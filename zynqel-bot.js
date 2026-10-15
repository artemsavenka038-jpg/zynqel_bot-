/* ============================================================================
 * ZYNQEL — Telegram-бот сигналов, версия 2
 *
 * Правила (проверены на истории 2024–2026, см. sim2/):
 *   • Основные монеты — только ЛОНГ: funding резко упал за последние 3 выплаты
 *     (Δ3 ≤ −0.012%). Режим BTC не важен (паника толпы — вход против неё).
 *   • Мемы — только ШОРТ: funding резко вырос (Δ3 ≥ +0.015%) или высокий (≥ 0.02%),
 *     и BTC ниже EMA50 по дневкам. Если BTC выше EMA50 — только «наблюдение».
 *   • Стоп по волатильности монеты: 2 × σ последних 20 восьмичасовых движений цены.
 *   • Цель 1 = 1R: закрыть 50%, стоп остатка в безубыток. Цель 2 = 3R: закрыть всё.
 *   • Не дольше 6 дней.
 *   • Одна позиция на монету; новый вход — только когда сигнал пропал и появился снова.
 *
 * Переменные окружения:
 *   BOT_TOKEN, CHAT_ID           — обязательно
 *   POLL_MINUTES (5)             — как часто проверять рынок
 *   SEND_WATCH (1)               — слать «наблюдение» (0 = только входы)
 *   WEEKLY_REPORT (1)            — итоги недели по понедельникам
 *   STATE_FILE                   — куда сохранять память (по умолчанию /data/… если есть диск)
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

// ---------- настройки стратегии ----------
const CORE = [ // только лонг
  { id: 'BTC', sym: 'BTCUSDT' }, { id: 'ETH', sym: 'ETHUSDT' }, { id: 'SOL', sym: 'SOLUSDT' },
  { id: 'XRP', sym: 'XRPUSDT' }, { id: 'DOGE', sym: 'DOGEUSDT' }, { id: 'LINK', sym: 'LINKUSDT' },
  { id: 'TON', sym: 'TONUSDT' }, { id: 'LTC', sym: 'LTCUSDT' }, { id: 'NEAR', sym: 'NEARUSDT' },
];
const MEMES = [ // только шорт; цена за 1000 монет, как на фьючерсах
  { id: '1000PEPE', sym: '1000PEPEUSDT' }, { id: '1000SHIB', sym: '1000SHIBUSDT' },
  { id: '1000FLOKI', sym: '1000FLOKIUSDT' }, { id: '1000BONK', sym: '1000BONKUSDT' },
];
const COINS = CORE.map(c => Object.assign({ kind: 'core' }, c)).concat(MEMES.map(c => Object.assign({ kind: 'meme' }, c)));

const RULES = {
  longDrop: -0.00012,  // Δ3 funding для лонга основных
  shortRise: 0.00015,  // Δ3 funding для шорта мемов
  highLevel: 0.0002,   // или просто высокий funding
  maxGapMs: 25 * 3600 * 1000, // 3 выплаты подряд без дыр
  emaPeriod: 50,
  volN: 20, stopSigma: 2,
  t1R: 1, finalR: 3, partial: 0.5,
  holdMs: 6 * 24 * 3600 * 1000,
};

// ---------- чистая логика (её же проверяют тесты) ----------

/* fund — массив {t, fr} по возрастанию времени (последние выплаты).
 * btcBear — true/false, или null если режим BTC неизвестен. */
function computeSignal(fund, kind, btcBear) {
  if (!fund || fund.length < 4) return { state: 'wait', why: 'мало истории funding' };
  const a = fund[fund.length - 1], b = fund[fund.length - 4];
  if (a.t - b.t > RULES.maxGapMs) return { state: 'wait', why: 'дыра в истории funding' };
  const f = a.fr, d3 = a.fr - b.fr;
  if (kind === 'core') {
    if (d3 <= RULES.longDrop) return { state: 'buy', dir: 'long', f, d3 };
    return { state: 'wait', f, d3 };
  }
  const raw = d3 >= RULES.shortRise || f >= RULES.highLevel;
  if (!raw) return { state: 'wait', f, d3 };
  if (btcBear === null || btcBear === undefined) return { state: 'wait', f, d3, why: 'режим BTC неизвестен' };
  if (btcBear) return { state: 'sell', dir: 'short', f, d3 };
  return { state: 'watch_short', f, d3 };
}

/* closes — дневные закрытия BTC (только ЗАКРЫТЫЕ дни), по возрастанию. */
function btcIsBear(closes) {
  const p = RULES.emaPeriod;
  if (!closes || closes.length < p + 1) return null;
  let e = 0; for (let i = 0; i < p; i++) e += closes[i]; e /= p;
  const k = 2 / (p + 1);
  for (let j = p; j < closes.length; j++) e = closes[j] * k + e * (1 - k);
  return { bear: closes[closes.length - 1] < e, close: closes[closes.length - 1], ema: e };
}

