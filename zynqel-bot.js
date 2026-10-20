/* ============================================================================
 * ZYNQEL — Telegram-бот сигналов, версия 2.7
 *
 * v2.7 (проверено на независимых данных июль 2021 – окт 2026, см. sim2/):
 *   • Лонги основных только в будни (UTC пн–пт): входы в субботу/воскресенье хуже во всех периодах.
 *   • Лонги основных держим не дольше 3 дней (шорты мемов — 6).
 *   • Риск 0.5% на любой сигнал: 🔥 сильные на независимых данных не лучше обычных.
 *   • Отсеянные сигналы (выходные, 0 баллов) бот ведёт «на бумаге» — так правила проверяются на живых данных.
 *   • К каждому сигналу записывается премия Coinbase (спрос из США) — только для будущей проверки, на сделки не влияет.
 *   • /history — бот сам скачивает из архива Binance историю открытого интереса и лонг/шорт с декабря 2021.
 *
 * Правила (проверены на истории 2024–2026, см. sim2/):
 *   • Основные монеты — только ЛОНГ: funding за 24 часа упал необычно сильно для этой монеты
 *     (больше 2σ от её обычных суточных изменений за последние ~30 дней). Режим BTC не важен (паника толпы — вход против неё).
 *   • Мемы (PEPE, SHIB, FLOKI) — только ШОРТ: funding за 24 часа вырос необычно сильно (больше 2σ),
 *     и BTC ниже EMA50 по дневкам. Если BTC выше EMA50 — только «наблюдение».
 *   • Стоп по волатильности монеты: 2 × σ последних 20 восьмичасовых движений цены.
 *   • Цель 1 = 1R: закрыть 50%, стоп остатка в безубыток. Цель 2 = 3R: закрыть всё.
 *   • Лонги не дольше 3 дней, шорты мемов не дольше 6.
 *   • Одна позиция на монету; новый вход — только когда сигнал пропал и появился снова.
 *   • Оценка по факторам движения (см. scoreSignal): 0 баллов — пропуск, все — 🔥 сильный, иначе обычный. Риск всегда 0.5%.
 *
 * Переменные окружения:
 *   BOT_TOKEN, CHAT_ID           — обязательно
 *   POLL_MINUTES (5)             — как часто проверять рынок
 *   SEND_WATCH (1)               — слать «наблюдение» (0 = только входы)
 *   WEEKLY_REPORT (1)            — итоги недели по понедельникам
 *   ADMIN_CHAT_ID                — твой личный chat id: команды /stats и /data в личке бота
 *   MEME_SHORTS (1)              — 0 = выключить шорты мемов
 *   ONLY_STRONG (0)              — 1 = присылать только 🔥 сильные сигналы
 *   WEEKEND_LONGS (0)            — 1 = открывать лонги и в выходные (как до v2.7)
 *   STATE_FILE                   — куда сохранять память (по умолчанию /data/… если есть диск)
 *
 * Дополнительно (v2.1): раз в 6 часов бот сохраняет часовой открытый интерес (OI),
 * соотношения лонгов/шортов и taker-поток по всем монетам — для будущей проверки идеи
 * «funding + OI». На сигналы это пока не влияет.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const VERSION = '2.7';

// ---------- настройки стратегии ----------
const CORE = [ // только лонг
  { id: 'BTC', sym: 'BTCUSDT' }, { id: 'ETH', sym: 'ETHUSDT' }, { id: 'SOL', sym: 'SOLUSDT' },
  { id: 'XRP', sym: 'XRPUSDT' }, { id: 'DOGE', sym: 'DOGEUSDT' }, { id: 'LINK', sym: 'LINKUSDT' },
  { id: 'LTC', sym: 'LTCUSDT' }, { id: 'NEAR', sym: 'NEARUSDT' },
  // TON убран в v2.2: выплаты funding раз в 4 часа, после правильного пересчёта преимущества нет
];
const MEMES = [ // только шорт; цена за 1000 монет, как на фьючерсах
  { id: '1000PEPE', sym: '1000PEPEUSDT' }, { id: '1000SHIB', sym: '1000SHIBUSDT' },
  { id: '1000FLOKI', sym: '1000FLOKIUSDT' },
  // BONK убран в v2.4: выплаты раз в 4 часа и минус на собственной истории
];
const COINS = CORE.map(c => Object.assign({ kind: 'core' }, c)).concat(MEMES.map(c => Object.assign({ kind: 'meme' }, c)));

const RULES = {
  zThr: 2,             // лонг основных: падение funding за сутки сильнее 2σ от обычного для монеты; шорт мемов: рост сильнее 2σ
  zWindow: 90, zMin: 30, // «обычное» = последние 90 выплат (~30 дней)
  maxGapMs: 25 * 3600 * 1000, // 3 выплаты подряд без дыр
  emaPeriod: 50,
  volN: 20, stopSigma: 2,
  t1R: 1, finalR: 3, partial: 0.5,
  holdMs: 6 * 24 * 3600 * 1000,     // шорты мемов (и по умолчанию)
  holdCoreMs: 3 * 24 * 3600 * 1000, // лонги основных (v2.7)
  riskPct: 0.5,                     // риск на сделку, % депозита (v2.7: одинаковый для всех сигналов)
};
const DAY_MS = 24 * 3600 * 1000;
const isWeekend = t => { const d = new Date(t).getUTCDay(); return d === 0 || d === 6; };

// ---------- чистая логика (её же проверяют тесты) ----------

/* fund — массив {t, fr} по возрастанию времени (последние выплаты).
 * btcBear — true/false, или null если режим BTC неизвестен.
 * Пороги подобраны под выплаты раз в 8 часов. Если биржа перевела монету на выплаты раз в 4 часа
 * (или 1 час), ставки пересчитываются к 8-часовым, а изменение берётся за те же 24 часа. */
