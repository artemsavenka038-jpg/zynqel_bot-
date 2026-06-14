/* ============================================================================
 * ZYNQEL — 24/7 TELEGRAM SIGNAL WORKER
 * Standalone Node.js process. Runs the SAME validated engine as the website
 * (funding-contrarian + BTC-EMA50 filter), 24/7, and posts to a Telegram channel.
 *
 * Mirrors src/analysis/analysisCore.js EXACTLY:
 *   - ACTIVE long: Δ3 funding ≤ -0.00012 AND BTC bullish (EMA50)
 *   - ACTIVE short: Δ3 ≥ +0.00015 OR funding ≥ 0.0002, AND BTC bearish
 *   - Active-section coins (memes/alts): SHORT ONLY (long disabled)
 *   - No signal when funding history or BTC regime not loaded
 *
 * Sends: entries (BUY/SELL) + watch. Dedups so the same state isn't reposted.
 *
 * SETUP (see README в этой папке):
 *   BOT_TOKEN  — от @BotFather
 *   CHAT_ID    — id канала (напр. @zynqel_signals или -100123...)
 *   npm install node-fetch@2     (если Node < 18; на Node ≥18 fetch встроен)
 *   node zynqel-bot.js
 * ========================================================================== */
'use strict';

// ---- config from environment ----
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const CHAT_ID   = process.env.CHAT_ID   || '';
const POLL_MS   = (parseInt(process.env.POLL_MINUTES || '5', 10)) * 60 * 1000; // default 5 min
const LANG      = (process.env.LANG_RU === '0') ? 'en' : 'ru';
const SEND_WATCH = process.env.SEND_WATCH !== '0'; // watch on by default (user choice)

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('❌ Задай BOT_TOKEN и CHAT_ID в переменных окружения. См. README.md');
  process.exit(1);
}

// fetch: built-in on Node 18+, fallback to node-fetch
let _fetch = global.fetch;
if (!_fetch) { try { _fetch = require('node-fetch'); } catch (e) { console.error('Нужен Node 18+ или: npm install node-fetch@2'); process.exit(1); } }

const FAPI = 'https://fapi.binance.com';

// ---- coin universe (matches the app's ASSETS) ----
// category: 'core' = both long/short; 'active' = memes/alts → SHORT ONLY
const COINS = [
  { id:'BTC', sym:'BTCUSDT', cat:'core' },
  { id:'ETH', sym:'ETHUSDT', cat:'core' },
  { id:'SOL', sym:'SOLUSDT', cat:'core' },
  { id:'XRP', sym:'XRPUSDT', cat:'core' },
  { id:'SUI', sym:'SUIUSDT', cat:'core' },
  { id:'AVAX', sym:'AVAXUSDT', cat:'core' },
  { id:'DOGE', sym:'DOGEUSDT', cat:'core' },
  { id:'LINK', sym:'LINKUSDT', cat:'core' },
  { id:'TON', sym:'TONUSDT', cat:'core' },
  { id:'LTC', sym:'LTCUSDT', cat:'core' },
  { id:'NEAR', sym:'NEARUSDT', cat:'core' },
  { id:'PEPE', sym:'1000PEPEUSDT', cat:'active' },
  { id:'WIF', sym:'WIFUSDT', cat:'active' },
  { id:'BONK', sym:'1000BONKUSDT', cat:'active' },
  { id:'SHIB', sym:'1000SHIBUSDT', cat:'active' },
  { id:'FLOKI', sym:'1000FLOKIUSDT', cat:'active' },
  { id:'ARB', sym:'ARBUSDT', cat:'active' },
  { id:'OP', sym:'OPUSDT', cat:'active' },
  { id:'INJ', sym:'INJUSDT', cat:'active' },
  { id:'SEI', sym:'SEIUSDT', cat:'active' },
  { id:'TIA', sym:'TIAUSDT', cat:'active' },
];