/* closes8h — закрытия 8-часовых свечей (закрытые), последняя = цена на момент выплаты. */
function stopDistance(closes8h, price) {
  const n = RULES.volN;
  if (!closes8h || closes8h.length < n + 1) return null;
  const c = closes8h.slice(-(n + 1));
  const r = []; for (let i = 1; i < c.length; i++) r.push(c[i] / c[i - 1] - 1);
  const m = r.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(r.reduce((s, x) => s + (x - m) * (x - m), 0) / n);
  const risk = RULES.stopSigma * sd * price;
  return risk > 0 ? risk : null;
}

function openPosition(coin, dir, price, risk, now) {
  const s = dir === 'long' ? 1 : -1;
  return {
    id: coin.id, kind: coin.kind, dir, entry: price, risk, openedAt: now,
    stop: price - s * risk, t1: price + s * RULES.t1R * risk, tF: price + s * RULES.finalR * risk,
    half: false, open: 1, realized: 0,
  };
}

/* Обновляет позицию по текущей цене. Возвращает {events:[...], closed:bool}. */
function updatePosition(p, price, now) {
  const s = p.dir === 'long' ? 1 : -1;
  const pnl = x => s * (x - p.entry) / p.entry;
  const ev = [];
  const close = (type) => {
    p.realized += p.open * pnl(price); p.open = 0;
    p.closedAt = now; p.exit = price; p.result = p.realized; p.outcome = type;
    ev.push({ type, price, result: p.realized });
    return { events: ev, closed: true };
  };
  if (s * (price - p.stop) <= 0) return close(p.half ? 'breakeven' : 'stop');
  if (s * (price - p.tF) >= 0) return close('target2');
  if (!p.half && s * (price - p.t1) >= 0) {
    p.realized += RULES.partial * pnl(price); p.open = 1 - RULES.partial;
    p.half = true; p.stop = p.entry;
    ev.push({ type: 'target1', price, part: pnl(price) });
  }
  if (now - p.openedAt >= RULES.holdMs) return close('time');
  return { events: ev, closed: false };
}