const HOUR = 3600 * 1000;
const okIv = h => h >= 1 && h <= 8;
function funding8h(fund) {
  // берём только последний непрерывный кусок истории (без дыр)
  let s = fund.length - 1;
  while (s > 0 && okIv(Math.round((fund[s].t - fund[s - 1].t) / HOUR))) s--;
  const out = [];
  for (let i = s; i < fund.length; i++) {
    let iv = i > s ? Math.round((fund[i].t - fund[i - 1].t) / HOUR) : null;
    if (!iv && i + 1 < fund.length) iv = Math.round((fund[i + 1].t - fund[i].t) / HOUR);
    if (!iv || !okIv(iv)) return [];
    out.push({ t: fund[i].t, fr: fund[i].fr * 8 / iv });
  }
  return out;
}
function drop24(n8, idx) { // изменение ставки за 24 часа для выплаты idx
  const x = n8[idx];
  for (let k = idx - 1; k >= 0 && x.t - n8[k].t <= RULES.maxGapMs; k--) if (x.t - n8[k].t >= 23 * HOUR) return x.fr - n8[k].fr;
  return null;
}
function computeSignal(fund, kind, btcBear) {
  if (!fund || fund.length < 4) return { state: 'wait', why: 'мало истории funding' };
  const n8 = funding8h(fund);
  const a = n8[n8.length - 1];
  let b = null; // последняя выплата, которая была 23+ часа назад
  for (let i = n8.length - 2; i >= 0; i--) if (a.t - n8[i].t >= 23 * HOUR) { b = n8[i]; break; }
  if (!a || !b) return { state: 'wait', why: 'мало истории funding' };
  if (a.t - b.t > RULES.maxGapMs) return { state: 'wait', why: 'дыра в истории funding' };
  const f = a.fr, d3 = a.fr - b.fr;
  // Насколько это изменение необычно именно для этой монеты (у BTC funding ходит меньше, чем у NEAR или PEPE)
  const d = [];
  for (let j = Math.max(0, n8.length - 1 - RULES.zWindow); j < n8.length - 1; j++) { const v = drop24(n8, j); if (v !== null) d.push(v); }
  if (d.length < RULES.zMin) return { state: 'wait', f, d3, why: 'мало истории funding для оценки' };
  const m = d.reduce((u, v) => u + v, 0) / d.length;
  const sd = Math.sqrt(d.reduce((u, v) => u + (v - m) * (v - m), 0) / d.length) || 1e-9;
  const z = (d3 - m) / sd;
  if (kind === 'core') { // основные: только лонг, режим BTC не важен
    if (z <= -RULES.zThr) return { state: 'buy', dir: 'long', f, d3, z };
    return { state: 'wait', f, d3, z };
  }
  // мемы: только шорт, funding вырос необычно сильно, и BTC ниже EMA50
  if (z < RULES.zThr) return { state: 'wait', f, d3, z };
  if (btcBear === null || btcBear === undefined) return { state: 'wait', f, d3, z, why: 'режим BTC неизвестен' };
  if (btcBear) return { state: 'sell', dir: 'short', f, d3, z };
  return { state: 'watch_short', f, d3, z };
}

/* Сила сигнала по вчерашнему потоку сделок (дневные свечи: объём и объём агрессивных покупок).
 * days — закрытые дневные свечи {v, tb} по возрастанию; последняя = вчера.
 * Лонг сильный, если вчера доля агрессивных покупок была НИЖЕ своей средней за 20 дней (продавцы давили).
 * Шорт сильный, если ВЫШЕ (покупатели гнались). На истории и свежих данных сильные сигналы заметно лучше. */
function flowGrade(days, kind) {
  if (!days || days.length < 16) return null;
  const y = days[days.length - 1];
  if (!(y.v > 0 && y.tb > 0)) return null;
  let ss = 0, n = 0;
  for (let k = 2; k <= 21 && days.length - k >= 0; k++) { const x = days[days.length - k]; if (x.v > 0 && x.tb > 0) { ss += x.tb / x.v; n++; } }
  if (n < 15) return null;
  const share = y.tb / y.v, avg = ss / n;
  return { share, avg, strong: kind === 'core' ? share < avg : share > avg };
}

/* Оценка сигнала по нескольким факторам движения (каждый +1 балл). Проверены на истории и на свежих данных:
 *   лонг: funding упал очень сильно (z ≤ −3) · цена упала за 3 дня · вчера продавцы давили
 *   шорт мема: вчера покупатели гнались · BTC рос 3 дня
 * 0 баллов → сигнал пропускаем (исторически около нуля); все баллы → 🔥 сильный; иначе обычный.
 * days — закрытые дневные свечи монеты {c, v, tb}; btcCloses — закрытия BTC; оба по возрастанию. */