// ---- data fetch ----
async function getJson(url) {
  const r = await _fetch(url, { headers: { 'User-Agent': 'zynqel-bot' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.json();
}
async function fundingHistory(sym) {
  // last ~10 funding points (8h each) → enough for Δ over 3 periods
  const arr = await getJson(`${FAPI}/fapi/v1/fundingRate?symbol=${sym}&limit=10`);
  return arr.map(x => parseFloat(x.fundingRate)).filter(Number.isFinite);
}
async function dailyCloses(sym, n) {
  const arr = await getJson(`${FAPI}/fapi/v1/klines?symbol=${sym}&interval=1d&limit=${n}`);
  return arr.map(k => parseFloat(k[4])).filter(Number.isFinite);
}
async function fearGreed() {
  // same source as the website (alternative.me)
  try {
    const d = await getJson('https://api.alternative.me/fng/?limit=1');
    if (d && d.data && d.data[0]) return parseInt(d.data[0].value, 10);
  } catch (e) { /* ignore — null means no block */ }
  return null;
}
function ema(values, period) {
  if (!values || values.length < period) return null;
  const k = 2 / (period + 1);
  let e = 0;
  for (let i = 0; i < period; i++) e += values[i];
  e /= period;
  for (let j = period; j < values.length; j++) e = values[j] * k + e * (1 - k);
  return e;
}

// ---- engine (identical thresholds to analysisCore.js) ----
function computeSignal(fundHist, btcBull, btcKnown, isActiveCoin, fgi) {
  if (!fundHist || fundHist.length < 4) return { state: 'wait', reason: 'funding history loading' };
  const f = fundHist[fundHist.length - 1];
  const drop = fundHist[fundHist.length - 1] - fundHist[fundHist.length - 4]; // Δ over 3 periods

  const lowLevel = f <= 0.00005;
  const highLevel = f >= 0.0002;
  const sharpDrop = drop <= -0.00012;  // ACTIVE long trigger (relaxed, validated)
  const sharpRise = drop >= 0.00015;   // ACTIVE short trigger

  // ACTIVE mode (the bot uses ACTIVE — earlier signals, matches app default for memes)
  let rawLong = sharpDrop;
  let rawShort = (sharpRise || highLevel);

  if (isActiveCoin) rawLong = false; // memes/alts: SHORT ONLY (long disabled, per backtest)

  // F&G filter (validated combo): no LONG in extreme greed (F&G > 75). null → no block.
  const fgiBlocksLong = (typeof fgi === 'number' && fgi > 75);

  if (!btcKnown) {
    if (rawLong || rawShort) return { state: 'wait', reason: 'BTC regime loading' };
    return { state: 'wait', reason: 'no trigger' };
  }

  const long = rawLong && btcBull && !fgiBlocksLong;
  const short = rawShort && !btcBull;

  if (long)  return { state: 'buy',  f, drop, reason: 'Резкое падение funding + BTC бычий → контр-лонг' };
  if (short) return { state: 'sell', f, drop, reason: 'Высокий funding + BTC медвежий → контр-шорт' };
  if (rawLong && btcBull && fgiBlocksLong) return { state: 'watch_long', f, drop, reason: 'Лонг-сетап, но крайняя жадность (F&G>75) — ждём' };
  if (rawLong && !btcBull)  return { state: 'watch_long',  f, drop, reason: 'Лонг-сетап, но BTC медвежий — ждём' };
  if (rawShort && btcBull)  return { state: 'watch_short', f, drop, reason: 'Шорт-сетап, но BTC бычий — ждём' };
  return { state: 'wait', f, drop, reason: 'no trigger' };
}

// ---- telegram ----
async function tg(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const r = await _fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true })
  });
  if (!r.ok) console.error('Telegram error', r.status, await r.text());
}

function fmtPrice(p) {
  if (p == null) return '—';
  const ap = Math.abs(p);
  const d = ap >= 1000 ? 2 : ap >= 1 ? 4 : 8;
  return '$' + Number(p).toFixed(d);
}

// Compute entry levels (stop + 3 targets) for a direction. Matches backtest R:R.
function computeLevels(dir, price) {
  if (dir === 'long') {
    const stop = price * 0.975, r = price - stop;
    return { stop, t1: price + r, t2: price + r * 2, t3: price + r * 3 };
  }
  const stop = price * 1.025, r = stop - price;
  return { stop, t1: price - r, t2: price - r * 2, t3: price - r * 3 };
}