// ---------- оформление сообщений ----------
function fmtPrice(p) {
  if (p == null || !isFinite(p)) return '—';
  const a = Math.abs(p);
  if (a >= 1000) return '$' + p.toFixed(2);
  if (a >= 1) return '$' + p.toFixed(4);
  return '$' + p.toPrecision(5);
}
const pct = (x, d = 2) => (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(d) + '%';
const fpct = x => (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(4) + '%';

function msgEntry(p, sig) {
  const long = p.dir === 'long';
  const stopPct = p.risk / p.entry;
  const size = Math.min(100, 1 / (stopPct * 100) * 100); // % депозита при риске 1%
  return (long ? '🟢' : '🔴') + ` <b>${p.id} — ${long ? 'ЛОНГ' : 'ШОРТ'}</b>\n` +
    `Вход: <b>${fmtPrice(p.entry)}</b>\n` +
    `Стоп: ${fmtPrice(p.stop)} (${(stopPct * 100).toFixed(1)}%)\n` +
    `Цель 1: ${fmtPrice(p.t1)} → закрыть 50%, стоп в безубыток\n` +
    `Цель 2: ${fmtPrice(p.tF)} → закрыть остаток\n` +
    `Держим не дольше 6 дней\n` +
    `Funding ${fpct(sig.f)} (за 3 выплаты ${fpct(sig.d3)})\n` +
    `Риск 1% депозита → позиция ≈ ${size.toFixed(0)}% депозита\n` +
    `<i>Не финансовая рекомендация.</i>`;
}
function msgEvent(p, e) {
  if (e.type === 'target1') return `🎯 <b>${p.id}</b> — цель 1 @ ${fmtPrice(e.price)}: закрываем 50% (${pct(e.part)}), стоп остатка в безубыток ${fmtPrice(p.entry)}.`;
  if (e.type === 'target2') return `🎯🎯 <b>${p.id}</b> — цель 2 @ ${fmtPrice(e.price)}. Сделка закрыта, итог ${pct(e.result)}.`;
  if (e.type === 'breakeven') return `⚖️ <b>${p.id}</b> — остаток закрыт в безубытке @ ${fmtPrice(e.price)}. Итог сделки ${pct(e.result)} (за счёт цели 1).`;
  if (e.type === 'stop') return `🛑 <b>${p.id}</b> — стоп @ ${fmtPrice(e.price)}. Итог ${pct(e.result)}.`;
  if (e.type === 'time') return `⏱ <b>${p.id}</b> — 6 дней прошло, закрываем @ ${fmtPrice(e.price)}. Итог сделки ${pct(e.result)}.`;
  return null;
}
function msgWatch(c, sig) {
  return `🟡 <b>${c.id} — наблюдение за ШОРТОМ</b>\nFunding ${fpct(sig.f)} (за 3 выплаты ${fpct(sig.d3)}). Перегрев есть, но BTC выше EMA50 — вход не даём, ждём.`;
}
function msgWeek(closed) {
  if (!closed.length) return '📊 <b>Итоги недели</b>\nЗакрытых сделок не было.';
  const wins = closed.filter(t => t.result > 0).length;
  const sum = closed.reduce((s, t) => s + t.result, 0);
  const lines = closed.map(t => `${t.result > 0 ? '✅' : (t.result === 0 ? '▫️' : '❌')} ${t.id} ${t.dir === 'long' ? 'лонг' : 'шорт'} ${pct(t.result)}`);
  return `📊 <b>Итоги недели</b>\nСделок: ${closed.length}, в плюс: ${wins}\n` +
    `Средний результат: ${pct(sum / closed.length)} на сделку (без комиссий)\n\n` + lines.join('\n');
}

// ---------- память ----------
function defaultStateFile() {
  if (process.env.STATE_FILE) return process.env.STATE_FILE;
  try { if (fs.statSync('/data').isDirectory()) return '/data/zynqel-state.json'; } catch (e) {}
  return path.join(__dirname, 'zynqel-state.json');
}
function loadState(file) {
  try { const s = JSON.parse(fs.readFileSync(file, 'utf8')); s.loaded = true; return s; }
  catch (e) { return { lastState: {}, positions: {}, closed: [], btc: null, lastReport: null, loaded: false }; }
}
function saveState(file, st) {
  try {
    const copy = Object.assign({}, st); delete copy.loaded;
    fs.writeFileSync(file + '.tmp', JSON.stringify(copy));
    fs.renameSync(file + '.tmp', file);
  } catch (e) { console.error('Не удалось сохранить память:', e.message); }
}

// ---------- один проход по рынку (зависимости передаются снаружи — так его можно тестировать) ----------
/* io: { getFunding(sym) → [{t,fr}], getBtcCloses() → [closes], getCloses8h(sym) → [closes],
 *       getPrices() → {SYM: price}, send(text), now() } */
async function tick(st, io, opts) {
  const sendWatch = opts.sendWatch !== false;
  const silent = !!opts.silent;
  const now = io.now();
  const out = [];
  const send = async (t) => { out.push(t); if (!silent) await io.send(t); };

  const btc = btcIsBear(await io.getBtcCloses());
  const btcBear = btc ? btc.bear : null;
  if (btc && st.btc !== null && st.btc !== undefined && st.btc !== btc.bear && !silent) {
    await send(btc.bear
      ? '📉 <b>BTC ушёл ниже EMA50</b> (дневки). Шорты мемов включены.'
      : '📈 <b>BTC поднялся выше EMA50</b> (дневки). Шорты мемов на паузе, по ним только наблюдение.');
  }
  if (btc) st.btc = btc.bear;

  const prices = await io.getPrices();
  for (const c of COINS) {
    try {
      const price = prices[c.sym];
      if (!price) continue;
      const pos = st.positions[c.id];
      if (pos) { // позиция открыта — ведём её, новых сигналов по монете не даём
        if (silent) continue;
        const r = updatePosition(pos, price, now);
        for (const e of r.events) await send(msgEvent(pos, e));
        if (r.closed) {
          st.closed.push({ id: pos.id, dir: pos.dir, entry: pos.entry, exit: pos.exit, result: pos.result, outcome: pos.outcome, openedAt: pos.openedAt, closedAt: pos.closedAt });
          if (st.closed.length > 500) st.closed = st.closed.slice(-500);
          delete st.positions[c.id];
        }
        continue;
      }
      const sig = computeSignal(await io.getFunding(c.sym), c.kind, btcBear);
      const prev = st.lastState[c.id];
      st.lastState[c.id] = sig.state;
      if (silent || sig.state === prev) continue;
      if (sig.state === 'buy' || sig.state === 'sell') {
        const risk = stopDistance(await io.getCloses8h(c.sym), price);
        if (!risk) continue;
        const p = openPosition(c, sig.dir, price, risk, now);
        st.positions[c.id] = p;
        await send(msgEntry(p, sig));
      } else if (sig.state === 'watch_short' && sendWatch) {
        await send(msgWatch(c, sig));
      }
    } catch (e) {
      console.error('  ' + c.id + ':', e.message);
    }
  }

  // итоги недели: понедельник, после 07:00 UTC, один раз
  if (opts.weekly !== false && !silent) {
    const d = new Date(now);
    const key = d.toISOString().slice(0, 10);
    if (d.getUTCDay() === 1 && d.getUTCHours() >= 7 && st.lastReport !== key) {
      const from = now - 7 * 24 * 3600 * 1000;
      await send(msgWeek(st.closed.filter(t => t.closedAt >= from)));
      st.lastReport = key;
    }
  }
  return { btc, messages: out };
}

// ---------- работа с Binance и Telegram ----------
const FAPI = 'https://fapi.binance.com';
async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'zynqel-bot/2' } });
  if (r.status === 451 || r.status === 403) throw new Error(`Binance отказал (${r.status}). Сервер должен быть в Европе: Railway → Settings → Region.`);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.json();
}
function closedOnly(klines, now) { return klines.filter(k => +k[6] < now).map(k => parseFloat(k[4])); }
function liveIO(token, chatId) {
  return {
    now: () => Date.now(),
    getFunding: async sym => (await getJson(`${FAPI}/fapi/v1/fundingRate?symbol=${sym}&limit=10`))
      .map(x => ({ t: +x.fundingTime, fr: parseFloat(x.fundingRate) })).filter(x => isFinite(x.fr)).sort((a, b) => a.t - b.t),
    getBtcCloses: async () => closedOnly(await getJson(`${FAPI}/fapi/v1/klines?symbol=BTCUSDT&interval=1d&limit=400`), Date.now()),
    getCloses8h: async sym => closedOnly(await getJson(`${FAPI}/fapi/v1/klines?symbol=${sym}&interval=8h&limit=25`), Date.now()),
    getPrices: async () => {
      const all = await getJson(`${FAPI}/fapi/v1/premiumIndex`);
      const m = {}; all.forEach(x => { m[x.symbol] = parseFloat(x.markPrice); }); return m;
    },
    send: async text => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
        });
        if (r.ok) { await new Promise(res => setTimeout(res, 400)); return; }
        const body = await r.json().catch(() => ({}));
        if (r.status === 429 && body.parameters && body.parameters.retry_after) {
          await new Promise(res => setTimeout(res, (body.parameters.retry_after + 1) * 1000)); continue;
        }
        console.error('Telegram ошибка', r.status, JSON.stringify(body));
        return;
      }
    },
  };
}