function scoreSignal(sig, kind, days, btcCloses) {
  const fl = flowGrade(days, kind);
  const pctTxt = x => (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(1) + '%';
  const f = [];
  if (kind === 'core') {
    const ret3 = days && days.length >= 4 ? days[days.length - 1].c / days[days.length - 4].c - 1 : null;
    f.push({ ok: sig.z != null && sig.z <= -3, text: `падение funding очень сильное (${sig.z != null ? (sig.z < 0 ? '−' : '+') + Math.abs(sig.z).toFixed(1) : '?'}σ, нужно −3σ)` });
    f.push({ ok: ret3 != null && ret3 < 0, text: `цена за 3 дня ${ret3 != null ? pctTxt(ret3) : '?'}` + (ret3 != null && ret3 < 0 ? ' (откат)' : '') });
    f.push({ ok: !!(fl && fl.strong), text: fl ? `вчера продавцы ${fl.strong ? 'давили' : 'не давили'} (агрессивные покупки ${(fl.share * 100).toFixed(1)}%, обычно ${(fl.avg * 100).toFixed(1)}%)` : 'поток сделок: нет данных' });
  } else {
    const b3 = btcCloses && btcCloses.length >= 4 ? btcCloses[btcCloses.length - 1] / btcCloses[btcCloses.length - 4] - 1 : null;
    f.push({ ok: !!(fl && fl.strong), text: fl ? `вчера покупатели ${fl.strong ? 'гнались' : 'не гнались'} (агрессивные покупки ${(fl.share * 100).toFixed(1)}%, обычно ${(fl.avg * 100).toFixed(1)}%)` : 'поток сделок: нет данных' });
    f.push({ ok: b3 != null && b3 > 0, text: `BTC за 3 дня ${b3 != null ? pctTxt(b3) : '?'}` });
  }
  const score = f.filter(x => x.ok).length;
  return { score, max: f.length, factors: f, grade: score === 0 ? 'skip' : (score === f.length ? 'strong' : 'normal') };
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
    holdMs: coin.kind === 'core' ? RULES.holdCoreMs : RULES.holdMs,
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
  if (now - p.openedAt >= (p.holdMs || RULES.holdMs)) return close('time');
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
  const strong = p.grade === 'strong';
  const riskPct = RULES.riskPct; // v2.7: одинаковый риск — 🔥 на независимых данных не лучше обычных
  const size = Math.min(100, riskPct / (stopPct * 100) * 100); // % депозита при выбранном риске
  const holdDays = Math.round((p.holdMs || RULES.holdMs) / DAY_MS);
  const cbLine = p.cbPrem != null ? `ℹ️ Премия Coinbase ${p.cbPrem >= 0 ? '+' : '−'}${Math.abs(p.cbPrem * 100).toFixed(3)}%` +
    (p.cbAvg != null ? ` (средняя за 20 дней ${p.cbAvg >= 0 ? '+' : '−'}${Math.abs(p.cbAvg * 100).toFixed(3)}%: спрос из США ${p.cbPrem > p.cbAvg ? 'растёт' : 'слабеет'})` : '') + ' — для статистики, на сделку не влияет\n' : '';
  const sc = p.scoreInfo;
  const gradeLine = (strong ? `🔥 <b>Сильный сигнал</b>` : `Обычный сигнал`) + (sc ? ` · ${sc.score} из ${sc.max}` : '') + '\n' +
    (sc ? sc.factors.map(x => `${x.ok ? '✅' : '▫️'} ${x.text}`).join('\n') + '\n' : '');
  return (long ? '🟢' : '🔴') + ` <b>${p.id} — ${long ? 'ЛОНГ' : 'ШОРТ'}</b>\n` +
    `Вход: <b>${fmtPrice(p.entry)}</b>\n` +
    `Стоп: ${fmtPrice(p.stop)} (${(stopPct * 100).toFixed(1)}%)\n` +
    `Цель 1: ${fmtPrice(p.t1)} → закрыть 50%, стоп в безубыток\n` +
    `Цель 2: ${fmtPrice(p.tF)} → закрыть остаток\n` +
    `Держим не дольше ${holdDays} дней\n` +
    `Funding ${fpct(sig.f)} (за сутки ${fpct(sig.d3)}` + (sig.z != null ? `, необычно сильно для ${p.id}: ${sig.z < 0 ? '−' : '+'}${Math.abs(sig.z).toFixed(1)}σ` : '') + `)\n` +
    gradeLine + cbLine +
    `Риск ${riskPct}% депозита → позиция ≈ ${size.toFixed(0)}% депозита\n` +
    `<i>Не финансовая рекомендация.</i>`;
}
function msgEvent(p, e) {
  if (e.type === 'target1') return `🎯 <b>${p.id}</b> — цель 1 @ ${fmtPrice(e.price)}: закрываем 50% (${pct(e.part)}), стоп остатка в безубыток ${fmtPrice(p.entry)}.`;
  if (e.type === 'target2') return `🎯🎯 <b>${p.id}</b> — цель 2 @ ${fmtPrice(e.price)}. Сделка закрыта, итог ${pct(e.result)}.`;
  if (e.type === 'breakeven') return `⚖️ <b>${p.id}</b> — остаток закрыт в безубытке @ ${fmtPrice(e.price)}. Итог сделки ${pct(e.result)} (за счёт цели 1).`;
  if (e.type === 'stop') return `🛑 <b>${p.id}</b> — стоп @ ${fmtPrice(e.price)}. Итог ${pct(e.result)}.`;
  if (e.type === 'time') return `⏱ <b>${p.id}</b> — ${Math.round((p.holdMs || RULES.holdMs) / DAY_MS)} дня прошло, закрываем @ ${fmtPrice(e.price)}. Итог сделки ${pct(e.result)}.`.replace('6 дня', '6 дней');
  return null;
}
function msgWatch(c, sig) {
  return `🟡 <b>${c.id} — наблюдение за ШОРТОМ</b>\nFunding ${fpct(sig.f)} (за сутки ${fpct(sig.d3)}). Перегрев есть, но BTC выше EMA50 — вход не даём, ждём.`;
}
/* Сводка по сделкам «на бумаге» (сигналы, которые бот отсеял): чтобы видеть, правильно ли отсеивает. */
function shadowSummary(list) {
  const out = [];
  for (const [key, nm] of [['weekend', 'выходные'], ['score0', '0 баллов']]) {
    const v = list.filter(t => t.skip === key);
    if (v.length) out.push(`${nm}: ${v.length}, в плюс ${v.filter(t => t.result > 0).length}, средне ${pct(v.reduce((s, t) => s + t.result, 0) / v.length)}`);
  }
  return out.join(' · ');
}
function msgWeek(closed, shadow) {
  const sh = shadow && shadow.length ? `\n\n<i>Отсеянные сигналы «на бумаге»: ${shadowSummary(shadow)}</i>` : '';
  if (!closed.length) return '📊 <b>Итоги недели</b>\nЗакрытых сделок не было.' + sh;
  const wins = closed.filter(t => t.result > 0).length;
  const sum = closed.reduce((s, t) => s + t.result, 0);
  const lines = closed.map(t => `${t.result > 0 ? '✅' : (t.result === 0 ? '▫️' : '❌')} ${t.grade === 'strong' ? '🔥' : ''}${t.id} ${t.dir === 'long' ? 'лонг' : 'шорт'} ${pct(t.result)}`);
  return `📊 <b>Итоги недели</b>\nСделок: ${closed.length}, в плюс: ${wins}\n` +
    `Средний результат: ${pct(sum / closed.length)} на сделку (без комиссий)\n\n` + lines.join('\n') + sh;
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

// ---------- сбор рыночных данных для будущих проверок ----------
// Binance хранит историю OI и соотношений лонг/шорт только 30 дней, поэтому бот копит её сам.
const MARKET_SERIES = [
  { key: 'oi', path: '/futures/data/openInterestHist', cols: ['oi', 'oi_usd'], pick: x => [+x.sumOpenInterest, +x.sumOpenInterestValue] },
  { key: 'ls', path: '/futures/data/globalLongShortAccountRatio', cols: ['ls_accounts'], pick: x => [+x.longShortRatio] },
  { key: 'top', path: '/futures/data/topLongShortPositionRatio', cols: ['ls_top_positions'], pick: x => [+x.longShortRatio] },
  { key: 'taker', path: '/futures/data/takerlongshortRatio', cols: ['taker_ratio', 'taker_buy', 'taker_sell'], pick: x => [+x.buySellRatio, +x.buyVol, +x.sellVol] },
];
const COLLECT_EVERY_MS = 6 * 3600 * 1000;

function mergeMarket(store, sym, series, rows) {
  const s = store[sym] || (store[sym] = {});
  let added = 0;
  for (const x of rows || []) {
    const t = +x.timestamp; if (!t) continue;
    const vals = series.pick(x); if (vals.some(v => !isFinite(v))) continue;
    const row = s[t] || (s[t] = {});
    if (!row[series.key]) added++;
    row[series.key] = vals;
  }
  return added;
}
async function collectMarket(store, io) {
  let added = 0, errors = 0;
  for (const c of COINS) {
    for (const ser of MARKET_SERIES) {
      try { added += mergeMarket(store, c.sym, ser, await io.getMarket(c.sym, ser.path)); }
      catch (e) { errors++; if (errors <= 3) console.error('  сбор ' + c.sym + ' ' + ser.key + ':', e.message); }
    }
  }
  return { added, errors };
}
function marketCsv(store) {
  const head = ['time_utc', 'coin'].concat(...MARKET_SERIES.map(s => s.cols));
  const lines = [head.join(',')];
  for (const c of COINS) {
    const s = store[c.sym] || {};
    for (const t of Object.keys(s).map(Number).sort((a, b) => a - b)) {
      const row = [new Date(t).toISOString(), c.id];
      for (const ser of MARKET_SERIES) row.push(...(s[t][ser.key] || ser.cols.map(() => '')));
      lines.push(row.join(','));
    }
  }
  return lines.join('\n') + '\n';
}
function marketSummary(store) {
  let n = 0, first = Infinity;
  for (const sym of Object.keys(store)) for (const t of Object.keys(store[sym])) { n++; first = Math.min(first, +t); }
  return n ? `${n} часовых точек с ${new Date(first).toISOString().slice(0, 10)}` : 'пока пусто';
}
/* Запись закрытой сделки (настоящей или «на бумаге») — одна форма для памяти, /stats и CSV. */
function closedRecord(p) {
  return { id: p.id, dir: p.dir, grade: p.grade || 'normal', score: p.score, z: p.z, trend20: p.trend20, entry: p.entry, exit: p.exit,
    result: p.result, outcome: p.outcome, openedAt: p.openedAt, closedAt: p.closedAt, holdMs: p.holdMs, cbPrem: p.cbPrem, cbAvg: p.cbAvg, skip: p.skip || null };
}
function tradesCsv(st) {
  const lines = ['type,opened_utc,closed_utc,coin,dir,grade,score,z,price_vs_sma20,cb_premium_pct,cb_premium_avg20_pct,hold_days,entry,exit,result_pct,outcome'];
  const n = (x, k) => x != null ? (x * 100).toFixed(k) : '';
  const row = (t, type) => [type, new Date(t.openedAt).toISOString(), new Date(t.closedAt).toISOString(), t.id, t.dir, t.grade || 'normal', t.score ?? '', t.z != null ? t.z.toFixed(2) : '',
    n(t.trend20, 2), n(t.cbPrem, 4), n(t.cbAvg, 4), t.holdMs ? Math.round(t.holdMs / DAY_MS) : '', t.entry, t.exit, (t.result * 100).toFixed(3), t.outcome].join(',');
  for (const t of st.closed) lines.push(row(t, 'real'));
  for (const t of st.shadowClosed || []) lines.push(row(t, 'skip_' + t.skip)); // отсеянные сигналы «на бумаге»
  return lines.join('\n') + '\n';
}

// ---------- история открытого интереса из архива Binance (data.binance.vision) ----------
/* Достаёт первый файл из zip (архивы Binance — один CSV внутри). */
function unzipFirst(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('zip: нет оглавления');
  const cd = buf.readUInt32LE(e + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error('zip: битое оглавление');
  const method = buf.readUInt16LE(cd + 10), size = buf.readUInt32LE(cd + 20), lh = buf.readUInt32LE(cd + 42);
  if (buf.readUInt32LE(lh) !== 0x04034b50) throw new Error('zip: битый заголовок файла');
  const start = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28);
  const data = buf.subarray(start, start + size);
  if (method === 0) return data;
  if (method === 8) return zlib.inflateRawSync(data);
  throw new Error('zip: неизвестный метод сжатия ' + method);
}
const METRICS_HEAD = ['create_time', 'symbol', 'sum_open_interest', 'sum_open_interest_value', 'count_toptrader_long_short_ratio',
  'sum_toptrader_long_short_ratio', 'count_long_short_ratio', 'sum_taker_long_short_vol_ratio'];
/* 5-минутные метрики за день → снимки на 00:00, 08:00, 16:00 UTC (как выплаты funding). */
function metricsSnapshots(text) {
  const lines = String(text).trim().split(/\r?\n/);
  let head = lines[0].split(',').map(s => s.trim()), first = 1;
  if (!head.includes('create_time')) { head = METRICS_HEAD; first = 0; }
  const ti = head.indexOf('create_time'), cols = head.map((h, i) => i).filter(i => i !== ti && head[i] !== 'symbol');
  const H8 = 8 * 3600 * 1000, got = new Set(), rows = [];
  for (let j = first; j < lines.length; j++) {
    const r = lines[j].split(','), raw = (r[ti] || '').trim();
    const t = /^\d+$/.test(raw) ? +raw : Date.parse(raw.replace(' ', 'T') + 'Z');
    if (!isFinite(t)) continue;
    const stamp = Math.floor(t / H8) * H8;
    if (t - stamp >= 10 * 60 * 1000 || got.has(stamp)) continue; // первая запись в течение 10 минут после отметки
    got.add(stamp); rows.push([stamp, ...cols.map(i => { const v = parseFloat(r[i]); return isFinite(v) ? v : null; })]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  return { cols: cols.map(i => head[i]), rows };
}
/* Скачивает дневные архивы метрик по всем монетам; продолжает с места остановки (прогресс в file). */
async function oiHistoryJob(file, io, opts = {}) {
  const st = loadJson(file, { done: {}, cols: null, data: {} });
  const from = opts.from || Date.UTC(2021, 11, 1), to = opts.to || (Math.floor(Date.now() / DAY_MS) * DAY_MS - DAY_MS);
  const coins = opts.coins || COINS, prog = opts.progress || {}, log = opts.log || (() => {});
  let files = 0, missing = 0, errors = 0, lastErr = '', sinceSave = 0;
  for (const c of coins) {
    st.data[c.sym] = st.data[c.sym] || [];
    let d = st.done[c.sym] ? st.done[c.sym] + DAY_MS : from;
    while (d <= to) {
      const batch = []; for (let k = 0; k < 8 && d <= to; k++, d += DAY_MS) batch.push(d);
      const res = await Promise.all(batch.map(async day => {
        const ds = new Date(day).toISOString().slice(0, 10);
        const url = `https://data.binance.vision/data/futures/um/daily/metrics/${c.sym}/${c.sym}-metrics-${ds}.zip`;
        for (let a = 0; a < 3; a++) {
          try { const buf = await io.getZip(url); return buf ? { snap: metricsSnapshots(unzipFirst(buf).toString('utf8')) } : { miss: true }; }
          catch (e) { if (a === 2) return { err: `${ds}: ${e.message}` }; await sleep((opts.retryMs ?? 1000) * (a + 1)); }
        }
      }));
      for (const r of res) {
        if (r.miss) missing++;
        else if (r.err) { errors++; lastErr = r.err; if (errors <= 5) log(`История ${c.sym} ${r.err}`); }
        else { files++; sinceSave++; st.cols = st.cols || r.snap.cols; st.data[c.sym].push(...r.snap.rows); }
      }
      if (errors >= 40 && files === 0) throw new Error(`архив Binance недоступен (${lastErr})`);
      st.done[c.sym] = batch[batch.length - 1];
      Object.assign(prog, { sym: c.sym, day: batch[batch.length - 1], files, missing, errors });
      if (sinceSave >= 300) { saveJson(file, st); sinceSave = 0; }
    }
    saveJson(file, st);
  }
  return { files, missing, errors, st };
}
function historyCsv(st) {
  const cols = st.cols || METRICS_HEAD.slice(2);
  const lines = [['time_utc', 'coin'].concat(cols).join(',')];
  for (const c of COINS) {
    const seen = new Set();
    for (const r of (st.data[c.sym] || []).slice().sort((a, b) => a[0] - b[0])) {
      if (seen.has(r[0])) continue; seen.add(r[0]);
      lines.push([new Date(r[0]).toISOString(), c.id].concat(r.slice(1).map(v => v == null ? '' : v)).join(','));
    }
  }
  return lines.join('\n') + '\n';
}

// ---------- команды в личке бота ----------
/* Возвращает список действий: {text} или {file:{name,content}}. Ничего не отправляет сам. */
function handleCommand(text, chatId, adminId, st, store) {
  const cmd = String(text || '').trim().split(/\s+/)[0].toLowerCase().replace(/@.*$/, '');
  const isAdmin = adminId && String(chatId) === String(adminId);
  const HELP = 'Команды: /stats — статистика сделок, /data — файлы с данными, /history — история открытого интереса с 2021 года (файлом), /id — твой chat id.';
  if (cmd === '/start' || cmd === '/id') {
    let t = `Твой chat id: <code>${chatId}</code>\n`;
    if (!adminId) t += 'Чтобы получать статистику и данные, впиши его в Railway → Variables → <b>ADMIN_CHAT_ID</b>. Бот перезапустится сам.';
    else if (isAdmin) t += 'Ты администратор. ' + HELP;
    else t += 'Это служебный бот канала ZYNQEL.';
    return [{ text: t }];
  }
  if (!isAdmin) { // подсказываем, почему нет доступа (чужой id админа не показываем)
    if (!adminId) return [{ text: `В настройках бота не указан ADMIN_CHAT_ID. Твой chat id: <code>${chatId}</code> — впиши его в Railway → Variables → <b>ADMIN_CHAT_ID</b>.` }];
    return [{ text: `Нет доступа: твой chat id <code>${chatId}</code> не совпадает с ADMIN_CHAT_ID в настройках бота. Если это ты — поправь ADMIN_CHAT_ID в Railway → Variables.` }];
  }
  if (cmd === '/history') return [{ history: true }];
  if (cmd === '/stats') {
    const c = st.closed;
    const open = Object.values(st.positions).map(p => `${p.id} ${p.dir === 'long' ? 'лонг' : 'шорт'} от ${fmtPrice(p.entry)}${p.half ? ' (цель 1 взята)' : ''}`);
    let t = '📊 <b>Статистика бота</b>\n';
    if (c.length) {
      const wins = c.filter(x => x.result > 0).length, sum = c.reduce((s, x) => s + x.result, 0);
      t += `Закрыто сделок: ${c.length}, в плюс: ${wins} (${(wins / c.length * 100).toFixed(0)}%)\n`;
      t += `Средний результат: ${pct(sum / c.length)} на сделку (без комиссий)\n`;
      for (const [g, nm] of [['strong', '🔥 сильные'], ['normal', 'обычные']]) {
        const v = c.filter(x => (x.grade || 'normal') === g);
        if (v.length) t += `${nm}: ${v.length} сделок, в плюс ${v.filter(x => x.result > 0).length}, средне ${pct(v.reduce((s, x) => s + x.result, 0) / v.length)}\n`;
      }
      t += 'Последние: ' + c.slice(-8).map(x => `${x.grade === 'strong' ? '🔥' : ''}${x.id} ${pct(x.result, 1)}`).join(', ') + '\n';
    } else t += 'Закрытых сделок пока нет.\n';
    t += `Открыто сейчас: ${open.length ? open.join('; ') : 'нет'}\n`;
    const sh = st.shadowClosed || [], shOpen = Object.keys(st.shadow || {});
    t += `Отсеянные «на бумаге»: ${sh.length ? shadowSummary(sh) : 'закрытых пока нет'}${shOpen.length ? ` (ведутся: ${shOpen.join(', ')})` : ''}\n`;
    t += `Рыночные данные (OI, лонг/шорт): ${marketSummary(store)}`;
    return [{ text: t }];
  }
  if (cmd === '/data') {
    const day = new Date().toISOString().slice(0, 10);
    return [
      { text: `Отправляю файлы. Рыночные данные: ${marketSummary(store)}. Сделок: ${st.closed.length}, отсеянных «на бумаге»: ${(st.shadowClosed || []).length}.` },
      { file: { name: `zynqel-market-${day}.csv`, content: marketCsv(store) } },
      { file: { name: `zynqel-trades-${day}.csv`, content: tradesCsv(st) } },
    ];
  }
  return [{ text: HELP }];
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

  const memeShorts = opts.memeShorts !== false;
  const btcCloses = await io.getBtcCloses();
  const btc = btcIsBear(btcCloses);
  const btcBear = btc ? btc.bear : null;
  if (memeShorts && btc && st.btc !== null && st.btc !== undefined && st.btc !== btc.bear && !silent) {
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
      const sh = st.shadow && st.shadow[c.id];
      if (sh && !silent) { // отсеянный сигнал ведём «на бумаге», без сообщений
        const r = updatePosition(sh, price, now);
        if (r.closed) {
          (st.shadowClosed = st.shadowClosed || []).push(closedRecord(sh));
          if (st.shadowClosed.length > 500) st.shadowClosed = st.shadowClosed.slice(-500);
          delete st.shadow[c.id];
        }
      }
      const pos = st.positions[c.id];
      if (c.kind === 'meme' && !memeShorts && !pos) continue; // шорты мемов выключены (уже открытую позицию доводим до конца)
      if (pos) { // позиция открыта — ведём её, новых сигналов по монете не даём
        if (silent) continue;
        const r = updatePosition(pos, price, now);
        for (const e of r.events) await send(msgEvent(pos, e));
        if (r.closed) {
          st.closed.push(closedRecord(pos));
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
        let days = null; try { days = await io.getDaily(c.sym); } catch (e) { console.error('  свечи ' + c.id + ':', e.message); }
        const sc = scoreSignal(sig, c.kind, days, btcCloses);
        p.grade = sc.grade; p.score = sc.score; p.scoreInfo = sc; p.z = sig.z;
        if (days && days.length >= 20) { const c20 = days.slice(-20).map(x => x.c); p.trend20 = days[days.length - 1].c / (c20.reduce((u, v) => u + v, 0) / 20) - 1; } // для будущей проверки «откат в тренде»
        if (io.getCbPremium) { try { const cb = await io.getCbPremium(); if (cb) { p.cbPrem = cb.p; p.cbAvg = cb.avg; } } catch (e) { console.error('  премия Coinbase:', e.message); } }
        let skip = null;
        if (sc.grade === 'skip') skip = 'score0';
        else if (c.kind === 'core' && !opts.weekendLongs && isWeekend(now)) skip = 'weekend';
        if (skip) {
          console.log(`  ${c.id}: ${skip === 'weekend' ? 'выходной, лонг не открываем' : `сигнал без подтверждающих факторов (0 из ${sc.max})`} — веду «на бумаге»`);
          st.shadow = st.shadow || {};
          if (!st.shadow[c.id]) { p.skip = skip; st.shadow[c.id] = p; }
          continue;
        }
        if (opts.onlyStrong && p.grade !== 'strong') continue; // режим «только сильные»: обычный сигнал пропускаем
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
      await send(msgWeek(st.closed.filter(t => t.closedAt >= from), (st.shadowClosed || []).filter(t => t.closedAt >= from)));
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
/* Премия Coinbase за вчера и её средняя за 20 дней до этого.
 * cbCandles — дневные свечи Coinbase BTC-USD [[время(сек), low, high, open, close, vol]...];
 * bnKlines — дневные свечи спота Binance BTCUSDT; today — начало сегодняшнего дня UTC (мс). */
function cbPremium(cbCandles, bnKlines, today) {
  const cb = new Map((cbCandles || []).map(x => [x[0] * 1000, +x[4]]));
  const bn = new Map((bnKlines || []).filter(k => +k[6] < today).map(k => [+k[0], +k[4]]));
  const prem = d => (cb.has(d) && bn.has(d) && bn.get(d) > 0) ? cb.get(d) / bn.get(d) - 1 : null;
  const y = today - DAY_MS, p = prem(y);
  if (p == null) return null;
  const past = []; for (let k = 1; k <= 20; k++) { const v = prem(y - k * DAY_MS); if (v != null) past.push(v); }
  return { p, avg: past.length >= 15 ? past.reduce((s, x) => s + x, 0) / past.length : null };
}
const TG = 'https://api.telegram.org/bot';
const sleep = ms => new Promise(res => setTimeout(res, ms));
function liveIO(token, chatId) {
  const tgCall = async (method, body, isForm) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(`${TG}${token}/${method}`, isForm ? { method: 'POST', body: body() }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      if (r.ok) return data;
      if (r.status === 429 && data.parameters && data.parameters.retry_after) { await sleep((data.parameters.retry_after + 1) * 1000); continue; }
      console.error('Telegram ошибка', method, r.status, JSON.stringify(data));
      return null;
    }
    return null;
  };
  const sendTo = async (to, text) => { await tgCall('sendMessage', { chat_id: to, text, parse_mode: 'HTML', disable_web_page_preview: true }); await sleep(400); };
  let cbCache = null;
  return {
    getCbPremium: async () => { // раз в день: Coinbase BTC-USD против спота Binance BTCUSDT
      const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;
      if (cbCache && cbCache.day === today) return cbCache.v;
      const start = new Date(today - 30 * DAY_MS).toISOString(), end = new Date(today).toISOString();
      const r = await fetch(`https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=${start}&end=${end}`, { headers: { 'User-Agent': 'zynqel-bot/' + VERSION } });
      if (!r.ok) throw new Error('Coinbase HTTP ' + r.status);
      const v = cbPremium(await r.json(), await getJson('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=40'), today);
      cbCache = { day: today, v }; return v;
    },
    getZip: async url => { // архив Binance: null, если файла нет
      const r = await fetch(url, { headers: { 'User-Agent': 'zynqel-bot/' + VERSION } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return Buffer.from(await r.arrayBuffer());
    },
    now: () => Date.now(),
    getFunding: async sym => (await getJson(`${FAPI}/fapi/v1/fundingRate?symbol=${sym}&limit=120`))
      .map(x => ({ t: +x.fundingTime, fr: parseFloat(x.fundingRate) })).filter(x => isFinite(x.fr)).sort((a, b) => a.t - b.t),
    getBtcCloses: async () => closedOnly(await getJson(`${FAPI}/fapi/v1/klines?symbol=BTCUSDT&interval=1d&limit=400`), Date.now()),
    getCloses8h: async sym => closedOnly(await getJson(`${FAPI}/fapi/v1/klines?symbol=${sym}&interval=8h&limit=25`), Date.now()),
    getPrices: async () => {
      const all = await getJson(`${FAPI}/fapi/v1/premiumIndex`);
      const m = {}; all.forEach(x => { m[x.symbol] = parseFloat(x.markPrice); }); return m;
    },
    getDaily: async sym => (await getJson(`${FAPI}/fapi/v1/klines?symbol=${sym}&interval=1d&limit=30`))
      .filter(k => +k[6] < Date.now()).map(k => ({ c: parseFloat(k[4]), v: parseFloat(k[5]), tb: parseFloat(k[9]) })),
    getMarket: async (sym, p) => { const d = await getJson(`${FAPI}${p}?symbol=${sym}&period=1h&limit=500`); await sleep(150); return d; },
    send: text => sendTo(chatId, text),
    sendTo,
    sendDocument: async (to, name, content) => tgCall('sendDocument', () => {
      const fd = new FormData();
      fd.append('chat_id', String(to));
      fd.append('document', new Blob([content], { type: 'text/csv' }), name);
      return fd;
    }, true),
    getUpdates: async offset => {
      const r = await fetch(`${TG}${token}/getUpdates?timeout=25&offset=${offset}&allowed_updates=${encodeURIComponent('["message"]')}`);
      if (r.status === 409) { await sleep(10000); return []; } // на минуту при перезапуске могут работать две копии
      const d = await r.json().catch(() => ({}));
      return d.ok ? d.result : [];
    },
  };
}

function marketFileFor(stateFile) { return path.join(path.dirname(stateFile), 'zynqel-market.json'); }
function loadJson(file, def) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return def; } }
function saveJson(file, obj) {
  try { fs.writeFileSync(file + '.tmp', JSON.stringify(obj)); fs.renameSync(file + '.tmp', file); }
  catch (e) { console.error('Не удалось сохранить', file, e.message); }
}

async function main() {
  const token = process.env.BOT_TOKEN, chatId = process.env.CHAT_ID;
  const adminId = (process.env.ADMIN_CHAT_ID || '').trim() || null;
  if (!token || !chatId) { console.error('❌ Нужны переменные BOT_TOKEN и CHAT_ID.'); process.exit(1); }
  if (typeof fetch !== 'function') { console.error('❌ Нужен Node 18 или новее.'); process.exit(1); }
  const pollMs = Math.max(1, parseInt(process.env.POLL_MINUTES || '5', 10)) * 60 * 1000;
  const opts = { sendWatch: process.env.SEND_WATCH !== '0', weekly: process.env.WEEKLY_REPORT !== '0', memeShorts: process.env.MEME_SHORTS !== '0', onlyStrong: process.env.ONLY_STRONG === '1', weekendLongs: process.env.WEEKEND_LONGS === '1' };
  const file = defaultStateFile();
  const st = loadState(file);
  const mfile = marketFileFor(file);
  const store = loadJson(mfile, {});
  const io = liveIO(token, chatId);
  const onDisk = file.startsWith('/data/');
  console.log(`ZYNQEL бот v${VERSION}. Память: ${file} (${st.loaded ? 'загружена' : 'новая'}${onDisk ? ', на диске Railway' : ', БЕЗ диска: сотрётся при обновлении'}). Проверка каждые ${pollMs / 60000} мин. Шорты мемов: ${opts.memeShorts ? 'включены' : 'выключены'}. Сигналы: ${opts.onlyStrong ? 'только сильные' : 'все, с оценкой силы'}. Лонги в выходные: ${opts.weekendLongs ? 'да' : 'нет'}. Админ: ${adminId || 'не задан'}.`);

  if (!st.loaded) {
    // Первый запуск без памяти: запоминаем текущие сигналы молча, чтобы не прислать старые входы.
    try { await tick(st, io, Object.assign({}, opts, { silent: true })); console.log('Прогрев: текущие сигналы запомнены без отправки.'); }
    catch (e) { console.error('Прогрев не удался:', e.message); }
    saveState(file, st);
  }
  await io.send(`✅ <b>ZYNQEL бот v${VERSION} запущен.</b>\nЛонги основных монет, когда funding падает необычно сильно для монеты${opts.weekendLongs ? '' : ' (только в будни)'}, держим до 3 дней` + (opts.memeShorts ? '; шорты PEPE, SHIB, FLOKI, когда funding растёт необычно сильно и BTC ниже EMA50, до 6 дней' : '') + '. Стоп по волатильности, 50% на первой цели. Каждый сигнал проверяется по факторам движения, без подтверждения — не присылаю. Риск 0.5% депозита на любой сигнал. Итоги недели по понедельникам.\n<i>Не финансовая рекомендация.</i>');

  // 1) сигналы и сделки
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

  // 2) сбор OI / лонг-шорт / taker раз в 6 часов (при старте сразу подтягивает ~20 дней назад)
  const collect = async () => {
    try {
      const r = await collectMarket(store, io);
      saveJson(mfile, store);
      console.log(`Сбор рыночных данных: +${r.added} новых точек, ошибок ${r.errors}. Всего: ${marketSummary(store)}.`);
    } catch (e) { console.error('Ошибка сбора:', e.message); }
    setTimeout(collect, COLLECT_EVERY_MS);
  };
  setTimeout(collect, 20000);

  // 3) история открытого интереса из архива Binance (по команде /history, в фоне)
  const histFile = path.join(path.dirname(file), 'zynqel-oi-history.json');
  const hist = { running: false, progress: {} };
  const runHistory = async to => {
    hist.running = true; hist.progress = {}; hist.error = null;
    try {
      const r = await oiHistoryJob(histFile, io, { progress: hist.progress, log: m => console.log(m) });
      hist.running = false;
      await io.sendTo(to, `✅ История открытого интереса готова: дней-файлов ${r.files}, нет в архиве ${r.missing}, ошибок ${r.errors}. Отправляю файл.`);
      await io.sendDocument(to, `zynqel-oi-history-${new Date().toISOString().slice(0, 10)}.csv`, historyCsv(r.st));
    } catch (e) {
      hist.running = false; hist.error = e.message; console.error('История OI:', e.message);
      await io.sendTo(to, '❌ История открытого интереса не скачалась: ' + e.message + '. Прогресс сохранён, /history продолжит с того же места.');
    }
  };

  // 4) команды в личке бота: /id, /stats, /data, /history
  const commands = async () => {
    try {
      const ups = await io.getUpdates(st.tgOffset || 0);
      for (const u of ups) {
        st.tgOffset = u.update_id + 1;
        const m = u.message;
        if (!m || !m.chat || m.chat.type !== 'private' || !m.text) continue;
        try {
          for (const a of handleCommand(m.text, m.chat.id, adminId, st, store)) {
            if (a.text) await io.sendTo(m.chat.id, a.text);
            if (a.file) await io.sendDocument(m.chat.id, a.file.name, a.file.content);
            if (a.history) {
              if (hist.running) {
                const p = hist.progress;
                await io.sendTo(m.chat.id, `⏳ Уже качаю: ${p.sym || '…'}${p.day ? ' до ' + new Date(p.day).toISOString().slice(0, 10) : ''}, файлов ${p.files || 0}. Пришлю, когда закончу.`);
              } else {
                await io.sendTo(m.chat.id, '⏳ Начал скачивать историю открытого интереса и лонг/шорт с декабря 2021 по 11 монетам из архива Binance. Это около 20 000 файлов, займёт 20–60 минут. Пришлю CSV сюда. Торговля в это время работает как обычно.');
                runHistory(m.chat.id);
              }
            }
          }
        } catch (e) { // ошибка в команде не должна молча съедать ответ
          console.error('Ошибка команды', m.text, e.message);
          await io.sendTo(m.chat.id, '⚠️ Ошибка при выполнении команды: ' + e.message);
        }
      }
      if (ups.length) saveState(file, st);
    } catch (e) { console.error('Ошибка команд:', e.message); await sleep(5000); }
    setTimeout(commands, 1000);
  };
  commands();
}

module.exports = { VERSION, RULES, COINS, MARKET_SERIES, funding8h, drop24, computeSignal, flowGrade, scoreSignal, btcIsBear, stopDistance, openPosition, updatePosition, tick, msgEntry, msgEvent, msgWeek, fmtPrice,
  mergeMarket, collectMarket, marketCsv, tradesCsv, handleCommand, isWeekend, closedRecord, cbPremium, unzipFirst, metricsSnapshots, oiHistoryJob, historyCsv, shadowSummary };
if (require.main === module) main();