function buildMessage(coin, sig, price) {
  const pct = (x) => (x == null ? '—' : (x >= 0 ? '+' : '') + (x * 100).toFixed(4) + '%');
  const tag = coin.cat === 'active' ? ' 🧪' : '';
  if (sig.state === 'buy') {
    const L = computeLevels('long', price);
    return `🟢 <b>${coin.id} — LONG</b>${tag}\n` +
      `Вход: <b>${fmtPrice(price)}</b>\n` +
      `Цель: ${fmtPrice(L.t1)} / ${fmtPrice(L.t2)} / ${fmtPrice(L.t3)}\n` +
      `Стоп: ${fmtPrice(L.stop)}\n` +
      `Funding: ${pct(sig.f)} (Δ3 ${pct(sig.drop)})\n` +
      `Удержание ~2–3 дня · ⚡ ACTIVE\n` +
      `<i>Не финансовая рекомендация.</i>`;
  }
  if (sig.state === 'sell') {
    const L = computeLevels('short', price);
    return `🔴 <b>${coin.id} — SHORT</b>${tag}\n` +
      `Вход: <b>${fmtPrice(price)}</b>\n` +
      `Цель: ${fmtPrice(L.t1)} / ${fmtPrice(L.t2)} / ${fmtPrice(L.t3)}\n` +
      `Стоп: ${fmtPrice(L.stop)}\n` +
      `Funding: ${pct(sig.f)} (Δ3 ${pct(sig.drop)})\n` +
      `Удержание ~2–3 дня · ⚡ ACTIVE\n` +
      `<i>Не финансовая рекомендация.</i>`;
  }
  if (sig.state === 'watch_long') {
    return `🟡 <b>${coin.id} — наблюдение за LONG</b>${tag}\n` +
      `Funding ${pct(sig.f)} (Δ3 ${pct(sig.drop)}). Сетап есть, но BTC медвежий — вход заблокирован. Жду подтверждения.`;
  }
  if (sig.state === 'watch_short') {
    return `🟡 <b>${coin.id} — наблюдение за SHORT</b>${tag}\n` +
      `Funding ${pct(sig.f)} (Δ3 ${pct(sig.drop)}). Сетап есть, но BTC бычий — вход заблокирован. Жду подтверждения.`;
  }
  return null;
}

// ---- dedup: don't repost the same state for the same coin ----
const lastState = {}; // id -> state string
function shouldSend(id, state) {
  if (state === 'wait') { lastState[id] = 'wait'; return false; }
  if (lastState[id] === state) return false; // same as last time → skip
  lastState[id] = state;
  return true;
}

// ---- open-position tracker: follow each entry to target/stop/time-exit ----
// In-memory only. If the host restarts the container, open positions are forgotten.
const HOLD_MS = 3 * 24 * 60 * 60 * 1000; // ~3 days (matches ACTIVE backtest horizon)
const positions = {}; // id -> { dir, entry, stop, t1, t2, t3, openedAt, hit1, hit2, beStop }

function openPosition(coin, dir, price) {
  const L = computeLevels(dir, price);
  positions[coin.id] = {
    dir, entry: price, stop: L.stop, t1: L.t1, t2: L.t2, t3: L.t3,
    openedAt: Date.now(), hit1: false, hit2: false, beStop: false
  };
}