async function main() {
  const token = process.env.BOT_TOKEN, chatId = process.env.CHAT_ID;
  if (!token || !chatId) { console.error('❌ Нужны переменные BOT_TOKEN и CHAT_ID.'); process.exit(1); }
  if (typeof fetch !== 'function') { console.error('❌ Нужен Node 18 или новее.'); process.exit(1); }
  const pollMs = Math.max(1, parseInt(process.env.POLL_MINUTES || '5', 10)) * 60 * 1000;
  const opts = { sendWatch: process.env.SEND_WATCH !== '0', weekly: process.env.WEEKLY_REPORT !== '0' };
  const file = defaultStateFile();
  const st = loadState(file);
  const io = liveIO(token, chatId);
  console.log(`ZYNQEL бот v2. Память: ${file} (${st.loaded ? 'загружена' : 'новая'}). Проверка каждые ${pollMs / 60000} мин.`);

  if (!st.loaded) {
    // Первый запуск без памяти: запоминаем текущие сигналы молча, чтобы не прислать старые входы.
    try { await tick(st, io, Object.assign({}, opts, { silent: true })); console.log('Прогрев: текущие сигналы запомнены без отправки.'); }
    catch (e) { console.error('Прогрев не удался:', e.message); }
    saveState(file, st);
  }
  await io.send('✅ <b>ZYNQEL бот v2 запущен.</b>\nЛонги основных монет на резком падении funding, шорты мемов при медвежьем BTC. Стоп по волатильности, 50% на первой цели, до 6 дней. Итоги недели по понедельникам.\n<i>Не финансовая рекомендация.</i>');

  const loop = async () => {
    try {
      const r = await tick(st, io, opts);
      saveState(file, st);
      const open = Object.keys(st.positions);
      console.log(`[${new Date().toISOString()}] BTC ${r.btc ? (r.btc.bear ? 'ниже' : 'выше') + ' EMA50' : 'неизвестно'} · открыто: ${open.length ? open.join(', ') : 'нет'} · сообщений: ${r.messages.length}`);
    } catch (e) { console.error('Ошибка прохода:', e.message); }
    setTimeout(loop, pollMs);
  };
  loop();
}

module.exports = { RULES, COINS, computeSignal, btcIsBear, stopDistance, openPosition, updatePosition, tick, msgEntry, msgEvent, msgWeek, fmtPrice };
if (require.main === module) main();