// Returns an array of update messages for a coin's open position (may be empty).
function checkPosition(coin, price) {
  const p = positions[coin.id];
  if (!p) return [];
  const msgs = [];
  const up = p.dir === 'long';
  const pnl = up ? (price - p.entry) / p.entry : (p.entry - price) / p.entry;
  const pnlStr = (pnl >= 0 ? '+' : '') + (pnl * 100).toFixed(2) + '%';
  const stopNow = p.beStop ? p.entry : p.stop;       // breakeven stop after target 1
  const stopHit = up ? price <= stopNow : price >= stopNow;
  const t1Hit = up ? price >= p.t1 : price <= p.t1;
  const t2Hit = up ? price >= p.t2 : price <= p.t2;
  const t3Hit = up ? price >= p.t3 : price <= p.t3;

  // stop first (conservative)
  if (stopHit) {
    msgs.push(`${p.beStop ? '⚖️' : '🛑'} <b>${coin.id}</b> — ${p.beStop ? 'закрыт в безубытке' : 'СТОП'} @ ${fmtPrice(price)} (${pnlStr})`);
    delete positions[coin.id];
    return msgs;
  }
  if (t3Hit) {
    msgs.push(`🎯🎯🎯 <b>${coin.id}</b> — ЦЕЛЬ 3 достигнута @ ${fmtPrice(price)} (${pnlStr}). Позиция закрыта.`);
    delete positions[coin.id];
    return msgs;
  }
  if (t2Hit && !p.hit2) { p.hit2 = true; p.beStop = true; msgs.push(`🎯🎯 <b>${coin.id}</b> — цель 2 @ ${fmtPrice(price)} (${pnlStr}). Стоп в безубытке.`); }
  if (t1Hit && !p.hit1) { p.hit1 = true; p.beStop = true; msgs.push(`🎯 <b>${coin.id}</b> — цель 1 @ ${fmtPrice(price)} (${pnlStr}). Стоп перенесён в безубыток.`); }

  // time-based exit
  if (Date.now() - p.openedAt >= HOLD_MS) {
    msgs.push(`⏱ <b>${coin.id}</b> — закрытие по времени (~3 дня) @ ${fmtPrice(price)} (${pnlStr}).`);
    delete positions[coin.id];
  }
  return msgs;
}

// ---- main loop ----
async function tick() {
  let btcCloses;
  try { btcCloses = await dailyCloses('BTCUSDT', 200); }
  catch (e) { console.error('BTC klines fail:', e.message); return; }
  const e50 = ema(btcCloses.slice(-160), 50);
  const btcKnown = e50 != null && btcCloses.length >= 50;
  const btcBull = btcKnown ? btcCloses[btcCloses.length - 1] > e50 : true;
  const fgi = await fearGreed(); // one fetch per cycle, shared across coins
  console.log(`[${new Date().toISOString()}] BTC ${btcKnown ? (btcBull ? 'бычий' : 'медвежий') : 'грузится'} · F&G ${fgi == null ? '?' : fgi}`);

  for (const coin of COINS) {
    try {
      const fh = await fundingHistory(coin.sym);
      const price = (await dailyCloses(coin.sym, 1))[0];

      // 1) If we already track an open position for this coin, manage it first.
      if (positions[coin.id]) {
        const updates = checkPosition(coin, price);
        for (const m of updates) { await tg(m); console.log('  → апдейт:', coin.id, m.slice(0, 24)); await new Promise(r => setTimeout(r, 300)); }
        continue; // don't emit a new signal while a position is live
      }

      // 2) Otherwise evaluate for a fresh signal.
      const sig = computeSignal(fh, btcBull, btcKnown, coin.cat === 'active', fgi);
      const isEntry = sig.state === 'buy' || sig.state === 'sell';
      const isWatch = sig.state === 'watch_long' || sig.state === 'watch_short';
      if (!isEntry && !(SEND_WATCH && isWatch)) { if (sig.state === 'wait') lastState[coin.id] = 'wait'; continue; }

      if (!shouldSend(coin.id, sig.state)) continue;

      const msg = buildMessage(coin, sig, price);
      if (msg) {
        await tg(msg);
        console.log('  → отправлено:', coin.id, sig.state);
        if (isEntry) openPosition(coin, sig.state === 'buy' ? 'long' : 'short', price); // start tracking
      }
      await new Promise(r => setTimeout(r, 400)); // be gentle to Telegram rate limits
    } catch (e) {
      console.error('  ' + coin.id + ' fail:', e.message);
    }
  }
}

(async function main() {
  console.log('ZYNQEL Telegram worker запущен. Опрос каждые', POLL_MS / 60000, 'мин. Watch:', SEND_WATCH ? 'вкл' : 'выкл');
  await tg('✅ ZYNQEL бот запущен. Сигналы по 21 монете + отслеживание входов (цель/стоп/закрытие). Не финансовая рекомендация.');
  await tick();
  setInterval(tick, POLL_MS);
})();
