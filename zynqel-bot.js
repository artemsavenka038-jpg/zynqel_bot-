/* ============================================================================
 * ZYNQEL — Telegram-бот сигналов, версия 2.16.0
 *
 * v2.16.0: «🪝 Ловец проливов» — три изменения сразу, вживую, по решению пользователя (sim2/PREREG_WICK5.md: по отдельности
 *   строгую проверку не прошли; связка посчитана в sim2/wick6_combo.js): вторая лимитка («ступень 2») на 7.5σ со своей продажей
 *   через 60 мин; «нервный рынок» (σ BTC за 168 ч выше медианы за год) — обе лимитки ×2; по выходным — только 5σ без удвоения.
 *   Ставка — 6% баланса (не меньше $5), дневной стоп — 12% баланса на начало суток, стоп торговли — баланс на 30% ниже максимума.
 *   На истории (8 монет, ставка $5): ≈ +$1.96 в месяц против +$0.67, худший день −$5.69, просадка −$10.36 (было −$3.85 / −$6.81).
 *
 * v2.15.0: «🪝 Ловец проливов» — первая стратегия, которая торгует САМА на Bybit (по решению пользователя, sim2/PREREG_WICK.md):
 *   каждый час лимитка на покупку на 5σ ниже цены (PostOnly), исполнилась — через 60 минут продажа по рынку. $5 на сделку,
 *   8 ликвидных монет, дневной стоп −$4, стоп при балансе ниже $28. Без ключей или без WICK_LIVE=1 — «бумага» по ценам Bybit.
 *   Сообщения — только в личку (ADMIN_CHAT_ID). Команды /wick, /wicktest, /wickstop, /wickstart.
 *
 * v2.14.0: «🔻 Ранний шорт 30м» (на проверке, «на бумаге», по решению пользователя; sim2/PREREG_M30.md): то же правило,
 *   что у раннего шорта, но на 30-минутных свечах и с проверкой каждые 30 минут (через 40 с после закрытия свечи).
 *   Ведётся отдельно от часового — чтобы сравнить вживую. На истории 2022–26: сделок больше на 60%, сумма R больше
 *   (2026: −48R против −83R), но просадки глубже и прибыль ещё сильнее держится на редких днях; заранее записанную
 *   проверку не прошёл (t по дням ниже). Выключить: EARLY_SHORT30=0. Подсказка риска — та же (SHORT_RISK).
 *
 * v2.13.0: «🔻 Ранний шорт» в стратегии 2 (на проверке, «на бумаге», по решению пользователя; sim2/PREREG_SHORT3.md):
 *   когда BTC ниже средней 50 дней — в узком коридоре 48 часов красная свеча на объёме ≥ 3 × обычного закрылась ниже середины
 *   коридора (но не ниже низа) → шорт, стоп — верх коридора, цель 2R, не дольше 96 часов. На истории в сумме плюс, но он держится
 *   на редких днях обвалов (3 года из 6 в минусе). Подсказка риска — 0.1% (SHORT_RISK). Выключить: EARLY_SHORT=0.
 *
 * v2.12.0: «живой» фильтр BTC для стратегии 2 (пробой и ранний вход): каждый час — часовое закрытие BTC против средней
 *   50 дневных закрытий (раньше — вчерашнее дневное закрытие, пересчёт раз в сутки). sim2/PREREG_LIVEFILT.md: на истории
 *   2021–23 заметно лучше, 2024–26 — то же самое; по заранее записанному правилу не прошёл на границе (0.02R), включён по решению
 *   пользователя. Вернуть прежний: ACTIVE_BTC_FILTER=daily.
 *
 * v2.11.0: «⚡ Ранний вход» внутри стратегии 2 (на проверке, «на бумаге», sim2/PREREG_VSPIKE.md): в том же узком коридоре
 *   48 часов зелёная свеча на объёме ≥ 3 × обычного закрылась выше середины коридора, но ещё не выше верха → вход раньше пробоя.
 *   Фильтр BTC и выходы — как у пробоя. Ведётся отдельно от пробоя (своя позиция по монете). Выключить: EARLY=0.
 *
 * v2.10.0: стратегия 2 «⚡ Активные свечи» (на проверке, «на бумаге»). Каждый час, через 40 секунд после закрытия
 *   часовой свечи, бот смотрит 48 монет (8 основных + 40 из /research): свеча закрылась выше максимума 48 часов,
 *   коридор был уже обычного, объём ×2 от обычного, BTC выше средней 50 дней → сообщение «⚡ Активная свеча»
 *   с ориентирами (стоп — низ коридора, подтягивается к минимуму 24 часов, не дольше 7 дней) и ведение «на бумаге».
 *   Правило заморожено (sim2/PREREG_BREAKOUT_H.md, BO-FWD): на истории 2024–26 в плюсе, 2021–23 на 40 монетах в минусе,
 *   решение «в бой» — после проверки на данных после 22.10.2026. Команда /active; итоги — в /stats, /data, итогах недели.
 *   Логика бота совпала с проверкой на истории: 5469 из 5469 сделок (вход и результат).
 *
 * v2.8.2: команда /liq — ликвидации на Binance по дням (Coinalyze, бесплатный ключ COINALYZE_KEY) для проверки
 *   «капитуляция лонгов перед сигналом» (sim2/PREREG_LIQ.md). Торговля та же.
 *
 * v2.8.1: «🕯 пролив выкупили» — если за 8 часов до сигнала funding была свеча с длинным нижним хвостом
 *   (хвост ≥ 70% свечи), риск по лонгу основной монеты 1% вместо 0.5% (sim2/PREREG_HOURLY.md).
 *   Команда /premium — история премии фьючерсов (для исследований; проверка «видеть funding заранее» не прошла, sim2/PREREG_EARLY.md).
 *   Команда /macro — суммарный выпуск стейблкоинов по дням (DefiLlama) для проверки «приток денег в крипту» (sim2/PREREG_STABLE.md).
 *   Команда /onchain — ончейн BTC/ETH (Coin Metrics Community), корейская цена (Upbit) и курс вона (FRED) — sim2/PREREG_ONCHAIN.md.
 *
 * v2.8: вторая, независимая стратегия «📈 ТРЕНД» (sim2/PREREG_STRATEGIES.md): раз в день после закрытия дневной свечи
 *   (00:00 UTC). Лонг, когда дневное закрытие выше максимума 20 предыдущих дней; держим, пока закрытие не опустится
 *   ниже минимума 10 предыдущих дней. 8 основных монет, размер позиции обратно волатильности (риск как у основной
 *   стратегии). Новые входы — только пока BTC выше своей средней за 50 дней (sim2/PREREG_ROUND2.md, R4).
 *   Проверено на 2024–2026, на 40 других и на 19 нетронутых монетах; вместе с основной стратегией колебания ровнее.
 *
 * v2.7.1 (лонги основных монет; всё проверено заранее записанными правилами, см. sim2/PREREG_*.md):
 *   • После цели 1 стоп остатка — на −0.5R вместо входа: шум реже выбивает остаток «в ноль» (PREREG_BE.md).
 *   • Повторный вход: лонг закрылся, а сигнал всё ещё действует — входим снова на новой выплате funding,
 *     не раньше следующего дня UTC (+5–13% сделок, PREREG_MORE.md).
 *   • Фильтр «толпа всё ещё в лонге»: доля счетов в лонге на Binance больше обычной (за 30 дней) в 1.358+ раза —
 *     лонг не открываем, ведём «на бумаге» (проверено на 12 независимых монетах, PREREG_OI.md).
 *   • Команды /research и /history2 — бот сам скачивает данные для проверок.
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
 *   • Цель 1 = 1R: закрыть 50%, стоп остатка: лонги основных — на −0.5R (v2.7.1), шорты мемов — в безубыток. Цель 2 = 3R: закрыть всё.
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
 *   REENTRY (1)                  — 0 = без повторного входа (как до v2.7.1)
 *   CROWD_FILTER (1)             — 0 = открывать лонги, даже когда толпа всё ещё в лонге
 *   TREND (1)                    — 0 = выключить стратегию «ТРЕНД»
 *   WICK_BOOST (1)               — 0 = не повышать риск до 1% после выкупленного пролива
 *   TREND_SCALE (1)              — множитель размера позиций «ТРЕНД» (2 = вдвое больше)
 *   TREND_DIGEST (1)             — 0 = не слать ежедневный список открытых позиций «ТРЕНД»
 *   STATE_FILE                   — куда сохранять память (по умолчанию /data/… если есть диск)
 *   COINALYZE_KEY                — бесплатный ключ coinalyze.net (только для команды /liq)
 *   ACTIVE (1)                   — 0 = выключить стратегию 2 «⚡ Активные свечи» (вместе с ранним входом)
 *   EARLY (1)                    — 0 = выключить только «⚡ Ранний вход»
 *   ACTIVE_BTC_FILTER (live)     — daily = фильтр BTC по вчерашнему дневному закрытию (как до v2.12)
 *   EARLY_SHORT (1)              — 0 = выключить «🔻 Ранний шорт»
 *   EARLY_SHORT30 (1)            — 0 = выключить «🔻 Ранний шорт 30м» (v2.14)
 *   BYBIT_KEY, BYBIT_SECRET      — ключ API Bybit (только торговля, БЕЗ вывода; лучше на отдельном субсчёте) — v2.15
 *   WICK_LIVE (0)                — 1 = «🪝 Ловец проливов» торгует реальными деньгами (иначе — бумага)
 *   WICK (1)                     — 0 = выключить ловца проливов совсем
 *   WICK_PCT (6)                 — ставка на лимитку в % баланса (не меньше $5); WICK_USD — вместо этого постоянная сумма в $
 *   WICK_LADDER (7.5)            — ступень 2 на столько σ (0 = без неё); WICK_NERV_MULT (2) — множитель в нервном рынке (1 = выкл)
 *   WICK_WEEKEND (base)          — base: по выходным только 5σ без удвоения; off: не торговать; all: как в будни
 *   WICK_DAY_LOSS_PCT (12) WICK_DD_STOP_PCT (30) — дневной стоп и стоп по балансу в %; WICK_DAY_LOSS / WICK_MIN_BALANCE — вместо них в $
 *   WICK_M (5) WICK_HOLD_MIN (60) WICK_LEVERAGE (10)
 *   WICK_COINS (SOL,XRP,DOGE,LINK,LTC,NEAR,BNB,ADA)
 *   SHORT_RISK (0.1)             — риск в % депозита для подсказки размера в «🔻 Раннем шорте»
 *   ACTIVE_RISK (0.25)           — риск в % депозита для подсказки размера позиции в «⚡ Активных свечах»
 *   ACTIVE_CHAT                  — куда слать «⚡ Активные свечи» (по умолчанию — тот же канал CHAT_ID)
 *
 * Дополнительно (v2.1): раз в 6 часов бот сохраняет часовой открытый интерес (OI),
 * соотношения лонгов/шортов и taker-поток по всем монетам — для будущей проверки идеи
 * «funding + OI». На сигналы это пока не влияет.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const VERSION = '2.16.0';

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
  crowdThr: 1.358,                  // v2.7.1: доля счетов в лонге выше обычной (за 30 дней) больше чем в 1.358 раза → лонг основной монеты не открываем (sim2/PREREG_OI.md, H2)
  beCoreR: -0.5,
  trend: { N: 20, exitN: 10, btcSma: 50, k: 0.00116, maxPos: 0.10 },
  wick: { thr: 0.6966, risk: 1.0 }, // v2.8.1: нижний хвост за 8 часов до сигнала ≥ 0.6966 свечи → риск 1% (лонги основных) // v2.8 «ТРЕНД»: позиция = k / σ дня (≈ риск основной стратегии), не больше 10% депозита                    // v2.7.1: после цели 1 стоп остатка лонга основных — на −0.5R, а не на вход (sim2/PREREG_BE.md)
};
const DAY_MS = 24 * 3600 * 1000;
/* Самый длинный нижний хвост (доля свечи) среди 8 часовых свечей, закрывшихся до отметки stamp. candles — [{t,o,h,l,c}]. */
function wickBefore(candles, stamp) {
  const c = (candles || []).filter(x => x.t + 3600 * 1000 <= stamp).sort((a, b) => a.t - b.t).slice(-8);
  if (c.length < 8) return null;
  let w = 0; for (const x of c) { const rng = x.h - x.l; if (rng > 0) w = Math.max(w, (Math.min(x.o, x.c) - x.l) / rng); }
  return w;
}
/* «Толпа всё ещё в лонге»: доля счетов в лонге (globalLongShortAccountRatio) на момент сигнала,
 * делённая на её среднее на отметках 00/08/16 UTC за 30 дней до сигнала. rows — ответ Binance [{timestamp, longShortRatio}]. */
function crowdRatio(rows, stamp) {
  const pts = (rows || []).map(x => ({ t: +x.timestamp, v: parseFloat(x.longShortRatio) })).filter(x => x.t > 0 && x.v > 0).sort((a, b) => a.t - b.t);
  const cur = pts.filter(x => x.t <= stamp).pop(); if (!cur) return null;
  const H8 = 8 * 3600 * 1000, past = pts.filter(x => x.t < stamp && x.t % H8 === 0 && x.t >= stamp - 30 * 24 * 3600 * 1000).slice(-90);
  if (past.length < 30) return null;
  return cur.v / (past.reduce((s, x) => s + x.v, 0) / past.length);
}
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
    beR: coin.kind === 'core' ? RULES.beCoreR : 0, // куда переносим стоп остатка после цели 1 (в R от входа)
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
  if (s * (price - p.stop) <= 0) return close(p.half ? (p.beR ? 'stop2' : 'breakeven') : 'stop');
  if (s * (price - p.tF) >= 0) return close('target2');
  if (!p.half && s * (price - p.t1) >= 0) {
    p.realized += RULES.partial * pnl(price); p.open = 1 - RULES.partial;
    p.half = true; p.stop = p.entry + s * (p.beR || 0) * p.risk; // v2.7.1: лонги основных — на −0.5R, шорты мемов — на вход
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
  const riskPct = p.riskPct || RULES.riskPct; // v2.7: одинаковый риск; v2.8.1: 1% после выкупленного пролива
  const size = Math.min(100, riskPct / (stopPct * 100) * 100); // % депозита при выбранном риске
  const holdDays = Math.round((p.holdMs || RULES.holdMs) / DAY_MS);
  const cbLine = p.cbPrem != null ? `ℹ️ Премия Coinbase ${p.cbPrem >= 0 ? '+' : '−'}${Math.abs(p.cbPrem * 100).toFixed(3)}%` +
    (p.cbAvg != null ? ` (средняя за 20 дней ${p.cbAvg >= 0 ? '+' : '−'}${Math.abs(p.cbAvg * 100).toFixed(3)}%: спрос из США ${p.cbPrem > p.cbAvg ? 'растёт' : 'слабеет'})` : '') + ' — для статистики, на сделку не влияет\n' : '';
  const sc = p.scoreInfo;
  const gradeLine = (strong ? `🔥 <b>Сильный сигнал</b>` : `Обычный сигнал`) + (sc ? ` · ${sc.score} из ${sc.max}` : '') + '\n' +
    (sc ? sc.factors.map(x => `${x.ok ? '✅' : '▫️'} ${x.text}`).join('\n') + '\n' : '');
  return (long ? '🟢' : '🔴') + ` <b>${p.id} — ${long ? 'ЛОНГ' : 'ШОРТ'}</b>${p.again ? ' (повторный вход: сигнал всё ещё действует)' : ''}\n` +
    `Вход: <b>${fmtPrice(p.entry)}</b>\n` +
    `Стоп: ${fmtPrice(p.stop)} (${(stopPct * 100).toFixed(1)}%)\n` +
    `Цель 1: ${fmtPrice(p.t1)} → закрыть 50%, ${p.beR ? `стоп остатка на ${fmtPrice(p.entry + (long ? 1 : -1) * p.beR * p.risk)} (половина риска)` : 'стоп в безубыток'}\n` +
    `Цель 2: ${fmtPrice(p.tF)} → закрыть остаток\n` +
    `Держим не дольше ${holdDays} дней\n` +
    `Funding ${fpct(sig.f)} (за сутки ${fpct(sig.d3)}` + (sig.z != null ? `, необычно сильно для ${p.id}: ${sig.z < 0 ? '−' : '+'}${Math.abs(sig.z).toFixed(1)}σ` : '') + `)\n` +
    gradeLine + (p.riskPct > RULES.riskPct ? `🕯 <b>Пролив выкупили</b>: за 8 часов до сигнала была свеча с длинным нижним хвостом (${(p.wick * 100).toFixed(0)}% свечи) — такие сделки лучше, риск ${p.riskPct}%\n` : '') + (p.crowd != null ? `👥 Доля счетов в лонге ×${p.crowd.toFixed(2)} от обычной за 30 дней — толпа не перекошена в лонг (выше ×${RULES.crowdThr} лонг не даём)\n` : '') + cbLine +
    `Риск ${riskPct}% депозита → позиция ≈ ${size.toFixed(0)}% депозита\n` +
    `<i>Не финансовая рекомендация.</i>`;
}
function msgEvent(p, e) {
  if (e.type === 'target1') return `🎯 <b>${p.id}</b> — цель 1 @ ${fmtPrice(e.price)}: закрываем 50% (${pct(e.part)}), ${p.beR ? `стоп остатка ${fmtPrice(p.stop)} (половина риска: даём сделке дойти до цели 2)` : `стоп остатка в безубыток ${fmtPrice(p.entry)}`}.`;
  if (e.type === 'target2') return `🎯🎯 <b>${p.id}</b> — цель 2 @ ${fmtPrice(e.price)}. Сделка закрыта, итог ${pct(e.result)}.`;
  if (e.type === 'breakeven') return `⚖️ <b>${p.id}</b> — остаток закрыт в безубытке @ ${fmtPrice(e.price)}. Итог сделки ${pct(e.result)} (за счёт цели 1).`;
  if (e.type === 'stop2') return `🛡 <b>${p.id}</b> — остаток закрыт по защитному стопу @ ${fmtPrice(e.price)}. Итог сделки ${pct(e.result)} (цель 1 перекрыла).`;
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
  for (const [key, nm] of [['weekend', 'выходные'], ['score0', '0 баллов'], ['crowd', 'толпа в лонге']]) {
    const v = list.filter(t => t.skip === key);
    if (v.length) out.push(`${nm}: ${v.length}, в плюс ${v.filter(t => t.result > 0).length}, средне ${pct(v.reduce((s, t) => s + t.result, 0) / v.length)}`);
  }
  return out.join(' · ');
}
function msgWeek(closed, shadow, trendClosed, trendOpen, activeClosed, earlyClosed, shortClosed, short30Closed) {
  const tr = (trendClosed && trendClosed.length) || (trendOpen && trendOpen.length)
    ? `\n\n📈 <b>ТРЕНД</b>: ${trendClosed && trendClosed.length ? 'закрыто ' + trendClosed.map(t => `${t.result > 0 ? '✅' : '❌'} ${t.id} ${pct(t.result)}`).join(', ') : 'закрытых нет'}${trendOpen && trendOpen.length ? '; открыто: ' + trendOpen.map(p => p.id).join(', ') : ''}` : '';
  const ac = (activeClosed && activeClosed.length ? `\n\n⚡ <b>Активные свечи</b> (на бумаге): ${activeSummary(activeClosed)}` : '') +
    (earlyClosed && earlyClosed.length ? `\n⚡ <b>Ранний вход</b> (на бумаге): ${activeSummary(earlyClosed)}` : '') +
    (shortClosed && shortClosed.length ? `\n🔻 <b>Ранний шорт</b> (на бумаге): ${activeSummary(shortClosed)}` : '') +
    (short30Closed && short30Closed.length ? `\n🔻 <b>Ранний шорт 30м</b> (на бумаге): ${activeSummary(short30Closed)}` : '');
  const sh = (shadow && shadow.length ? `\n\n<i>Отсеянные сигналы «на бумаге»: ${shadowSummary(shadow)}</i>` : '') + tr + ac;
  if (!closed.length) return '📊 <b>Итоги недели</b>\nЗакрытых сделок не было.' + sh;
  const wins = closed.filter(t => t.result > 0).length;
  const sum = closed.reduce((s, t) => s + t.result, 0);
  const lines = closed.map(t => `${t.result > 0 ? '✅' : (t.result === 0 ? '▫️' : '❌')} ${t.grade === 'strong' ? '🔥' : ''}${t.id} ${t.dir === 'long' ? 'лонг' : 'шорт'} ${pct(t.result)}`);
  return `📊 <b>Итоги недели</b>\nСделок: ${closed.length}, в плюс: ${wins}\n` +
    `Средний результат: ${pct(sum / closed.length)} на сделку (без комиссий)\n\n` + lines.join('\n') + sh;
}

// ---------- стратегия «📈 ТРЕНД» (v2.8) ----------
/* closes — закрытия ЗАКРЫТЫХ дневных свечей по возрастанию времени. Возвращает уровни на последний день или null. */
function trendSignal(closes, R = RULES.trend) {
  const c = (closes || []).filter(x => isFinite(x) && x > 0);
  if (c.length < R.N + 2) return null;
  const x = c[c.length - 1], prev = c.slice(-R.N - 1, -1), prev2 = c.slice(-R.exitN - 1, -1);
  const r = []; for (let i = c.length - 20; i < c.length; i++) r.push(c[i] / c[i - 1] - 1);
  const m = r.reduce((s, v) => s + v, 0) / r.length, sigma = Math.sqrt(r.reduce((s, v) => s + (v - m) ** 2, 0) / r.length);
  return { x, hi: Math.max(...prev), lo: Math.min(...prev2), sigma };
}
const trendSize = (sigma, scale = 1, R = RULES.trend) => sigma > 0 ? Math.min(R.maxPos, R.k * scale / sigma) : 0;
function msgTrendEntry(p) {
  return `📈 <b>ТРЕНД — ${p.id} ЛОНГ</b>\n` +
    `Вход: <b>${fmtPrice(p.entry)}</b>\n` +
    `Дневное закрытие ${fmtPrice(p.x)} выше максимума 20 дней (${fmtPrice(p.hi)}) — начался тренд вверх. BTC выше средней за 50 дней — рынок растёт.\n` +
    `Выход: когда дневное закрытие опустится ниже минимума 10 дней (сейчас ${fmtPrice(p.exitLevel)}, уровень будет подтягиваться). Целей и стопа внутри дня нет — держим, пока тренд жив (в среднем 2–3 недели).\n` +
    `Позиция ≈ <b>${(p.size * 100).toFixed(1)}% депозита</b> (по волатильности монеты, риск как у основных сигналов)\n` +
    `<i>В этой стратегии в плюс закрывается лишь ~40% сделок, но прибыльные в среднем в 3 раза больше убыточных. Не финансовая рекомендация.</i>`;
}
function msgTrendExit(p) {
  return `📈 <b>ТРЕНД — ${p.id} выход</b> @ ${fmtPrice(p.exit)}: дневное закрытие ниже минимума 10 дней. Итог ${pct(p.result)} за ${Math.max(1, Math.round((p.closedAt - p.openedAt) / DAY_MS))} дн.`;
}
function msgTrendDigest(list, prices) {
  return '📈 <b>ТРЕНД — открытые позиции</b>\n' + list.map(p => { const px = prices[p.sym]; const r = px ? px / p.entry - 1 : null;
    return `${p.id}: ${r != null ? pct(r) : '—'} от входа ${fmtPrice(p.entry)} · выход, если закрытие дня ниже ${fmtPrice(p.exitLevel)}`; }).join('\n');
}
/* Раз в сутки после 00:00 UTC: выходы и входы стратегии ТРЕНД. io.getDailyCloses(sym) → закрытия закрытых дневок. */
/* Рынок для входов «ТРЕНД»: последнее закрытие BTC выше средней 50 последних закрытий (включая его). */
function btcAboveSma(closes, n = RULES.trend.btcSma) { const c = (closes || []).filter(x => x > 0); if (c.length < n) return null; const m = c.slice(-n).reduce((a, b) => a + b, 0) / n; return c[c.length - 1] > m; }
async function trendTick(st, io, opts, now, prices, send, btcCloses) {
  const day = new Date(now).toISOString().slice(0, 10);
  if (st.trendDay === day) return;
  st.trend = st.trend || {}; st.trendClosed = st.trendClosed || [];
  let errors = 0;
  const bull = btcAboveSma(btcCloses); // null — нет данных: новые входы не открываем
  for (const c of COINS.filter(x => x.kind === 'core')) {
    try {
      const sig = trendSignal(await io.getDailyCloses(c.sym)); if (!sig) continue;
      const price = prices[c.sym]; if (!price) { errors++; continue; }
      const p = st.trend[c.id];
      if (p) {
        if (sig.x < sig.lo) {
          Object.assign(p, { exit: price, closedAt: now, result: price / p.entry - 1 });
          st.trendClosed.push({ strategy: 'trend', id: p.id, dir: 'long', entry: p.entry, exit: price, result: p.result, openedAt: p.openedAt, closedAt: now, size: p.size, outcome: 'trend_exit' });
          if (st.trendClosed.length > 500) st.trendClosed = st.trendClosed.slice(-500);
          delete st.trend[c.id];
          await send(msgTrendExit(p));
        } else p.exitLevel = sig.lo; // уровень выхода = минимум 10 закрытий перед последним (как в проверке)
      } else if (sig.x > sig.hi && !bull) {
        console.log(`  тренд ${c.id}: пробой максимума 20 дней, но BTC ниже средней за 50 дней — не входим`);
      } else if (sig.x > sig.hi) {
        const np = { id: c.id, sym: c.sym, entry: price, openedAt: now, x: sig.x, hi: sig.hi, exitLevel: sig.lo, size: trendSize(sig.sigma, opts.trendScale || 1) };
        st.trend[c.id] = np;
        await send(msgTrendEntry(np));
      }
    } catch (e) { errors++; console.error('  тренд ' + c.id + ':', e.message); }
  }
  if (errors) return; // попробуем ещё раз на следующем проходе (уже открытые/закрытые позиции не задваиваются)
  st.trendDay = day;
  const open = Object.values(st.trend);
  if (open.length && opts.trendDigest !== false) await send(msgTrendDigest(open, prices));
}
function trendSummary(list) {
  if (!list.length) return 'закрытых пока нет';
  const w = list.filter(t => t.result > 0).length, avg = list.reduce((s, t) => s + t.result, 0) / list.length;
  return `${list.length} сделок, в плюс ${w} (${(w / list.length * 100).toFixed(0)}%), средне ${pct(avg)} цены`;
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
    result: p.result, outcome: p.outcome, openedAt: p.openedAt, closedAt: p.closedAt, holdMs: p.holdMs, cbPrem: p.cbPrem, cbAvg: p.cbAvg, skip: p.skip || null, crowd: p.crowd ?? null, again: !!p.again, wick: p.wick ?? null, riskPct: p.riskPct || null };
}
function tradesCsv(st) {
  const lines = ['type,opened_utc,closed_utc,coin,dir,grade,score,z,price_vs_sma20,cb_premium_pct,cb_premium_avg20_pct,hold_days,entry,exit,result_pct,outcome,crowd_ratio,reentry,wick,risk_pct'];
  const n = (x, k) => x != null ? (x * 100).toFixed(k) : '';
  const row = (t, type) => [type, new Date(t.openedAt).toISOString(), new Date(t.closedAt).toISOString(), t.id, t.dir, t.grade || 'normal', t.score ?? '', t.z != null ? t.z.toFixed(2) : '',
    n(t.trend20, 2), n(t.cbPrem, 4), n(t.cbAvg, 4), t.holdMs ? Math.round(t.holdMs / DAY_MS) : '', t.entry, t.exit, (t.result * 100).toFixed(3), t.outcome, t.crowd != null ? t.crowd.toFixed(3) : '', t.again ? 1 : '', t.wick != null ? t.wick.toFixed(3) : '', t.riskPct || ''].join(',');
  for (const t of st.closed) lines.push(row(t, 'real'));
  for (const t of st.shadowClosed || []) lines.push(row(t, 'skip_' + t.skip)); // отсеянные сигналы «на бумаге»
  for (const t of st.trendClosed || []) lines.push(row(Object.assign({ grade: 'trend' }, t), 'trend')); // стратегия ТРЕНД
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
/* /history2: те же данные по 12 другим крупным монетам — независимая проверка (sim2/PREREG_OI.md, H2-NEW). */
const OI_HOLDOUT = ['ADA', 'BNB', 'DOT', 'APT', 'AVAX', 'TRX', 'ATOM', 'BCH', 'ETC', 'FIL', 'UNI', 'AAVE'].map(id => ({ id, sym: id + 'USDT' }));
function historyCsv(st, coins = COINS) {
  const cols = st.cols || METRICS_HEAD.slice(2);
  const lines = [['time_utc', 'coin'].concat(cols).join(',')];
  for (const c of coins) {
    const seen = new Set();
    for (const r of (st.data[c.sym] || []).slice().sort((a, b) => a[0] - b[0])) {
      if (seen.has(r[0])) continue; seen.add(r[0]);
      lines.push([new Date(r[0]).toISOString(), c.id].concat(r.slice(1).map(v => v == null ? '' : v)).join(','));
    }
  }
  return lines.join('\n') + '\n';
}

// ---------- /research: данные для проверки правил на других монетах (v2.7.1) ----------
/* Список монет задаёт правило, а не выбор по результатам (см. sim2/PREREG_BREADTH.md). */
const RESEARCH = {
  from: Date.UTC(2021, 0, 1),
  listedBefore: Date.UTC(2024, 0, 1),
  top: 60,                     // 60 самых торгуемых: после исключения мемов и 4-часовых при анализе останется 40
  stables: ['USDT', 'USDC', 'FDUSD', 'TUSD', 'BUSD', 'DAI', 'USDP', 'USDE', 'EUR', 'AEUR', 'USD1', 'BFUSD', 'XUSD', 'RLUSD', 'PYUSD', 'USDS'],
  control: 'BTCUSDT',          // контроль: сверяем с данными, на которых шли прошлые тесты
  hourly: CORE.map(c => c.sym), // часовые свечи основных — для проверки входа внутри 8 часов
  m15: ['SOLUSDT', 'BTCUSDT', 'ETHUSDT'], m15From: Date.UTC(2023, 0, 1), // 15-минутные — для проверки индикаторов TradingView (отдельный архив)
};
function researchUniverse(info, tickers, used) {
  const vol = new Map((tickers || []).map(x => [x.symbol, parseFloat(x.quoteVolume) || 0]));
  return ((info && info.symbols) || []).filter(s => s.contractType === 'PERPETUAL' && s.quoteAsset === 'USDT' && s.status === 'TRADING'
      && (s.underlyingType || 'COIN') === 'COIN' && +s.onboardDate > 0 && +s.onboardDate < RESEARCH.listedBefore
      && !RESEARCH.stables.includes(s.baseAsset) && !used.has(s.symbol))
    .map(s => ({ sym: s.symbol, onboard: +s.onboardDate, vol: vol.get(s.symbol) || 0 }))
    .sort((a, b) => b.vol - a.vol).slice(0, RESEARCH.top);
}
/* Листает ответы Binance вперёд по времени: start → end, пока страницы полные. */
async function pageAll(get, makeUrl, start, end, limit, timeOf) {
  const out = []; let s = start;
  for (let n = 0; n < 400 && s <= end; n++) {
    const r = await get(makeUrl(s));
    if (!Array.isArray(r) || !r.length) break;
    out.push(...r);
    const last = timeOf(r[r.length - 1]);
    if (r.length < limit || last >= end || !(last >= s)) break;
    s = last + 1;
  }
  return out;
}
const klineRow = k => [+k[0], k[1], k[2], k[3], k[4], k[5], k[8], k[9]]; // время, o, h, l, c, объём, сделок, taker buy
function uniqRows(rows) { const seen = new Set(); return rows.filter(r => !seen.has(r[0]) && seen.add(r[0])).sort((a, b) => a[0] - b[0]); }
/* Одна монета. parts: funding (ставки + цена на отметке), d1 (дневки фьючерсов), h1 (часовые свечи). */
async function researchCoin(get, sym, from, now, parts) {
  const F = `${FAPI}/fapi/v1`, res = {};
  if (parts.includes('funding')) {
    const raw = await pageAll(get, s => `${F}/fundingRate?symbol=${sym}&startTime=${s}&endTime=${now}&limit=1000`, from, now, 1000, x => +x.fundingTime);
    const fund = uniqRows(raw.filter(x => isFinite(parseFloat(x.fundingRate)))
      .map(x => { const mp = parseFloat(x.markPrice); return [+x.fundingTime, x.fundingRate, isFinite(mp) && mp > 0 ? x.markPrice : null]; }));
    const miss = fund.filter(r => r[2] == null);
    let filled = 0;
    if (miss.length) { // до конца 2023 Binance не отдаёт цену в истории funding — берём открытие часовой свечи mark price
      const a = Math.floor(miss[0][0] / HOUR) * HOUR, b = miss[miss.length - 1][0];
      const mk = await pageAll(get, s => `${F}/markPriceKlines?symbol=${sym}&interval=1h&startTime=${s}&endTime=${b}&limit=1500`, a, b, 1500, k => +k[0]);
      const open = new Map(mk.map(k => [+k[0], k[1]]));
      for (const r of miss) { const v = open.get(Math.round(r[0] / HOUR) * HOUR); if (v != null && parseFloat(v) > 0) { r[2] = v; filled++; } }
    }
    res.funding = fund.filter(r => r[2] != null);
    res.markFilled = filled; res.markDropped = fund.length - res.funding.length;
  }
  for (const [part, iv] of [['d1', '1d'], ['h1', '1h'], ['m15', '15m']]) {
    if (!parts.includes(part)) continue;
    const kl = await pageAll(get, s => `${F}/klines?symbol=${sym}&interval=${iv}&startTime=${s}&limit=1500`, from, now, 1500, k => +k[0]);
    res[part] = uniqRows(kl.filter(k => +k[6] < now).map(klineRow)); // только закрытые свечи
  }
  return res;
}
/* Минимальный zip (deflate) из нескольких файлов — без сторонних библиотек. */
const CRC_T = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function zipFiles(files, when = new Date()) {
  const dt = ((when.getUTCHours() << 11) | (when.getUTCMinutes() << 5) | (when.getUTCSeconds() >> 1)) & 0xffff;
  const dd = (((when.getUTCFullYear() - 1980) << 9) | ((when.getUTCMonth() + 1) << 5) | when.getUTCDate()) & 0xffff;
  const parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8'), data = Buffer.isBuffer(f.content) ? f.content : Buffer.from(String(f.content), 'utf8');
    const comp = zlib.deflateRawSync(data, { level: 9 }), crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(dt, 10); lh.writeUInt16LE(dd, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(dt, 12); ch.writeUInt16LE(dd, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, name, comp); central.push(ch, name); off += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
/* Скачивает всё для проверки и возвращает zip. io.getUrl(url) → JSON; io.pace() — пауза между запросами. */
async function researchJob(io, opts = {}) {
  const now = opts.now || Date.now(), from = opts.from || RESEARCH.from, prog = opts.progress || {}, log = opts.log || (() => {});
  const get = async url => {
    for (let a = 0; ; a++) {
      try { const r = await io.getUrl(url); if (io.pace) await io.pace(); return r; }
      catch (e) { // лимит запросов или сеть — ждём и повторяем; другие ошибки Binance — сразу дальше
        const m = String(e.message || e), retry = /HTTP (429|418|5\d\d)/.test(m) || !/HTTP \d/.test(m);
        if (!retry || a >= 3) throw e;
        await sleep((opts.retryMs ?? 15000) * (a + 1));
      }
    }
  };
  const used = new Set(COINS.map(c => c.sym));
  const uni = researchUniverse(await get(`${FAPI}/fapi/v1/exchangeInfo`), await get(`${FAPI}/fapi/v1/ticker/24hr`), used);
  if (!uni.length) throw new Error('Binance не вернул список фьючерсов');
  let iv = new Map(); try { iv = new Map((await get(`${FAPI}/fapi/v1/fundingInfo`) || []).map(x => [x.symbol, x.fundingIntervalHours])); } catch (e) { log('fundingInfo: ' + e.message); }
  const nm = s => s.replace(/USDT$/, '');
  const jobs = uni.map((u, k) => ({ sym: u.sym, name: nm(u.sym), parts: ['funding', 'd1'], u, rank: k + 1 }))
    .concat([{ sym: RESEARCH.control, name: 'BTC_control', parts: ['funding', 'd1'] }])
    .concat(RESEARCH.hourly.map(s => ({ sym: s, name: nm(s), parts: ['h1'] })))
    .concat(RESEARCH.m15.map(s => ({ sym: s, name: nm(s), parts: ['m15'], from: RESEARCH.m15From })));
  const files = [], files15 = [], uniRows = [], failed = [];
  const FH = 'time,fundingRate,markPrice', KH = 'time,open,high,low,close,volume,trades,taker_buy';
  const csvOf = (head, rows) => head + '\n' + rows.map(r => r.join(',')).join('\n') + '\n';
  for (let j = 0; j < jobs.length; j++) {
    const jb = jobs[j];
    Object.assign(prog, { n: j + 1, total: jobs.length, sym: jb.sym });
    let status = 'ok', r = {};
    try {
      r = await researchCoin(get, jb.sym, jb.from || from, now, jb.parts);
      if (r.funding) files.push({ name: `${jb.name}_funding.csv`, content: csvOf(FH, r.funding) });
      if (r.d1) files.push({ name: `${jb.name}_1d.csv`, content: csvOf(KH, r.d1) });
      if (r.h1) files.push({ name: `${jb.name}_1h.csv`, content: csvOf(KH, r.h1) });
      if (r.m15) files15.push({ name: `${jb.name}_15m.csv`, content: csvOf(KH, r.m15) });
    } catch (e) { status = 'error: ' + String(e.message || e).replace(/,/g, ' ').slice(0, 120); failed.push(jb.sym); log(`research ${jb.sym}: ${e.message}`); }
    if (jb.u) uniRows.push([jb.rank, jb.sym, new Date(jb.u.onboard).toISOString().slice(0, 10), Math.round(jb.u.vol), iv.get(jb.sym) || 8,
      r.funding ? r.funding.length : 0, r.markFilled || 0, r.markDropped || 0, r.d1 ? r.d1.length : 0, status]);
    else if (status !== 'ok') uniRows.push(['', jb.sym, '', '', '', '', '', '', '', status + ' (' + jb.parts.join('+') + ')']);
  }
  if (failed.length > jobs.length / 2) throw new Error(`не скачались ${failed.length} из ${jobs.length} (${failed.slice(0, 5).join(', ')}…)`);
  files.unshift({ name: 'universe.csv', content: csvOf('rank,symbol,listed_utc,quote_volume_24h_usdt,funding_interval_h,funding_rows,mark_filled_from_klines,mark_missing,days,status', uniRows) });
  files.unshift({ name: 'readme.txt', content: `ZYNQEL bot v${VERSION} /research, ${new Date(now).toISOString()}\n`
    + `Монеты: бессрочные USDT-фьючерсы Binance (COIN), на бирже до ${new Date(RESEARCH.listedBefore).toISOString().slice(0, 10)}, без стейблкоинов и монет бота, топ-${RESEARCH.top} по обороту за 24 ч.\n`
    + `История с ${new Date(from).toISOString().slice(0, 10)}. *_funding.csv — ставка и цена на отметке (до конца 2023 цена — открытие часовой свечи mark price).\n`
    + `*_1d.csv — дневные свечи фьючерсов; *_1h.csv — часовые свечи основных монет; BTC_control — для сверки.\n` });
  return { zip: zipFiles(files, new Date(now)), zip15: files15.length ? zipFiles(files15, new Date(now)) : null,
    total: jobs.length, ok: jobs.length - failed.length, failed, coins: uni.length };
}

/* /premium: часовые свечи премии фьючерса к индексу (premiumIndexKlines) по монетам бота с 2021 года — один zip. */
async function premiumJob(io, opts = {}) {
  const now = opts.now || Date.now(), from = opts.from || RESEARCH.from, prog = opts.progress || {}, log = opts.log || (() => {});
  const get = async url => { for (let a = 0; ; a++) { try { const r = await io.getUrl(url); if (io.pace) await io.pace(); return r; }
    catch (e) { const m = String(e.message || e); if (!(/HTTP (429|418|5\d\d)/.test(m) || !/HTTP \d/.test(m)) || a >= 3) throw e; await sleep((opts.retryMs ?? 15000) * (a + 1)); } } };
  const files = [], failed = [];
  for (let j = 0; j < COINS.length; j++) { const c = COINS[j]; Object.assign(prog, { n: j + 1, total: COINS.length, sym: c.sym });
    try {
      const kl = await pageAll(get, s => `${FAPI}/fapi/v1/premiumIndexKlines?symbol=${c.sym}&interval=1h&startTime=${s}&limit=1500`, from, now, 1500, k => +k[0]);
      const rows = uniqRows(kl.filter(k => +k[6] < now).map(k => [+k[0], k[1], k[2], k[3], k[4]]));
      files.push({ name: `${c.id}_premium_1h.csv`, content: 'time,open,high,low,close\n' + rows.map(r => r.join(',')).join('\n') + '\n' });
    } catch (e) { failed.push(c.sym); log(`premium ${c.sym}: ${e.message}`); }
  }
  if (failed.length > COINS.length / 2) throw new Error(`не скачались ${failed.length} из ${COINS.length}`);
  files.unshift({ name: 'readme.txt', content: `ZYNQEL bot v${VERSION} /premium, ${new Date(now).toISOString()}\nЧасовые свечи премии фьючерса к индексу (premiumIndexKlines) с ${new Date(from).toISOString().slice(0, 10)}.\n` });
  return { zip: zipFiles(files, new Date(now)), ok: COINS.length - failed.length, total: COINS.length, failed };
}

/* /macro: суммарная капитализация стейблкоинов по дням (DefiLlama, без ключа). rows — ответ API. */
function stableCsv(rows) {
  const out = ['date,total_usd'];
  for (const x of rows || []) { const d = +x.date, v = x.totalCirculatingUSD && x.totalCirculatingUSD.peggedUSD; if (d > 0 && v > 0) out.push(`${new Date(d * 1000).toISOString().slice(0, 10)},${Math.round(v)}`); }
  return out.join('\n') + '\n';
}

/* /onchain: бесплатные внешние данные одним zip. io.getUrl(url) → JSON, io.getText(url) → текст. */
const CM_METRICS = ['CapMVRVCur', 'AdrActCnt', 'TxCnt', 'FlowInExNtv', 'FlowOutExNtv', 'SplyExNtv', 'CapMrktCurUSD'];
async function onchainJob(io, opts = {}) {
  const log = opts.log || (() => {}), from = opts.from || '2020-06-01', files = [], notes = [];
  const pace = async () => { if (io.pace) await io.pace(); };
  // 1) Coin Metrics Community — по одной метрике (недоступные бесплатно пропускаем)
  const cm = ['date,asset,metric,value'];
  for (const asset of ['btc', 'eth']) for (const m of CM_METRICS) {
    try { let url = `https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=${asset}&metrics=${m}&frequency=1d&start_time=${from}&page_size=10000`, n = 0;
      for (let pg = 0; url && pg < 20; pg++) { const r = await io.getUrl(url); await pace();
        for (const x of (r && r.data) || []) if (x[m] != null && x[m] !== '') { cm.push(`${String(x.time).slice(0, 10)},${asset},${m},${x[m]}`); n++; }
        url = r && r.next_page_url; }
      notes.push(`coinmetrics ${asset} ${m}: ${n} дней`);
    } catch (e) { notes.push(`coinmetrics ${asset} ${m}: нет (${String(e.message || e).slice(0, 80)})`); log(`onchain ${asset} ${m}: ${e.message}`); } }
  files.push({ name: 'coinmetrics.csv', content: cm.join('\n') + '\n' });
  // 2) Upbit — дневные свечи KRW-BTC, KRW-ETH (идём назад по 200 дней)
  for (const mk of ['KRW-BTC', 'KRW-ETH']) {
    const rows = []; let to = null;
    try { for (let pg = 0; pg < 15; pg++) { const r = await io.getUrl(`https://api.upbit.com/v1/candles/days?market=${mk}&count=200${to ? '&to=' + encodeURIComponent(to) : ''}`); await pace();
        if (!Array.isArray(r) || !r.length) break; for (const x of r) rows.push([String(x.candle_date_time_utc).slice(0, 10), x.trade_price]);
        const last = r[r.length - 1].candle_date_time_utc; to = String(last).slice(0, 19) + 'Z'; if (String(last).slice(0, 10) < from) break; }
      const seen = new Set(), out = rows.filter(r => !seen.has(r[0]) && seen.add(r[0])).sort((a, b) => a[0] < b[0] ? -1 : 1);
      files.push({ name: `upbit_${mk.split('-')[1].toLowerCase()}.csv`, content: 'date,close_krw\n' + out.map(r => r.join(',')).join('\n') + '\n' }); notes.push(`upbit ${mk}: ${out.length} дней`);
    } catch (e) { notes.push(`upbit ${mk}: нет (${String(e.message || e).slice(0, 80)})`); } }
  // 3) FRED — вон за доллар
  try { const t = await io.getText('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXKOUS'); if (!/DEXKOUS/.test(t)) throw new Error('неожиданный ответ');
    files.push({ name: 'fred_dexkous.csv', content: t }); notes.push(`fred DEXKOUS: ${t.trim().split('\n').length - 1} строк`);
  } catch (e) { notes.push(`fred DEXKOUS: нет (${String(e.message || e).slice(0, 80)})`); }
  files.unshift({ name: 'readme.txt', content: `ZYNQEL bot v${VERSION} /onchain, ${new Date().toISOString()}\n` + notes.join('\n') + '\n' });
  return { zip: zipFiles(files), notes };
}

/* /liq — ликвидации на Binance по дням (Coinalyze, бесплатный ключ в переменной COINALYZE_KEY) — sim2/PREREG_LIQ.md.
 * Монеты бота + 40 монет, на которых проверяются правила (те же, что в /research). */
const LIQ_EXTRA = ['ZEC', 'WLD', 'GTC', 'BNB', 'SUI', 'ARB', 'UNI', 'ADA', 'FIL', 'AVAX', 'INJ', 'XMR', 'AAVE', 'BCH', 'QNT', 'DOT', 'SAND', 'FET', 'BAT', 'APT',
  'HBAR', 'CRV', 'OP', 'XLM', 'TRX', 'DASH', 'RLC', 'ATOM', 'SEI', 'PENDLE', 'ETC', 'ICP', 'LDO', 'GALA', 'STX', 'RSR', 'ALGO', 'COMP', 'RUNE', 'APE'];
async function liqJob(io, key, opts = {}) {
  const now = opts.now || Date.now(), log = opts.log || (() => {}), notes = [];
  const wait = async ms => { if (io.wait) await io.wait(ms); };
  const API = 'https://api.coinalyze.net/v1', get = p => io.getCoinalyze(API + p, key);
  const ex = await get('/exchanges');
  const bn = (ex || []).find(x => /^binance$/i.test(String(x.name).trim())) || (ex || []).find(x => /binance/i.test(x.name) && !/us|tr|coin/i.test(x.name));
  const code = bn ? bn.code : 'A';
  const mk = await get('/future-markets'), bySym = new Map();
  for (const m of mk || []) if (m.exchange === code && m.is_perpetual && m.margined === 'STABLE' && /USDT$/.test(m.symbol_on_exchange || '')) bySym.set(m.symbol_on_exchange, m.symbol);
  const want = [...new Set([...COINS.map(c => c.sym), ...LIQ_EXTRA.map(n => n + 'USDT')])];
  const pairs = want.filter(s => bySym.has(s)).map(s => [s, bySym.get(s)]), missing = want.filter(s => !bySym.has(s));
  if (!pairs.length) throw new Error(`на Coinalyze не нашлись рынки Binance (код биржи ${code}, рынков всего ${(mk || []).length})`);
  const rows = ['date,coin,symbol,long_usd,short_usd'], from = Math.floor(Date.UTC(2020, 0, 1) / 1000), to = Math.floor(now / 1000);
  let minT = Infinity, maxT = 0, got = 0;
  for (let i = 0; i < pairs.length; i += 20) {
    const part = pairs.slice(i, i + 20);
    const r = await get(`/liquidation-history?symbols=${part.map(p => p[1]).join(',')}&interval=daily&from=${from}&to=${to}&convert_to_usd=true`);
    for (const x of r || []) {
      const p = part.find(q => q[1] === x.symbol), coin = p ? p[0].replace(/USDT$/, '') : x.symbol, h = x.history || [];
      if (h.length) got++;
      for (const d of h) { rows.push(`${new Date(d.t * 1000).toISOString().slice(0, 10)},${coin},${x.symbol},${d.l},${d.s}`); minT = Math.min(minT, d.t); maxT = Math.max(maxT, d.t); }
    }
    log(`liq: ${Math.min(i + 20, pairs.length)} из ${pairs.length}`);
    if (i + 20 < pairs.length) await wait(31000); // лимит Coinalyze — 40 запросов в минуту, каждая монета = 1 запрос
  }
  const day = t => new Date(t * 1000).toISOString().slice(0, 10);
  notes.push(`Binance на Coinalyze: код ${code}; монет с данными ${got} из ${want.length}`);
  if (got) notes.push(`дни: с ${day(minT)} по ${day(maxT)}, строк ${rows.length - 1}`);
  if (missing.length) notes.push(`нет на Coinalyze: ${missing.join(', ')}`);
  const files = [{ name: 'readme.txt', content: `ZYNQEL bot v${VERSION} /liq, ${new Date(now).toISOString()}\n` + notes.join('\n') + '\n' }, { name: 'liq.csv', content: rows.join('\n') + '\n' }];
  return { zip: zipFiles(files), notes };
}

// ---------- стратегия 2 «⚡ Активные свечи» (v2.10, на проверке) ----------
/* Рывок вверх из узкого коридора на большом объёме. Правило заморожено как есть (sim2/PREREG_BREAKOUT_H.md, BO-FWD):
 *  • коридор = 48 предыдущих часовых свечей; его ширина не больше медианы ширины таких коридоров за 30 дней (берём каждые 6 часов);
 *  • часовая свеча закрылась выше верха коридора, объём свечи ≥ 2 × медианы объёма свечей коридора;
 *  • BTC выше средней 50 дневных закрытий (по вчерашний день);
 *  • вход — закрытие свечи пробоя, стоп — низ коридора; стоп подтягивается к минимуму последних 24 часов; не дольше 7 дней.
 * На истории: 2024–26 в плюсе (~+0.1R на сделку), но на 40 монетах в 2021–23 в минусе — поэтому бот ведёт её «на бумаге»
 * и помечает такие свечи, а решение «в бой» — после проверки на данных после 22.10.2026.
 * v2.11 «⚡ Ранний вход» (sim2/PREREG_VSPIKE.md, VS-FWD): тот же узкий коридор, но вход раньше пробоя — зелёная свеча на объёме
 * ≥ 3 × медианы, закрытие внутри коридора и выше его середины; фильтр BTC и выходы — как у пробоя. Ведётся отдельно, тоже «на бумаге». */
const ACTIVE = { N: 48, look: 720, step: 6, volX: 2, vsVol: 3, trailN: 24, maxH: 168, fee: 0.0011, minRisk: 0.002, nearTop: 0.01, risk: 0.25 };
const activeCoins = () => CORE.map(c => c.id).concat(LIQ_EXTRA).map(id => ({ id, sym: id + 'USDT' }));
const medianOf = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
function corridorAt(X, k, N = ACTIVE.N) { // коридор из N свечей ПЕРЕД свечой k
  let hi = -Infinity, lo = Infinity;
  for (let j = k - N; j < k; j++) { hi = Math.max(hi, X.h[j]); lo = Math.min(lo, X.l[j]); }
  return { hi, lo, w: hi / lo - 1 };
}
/* X — закрытые часовые свечи {t,o,h,l,c,v} (массивы по возрастанию времени). Проверяет свечу k (по умолчанию — последнюю). */
function activeCheck(X, k = X.t.length - 1, A = ACTIVE) {
  const N = A.N;
  if (k < N + A.look || X.t[k] - X.t[k - N] !== N * (A.bar || HOUR)) return null;
  const R = corridorAt(X, k, N);
  const past = []; for (let j = k - A.look; j < k; j += A.step) past.push(corridorAt(X, j, N).w);
  const wMed = medianOf(past), vMed = medianOf(X.v.slice(k - N, k)), close = X.c[k], risk = close - R.lo;
  const tight = R.w <= wMed;
  const breakout = close > R.hi && X.v[k] >= A.volX * vMed && tight && risk > 0 && risk / close >= A.minRisk;
  return { t: X.t[k], hi: R.hi, lo: R.lo, w: R.w, wMed, tight, close, vol: X.v[k], vMed, risk, breakout };
}
/* «⚡ Ранний вход»: зелёная свеча на объёме ≥ 3 × медианы внутри узкого коридора, закрытие выше середины коридора, но не выше верха. */
function earlyCheck(X, k = X.t.length - 1, A = ACTIVE) {
  const ck = activeCheck(X, k, A); if (!ck) return null;
  ck.early = X.c[k] > X.o[k] && ck.close <= ck.hi && ck.close > (ck.hi + ck.lo) / 2 && X.v[k] >= A.vsVol * ck.vMed && ck.tight && ck.risk > 0 && ck.risk / ck.close >= A.minRisk;
  return ck;
}
/* BTC выше средней 50 дневных закрытий — по вчерашний день относительно свечи t (как в проверке). daily: [{t, c}] — закрытые дневки. */
function btcBullAt(daily, t) {
  const m = new Map((daily || []).map(x => [Math.floor(x.t / DAY_MS), x.c]));
  const d = Math.floor(t / DAY_MS) - 1, x = m.get(d);
  let s = 0, n = 0; for (let k = 0; k < 50; k++) { const y = m.get(d - k); if (y) { s += y; n++; } }
  return x && n >= 45 ? x > s / n : false;
}
/* v2.12 «живой» фильтр BTC (sim2/PREREG_LIVEFILT.md): часовое закрытие BTC в тот же час, что и свеча сигнала,
 * выше той же средней 50 дневных закрытий по вчерашний день. Включается сразу, а не ждёт закрытия дня. */
function btcLiveBullAt(daily, btcX, t) {
  const m = new Map((daily || []).map(x => [Math.floor(x.t / DAY_MS), x.c]));
  const d = Math.floor(t / DAY_MS) - 1; if (m.get(d) == null || !btcX) return false;
  let s = 0, n = 0; for (let k = 0; k < 50; k++) { const y = m.get(d - k); if (y) { s += y; n++; } }
  if (n < 45) return false;
  const i = btcX.t.lastIndexOf(t);
  return i >= 0 && btcX.c[i] > s / n;
}
/* v2.13 «🔻 Ранний шорт» (sim2/PREREG_SHORT3.md — вариант «ранний шорт, 48ч, цель 2R, BTC ниже»; замечен после подбора, поэтому
 * только «на бумаге»): в узком коридоре 48 часов красная свеча на объёме ≥ 3 × медианы закрылась ниже середины коридора, но не ниже низа;
 * BTC ниже средней 50 дней (тот же фильтр, что у лонгов стратегии 2, наоборот). Шорт по закрытию свечи, стоп — верх коридора,
 * цель — 2 риска вниз, не дольше 96 часов. На истории в сумме плюс, но держится на редких днях обвалов: 3 года из 6 в минусе. */
const SHORTE = { maxH: 96, tgtR: 2, risk: 0.1 };
/* v2.14 «🔻 Ранний шорт 30м» (sim2/PREREG_M30.md): то же правило на 30-минутных свечах — коридор 48 часов = 96 свечей,
 * узость — по 30 дням (1440 свечей, каждые 6 часов), объём ≥ 3 × медианы 30-минутных свечей коридора, выход — как у часового (цель 2R, до 96 часов). */
const M30 = 30 * 60 * 1000;
const ACTIVE30 = Object.assign({}, ACTIVE, { N: 96, look: 1440, step: 12, bar: M30 });
function shortEarlyCheck(X, k = X.t.length - 1, A = ACTIVE) {
  const ck = activeCheck(X, k, A); if (!ck) return null;
  ck.riskS = ck.hi - ck.close;
  ck.shortEarly = X.c[k] < X.o[k] && ck.close >= ck.lo && ck.close < (ck.hi + ck.lo) / 2 && X.v[k] >= A.vsVol * ck.vMed && ck.tight && ck.riskS > 0 && ck.riskS / ck.close >= A.minRisk;
  return ck;
}
function btcBearAt(daily, t) { // дневной вариант: вчерашнее закрытие BTC ниже средней 50 дневных закрытий
  const m = new Map((daily || []).map(x => [Math.floor(x.t / DAY_MS), x.c]));
  const d = Math.floor(t / DAY_MS) - 1, x = m.get(d);
  let s = 0, n = 0; for (let k = 0; k < 50; k++) { const y = m.get(d - k); if (y) { s += y; n++; } }
  return x && n >= 45 ? x < s / n : false;
}
function btcLiveBearAt(daily, btcX, t) { // живой: часовое закрытие BTC в тот же час ниже той же средней
  const m = new Map((daily || []).map(x => [Math.floor(x.t / DAY_MS), x.c]));
  const d = Math.floor(t / DAY_MS) - 1; if (m.get(d) == null || !btcX) return false;
  let s = 0, n = 0; for (let k = 0; k < 50; k++) { const y = m.get(d - k); if (y) { s += y; n++; } }
  if (n < 45) return false;
  const i = btcX.t.lastIndexOf(t);
  return i >= 0 && btcX.c[i] < s / n;
}
function shortOpen(c, ck, bar = HOUR) {
  const p = { id: c.id, sym: c.sym, dir: 'short', t0: ck.t, entry: ck.close, stop0: ck.hi, stop: ck.hi, risk: ck.riskS, lo: ck.lo, hi: ck.hi, w: ck.w,
    target: ck.close - SHORTE.tgtR * ck.riskS, volX: ck.vMed > 0 ? ck.vol / ck.vMed : null, lastT: ck.t, openedAt: ck.t + bar };
  if (bar !== HOUR) p.bar = bar; // v2.14: 30-минутный вариант
  return p;
}
/* Ведёт шорт по закрытым свечам новее p.lastT: стоп (максимум свечи ≥ стопа → по max(стоп, открытие)), цель 2R, не дольше 96 часов.
 * Свечи — того же размера, что при входе (p.bar; по умолчанию часовые). */
function shortUpdate(p, X, A = ACTIVE) {
  const done = (ex, reason, t) => { const ret = 1 - ex / p.entry - A.fee; return { exit: ex, reason, t, ret, R: ret / (p.risk / p.entry) }; };
  const bar = p.bar || HOUR, maxB = Math.round(SHORTE.maxH * HOUR / bar);
  for (let j = 0; j < X.t.length; j++) {
    if (X.t[j] <= p.lastT) continue;
    const h = Math.round((X.t[j] - p.t0) / bar);
    p.lastT = X.t[j];
    if (h > maxB) return done(X.c[j], 'time', X.t[j]);
    if (X.h[j] >= p.stop) return done(Math.max(p.stop, X.o[j]), 'stop', X.t[j]);
    if (X.l[j] <= p.target) return done(p.target, 'target', X.t[j]);
    if (h >= maxB) return done(X.c[j], 'time', X.t[j]);
  }
  return null;
}
function msgShortEntry(p, opts = {}) {
  const stopPct = (p.stop0 - p.entry) / p.entry, risk = opts.shortRisk || SHORTE.risk;
  const size = Math.min(100, risk / (stopPct * 100) * 100);
  const late = opts.lateMin >= 10 ? `\n⏰ Свеча закрылась ${opts.lateMin} мин назад (бот перезапускался) — цена могла уйти.` : '';
  const m30 = p.bar === M30;
  return `🔻 <b>Ранний шорт${m30 ? ' 30м' : ''} — ${p.id}</b> · 🧪 на проверке\n` +
    `Внутри узкого коридора 48 часов (${fmtPrice(p.lo)}–${fmtPrice(p.hi)}, ${(p.w * 100).toFixed(1)}%) ${m30 ? '30-минутная свеча' : 'свеча'} вниз` + (p.volX ? ` на объёме ×${p.volX.toFixed(1)} от обычного` : '') + `: закрытие <b>${fmtPrice(p.entry)}</b>, до низа коридора ${((1 - p.lo / p.entry) * 100).toFixed(1)}%. BTC ниже средней за 50 дней.\n` +
    `Ориентиры: стоп выше ${fmtPrice(p.stop0)} (+${(stopPct * 100).toFixed(1)}%), цель <b>${fmtPrice(p.target)}</b> (−${(stopPct * 200).toFixed(1)}%, 2 риска) — забрать сразу; не дольше 4 дней.\n` +
    `Если пробуешь: риск ${risk}% депозита → позиция ≈ ${size.toFixed(0)}% депозита.` + late + '\n' +
    (m30 ? `<i>Ведётся «на бумаге» для сравнения с часовым. На истории сделок больше и в сумме больше (2026: −48R против −83R у часового), но прибыль ещё сильнее держится на редких днях обвалов, а просадки глубже. Заранее записанную проверку не прошёл. Риск — минимальный. Не финансовая рекомендация.</i>`
      : `<i>Ведётся «на бумаге». На истории в сумме плюс, но он держится на редких днях обвалов: в 3 годах из 6 (и в 2026) — минус, подряд бывало до 57 убыточных. Риск — минимальный. Не финансовая рекомендация.</i>`);
}
const SHORT_REASON = { stop: 'цена вернулась к верху коридора (стоп)', target: 'цель 2R взята', time: 'прошло 4 дня' };
function msgShortExit(p) {
  const hrs = Math.max(1, Math.round((p.closedAt - p.openedAt) / HOUR));
  return `🔻 <b>${p.id}</b> — ранний шорт${p.bar === M30 ? ' 30м' : ''} закрыт «на бумаге» @ ${fmtPrice(p.exit)}: ${SHORT_REASON[p.reason] || p.reason}. ` +
    `Итог ${pct(p.result)} (${p.R >= 0 ? '+' : '−'}${Math.abs(p.R).toFixed(2)}R) за ${hrs < 48 ? hrs + ' ч' : Math.round(hrs / 24) + ' дн.'}`;
}
function activeOpen(c, ck) {
  return { id: c.id, sym: c.sym, t0: ck.t, entry: ck.close, stop0: ck.lo, stop: ck.lo, risk: ck.risk, hi: ck.hi, w: ck.w,
    volX: ck.vMed > 0 ? ck.vol / ck.vMed : null, lastT: ck.t, openedAt: ck.t + HOUR };
}
/* Ведёт позицию по закрытым свечам X, которые новее p.lastT. Возвращает {exit, reason, t, ret, R} при выходе, иначе null. */
function activeUpdate(p, X, A = ACTIVE) {
  const done = (ex, reason, t) => { const ret = ex / p.entry - 1 - A.fee; return { exit: ex, reason, t, ret, R: ret / (p.risk / p.entry) }; };
  for (let j = 0; j < X.t.length; j++) {
    if (X.t[j] <= p.lastT) continue;
    const h = Math.round((X.t[j] - p.t0) / HOUR);
    p.lastT = X.t[j];
    if (h > A.maxH) return done(X.c[j], 'time', X.t[j]); // бот был выключен дольше срока — закрываем по первой доступной свече
    if (X.l[j] <= p.stop) return done(Math.min(p.stop, X.o[j]), p.stop > p.stop0 ? 'trail' : 'stop', X.t[j]);
    let lo = Infinity; for (let q = Math.max(0, j - A.trailN + 1); q <= j; q++) lo = Math.min(lo, X.l[q]);
    if (X.c[j] < lo + 1e-12 && h > A.trailN) return done(X.c[j], 'trail', X.t[j]);
    p.stop = Math.max(p.stop, lo);
    if (h >= A.maxH) return done(X.c[j], 'time', X.t[j]);
  }
  return null;
}
function msgActiveEntry(p, opts = {}) {
  const stopPct = (p.entry - p.stop0) / p.entry, risk = opts.activeRisk || ACTIVE.risk;
  const size = Math.min(100, risk / (stopPct * 100) * 100);
  const late = opts.lateMin >= 10 ? `\n⏰ Свеча закрылась ${opts.lateMin} мин назад (бот перезапускался) — цена могла уйти.` : '';
  return `⚡ <b>Активная свеча — ${p.id}</b> · 🧪 стратегия 2 на проверке\n` +
    `Часовая свеча закрылась на <b>${fmtPrice(p.entry)}</b> — выше максимума 48 часов (${fmtPrice(p.hi)})` + (p.volX ? `, объём ×${p.volX.toFixed(1)} от обычного` : '') + `.\n` +
    `Перед этим 2 дня цена стояла в узком коридоре ${fmtPrice(p.stop0)}–${fmtPrice(p.hi)} (${(p.w * 100).toFixed(1)}% — уже обычного для монеты).\n` +
    `Ориентиры: стоп ниже ${fmtPrice(p.stop0)} (−${(stopPct * 100).toFixed(1)}%), дальше стоп подтягивается к минимуму последних 24 часов; не дольше 7 дней.\n` +
    `Если пробуешь: риск ${risk}% депозита → позиция ≈ ${size.toFixed(0)}% депозита.` + late + '\n' +
    `<i>Бот ведёт эту стратегию «на бумаге»: на истории 2024–26 она в плюсе, а в 2021–23 — в минусе. Это пометка, не сигнал основной стратегии. Не финансовая рекомендация.</i>`;
}
const ACTIVE_REASON = { stop: 'цена вернулась в коридор (стоп)', trail: 'цена опустилась до минимума последних 24 часов', time: 'прошло 7 дней' };
function msgActiveExit(p) {
  const hrs = Math.max(1, Math.round((p.closedAt - p.openedAt) / HOUR));
  return `⚡ <b>${p.id}</b> — активная свеча закрыта «на бумаге» @ ${fmtPrice(p.exit)}: ${ACTIVE_REASON[p.reason] || p.reason}. ` +
    `Итог ${pct(p.result)} цены (${p.R >= 0 ? '+' : '−'}${Math.abs(p.R).toFixed(2)}R) за ${hrs < 48 ? hrs + ' ч' : Math.round(hrs / 24) + ' дн.'}`;
}
function msgEarlyEntry(p, opts = {}) {
  const stopPct = (p.entry - p.stop0) / p.entry, risk = opts.activeRisk || ACTIVE.risk;
  const size = Math.min(100, risk / (stopPct * 100) * 100);
  const late = opts.lateMin >= 10 ? `\n⏰ Свеча закрылась ${opts.lateMin} мин назад (бот перезапускался) — цена могла уйти.` : '';
  return `⚡ <b>Ранний вход — ${p.id}</b> · 🧪 на проверке\n` +
    `Внутри узкого коридора 48 часов (${fmtPrice(p.stop0)}–${fmtPrice(p.hi)}, ${(p.w * 100).toFixed(1)}%) свеча вверх` + (p.volX ? ` на объёме ×${p.volX.toFixed(1)} от обычного` : '') + `: закрытие <b>${fmtPrice(p.entry)}</b>, до верха коридора ${((p.hi / p.entry - 1) * 100).toFixed(1)}%.\n` +
    `Пробоя ещё нет: вход раньше, но и ложных движений больше.\n` +
    `Ориентиры: стоп ниже ${fmtPrice(p.stop0)} (−${(stopPct * 100).toFixed(1)}%), дальше стоп подтягивается к минимуму последних 24 часов; не дольше 7 дней.\n` +
    `Если пробуешь: риск ${risk}% депозита → позиция ≈ ${size.toFixed(0)}% депозита.` + late + '\n' +
    `<i>Ведётся «на бумаге»: на истории 2024–26 в плюсе, на 40 альтах в 2021–23 — в минусе; в плюс закрывается ~1 сделка из 3. Не сигнал основной стратегии. Не финансовая рекомендация.</i>`;
}
function msgEarlyExit(p) {
  const hrs = Math.max(1, Math.round((p.closedAt - p.openedAt) / HOUR));
  return `⚡ <b>${p.id}</b> — ранний вход закрыт «на бумаге» @ ${fmtPrice(p.exit)}: ${ACTIVE_REASON[p.reason] || p.reason}. ` +
    `Итог ${pct(p.result)} цены (${p.R >= 0 ? '+' : '−'}${Math.abs(p.R).toFixed(2)}R) за ${hrs < 48 ? hrs + ' ч' : Math.round(hrs / 24) + ' дн.'}`;
}
function activeSummary(list) {
  if (!list || !list.length) return 'закрытых пока нет';
  const w = list.filter(t => t.result > 0).length, avg = list.reduce((s, t) => s + t.result, 0) / list.length, avgR = list.reduce((s, t) => s + t.R, 0) / list.length;
  return `${list.length} на бумаге, в плюс ${w} (${(w / list.length * 100).toFixed(0)}%), средне ${pct(avg)} цены (${avgR >= 0 ? '+' : '−'}${Math.abs(avgR).toFixed(2)}R)`;
}
function msgActiveStatus(st) {
  const W = st.activeWatch, open = Object.values(st.active || {});
  let t = '⚡ <b>Активные свечи</b> (стратегия 2, на проверке «на бумаге»)\n';
  t += W ? `Рынок: ${W.bull == null ? 'нет данных по BTC' : W.bull ? 'BTC выше средней за 50 дней — отмечаю лонги' : 'BTC ниже средней за 50 дней — лонги не отмечаю, 🔻 ранние шорты отмечаю'} (${W.live ? 'по последнему часовому закрытию, ' : 'по вчерашнему закрытию, '}проверка ${new Date(W.t).toISOString().slice(11, 16)} UTC).\n` : 'Проверка идёт сейчас или будет в начале следующего часа.\n';
  const fmtOpen = list => list.length ? list.map(p => `${p.id} от ${fmtPrice(p.entry)}, стоп ${fmtPrice(p.stop)}`).join('; ') : 'нет';
  t += `<b>Пробой коридора</b> — закрыто: ${activeSummary(st.activeClosed)}\nОткрыто: ${fmtOpen(open)}\n`;
  t += `<b>Ранний вход</b> (всплеск объёма внутри коридора) — закрыто: ${activeSummary(st.earlyClosed)}\nОткрыто: ${fmtOpen(Object.values(st.early || {}))}\n`;
  const so = Object.values(st.shortE || {});
  const fmtShort = list => list.length ? list.map(p => `${p.id} от ${fmtPrice(p.entry)}, стоп ${fmtPrice(p.stop)}, цель ${fmtPrice(p.target)}`).join('; ') : 'нет';
  t += `<b>🔻 Ранний шорт</b> (когда BTC ниже средней) — закрыто: ${activeSummary(st.shortEClosed)}\nОткрыто: ${fmtShort(so)}\n`;
  if (st.short30Slot || st.shortE30) { // v2.14
    t += `<b>🔻 Ранний шорт 30м</b> (30-минутные свечи, для сравнения${st.short30Slot ? `, проверка ${new Date(st.short30Slot).toISOString().slice(11, 16)} UTC` : ''}) — закрыто: ${activeSummary(st.shortE30Closed)}\nОткрыто: ${fmtShort(Object.values(st.shortE30 || {}))}\n`;
  }
  if (W && W.list && W.list.length) t += `Готовятся (узкий коридор 48 ч, цена у верхней границы): ` + W.list.slice(0, 12).map(x => `${x.id} (до пробоя ${(x.dist * 100).toFixed(1)}%)`).join(', ');
  else if (W) t += 'Готовятся: сейчас нет монет у верхней границы узкого коридора.';
  return t;
}
function activeCsv(st) {
  const head = 'type,coin,status,entry_time_utc,entry,stop0,exit_time_utc,exit,reason,result,R';
  const iso = t => t ? new Date(t).toISOString() : '';
  const rows = [];
  for (const [type, open, closed] of [['breakout', st.active, st.activeClosed], ['early', st.early, st.earlyClosed], ['short_early', st.shortE, st.shortEClosed], ['short_early_30m', st.shortE30, st.shortE30Closed]]) {
    for (const p of closed || []) rows.push([type, p.id, 'closed', iso(p.openedAt), p.entry, p.stop0, iso(p.closedAt), p.exit, p.reason, p.result, p.R].join(','));
    for (const p of Object.values(open || {})) rows.push([type, p.id, 'open', iso(p.openedAt), p.entry, p.stop0, '', '', '', '', ''].join(','));
  }
  return [head].concat(rows).join('\n') + '\n';
}
/* Раз в час, после закрытия часовой свечи: ведём открытые «на бумаге», ищем новые активные свечи.
 * io.getHourlyBars(sym) → закрытые часовые свечи {t,o,h,l,c,v} (≥ 769 штук); io.getBtcDaily() → [{t, c}] закрытые дневки BTC. */
async function activeTick(st, io, opts = {}) {
  const now = io.now(), hour = Math.floor(now / HOUR) * HOUR;
  if (st.activeHour === hour) return { skipped: true };
  st.active = st.active || {}; st.activeClosed = st.activeClosed || [];
  const out = [], send = async t => { out.push(t); if (!opts.silent) await (io.sendActive || io.send)(t); };
  let daily = null; try { daily = await io.getBtcDaily(); } catch (e) { console.error('  активные свечи, BTC:', e.message); }
  const live = opts.btcFilter !== 'daily'; // v2.12: по умолчанию живой фильтр BTC (каждый час)
  let btcX = null; if (live) { try { btcX = await io.getHourlyBars('BTCUSDT'); } catch (e) { console.error('  активные свечи, BTC часовые:', e.message); } }
  const bullAt = t => live ? btcLiveBullAt(daily, btcX, t) : btcBullAt(daily, t);
  const watch = []; let errors = 0, checked = 0;
  st.early = st.early || {}; st.earlyClosed = st.earlyClosed || [];
  const KINDS = [
    { key: 'active', closed: 'activeClosed', strategy: 'active', check: activeCheck, flag: 'breakout', msgIn: msgActiveEntry, msgOut: msgActiveExit, name: 'активная свеча' },
  ];
  if (opts.early !== false) KINDS.push({ key: 'early', closed: 'earlyClosed', strategy: 'early', check: earlyCheck, flag: 'early', msgIn: msgEarlyEntry, msgOut: msgEarlyExit, name: 'ранний вход' });
  st.shortE = st.shortE || {}; st.shortEClosed = st.shortEClosed || [];
  const bearAt = t => live ? btcLiveBearAt(daily, btcX, t) : btcBearAt(daily, t);
  if (opts.earlyShort !== false) KINDS.push({ key: 'shortE', closed: 'shortEClosed', strategy: 'short_early', check: shortEarlyCheck, flag: 'shortEarly', msgIn: msgShortEntry, msgOut: msgShortExit, name: 'ранний шорт', short: true });
  for (const c of activeCoins()) {
    try {
      const X = c.sym === 'BTCUSDT' && btcX ? btcX : await io.getHourlyBars(c.sym);
      if (!X || X.t.length < ACTIVE.N + ACTIVE.look + 1) continue;
      checked++;
      const last = X.t.length - 1;
      for (const K of KINDS) { // пробой и ранний вход ведутся независимо: у каждого своя позиция по монете (как в проверках)
        const p = st[K.key][c.id];
        if (p) {
          const r = K.short ? shortUpdate(p, X) : activeUpdate(p, X);
          if (!r) continue; // позиция открыта — новых входов этого вида по монете нет
          Object.assign(p, { exit: r.exit, result: r.ret, R: r.R, reason: r.reason, closedAt: r.t + HOUR });
          st[K.closed].push({ strategy: K.strategy, id: p.id, dir: K.short ? 'short' : 'long', entry: p.entry, stop0: p.stop0, exit: p.exit, result: p.result, R: p.R, reason: p.reason, openedAt: p.openedAt, closedAt: p.closedAt });
          if (st[K.closed].length > 1000) st[K.closed] = st[K.closed].slice(-1000);
          delete st[K.key][c.id];
          await send(K.msgOut(p));
          if (r.t === X.t[last]) continue; // свеча выхода не бывает свечой нового входа (как в проверке)
        }
        const ck = K.check(X, last);
        if (!ck) continue;
        if (!ck[K.flag]) {
          if (K.key === 'active' && ck.tight && ck.close <= ck.hi && ck.close >= ck.hi * (1 - ACTIVE.nearTop)) watch.push({ id: c.id, dist: ck.hi / ck.close - 1 });
          continue;
        }
        if (!daily || (live && !btcX)) { errors++; continue; }
        if (K.short ? !bearAt(ck.t) : !bullAt(ck.t)) { console.log(`  ${K.name} ${c.id}, но BTC ${K.short ? 'выше' : 'ниже'} средней за 50 дней — не отмечаю`); continue; }
        const np = K.short ? shortOpen(c, ck) : activeOpen(c, ck);
        st[K.key][c.id] = np;
        await send(K.msgIn(np, { activeRisk: opts.activeRisk, shortRisk: opts.shortRisk, lateMin: Math.round((now - (ck.t + HOUR)) / 60000) }));
      }
    } catch (e) { errors++; if (errors <= 3) console.error('  активные свечи ' + c.id + ':', e.message); }
  }
  watch.sort((a, b) => a.dist - b.dist);
  const bullNow = !daily ? null : live ? (btcX && btcX.t.length ? btcLiveBullAt(daily, btcX, btcX.t[btcX.t.length - 1]) : null) : btcBullAt(daily, now);
  if (checked > 0) { st.activeHour = hour; st.activeWatch = { t: hour, list: watch, bull: bullNow, live }; }
  return { checked, errors, messages: out };
}
/* v2.14 «🔻 Ранний шорт 30м»: каждые 30 минут, после закрытия 30-минутной свечи — то же правило, что у часового раннего шорта,
 * на 30-минутных свечах (ACTIVE30). Своя позиция по монете, независимо от часового. Фильтр BTC — 30-минутное закрытие BTC
 * против средней 50 дневных закрытий по вчерашний день (или вчерашнее дневное закрытие, если ACTIVE_BTC_FILTER=daily).
 * io.getBars30(sym) → закрытые 30-минутные свечи (≥ 1537 штук). */
async function short30Tick(st, io, opts = {}) {
  const now = io.now(), slot = Math.floor(now / M30) * M30;
  if (st.short30Slot === slot) return { skipped: true };
  st.shortE30 = st.shortE30 || {}; st.shortE30Closed = st.shortE30Closed || [];
  const out = [], send = async t => { out.push(t); if (!opts.silent) await (io.sendActive || io.send)(t); };
  let daily = null; try { daily = await io.getBtcDaily(); } catch (e) { console.error('  ранний шорт 30м, BTC:', e.message); }
  const live = opts.btcFilter !== 'daily';
  let btcX = null; try { btcX = await io.getBars30('BTCUSDT'); } catch (e) { console.error('  ранний шорт 30м, BTC 30м:', e.message); }
  const bearAt = t => live ? btcLiveBearAt(daily, btcX, t) : btcBearAt(daily, t);
  let errors = 0, checked = 0;
  for (const c of activeCoins()) {
    try {
      const X = c.sym === 'BTCUSDT' && btcX ? btcX : await io.getBars30(c.sym);
      if (!X || X.t.length < ACTIVE30.N + ACTIVE30.look + 1) continue;
      checked++;
      const last = X.t.length - 1, p = st.shortE30[c.id];
      if (p) {
        const r = shortUpdate(p, X);
        if (!r) continue;
        Object.assign(p, { exit: r.exit, result: r.ret, R: r.R, reason: r.reason, closedAt: r.t + M30 });
        st.shortE30Closed.push({ strategy: 'short_early_30m', id: p.id, dir: 'short', entry: p.entry, stop0: p.stop0, exit: p.exit, result: p.result, R: p.R, reason: p.reason, openedAt: p.openedAt, closedAt: p.closedAt });
        if (st.shortE30Closed.length > 1000) st.shortE30Closed = st.shortE30Closed.slice(-1000);
        delete st.shortE30[c.id];
        await send(msgShortExit(p));
        if (r.t === X.t[last]) continue; // свеча выхода не бывает свечой нового входа
      }
      const ck = shortEarlyCheck(X, last, ACTIVE30);
      if (!ck || !ck.shortEarly) continue;
      if (!daily || (live && !btcX)) { errors++; continue; }
      if (!bearAt(ck.t)) { console.log(`  ранний шорт 30м ${c.id}, но BTC выше средней за 50 дней — не отмечаю`); continue; }
      const np = shortOpen(c, ck, M30);
      st.shortE30[c.id] = np;
      await send(msgShortEntry(np, { shortRisk: opts.shortRisk, lateMin: Math.round((now - (ck.t + M30)) / 60000) }));
    } catch (e) { errors++; if (errors <= 3) console.error('  ранний шорт 30м ' + c.id + ':', e.message); }
  }
  if (checked > 0) st.short30Slot = slot;
  return { checked, errors, messages: out };
}

// ---------- v2.15 «🪝 Ловец проливов»: лимитки далеко ниже цены, торговля на Bybit (sim2/PREREG_WICK.md); v2.16 — вторая ступень, нервный рынок, выходные ----------
/* Каждый час по закрытию часовой свечи P: лимитка на покупку (PostOnly, комиссия maker) по P × (1 − m·σ), σ — стандартное отклонение
 * часовых изменений монеты за предыдущие 30 дней. Исполнилась — через 60 минут продаём по рынку. Не исполнилась за час — снимаем и ставим новую.
 * На истории (48 монет Binance, 2022–2026): в среднем плюс на сделку после комиссии, минутки и Bybit подтвердили; но тяжёлые дни
 * (10.10.2025, обвалы LUNA/FTT) — поэтому только ликвидные монеты, дневной стоп и стоп по балансу.
 * v2.16 (решение пользователя 26.10.2026; sim2/PREREG_WICK5.md — по отдельности эти изменения строгую проверку НЕ прошли, связка считалась в wick6_combo.js):
 *  — «ступень 2»: вторая лимитка на 7.5σ, своя продажа через 60 мин после своего исполнения;
 *  — «нервный рынок»: σ BTC по 168 часам выше медианы этого показателя за прошлые 365 дней → обе лимитки ×2;
 *  — выходные (суббота и воскресенье по UTC): только обычная лимитка 5σ, без удвоения;
 *  — ставка 6% баланса (не меньше минимума Bybit $5), дневной стоп 12% баланса на начало суток, стоп торговли при балансе на 30% ниже максимума.
 * Режимы: «реальные деньги» (BYBIT_KEY + BYBIT_SECRET + WICK_LIVE=1), иначе «бумага» по ценам Bybit. Сообщения — только в личку (ADMIN_CHAT_ID). */
const WICK_DEF = { m: 5, lad: 7.5, nervMult: 2, weekend: 'base', usd: null, pct: 6, minUsd: 5, maxUsd: 10, holdMin: 60, lev: 10,
  dayLoss: null, dayLossPct: 12, fallbackDayLoss: 4, minEquity: null, ddStopPct: 30, maker: 0.0002, taker: 0.00055,
  coins: ['SOL', 'XRP', 'DOGE', 'LINK', 'LTC', 'NEAR', 'BNB', 'ADA'] };
const BYBIT = 'https://api.bybit.com';
function bybitClient({ key, secret, base = BYBIT, fetchFn, nowFn = Date.now, recv = 10000, waitFn } = {}) {
  const crypto = require('crypto'); const F = fetchFn || ((...a) => fetch(...a)); let offset = 0, synced = false;
  waitFn = waitFn || (ms => new Promise(res => setTimeout(res, ms)));
  const qs = p => Object.keys(p).filter(k => p[k] !== undefined && p[k] !== null).map(k => `${k}=${encodeURIComponent(p[k])}`).join('&');
  async function call(method, path, params = {}, auth = false, retry = true, tries = 0) {
    const q = method === 'GET' ? qs(params) : '', body = method === 'POST' ? JSON.stringify(params) : '';
    const headers = { 'User-Agent': 'zynqel-bot/' + VERSION };
    if (method === 'POST') headers['Content-Type'] = 'application/json';
    if (auth) {
      if (!key || !secret) throw new Error('нет ключа Bybit (BYBIT_KEY / BYBIT_SECRET)');
      const ts = String(Math.round(nowFn() + offset));
      headers['X-BAPI-API-KEY'] = key; headers['X-BAPI-TIMESTAMP'] = ts; headers['X-BAPI-RECV-WINDOW'] = String(recv); headers['X-BAPI-SIGN-TYPE'] = '2';
      headers['X-BAPI-SIGN'] = crypto.createHmac('sha256', secret).update(ts + key + recv + (method === 'GET' ? q : body)).digest('hex');
    }
    const r = await F(base + path + (q ? '?' + q : ''), { method, headers, body: method === 'POST' ? body : undefined });
    const text = await r.text(); let d;
    if ((r.status === 429 || /Too many visits|rate limit/i.test(text)) && tries < 4) { // v2.15.2: лимит частоты — ждём и повторяем
      const reset = +((r.headers && r.headers.get && r.headers.get('x-bapi-limit-reset-timestamp')) || 0);
      await waitFn(Math.min(5000, Math.max(800, reset ? reset - nowFn() + 100 : 1000 * (tries + 1))));
      return call(method, path, params, auth, retry, tries + 1);
    }
    try { d = JSON.parse(text); } catch (e) {
      const err = new Error(`Bybit HTTP ${r.status}${r.status === 403 ? ' — Bybit не отвечает этому серверу (похоже, ограничение по стране/региону)' : ''}: ${String(text).slice(0, 100)}`); err.http = r.status; throw err; }
    if (d.retCode === 10002 && retry && !synced) { // время сервера разошлось с биржей — подстраиваемся и повторяем
      try { const t = await call('GET', '/v5/market/time', {}, false, false); const srv = t.timeNano ? Number(BigInt(t.timeNano) / 1000000n) : +t.timeSecond * 1000; offset = srv - nowFn(); synced = true; } catch (e) {}
      return call(method, path, params, auth, false);
    }
    if (d.retCode !== 0) { // ключ из ответа Bybit («origin_string[…]») в сообщения не пускаем
      const msg = String(d.retMsg || '').replace(/origin_string\[[^\]]*\]/g, '').replace(/[:\s]+$/, '') + (d.retCode === 10004 ? ' — Secret не подходит к ключу: проверь BYBIT_SECRET' : d.retCode === 10003 ? ' — ключ не найден: проверь BYBIT_KEY' : '');
      const err = new Error(`Bybit ${d.retCode}: ${msg}`); err.code = d.retCode; throw err; }
    return d.result;
  }
  return { pub: (p, a) => call('GET', p, a, false), get: (p, a) => call('GET', p, a, true), post: (p, a) => call('POST', p, a, true), hasKey: !!(key && secret) };
}
const stepDec = step => { const s = String(step); return s.includes('.') ? s.split('.')[1].replace(/0+$/, '').length : 0; };
const floorStep = (x, step) => { const d = stepDec(step), s = +step; return +(Math.floor(x / s + 1e-9) * s).toFixed(d); };
const ceilStep = (x, step) => { const d = stepDec(step), s = +step; return +(Math.ceil(x / s - 1e-9) * s).toFixed(d); };
const nearStep = (x, step) => { const d = stepDec(step), s = +step; return +(Math.round(x / s) * s).toFixed(d); };
/* Уровень лимитки по закрытым часовым свечам (старые → новые): σ — по 720 часовым изменениям, кончая предпоследним закрытием (как в проверке). */
function wickLevel(t, c, m) {
  const k = c.length - 1; if (k < 721) return null;
  let s = 0, s2 = 0, n = 0;
  for (let j = k - 720; j < k; j++) { if (t[j] - t[j - 1] !== HOUR) continue; const r = Math.log(c[j] / c[j - 1]); if (isFinite(r)) { s += r; s2 += r * r; n++; } }
  if (n < 600) return null; const mu = s / n, sig = Math.sqrt(Math.max(0, s2 / n - mu * mu)); if (!(sig > 0)) return null;
  return { P: c[k], sig, lim: c[k] * (1 - m * sig), depth: m * sig };
}
/* v2.16: σ на каждом закрытии часа по n изменениям, кончая предыдущим закрытием (как anchors() в sim2/wick6_combo.js). t — начала часовых свечей. */
function wickSigSeries(t, c, n, minN) {
  const N = c.length, S1 = new Float64Array(N + 1), S2 = new Float64Array(N + 1), K = new Float64Array(N + 1);
  for (let j = 0; j < N; j++) { let r = NaN; if (j > 0 && t[j] - t[j - 1] === HOUR) r = Math.log(c[j] / c[j - 1]); const ok = isFinite(r);
    S1[j + 1] = S1[j] + (ok ? r : 0); S2[j + 1] = S2[j] + (ok ? r * r : 0); K[j + 1] = K[j] + (ok ? 1 : 0); }
  const sig = new Float64Array(N).fill(NaN);
  for (let k = n + 1; k < N; k++) { const a = k - n, cnt = K[k] - K[a]; if (cnt < minN) continue; const mu = (S1[k] - S1[a]) / cnt, v = (S2[k] - S2[a]) / cnt - mu * mu; sig[k] = v > 0 ? Math.sqrt(v) : NaN; }
  return sig;
}
/* Медиана σ BTC (168 ч) по закрытиям часов за 365 дней до начала суток D (UTC); меньше 4000 значений — null. */
function wickNervMedian(t, sig, D) {
  const w = []; for (let k = 0; k < t.length; k++) { const T = t[k] + HOUR; if (T >= D - 365 * DAY_MS && T < D && sig[k] > 0) w.push(sig[k]); }
  if (w.length < 4000) return null; w.sort((a, b) => a - b); return w[w.length >> 1];
}
const wickBase = (cfg, eq) => cfg.usd > 0 ? cfg.usd : Math.max(cfg.minUsd, eq > 0 ? eq * cfg.pct / 100 : 0); // ставка на одну лимитку (без удвоения)
const wickDayLimit = (cfg, W) => cfg.dayLoss > 0 ? cfg.dayLoss : W.dayEq > 0 ? W.dayEq * cfg.dayLossPct / 100 : cfg.fallbackDayLoss;
const wickFloor = (cfg, W) => cfg.minEquity > 0 ? cfg.minEquity : W.peakEq > 0 ? W.peakEq * (1 - cfg.ddStopPct / 100) : null;
const wickCoin = s => String(s).split(':')[0], wickStep = s => String(s).includes(':') ? 2 : 1;
const wickLabel = s => wickStep(s) === 2 ? `${wickCoin(s)} (ступень 2)` : wickCoin(s);
const usd = x => (x < 0 ? '−$' : '+$') + Math.abs(x).toFixed(2);
function wickSummary(w) {
  const c = w.closed || []; if (!c.length) return 'закрытых сделок пока нет';
  const sum = c.reduce((a, x) => a + x.pnl, 0), win = c.filter(x => x.pnl > 0).length;
  return `${c.length} сделок, в плюс ${win} (${(win / c.length * 100).toFixed(0)}%), итого ${usd(sum)}`;
}
function wickCsv(w) {
  const iso = t => t ? new Date(t).toISOString() : '';
  return 'mode,coin,qty,entry,fill_time_utc,exit,exit_time_utc,fees,pnl_usd,level_depth,step,mult\n' +
    (w.closed || []).map(x => [x.paper ? 'paper' : 'live', x.sym, x.qty, x.entry, iso(x.fillT), x.exit, iso(x.exitT), (x.fee || 0).toFixed(5), x.pnl.toFixed(5), (x.depth || 0).toFixed(5), x.step || 1, x.mult || 1].join(',')).join('\n') + '\n';
}
/* Движок. ctx: { cl — bybitClient, live — торговать реальными деньгами, send(text) — в личку, now(), cfg — WICK_DEF с настройками, log, pace }.
 * Состояние — в st.wick. Ключи W.orders / W.pos — «места»: 'SOL' (обычная лимитка) и 'SOL:2' (ступень 2). */
function makeWick(st, ctx) {
  const cfg = Object.assign({}, WICK_DEF, ctx.cfg || {}), cl = ctx.cl, now = ctx.now || Date.now, log = ctx.log || (() => {});
  if (!(cfg.lad > cfg.m)) cfg.lad = 0;
  const W = st.wick = st.wick || {}; W.orders = W.orders || {}; W.pos = W.pos || {}; W.closed = W.closed || []; W.totalPnl = W.totalPnl || 0;
  W.cfg = { m: cfg.m, lad: cfg.lad, nervMult: cfg.nervMult, weekend: cfg.weekend, usd: cfg.usd, pct: cfg.pct, minUsd: cfg.minUsd, holdMin: cfg.holdMin, coins: cfg.coins,
    dayLoss: cfg.dayLoss, dayLossPct: cfg.dayLossPct, fallbackDayLoss: cfg.fallbackDayLoss, minEquity: cfg.minEquity, ddStopPct: cfg.ddStopPct };
  const live = !!ctx.live, inst = {}, errAt = {};
  let running = false;
  const pause = ms => ctx.pace === 0 ? Promise.resolve() : new Promise(res => setTimeout(res, ms));
  const say = async t => { try { await ctx.send('🪝 ' + t); } catch (e) { log('wick send: ' + e.message); } };
  const warn = async (k, t) => { if (errAt[k] && now() - errAt[k] < 3600000) return; errAt[k] = now(); await say(t); };
  const sym = c => c + 'USDT';
  const today = () => Math.floor(now() / DAY_MS);
  const dayPnl = () => (W.dayD === today() ? W.dayPnl || 0 : 0);
  const busyCoin = c => Object.keys(W.orders).concat(Object.keys(W.pos)).some(s => wickCoin(s) === c);
  const tag = o => `${(o.step || 1) === 2 ? ', ступень 2' : ''}${o.mult > 1 ? `, ×${o.mult} — нервный рынок` : ''}`;
  async function instrument(c) {
    if (inst[c]) return inst[c];
    const r = await cl.pub('/v5/market/instruments-info', { category: 'linear', symbol: sym(c) }); const x = r.list && r.list[0];
    if (!x) throw new Error('нет такой монеты на Bybit: ' + sym(c));
    return (inst[c] = { tick: x.priceFilter.tickSize, step: x.lotSizeFilter.qtyStep, minQty: +x.lotSizeFilter.minOrderQty, minNotional: +(x.lotSizeFilter.minNotionalValue || 5) });
  }
  async function hourly(c) { // закрытые часовые свечи, старые → новые
    const r = await cl.pub('/v5/market/kline', { category: 'linear', symbol: sym(c), interval: '60', limit: 800 });
    const L = (r.list || []).map(k => [+k[0], +k[4]]).filter(k => k[0] + HOUR <= now()).sort((a, b) => a[0] - b[0]);
    return { t: L.map(k => k[0]), c: L.map(k => k[1]) };
  }
  async function btcBars(fromT, limit, maxPages) { // часовые закрытые свечи BTC от fromT, старые → новые (листаем назад по end)
    const m = new Map(); let end = now();
    for (let p = 0; p < maxPages; p++) {
      const r = await cl.pub('/v5/market/kline', { category: 'linear', symbol: 'BTCUSDT', interval: '60', end, limit });
      const L = r.list || []; if (!L.length) break; let oldest = Infinity;
      for (const k of L) { const t = +k[0]; if (t < oldest) oldest = t; if (t + HOUR <= now() && t >= fromT) m.set(t, +k[4]); }
      if (oldest <= fromT || L.length < limit) break; end = oldest - 1; await pause(ctx.pace || 250);
    }
    const t = [...m.keys()].sort((a, b) => a - b); return { t, c: t.map(x => m.get(x)) };
  }
  async function btcNervous(H) { // «нервный рынок»: σ BTC по 168 часам выше медианы за прошлый год (медиана — раз в сутки)
    const D = Math.floor(H / DAY_MS) * DAY_MS;
    if (!(W.nerv && W.nerv.day === D && W.nerv.med > 0)) {
      const b = await btcBars(D - 365 * DAY_MS - 170 * HOUR, 1000, 12), med = wickNervMedian(b.t, wickSigSeries(b.t, b.c, 168, 140), D);
      if (!(med > 0)) throw new Error(`мало истории BTC (${b.t.length} часовых свечей)`);
      W.nerv = { day: D, med };
    }
    const b = await btcBars(H - 200 * HOUR, 200, 1), k = b.t.length - 1;
    if (k < 0 || b.t[k] !== H - HOUR) throw new Error('нет свежей часовой свечи BTC');
    const sig = wickSigSeries(b.t, b.c, 168, 140)[k]; if (!(sig > 0)) throw new Error('мало часовых свечей BTC');
    return { on: sig > W.nerv.med, sig, med: W.nerv.med };
  }
  async function regime(H) { // размер и ступени на этот час
    const wk = [0, 6].includes(new Date(H).getUTCDay()), full = !wk || cfg.weekend === 'all';
    let nerv = null;
    if (cfg.nervMult > 1 && full) { try { nerv = await btcNervous(H); } catch (e) { await warn('nerv', `не посчитал «нервный рынок» BTC (${e.message}) — ставлю обычный размер`); } }
    return { wk, nerv, mult: full && nerv && nerv.on ? cfg.nervMult : 1, lad: full ? cfg.lad : 0, skip: wk && cfg.weekend === 'off' };
  }
  async function minutes(c, start, end, limit) {
    const r = await cl.pub('/v5/market/kline', { category: 'linear', symbol: sym(c), interval: '1', start, end, limit });
    return (r.list || []).map(k => ({ t: +k[0], l: +k[3], c: +k[4] })).filter(k => k.t + 60000 <= now()).sort((a, b) => a.t - b.t);
  }
  async function orderInfo(c, link) {
    let r = await cl.get('/v5/order/realtime', { category: 'linear', symbol: sym(c), orderLinkId: link });
    let x = r.list && r.list[0];
    if (!x) { r = await cl.get('/v5/order/history', { category: 'linear', symbol: sym(c), orderLinkId: link }); x = r.list && r.list[0]; }
    return x || null;
  }
  async function positionOf(c) {
    const r = await cl.get('/v5/position/list', { category: 'linear', symbol: sym(c) });
    return (r.list || []).filter(p => +p.size > 0);
  }
  async function place(body) {
    try { return await cl.post('/v5/order/create', Object.assign({ positionIdx: W.posIdx || 0 }, body)); }
    catch (e) { // режим «хедж»: лонг — positionIdx 1
      if (e.code === 10001 && /position ?idx/i.test(e.message) && !W.posIdx) { W.posIdx = 1; return cl.post('/v5/order/create', Object.assign({ positionIdx: 1 }, body)); }
      throw e; }
  }
  async function cancel(c, link) {
    try { await cl.post('/v5/order/cancel', { category: 'linear', symbol: sym(c), orderLinkId: link }); }
    catch (e) { if (![110001, 170213].includes(e.code)) throw e; } // уже исполнен или снят
  }
  function record(s, p, exit, exitT, feeOut) {
    const fee = (p.feeIn || 0) + (feeOut || 0), pnl = (exit - p.entry) * p.qty - fee;
    const rec = { sym: wickCoin(s), step: wickStep(s), mult: p.mult || 1, qty: p.qty, entry: p.entry, fillT: p.fillT, exit, exitT, fee, pnl, depth: p.depth, paper: !live };
    W.closed.push(rec); if (W.closed.length > 2000) W.closed = W.closed.slice(-2000);
    if (W.dayD !== today()) { W.dayD = today(); W.dayPnl = 0; W.dayStopSaid = false; }
    W.dayPnl += pnl; W.totalPnl += pnl; delete W.pos[s];
    return rec;
  }
  async function cancelAll() { // снять все лимитки бота (с учётом исполнений)
    for (const s of Object.keys(W.orders)) { const c = wickCoin(s);
      try { if (live) { await cancel(c, W.orders[s].link); await absorb(s, W.orders[s], await orderInfo(c, W.orders[s].link)); } delete W.orders[s]; } catch (e) {} }
  }
  // каждый час: снять старые лимитки, поставить новые
  async function rollover() {
    const H = Math.floor(now() / HOUR) * HOUR;
    if (W.lastHour === H) return { skipped: true };
    let placed = 0, errors = 0; const notes = [];
    for (const s of Object.keys(W.orders)) { const o = W.orders[s], c = wickCoin(s); // прошлый час: снимаем (сначала учитываем исполнение)
      try { if (live) { await cancel(c, o.link); const x = await orderInfo(c, o.link); await absorb(s, o, x); } else await checkOrder(s, o); delete W.orders[s]; }
      catch (e) { errors++; await warn('cancel' + s, `не смог снять лимитку ${wickLabel(s)}: ${e.message}`); } }
    if (W.disabled) { W.lastHour = H; return { placed, errors, disabled: true }; }
    if (live) {
      try { const eq = await equity(); W.equity = eq;
        if (eq != null) { if (W.dayEqD !== today()) { W.dayEqD = today(); W.dayEq = eq; } if (!(W.peakEq >= eq)) W.peakEq = eq; }
        const fl = wickFloor(cfg, W);
        if (eq != null && fl != null && eq < fl) { W.disabled = true;
          await say(`баланс $${eq.toFixed(2)} — ниже порога $${fl.toFixed(2)}${cfg.minEquity > 0 ? '' : ` (на ${cfg.ddStopPct}% ниже максимума $${W.peakEq.toFixed(2)})`}. Остановил торговлю (открытые позиции закроются по плану). Включить снова: /wickstart.`);
          W.lastHour = H; return { placed, errors, stopped: true }; } }
      catch (e) { errors++; await warn('equity', `не получил баланс Bybit: ${e.message}. Повторю через 2 минуты.`); return { placed, errors, retry: true }; } // час не отмечаем — повтор скоро
    }
    const lim = wickDayLimit(cfg, W);
    if (dayPnl() <= -lim) { if (!W.dayStopSaid) { W.dayStopSaid = true; await say(`дневной стоп: за сегодня ${usd(dayPnl())} (предел −$${lim.toFixed(2)}) — новые лимитки не ставлю до 03:00 по Минску.`); } W.lastHour = H; return { placed, errors, dayStop: true }; }
    const R = await regime(H), base = wickBase(cfg, W.equity), target = base * R.mult;
    W.regime = { H, wk: R.wk, nerv: R.nerv ? R.nerv.on : null, sig: R.nerv ? R.nerv.sig : null, med: R.nerv ? R.nerv.med : null, mult: R.mult, lad: R.lad, base };
    if (R.skip) { W.lastNotes = ['выходные — по настройке WICK_WEEKEND=off не торгую']; W.lastHour = H; return { placed, errors, weekendOff: true }; }
    for (const c of cfg.coins) {
      if (busyCoin(c)) continue;
      await pause(ctx.pace || 250); // пауза между монетами — не упираться в лимит Bybit
      try {
        if (live && (await positionOf(c)).length) { notes.push(`${c}: есть своя позиция — пропускаю`); continue; }
        const [h, ins] = [await hourly(c), await instrument(c)];
        if (!h.t.length || h.t[h.t.length - 1] !== H - HOUR) { notes.push(`${c}: нет свежей часовой свечи`); continue; }
        const steps = [[c, cfg.m]]; if (R.lad > 0) steps.push([c + ':2', R.lad]);
        for (const [s, m] of steps) {
          const lv = wickLevel(h.t, h.c, m); if (!lv) { notes.push(`${c}: мало истории`); break; }
          const price = floorStep(lv.lim, ins.tick); if (!(price > 0)) break;
          let qty = Math.max(nearStep(target / price, ins.step), ins.minQty); if (qty * price < ins.minNotional) qty = ceilStep(ins.minNotional * 1.001 / price, ins.step);
          const cap = Math.max(cfg.maxUsd, 2 * target);
          if (qty * price > cap) { notes.push(`${c}: минимум Bybit ${(qty * price).toFixed(2)}$ больше $${cap.toFixed(0)} — пропускаю`); break; }
          const link = `zw-${c}-${H / HOUR}${wickStep(s) === 2 ? '-2' : ''}`;
          if (live) await place({ category: 'linear', symbol: sym(c), side: 'Buy', orderType: 'Limit', qty: String(qty), price: String(price), timeInForce: 'PostOnly', orderLinkId: link });
          W.orders[s] = { c, step: wickStep(s), link, lim: price, qty, P: lv.P, depth: lv.depth, hour: H, placedAt: now(), mult: R.mult }; placed++;
        }
      } catch (e) { errors++; await warn('place' + c, `не поставил лимитку ${c}: ${e.message}`); }
    }
    W.lastNotes = notes;
    log(`ловец проливов: лимиток ${placed}, ошибок ${errors}, ставка $${target.toFixed(2)}${R.mult > 1 ? ' (×' + R.mult + ')' : ''}${R.lad ? '' : ', без ступени 2'}${notes.length ? ' · ' + notes.join('; ') : ''}`);
    if (!placed && errors) return { placed, errors, notes, retry: true }; // ничего не поставилось из-за ошибок — повтор через 2 минуты
    W.lastHour = H;
    return { placed, errors, notes };
  }
  async function absorb(s, o, x) { // учесть исполнение лимитки (полное или частичное)
    if (!x || !(+x.cumExecQty > 0)) return false;
    const p = W.pos[s], c = wickCoin(s);
    if (!p) { W.pos[s] = { c, step: wickStep(s), mult: o.mult || 1, qty: +x.cumExecQty, entry: +x.avgPrice || o.lim, fillT: +x.updatedTime || now(), feeIn: +x.cumExecFee || 0, link: o.link, P: o.P, depth: o.depth };
      await say(`💰 куплено ${c} ${x.cumExecQty} по ${fmtPrice(+x.avgPrice || o.lim)} (−${(o.depth * 100).toFixed(1)}% от цены часа ${fmtPrice(o.P)}${tag(o)}) — реальные деньги. Продам через ${cfg.holdMin} мин.`); }
    else { p.qty = +x.cumExecQty; p.entry = +x.avgPrice || p.entry; p.feeIn = +x.cumExecFee || p.feeIn; }
    return true;
  }
  async function equity() {
    for (const accountType of ['UNIFIED', 'CONTRACT']) {
      try { const r = await cl.get('/v5/account/wallet-balance', { accountType }); const a = r.list && r.list[0]; if (!a) continue;
        if (a.totalEquity !== undefined && a.totalEquity !== '') return +a.totalEquity;
        const u = (a.coin || []).find(x => x.coin === 'USDT'); if (u) return +(u.equity || u.walletBalance); }
      catch (e) { if (accountType === 'CONTRACT') throw e; }
    }
    return null;
  }
  // каждые 10 секунд (бумага — раз в минуту): исполнения и выходы
  async function checkOrder(s, o) { // исполнилась ли лимитка; true — больше не ждём
    const c = wickCoin(s);
    if (live) {
      const x = await orderInfo(c, o.link); await absorb(s, o, x); if (!x) return false;
      if (x.orderStatus === 'Filled') return true;
      if (['Cancelled', 'Rejected', 'Deactivated', 'PartiallyFilledCanceled'].includes(x.orderStatus)) {
        if (!(+x.cumExecQty > 0) && x.rejectReason && x.rejectReason !== 'EC_NoError') await warn('rej' + s, `биржа отклонила/сняла лимитку ${wickLabel(s)}: ${x.rejectReason}`);
        return true; }
      return false;
    }
    // бумага: исполнилась, если минутный минимум ушёл НИЖЕ уровня (как в проверке)
    const ms = await minutes(c, o.hour, o.hour + HOUR - 1, 60), hit = ms.find(k => k.t >= o.hour && k.t < o.hour + HOUR && k.l < o.lim);
    if (!hit) return false;
    W.pos[s] = { c, step: wickStep(s), mult: o.mult || 1, qty: o.qty, entry: o.lim, fillT: hit.t + 60000, feeIn: o.lim * o.qty * cfg.maker, P: o.P, depth: o.depth };
    await say(`📝 бумага: «куплено» ${c} ${o.qty} по ${fmtPrice(o.lim)} (−${(o.depth * 100).toFixed(1)}% от цены часа ${fmtPrice(o.P)}${tag(o)}). «Продам» через ${cfg.holdMin} мин.`);
    return true;
  }
  async function poll() {
    for (const s of Object.keys(W.orders)) {
      try { if (await checkOrder(s, W.orders[s])) delete W.orders[s]; }
      catch (e) { await warn('poll' + s, `проверка лимитки ${wickLabel(s)}: ${e.message}`); }
    }
    for (const s of Object.keys(W.pos)) { const p = W.pos[s], c = wickCoin(s), exitAt = p.fillT + cfg.holdMin * 60000; if (now() < exitAt) continue;
      try {
        let rec;
        if (live) {
          const o = W.orders[s]; if (o) { await cancel(c, o.link); await absorb(s, o, await orderInfo(c, o.link)); delete W.orders[s]; }
          const have = (await positionOf(c)).filter(x => x.side === 'Buy').reduce((a, x) => a + +x.size, 0), ins = await instrument(c);
          const qty = floorStep(Math.min(p.qty, have), ins.step);
          if (!(qty > 0)) { delete W.pos[s]; await say(`⚠️ ${wickLabel(s)}: позиции на бирже уже нет (закрыта вручную?) — убираю из учёта.`); continue; }
          const link = `zx-${c}-${wickStep(s)}-${Math.floor(now() / 1000)}`;
          await place({ category: 'linear', symbol: sym(c), side: 'Sell', orderType: 'Market', qty: String(qty), reduceOnly: true, orderLinkId: link });
          let x = null; for (let a = 0; a < 5 && !(x && +x.cumExecQty > 0); a++) { await sleep(a ? 1000 : 300); x = await orderInfo(c, link); }
          p.qty = qty; rec = record(s, p, x && +x.avgPrice || p.entry, now(), x ? +x.cumExecFee || 0 : 0);
        } else {
          const ms = await minutes(c, exitAt - 60000, exitAt - 1, 1), k = ms.find(m => m.t === exitAt - 60000); if (!k) continue;
          rec = record(s, p, k.c, exitAt, k.c * p.qty * cfg.taker);
        }
        await say(`${live ? '' : '📝 бумага: '}${wickLabel(s)} продано по ${fmtPrice(rec.exit)} через ${cfg.holdMin} мин: ${usd(rec.pnl)} (${((rec.exit / rec.entry - 1) * 100).toFixed(2)}% цены, комиссия $${rec.fee.toFixed(3)}). Сегодня ${usd(dayPnl())}, всего ${usd(W.totalPnl)} (${W.closed.length} сд).`);
        if (dayPnl() <= -wickDayLimit(cfg, W)) await cancelAll();
      } catch (e) { p.fails = (p.fails || 0) + 1; await warn('exit' + s, `❗ не смог продать ${wickLabel(s)}: ${e.message}. Повторяю каждые 10 секунд${p.fails >= 3 ? ' — проверь Bybit вручную' : ''}.`); }
    }
  }
  async function guarded(fn) { if (running) return { busy: true }; running = true; try { return await fn(); } finally { running = false; } }
  return {
    cfg, live,
    rollover: () => guarded(rollover), poll: () => guarded(poll), nervousAt: H => btcNervous(H),
    async start() { // при запуске: связь, плечо, чужие «зависшие» лимитки бота
      const out = { ok: true, lines: [] };
      if (!live) { out.lines.push('режим: 📝 бумага по ценам Bybit (реальные деньги — после BYBIT_KEY, BYBIT_SECRET и WICK_LIVE=1)'); }
      if (cl.hasKey) {
        try { const eq = await equity(); W.equity = eq; out.lines.push(`Bybit на связи, баланс ${eq == null ? '?' : '$' + eq.toFixed(2)}`); }
        catch (e) { out.ok = false; out.lines.push('❌ Bybit не принял ключ или не отвечает: ' + e.message); }
      }
      if (live && out.ok) for (const c of cfg.coins) {
        try { await cl.post('/v5/position/set-leverage', { category: 'linear', symbol: sym(c), buyLeverage: String(cfg.lev), sellLeverage: String(cfg.lev) }); } catch (e) { if (e.code !== 110043) out.lines.push(`${c}: плечо не выставил (${e.message})`); }
        try { const r = await cl.get('/v5/order/realtime', { category: 'linear', symbol: sym(c) }), mine = new Set(Object.values(W.orders).map(o => o.link)); // лимитки бота, о которых он забыл (перезапуск без диска)
          for (const x of r.list || []) if (String(x.orderLinkId || '').startsWith('zw-') && !mine.has(x.orderLinkId)) { await cancel(c, x.orderLinkId); out.lines.push(`${c}: снял старую лимитку бота`); } } catch (e) {}
        if (!Object.keys(W.pos).some(s => wickCoin(s) === c)) try { const ps = (await positionOf(c)).filter(x => x.side === 'Buy');
          if (ps.length) { const h = await cl.get('/v5/order/history', { category: 'linear', symbol: sym(c), limit: 50 }); let found = 0;
            for (const x of h.list || []) { const l = String(x.orderLinkId || ''); if (!l.startsWith('zw-') || !(+x.cumExecQty > 0) || now() - +x.updatedTime >= 3 * HOUR) continue;
              const s = l.endsWith('-2') ? c + ':2' : c; if (W.pos[s]) continue; // по каждой ступени — самая свежая
              W.pos[s] = { c, step: wickStep(s), mult: 1, qty: +x.cumExecQty, entry: +x.avgPrice, fillT: +x.updatedTime, feeIn: +x.cumExecFee || 0, link: l, depth: 0 }; found++; }
            out.lines.push(found ? `${c}: нашёл позицию бота — продам по плану` : `${c}: на счёте есть позиция не от бота — эту монету пропускаю, пока она открыта`); } } catch (e) {}
      }
      return out;
    },
    async stopAll() { // /wickstop: снять лимитки, продать всё бота по рынку
      W.disabled = true; const lines = [];
      for (const s of Object.keys(W.orders)) { const c = wickCoin(s); try { if (live) { await cancel(c, W.orders[s].link); await absorb(s, W.orders[s], await orderInfo(c, W.orders[s].link)); } delete W.orders[s]; } catch (e) { lines.push(`${wickLabel(s)}: лимитку не снял — ${e.message}`); } }
      for (const s of Object.keys(W.pos)) { W.pos[s].fillT = now() - cfg.holdMin * 60000 - 1; }
      await guarded(poll);
      lines.push(Object.keys(W.pos).length ? `не закрылись: ${Object.keys(W.pos).map(wickLabel).join(', ')} — проверь Bybit` : 'лимиток и позиций бота нет');
      return lines;
    },
    async test() { // /wicktest: поставить и сразу снять крошечную лимитку далеко от цены
      if (!cl.hasKey) return '❌ нет ключа: добавь BYBIT_KEY и BYBIT_SECRET в Railway → Variables.';
      const c = 'SOL', ins = await instrument(c), t = await cl.pub('/v5/market/tickers', { category: 'linear', symbol: sym(c) });
      const last = +t.list[0].lastPrice, price = floorStep(last * 0.5, ins.tick), qty = Math.max(ceilStep(ins.minNotional * 1.01 / price, ins.step), ins.minQty), link = `zt-${Math.floor(now() / 1000)}`;
      await place({ category: 'linear', symbol: sym(c), side: 'Buy', orderType: 'Limit', qty: String(qty), price: String(price), timeInForce: 'PostOnly', orderLinkId: link });
      const x = await orderInfo(c, link); await cancel(c, link); const y = await orderInfo(c, link);
      return `✅ Bybit работает: поставил лимитку SOL ${qty} по ${fmtPrice(price)} (половина цены, исполниться не могла) — статус «${x ? x.orderStatus : '?'}», затем снял — «${y ? y.orderStatus : '?'}». Баланс ${W.equity == null ? '?' : '$' + W.equity.toFixed(2)}.`;
    },
  };
}
function wickRuleText(cfg) { // правило словами (для /wick и стартового сообщения)
  const size = cfg.usd > 0 ? `$${cfg.usd} на лимитку` : `${cfg.pct}% баланса на лимитку (не меньше $${cfg.minUsd})`;
  return `каждый час лимитки на покупку на ${cfg.m}σ${cfg.lad > cfg.m ? ` и ${cfg.lad}σ (ступень 2)` : ''} ниже цены, ${size}${cfg.nervMult > 1 ? `, ×${cfg.nervMult} в нервном рынке BTC` : ''}; ` +
    `${cfg.weekend === 'off' ? 'по выходным не торгую' : cfg.weekend === 'all' ? 'по выходным — как в будни' : `по выходным — только ${cfg.m}σ без удвоения`}; продажа через ${cfg.holdMin} мин`;
}
function msgWick(st, mode) {
  const W = st.wick || {}, cfg = Object.assign({}, WICK_DEF, W.cfg || {}), R = W.regime || null;
  const o = Object.entries(W.orders || {}), p = Object.entries(W.pos || {});
  const lab = s => wickStep(s) === 2 ? wickCoin(s) + '-2' : wickCoin(s);
  let t = `🪝 <b>Ловец проливов</b> — ${mode === 'live' ? '💵 реальные деньги (Bybit)' : mode === 'paper' ? '📝 бумага по ценам Bybit' : 'выключен'}${W.disabled ? ' · ⏸ остановлен (/wickstart — включить)' : ''}\n`;
  t += `Правило: ${wickRuleText(cfg)}. Монеты: ${cfg.coins.join(', ')}.\n`;
  if (R) t += `Этот час: ${R.wk ? '🗓 выходные' : 'будни'}${R.nerv == null ? (R.wk && cfg.weekend !== 'all' ? '' : ', рынок BTC не посчитан') : ', рынок BTC ' + (R.nerv ? `😬 нервный (σ ${(R.sig * 100).toFixed(2)}% > обычной ${(R.med * 100).toFixed(2)}%)` : `😌 спокойный (σ ${(R.sig * 100).toFixed(2)}% ≤ обычной ${(R.med * 100).toFixed(2)}%)`)} → ставка $${(R.base * R.mult).toFixed(2)}${R.mult > 1 ? ` (×${R.mult})` : ''}${R.lad ? `, ступень 2 на ${R.lad}σ` : ', без ступени 2'}.\n`;
  const fl = wickFloor(cfg, W);
  if (W.equity != null) t += `Баланс Bybit: $${W.equity.toFixed(2)}${fl != null ? ` (стоп торговли ниже $${fl.toFixed(2)}${cfg.minEquity > 0 ? '' : ` — на ${cfg.ddStopPct}% ниже максимума $${W.peakEq.toFixed(2)}`})` : ''}.\n`;
  t += `Сегодня: ${usd(W.dayD === Math.floor(Date.now() / DAY_MS) ? W.dayPnl || 0 : 0)} (дневной стоп −$${wickDayLimit(cfg, W).toFixed(2)}). Всего: ${wickSummary(W)}.\n`;
  t += `Позиции: ${p.length ? p.map(([s, x]) => `${lab(s)} ${x.qty} по ${fmtPrice(x.entry)}, продажа в ${new Date(x.fillT + cfg.holdMin * 60000).toISOString().slice(11, 16)} UTC`).join('; ') : 'нет'}\n`;
  const nextH = new Date(Math.floor(Date.now() / HOUR) * HOUR + HOUR + 3 * HOUR).toISOString().slice(11, 16);
  t += `Лимитки на этот час: ${o.length ? o.map(([s, x]) => `${lab(s)} ${fmtPrice(x.lim)} (−${(x.depth * 100).toFixed(1)}%)`).join(', ') : `нет — следующие в ${nextH} по Минску`}`;
  if (W.lastNotes && W.lastNotes.length) t += `\n<i>${W.lastNotes.join('; ')}</i>`;
  return t;
}

// ---------- команды в личке бота ----------
/* Возвращает список действий: {text} или {file:{name,content}}. Ничего не отправляет сам. */
function handleCommand(text, chatId, adminId, st, store) {
  const cmd = String(text || '').trim().split(/\s+/)[0].toLowerCase().replace(/@.*$/, '');
  const isAdmin = adminId && String(chatId) === String(adminId);
  const HELP = 'Команды: /stats — статистика сделок, /active — ⚡ активные свечи (стратегия 2: открытые, итоги, какие монеты готовятся), /wick — 🪝 ловец проливов (Bybit: баланс, позиции, итоги), /wicktest — проверить связь с Bybit, /wickstop — остановить и закрыть позиции бота, /wickstart — включить снова, /data — файлы с данными, /history — история открытого интереса с 2021 года (файлом), /history2 — то же по 12 другим монетам, /research — данные для проверки правил на других монетах (архивом), /premium — история премии фьючерсов (архивом), /macro — выпуск стейблкоинов по дням (файлом), /onchain — ончейн и корейская цена (архивом), /liq — ликвидации по дням (архивом, нужен COINALYZE_KEY), /id — твой chat id.';
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
  if (cmd === '/history2') return [{ history: true, set: 2 }];
  if (cmd === '/research') return [{ research: true }];
  if (cmd === '/premium') return [{ premium: true }];
  if (cmd === '/macro') return [{ macro: true }];
  if (cmd === '/onchain') return [{ onchain: true }];
  if (cmd === '/liq') return [{ liq: true }];
  if (cmd === '/active') return [{ text: msgActiveStatus(st) }];
  if (cmd === '/wick') return [{ wick: 'status' }];
  if (cmd === '/wickstop') return [{ wick: 'stop' }];
  if (cmd === '/wickstart') return [{ wick: 'start' }];
  if (cmd === '/wicktest') return [{ wick: 'test' }];
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
    const tro = Object.values(st.trend || {});
    t += `📈 Тренд: ${trendSummary(st.trendClosed || [])}${tro.length ? `; открыто: ${tro.map(p => p.id).join(', ')}` : ''}\n`;
    const aco = Object.keys(st.active || {});
    t += `⚡ Активные свечи: ${activeSummary(st.activeClosed)}${aco.length ? `; открыто: ${aco.join(', ')}` : ''}\n`;
    const sco = Object.keys(st.shortE || {});
    const eco = Object.keys(st.early || {});
    t += `⚡ Ранний вход: ${activeSummary(st.earlyClosed)}${eco.length ? `; открыто: ${eco.join(', ')}` : ''}\n`;
    t += `🔻 Ранний шорт: ${activeSummary(st.shortEClosed)}${sco.length ? `; открыто: ${sco.join(', ')}` : ''}\n`;
    if (st.short30Slot || st.shortE30) { const s3o = Object.keys(st.shortE30 || {}); t += `🔻 Ранний шорт 30м: ${activeSummary(st.shortE30Closed)}${s3o.length ? `; открыто: ${s3o.join(', ')}` : ''}\n`; }
    t += `Рыночные данные (OI, лонг/шорт): ${marketSummary(store)}`;
    return [{ text: t }];
  }
  if (cmd === '/data') {
    const day = new Date().toISOString().slice(0, 10);
    return [
      { text: `Отправляю файлы. Рыночные данные: ${marketSummary(store)}. Сделок: ${st.closed.length}, отсеянных «на бумаге»: ${(st.shadowClosed || []).length}.` },
      { file: { name: `zynqel-market-${day}.csv`, content: marketCsv(store) } },
      { file: { name: `zynqel-trades-${day}.csv`, content: tradesCsv(st) } },
      { file: { name: `zynqel-active-${day}.csv`, content: activeCsv(st) } },
    ].concat(st.wick && st.wick.closed && st.wick.closed.length ? [{ file: { name: `zynqel-wick-${day}.csv`, content: wickCsv(st.wick) } }] : []);
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
          // v2.7.1: повторный вход по лонгам основных — со следующего дня UTC после закрытия, на новой выплате funding
          if (c.kind === 'core') (st.reentryFrom = st.reentryFrom || {})[c.id] = Math.floor(now / DAY_MS) * DAY_MS + DAY_MS;
        }
        continue;
      }
      const fund = await io.getFunding(c.sym);
      const sig = computeSignal(fund, c.kind, btcBear);
      const prev = st.lastState[c.id];
      st.lastState[c.id] = sig.state;
      // v2.7.1 (sim2/PREREG_MORE.md, M2): если сигнал по лонгу основной монеты всё ещё действует и позиции нет,
      // на каждой НОВОЙ выплате funding он считается заново (раньше ждали, пока сигнал пропадёт и появится снова)
      st.lastStamp = st.lastStamp || {}; st.reentryFrom = st.reentryFrom || {};
      const stamp = fund.length ? fund[fund.length - 1].t : 0, seen = st.lastStamp[c.id];
      st.lastStamp[c.id] = stamp;
      let fresh = sig.state !== prev, again = false;
      if (!fresh && c.kind === 'core' && sig.state === 'buy' && opts.reentry !== false && seen != null && stamp > seen && stamp >= (st.reentryFrom[c.id] || 0)) fresh = again = true;
      if (silent || !fresh) continue;
      if (sig.state === 'buy' || sig.state === 'sell') {
        const risk = stopDistance(await io.getCloses8h(c.sym), price);
        if (!risk) continue;
        const p = openPosition(c, sig.dir, price, risk, now);
        if (again) p.again = true; // повторный вход: сигнал всё ещё действует
        let days = null; try { days = await io.getDaily(c.sym); } catch (e) { console.error('  свечи ' + c.id + ':', e.message); }
        const sc = scoreSignal(sig, c.kind, days, btcCloses);
        p.grade = sc.grade; p.score = sc.score; p.scoreInfo = sc; p.z = sig.z;
        if (days && days.length >= 20) { const c20 = days.slice(-20).map(x => x.c); p.trend20 = days[days.length - 1].c / (c20.reduce((u, v) => u + v, 0) / 20) - 1; } // для будущей проверки «откат в тренде»
        if (io.getCbPremium) { try { const cb = await io.getCbPremium(); if (cb) { p.cbPrem = cb.p; p.cbAvg = cb.avg; } } catch (e) { console.error('  премия Coinbase:', e.message); } }
        if (c.kind === 'core' && io.getCrowd) { try { p.crowd = await io.getCrowd(c.sym, stamp); } catch (e) { console.error('  доля лонгов ' + c.id + ':', e.message); } }
        if (c.kind === 'core' && io.getHourly) { try { p.wick = wickBefore(await io.getHourly(c.sym), stamp); } catch (e) { console.error('  часовые свечи ' + c.id + ':', e.message); } }
        if (c.kind === 'core' && opts.wickBoost !== false && p.wick != null && p.wick >= RULES.wick.thr) p.riskPct = RULES.wick.risk;
        let skip = null;
        if (sc.grade === 'skip') skip = 'score0';
        else if (c.kind === 'core' && !opts.weekendLongs && isWeekend(now)) skip = 'weekend';
        else if (c.kind === 'core' && opts.crowd !== false && p.crowd != null && p.crowd > RULES.crowdThr) skip = 'crowd';
        if (skip) {
          console.log(`  ${c.id}: ${skip === 'weekend' ? 'выходной, лонг не открываем' : skip === 'crowd' ? `толпа всё ещё в лонге (доля лонгов ×${p.crowd.toFixed(2)} от обычной)` : `сигнал без подтверждающих факторов (0 из ${sc.max})`} — веду «на бумаге»`);
          st.shadow = st.shadow || {};
          if (!st.shadow[c.id]) { p.skip = skip; st.shadow[c.id] = p; }
          continue;
        }
        if (opts.onlyStrong && p.grade !== 'strong') continue; // режим «только сильные»: обычный сигнал пропускаем
        st.positions[c.id] = p;
        delete st.reentryFrom[c.id];
        await send(msgEntry(p, sig));
      } else if (sig.state === 'watch_short' && sendWatch) {
        await send(msgWatch(c, sig));
      }
    } catch (e) {
      console.error('  ' + c.id + ':', e.message);
    }
  }

  // v2.8: стратегия «ТРЕНД» — раз в сутки после закрытия дневной свечи
  if (opts.trend !== false && !silent && io.getDailyCloses) {
    try { await trendTick(st, io, opts, now, prices, send, btcCloses); } catch (e) { console.error('  тренд:', e.message); }
  }

  // итоги недели: понедельник, после 07:00 UTC, один раз
  if (opts.weekly !== false && !silent) {
    const d = new Date(now);
    const key = d.toISOString().slice(0, 10);
    if (d.getUTCDay() === 1 && d.getUTCHours() >= 7 && st.lastReport !== key) {
      const from = now - 7 * 24 * 3600 * 1000;
      await send(msgWeek(st.closed.filter(t => t.closedAt >= from), (st.shadowClosed || []).filter(t => t.closedAt >= from), (st.trendClosed || []).filter(t => t.closedAt >= from), Object.values(st.trend || {}), (st.activeClosed || []).filter(t => t.closedAt >= from), (st.earlyClosed || []).filter(t => t.closedAt >= from), (st.shortEClosed || []).filter(t => t.closedAt >= from), (st.shortE30Closed || []).filter(t => t.closedAt >= from)));
      st.lastReport = key;
    }
  }
  return { btc, messages: out };
}

// ---------- работа с Binance и Telegram ----------
const FAPI = 'https://fapi.binance.com';
async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'zynqel-bot/2' } });
  if ((r.status === 451 || r.status === 403) && /binance/.test(url)) throw new Error(`Binance отказал (${r.status}). Сервер должен быть в Европе: Railway → Settings → Region.`);
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
function liveIO(token, chatId, activeChat) {
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
  const sendTo = async (to, text) => { for (const part of splitText(text)) { await tgCall('sendMessage', { chat_id: to, text: part, parse_mode: 'HTML', disable_web_page_preview: true }); await sleep(400); } };
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
    getHourly: async sym => (await getJson(`${FAPI}/fapi/v1/klines?symbol=${sym}&interval=1h&limit=12`)).map(k => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] })),
    getHourlyBars: async sym => { // «⚡ Активные свечи»: 1000 последних ЗАКРЫТЫХ часовых свечей
      const k = (await getJson(`${FAPI}/fapi/v1/klines?symbol=${sym}&interval=1h&limit=1000`)).filter(x => +x[6] < Date.now()); await sleep(120);
      return { t: k.map(x => +x[0]), o: k.map(x => +x[1]), h: k.map(x => +x[2]), l: k.map(x => +x[3]), c: k.map(x => +x[4]), v: k.map(x => +x[5]) };
    },
    getBars30: async sym => { // v2.14 «🔻 Ранний шорт 30м»: ~2000 последних ЗАКРЫТЫХ 30-минутных свечей (два запроса по 1000)
      const a = await getJson(`${FAPI}/fapi/v1/klines?symbol=${sym}&interval=30m&limit=1000`); await sleep(120);
      const b = a.length ? await getJson(`${FAPI}/fapi/v1/klines?symbol=${sym}&interval=30m&limit=1000&endTime=${+a[0][0] - 1}`) : []; await sleep(120);
      const k = b.concat(a).filter(x => +x[6] < Date.now());
      return { t: k.map(x => +x[0]), o: k.map(x => +x[1]), h: k.map(x => +x[2]), l: k.map(x => +x[3]), c: k.map(x => +x[4]), v: k.map(x => +x[5]) };
    },
    getBtcDaily: async () => (await getJson(`${FAPI}/fapi/v1/klines?symbol=BTCUSDT&interval=1d&limit=120`)).filter(k => +k[6] < Date.now()).map(k => ({ t: +k[0], c: +k[4] })),
    getDailyCloses: async sym => (await getJson(`${FAPI}/fapi/v1/klines?symbol=${sym}&interval=1d&limit=40`)).filter(k => +k[6] < Date.now()).map(k => parseFloat(k[4])),
    getCrowd: async (sym, stamp) => crowdRatio(await getJson(`${FAPI}/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=4h&limit=180`), stamp),
    getUrl: url => getJson(url),   // /research
    getCoinalyze: async (url, key) => { // /liq: ключ в заголовке api_key; при лимите (429) ждём, сколько скажет Coinalyze
      for (let a = 0; a < 5; a++) {
        const r = await fetch(url, { headers: { api_key: key, 'User-Agent': 'zynqel-bot/' + VERSION } });
        if (r.status === 429) { await sleep((Math.min(120, +(r.headers.get('retry-after') || 30)) + 1) * 1000); continue; }
        if (r.status === 401 || r.status === 403) throw new Error(`Coinalyze не принял ключ (HTTP ${r.status}) — проверь COINALYZE_KEY`);
        if (!r.ok) throw new Error('Coinalyze HTTP ' + r.status);
        return r.json();
      }
      throw new Error('Coinalyze: слишком много запросов, повтори /liq через пару минут');
    },
    wait: ms => sleep(ms),
    getText: async url => { const r = await fetch(url, { headers: { 'User-Agent': 'zynqel-bot/' + VERSION } }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); },
    pace: () => sleep(250),        // пауза между запросами /research, чтобы не упереться в лимиты Binance
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
    sendActive: text => sendTo(activeChat || chatId, text),
    sendTo,
    sendDocument: async (to, name, content, type = 'text/csv') => tgCall('sendDocument', () => {
      const fd = new FormData();
      fd.append('chat_id', String(to));
      fd.append('document', new Blob([content], { type }), name);
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

/* v2.14: Telegram принимает до 4096 символов — длинный текст (например, /active в день обвала) делим по строкам,
 * слишком длинную строку — по «; » (HTML-теги в боте не переходят через строку и через «; » внутри списков). */
function splitText(text, max = 4000) {
  text = String(text); if (text.length <= max) return [text];
  const pieces = [];
  for (const line of text.split('\n')) {
    if (line.length <= max) { pieces.push(line); continue; }
    let cur = ''; for (const seg of line.split('; ')) { const add = cur ? cur + '; ' + seg : seg; if (add.length > max && cur) { pieces.push(cur + ';'); cur = seg; } else cur = add; }
    while (cur.length > max) { pieces.push(cur.slice(0, max)); cur = cur.slice(max); }
    if (cur) pieces.push(cur);
  }
  const out = []; let cur = '';
  for (const p of pieces) { if (cur && cur.length + 1 + p.length > max) { out.push(cur); cur = p; } else cur = cur ? cur + '\n' + p : p; }
  if (cur) out.push(cur);
  return out;
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
  const opts = { sendWatch: process.env.SEND_WATCH !== '0', weekly: process.env.WEEKLY_REPORT !== '0', memeShorts: process.env.MEME_SHORTS !== '0', onlyStrong: process.env.ONLY_STRONG === '1', weekendLongs: process.env.WEEKEND_LONGS === '1', reentry: process.env.REENTRY !== '0', crowd: process.env.CROWD_FILTER !== '0', trend: process.env.TREND !== '0', trendScale: parseFloat(process.env.TREND_SCALE || '1') || 1, trendDigest: process.env.TREND_DIGEST !== '0', wickBoost: process.env.WICK_BOOST !== '0', active: process.env.ACTIVE !== '0', early: process.env.EARLY !== '0', earlyShort: process.env.EARLY_SHORT !== '0', earlyShort30: process.env.EARLY_SHORT30 !== '0', shortRisk: parseFloat(process.env.SHORT_RISK || String(SHORTE.risk)) || SHORTE.risk, btcFilter: (process.env.ACTIVE_BTC_FILTER || 'live').trim() === 'daily' ? 'daily' : 'live', activeRisk: parseFloat(process.env.ACTIVE_RISK || String(ACTIVE.risk)) || ACTIVE.risk };
  const file = defaultStateFile();
  const st = loadState(file);
  const mfile = marketFileFor(file);
  const store = loadJson(mfile, {});
  const io = liveIO(token, chatId, (process.env.ACTIVE_CHAT || '').trim() || null);
  const onDisk = file.startsWith('/data/');
  console.log(`ZYNQEL бот v${VERSION}. Память: ${file} (${st.loaded ? 'загружена' : 'новая'}${onDisk ? ', на диске Railway' : ', БЕЗ диска: сотрётся при обновлении'}). Проверка каждые ${pollMs / 60000} мин. Шорты мемов: ${opts.memeShorts ? 'включены' : 'выключены'}. Сигналы: ${opts.onlyStrong ? 'только сильные' : 'все, с оценкой силы'}. Лонги в выходные: ${opts.weekendLongs ? 'да' : 'нет'}. Админ: ${adminId || 'не задан'}.`);

  if (!st.loaded) {
    // Первый запуск без памяти: запоминаем текущие сигналы молча, чтобы не прислать старые входы.
    try { await tick(st, io, Object.assign({}, opts, { silent: true })); console.log('Прогрев: текущие сигналы запомнены без отправки.'); }
    catch (e) { console.error('Прогрев не удался:', e.message); }
    saveState(file, st);
  }
  await io.send(`✅ <b>ZYNQEL бот v${VERSION} запущен.</b>\nЛонги основных монет, когда funding падает необычно сильно для монеты${opts.weekendLongs ? '' : ' (только в будни)'}, держим до 3 дней` + (opts.memeShorts ? '; шорты PEPE, SHIB, FLOKI, когда funding растёт необычно сильно и BTC ниже EMA50, до 6 дней' : '') + '. Стоп по волатильности, 50% на первой цели. Каждый сигнал проверяется по факторам движения, без подтверждения — не присылаю. Риск 0.5% депозита на любой сигнал.' + (opts.trend ? '\n📈 Вторая стратегия «ТРЕНД»: раз в день после закрытия дневной свечи (03:00 по Минску) — лонг на пробое максимума 20 дней (когда BTC выше средней за 50 дней), выход ниже минимума 10 дней.' : '') + ' Итоги недели по понедельникам.' + (opts.active ? '\n⚡ Стратегия 2 «Активные свечи» (на проверке): каждый час бот смотрит 48 монет — пробой узкого коридора на большом объёме' + (opts.early ? ' и «ранний вход» (всплеск объёма внутри коридора, до пробоя)' : '') + (opts.earlyShort ? ', а когда BTC ниже средней — «🔻 ранний шорт»' : '') + ', помечает их и ведёт «на бумаге».' + (opts.earlyShort30 ? ' «🔻 Ранний шорт 30м» — то же правило на 30-минутных свечах, проверка каждые 30 минут (для сравнения с часовым).' : '') + ' Команда /active — что открыто и какие монеты готовятся.' : '') + '\n<i>Не финансовая рекомендация.</i>');

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

  // 1b) «⚡ Активные свечи» — каждый час, через 40 секунд после закрытия часовой свечи
  if (opts.active) {
    const activeLoop = async () => {
      let retry = false;
      try {
        const r = await activeTick(st, io, opts);
        if (!r.skipped) { saveState(file, st); console.log(`[${new Date().toISOString()}] Активные свечи: проверено ${r.checked} монет, ошибок ${r.errors}, сообщений ${r.messages.length}, открыто: ${[...Object.keys(st.active || {}), ...Object.keys(st.early || {}).map(x => x + ' (ранний)')].join(', ') || 'нет'}`); retry = r.checked === 0; }
      } catch (e) { console.error('Ошибка активных свечей:', e.message); retry = true; }
      const now = Date.now(), next = Math.floor(now / HOUR) * HOUR + HOUR + 40000;
      setTimeout(activeLoop, retry ? 3 * 60000 : Math.max(5000, next - now));
    };
    setTimeout(activeLoop, 30000);
  }
  // 1d) v2.15 «🪝 Ловец проливов» — лимитки каждый час (через 20 с после закрытия часа), проверка исполнений каждые 10 с (бумага — раз в минуту)
  const bybitKey = (process.env.BYBIT_KEY || '').trim(), bybitSecret = (process.env.BYBIT_SECRET || '').trim();
  const wickMode = process.env.WICK === '0' ? 'off' : (bybitKey && bybitSecret && process.env.WICK_LIVE === '1') ? 'live' : 'paper';
  let wick = null;
  if (wickMode !== 'off') {
    const num = (v, d, lo, hi) => { const x = parseFloat(v); return isFinite(x) && x >= lo && x <= hi ? x : d; };
    const coins = (process.env.WICK_COINS || '').split(/[\s,]+/).map(x => x.trim().toUpperCase().replace(/USDT$/, '')).filter(Boolean);
    const opt = (v, lo, hi) => v != null && String(v).trim() !== '' ? num(v, null, lo, hi) : null; // задано — своё число, нет — авто от баланса
    const wk = String(process.env.WICK_WEEKEND || '').trim().toLowerCase();
    const cfg = { m: num(process.env.WICK_M, WICK_DEF.m, 2, 10), lad: num(process.env.WICK_LADDER, WICK_DEF.lad, 0, 20), nervMult: num(process.env.WICK_NERV_MULT, WICK_DEF.nervMult, 1, 5),
      weekend: ['base', 'off', 'all'].includes(wk) ? wk : WICK_DEF.weekend, usd: opt(process.env.WICK_USD, 1, 100000), pct: num(process.env.WICK_PCT, WICK_DEF.pct, 0.5, 50),
      holdMin: num(process.env.WICK_HOLD_MIN, WICK_DEF.holdMin, 5, 240), dayLoss: opt(process.env.WICK_DAY_LOSS, 0.5, 1e6), dayLossPct: num(process.env.WICK_DAY_LOSS_PCT, WICK_DEF.dayLossPct, 1, 100),
      minEquity: opt(process.env.WICK_MIN_BALANCE, 0, 1e9), ddStopPct: num(process.env.WICK_DD_STOP_PCT, WICK_DEF.ddStopPct, 5, 95), lev: Math.round(num(process.env.WICK_LEVERAGE, WICK_DEF.lev, 1, 25)),
      coins: coins.length ? coins : WICK_DEF.coins };
    const toAdmin = t => adminId ? io.sendTo(adminId, t) : Promise.resolve(console.log('[ловец проливов] ' + t));
    wick = makeWick(st, { cl: bybitClient({ key: bybitKey, secret: bybitSecret }), live: wickMode === 'live', send: toAdmin, log: x => console.log(x), cfg });
    try { const r = await wick.start(); saveState(file, st);
      await toAdmin(`🪝 <b>Ловец проливов</b>: ${wickMode === 'live' ? '💵 торгую реальными деньгами на Bybit' : '📝 бумага по ценам Bybit'}. ${(t => t[0].toUpperCase() + t.slice(1))(wickRuleText(wick.cfg))}; ${cfg.coins.length} монет. Дневной стоп ${cfg.dayLoss ? '−$' + cfg.dayLoss : cfg.dayLossPct + '% баланса'}, стоп торговли ${cfg.minEquity != null ? 'при балансе ниже $' + cfg.minEquity : 'при балансе на ' + cfg.ddStopPct + '% ниже максимума'}.\n` + r.lines.join('\n') + '\nКоманды: /wick, /wicktest, /wickstop, /wickstart.' + (adminId ? '' : '\n⚠️ Нет ADMIN_CHAT_ID — сообщения ловца пишу только в лог.'));
    } catch (e) { console.error('Ловец проливов, запуск:', e.message); }
    const rollLoop = async () => {
      try { const r = await wick.rollover(); if (r && !r.skipped && !r.busy) saveState(file, st); if (r && r.busy) return setTimeout(rollLoop, 3000); if (r && r.retry) return setTimeout(rollLoop, 2 * 60000); }
      catch (e) { console.error('Ловец проливов, час:', e.message); }
      const now = Date.now(), next = Math.floor(now / HOUR) * HOUR + HOUR + 20000; setTimeout(rollLoop, Math.max(5000, next - now));
    };
    const pollLoop = async () => {
      try { const n0 = (st.wick.closed || []).length, p0 = Object.keys(st.wick.pos).length; const r = await wick.poll(); if (!r || !r.busy) { if ((st.wick.closed || []).length !== n0 || Object.keys(st.wick.pos).length !== p0) saveState(file, st); } }
      catch (e) { console.error('Ловец проливов, проверка:', e.message); }
      setTimeout(pollLoop, wickMode === 'live' ? 10000 : 60000);
    };
    setTimeout(rollLoop, 15000); setTimeout(pollLoop, 25000);
  }

  // 1c) v2.14 «🔻 Ранний шорт 30м» — каждые 30 минут, через 40 секунд после закрытия 30-минутной свечи
  if (opts.active && opts.earlyShort30) {
    const short30Loop = async () => {
      let retry = false;
      try {
        const r = await short30Tick(st, io, opts);
        if (!r.skipped) { saveState(file, st); console.log(`[${new Date().toISOString()}] Ранний шорт 30м: проверено ${r.checked} монет, ошибок ${r.errors}, сообщений ${r.messages.length}, открыто: ${Object.keys(st.shortE30 || {}).join(', ') || 'нет'}`); retry = r.checked === 0; }
      } catch (e) { console.error('Ошибка раннего шорта 30м:', e.message); retry = true; }
      const now = Date.now(), next = Math.floor(now / M30) * M30 + M30 + 40000;
      setTimeout(short30Loop, retry ? 3 * 60000 : Math.max(5000, next - now));
    };
    setTimeout(short30Loop, 45000);
  }

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

  // 3) история открытого интереса из архива Binance (по команде /history — монеты бота, /history2 — 12 других; в фоне)
  const HSETS = {
    1: { file: path.join(path.dirname(file), 'zynqel-oi-history.json'), coins: COINS, name: 'zynqel-oi-history', cmd: '/history', what: 'по 11 монетам бота' },
    2: { file: path.join(path.dirname(file), 'zynqel-oi-history2.json'), coins: OI_HOLDOUT, name: 'zynqel-oi-history2', cmd: '/history2', what: 'по 12 другим монетам (ADA, BNB, DOT, APT, AVAX, TRX, ATOM, BCH, ETC, FIL, UNI, AAVE)' },
  };
  const hists = { 1: { running: false, progress: {} }, 2: { running: false, progress: {} } };
  const runHistory = async (to, k) => {
    const H = HSETS[k], hist = hists[k];
    hist.running = true; hist.progress = {}; hist.error = null;
    try {
      const r = await oiHistoryJob(H.file, io, { coins: H.coins, progress: hist.progress, log: m => console.log(m) });
      hist.running = false;
      await io.sendTo(to, `✅ История открытого интереса ${H.what} готова: дней-файлов ${r.files}, нет в архиве ${r.missing}, ошибок ${r.errors}. Отправляю файл.`);
      await io.sendDocument(to, `${H.name}-${new Date().toISOString().slice(0, 10)}.csv`, historyCsv(r.st, H.coins));
    } catch (e) {
      hist.running = false; hist.error = e.message; console.error('История OI:', e.message);
      await io.sendTo(to, '❌ История открытого интереса не скачалась: ' + e.message + `. Прогресс сохранён, ${H.cmd} продолжит с того же места.`);
    }
  };

  // 3б) данные для проверки правил на других монетах (по команде /research, в фоне; ~10–15 минут)
  const research = { running: false, progress: {} };
  const runResearch = async to => {
    research.running = true; research.progress = {};
    try {
      const r = await researchJob(io, { progress: research.progress, log: m => console.log(m) });
      research.running = false;
      const mb = z => (z.length / 1048576).toFixed(1), day = new Date().toISOString().slice(0, 10);
      await io.sendTo(to, `✅ Данные готовы: ${r.ok} из ${r.total} загрузок${r.failed.length ? ' (не скачались: ' + r.failed.join(', ') + ')' : ''}. Отправляю ${r.zip15 ? 'два архива' : 'архив'} — перешли ${r.zip15 ? 'оба' : 'его'} Claude в чат исследования.`);
      for (const [nm, z] of [[`zynqel-research-${day}.zip`, r.zip], [`zynqel-research-15m-${day}.zip`, r.zip15]]) {
        if (!z) continue;
        const sent = await io.sendDocument(to, nm, z, 'application/zip');
        if (!sent) await io.sendTo(to, `❌ Telegram не принял ${nm} (${mb(z)} МБ). Напиши Claude — уменьшу.`);
      }
    } catch (e) {
      research.running = false; console.error('/research:', e.message);
      await io.sendTo(to, '❌ Данные не скачались: ' + e.message + '. Можно повторить /research позже.');
    }
  };

  // 3в) история премии (по команде /premium, в фоне; ~5 минут)
  const prem = { running: false, progress: {} };
  const runPremium = async to => {
    prem.running = true; prem.progress = {};
    try {
      const r = await premiumJob(io, { progress: prem.progress, log: m => console.log(m) });
      prem.running = false;
      await io.sendTo(to, `✅ История премии готова: ${r.ok} из ${r.total} монет${r.failed.length ? ' (не скачались: ' + r.failed.join(', ') + ')' : ''}. Отправляю архив — перешли его Claude.`);
      const sent = await io.sendDocument(to, `zynqel-premium-${new Date().toISOString().slice(0, 10)}.zip`, r.zip, 'application/zip');
      if (!sent) await io.sendTo(to, '❌ Telegram не принял архив. Напиши Claude.');
    } catch (e) { prem.running = false; console.error('/premium:', e.message); await io.sendTo(to, '❌ История премии не скачалась: ' + e.message + '. Можно повторить /premium позже.'); }
  };

  // 4) команды в личке бота: /id, /stats, /data, /history, /research, /premium
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
              const k = a.set || 1, hist = hists[k];
              if (hist.running) {
                const p = hist.progress;
                await io.sendTo(m.chat.id, `⏳ Уже качаю: ${p.sym || '…'}${p.day ? ' до ' + new Date(p.day).toISOString().slice(0, 10) : ''}, файлов ${p.files || 0}. Пришлю, когда закончу.`);
              } else {
                await io.sendTo(m.chat.id, `⏳ Начал скачивать историю открытого интереса и лонг/шорт с декабря 2021 ${HSETS[k].what} из архива Binance. Это около 20 000 файлов, займёт 20–60 минут. Пришлю CSV сюда. Торговля в это время работает как обычно.`);
                runHistory(m.chat.id, k);
              }
            }
            if (a.wick) {
              if (!wick) await io.sendTo(m.chat.id, '🪝 Ловец проливов выключен (WICK=0 в Railway → Variables).');
              else if (a.wick === 'status') await io.sendTo(m.chat.id, msgWick(st, wickMode));
              else if (a.wick === 'stop') { await io.sendTo(m.chat.id, '⏳ Останавливаю: снимаю лимитки, продаю позиции бота…'); const lines = await wick.stopAll(); saveState(file, st); await io.sendTo(m.chat.id, '⏸ Ловец проливов остановлен: ' + lines.join('; ') + '. Включить: /wickstart.'); }
              else if (a.wick === 'start') { st.wick.disabled = false; st.wick.peakEq = null; saveState(file, st); await io.sendTo(m.chat.id, '▶️ Ловец проливов включён — новые лимитки в начале следующего часа. Максимум баланса для стопа считаю заново с текущего.'); }
              else if (a.wick === 'test') { try { await io.sendTo(m.chat.id, '🪝 ' + await wick.test()); } catch (e) { await io.sendTo(m.chat.id, '🪝 ❌ Bybit: ' + e.message); } }
            }
            if (a.liq) {
              const key = (process.env.COINALYZE_KEY || '').trim();
              if (!key) await io.sendTo(m.chat.id, '🔑 Нужен бесплатный ключ Coinalyze: зарегистрируйся на coinalyze.net, создай API key и впиши его в Railway → Variables как <b>COINALYZE_KEY</b>. Бот перезапустится — тогда снова /liq.');
              else {
                await io.sendTo(m.chat.id, '⏳ Скачиваю ликвидации на Binance по дням (Coinalyze) по 51 монете. Около 2 минут.');
                try { const r = await liqJob(io, key, { log: x => console.log(x) });
                  await io.sendTo(m.chat.id, '✅ Готово:\n' + r.notes.join('\n') + '\nОтправляю архив — перешли его Claude.');
                  await io.sendDocument(m.chat.id, `zynqel-liq-${new Date().toISOString().slice(0, 10)}.zip`, r.zip, 'application/zip');
                } catch (e) { await io.sendTo(m.chat.id, '❌ Не скачалось: ' + e.message); }
              }
            }
            if (a.onchain) {
              await io.sendTo(m.chat.id, '⏳ Скачиваю ончейн BTC/ETH (Coin Metrics), корейскую цену (Upbit) и курс вона (FRED). 1–3 минуты.');
              try { const r = await onchainJob(io, { log: x => console.log(x) });
                await io.sendTo(m.chat.id, '✅ Готово:\n' + r.notes.join('\n') + '\nОтправляю архив — перешли его Claude.');
                await io.sendDocument(m.chat.id, `zynqel-onchain-${new Date().toISOString().slice(0, 10)}.zip`, r.zip, 'application/zip');
              } catch (e) { await io.sendTo(m.chat.id, '❌ Не скачалось: ' + e.message); }
            }
            if (a.macro) {
              try { const rows = await io.getUrl('https://stablecoins.llama.fi/stablecoincharts/all'); const csv = stableCsv(rows); const n = csv.trim().split('\n').length - 1;
                if (n < 100) throw new Error('DefiLlama вернул мало данных (' + n + ' дней)');
                await io.sendTo(m.chat.id, `✅ Выпуск стейблкоинов: ${n} дней. Отправляю файл — перешли его Claude.`);
                await io.sendDocument(m.chat.id, `zynqel-stablecoins-${new Date().toISOString().slice(0, 10)}.csv`, csv);
              } catch (e) { await io.sendTo(m.chat.id, '❌ Данные о стейблкоинах не скачались: ' + e.message); }
            }
            if (a.premium) {
              if (prem.running) { const p = prem.progress; await io.sendTo(m.chat.id, `⏳ Уже качаю: ${p.n || 0} из ${p.total || '…'}${p.sym ? ' (' + p.sym + ')' : ''}.`); }
              else { await io.sendTo(m.chat.id, '⏳ Начал скачивать с Binance часовую историю премии фьючерсов (из неё складывается funding) по 11 монетам с 2021 года. Займёт 5–10 минут. Пришлю архив сюда.'); runPremium(m.chat.id); }
            }
            if (a.research) {
              if (research.running) {
                const p = research.progress;
                await io.sendTo(m.chat.id, `⏳ Уже качаю: ${p.n || 0} из ${p.total || '…'}${p.sym ? ' (' + p.sym + ')' : ''}. Пришлю архив, когда закончу.`);
              } else {
                await io.sendTo(m.chat.id, '⏳ Начал скачивать с Binance историю funding, цен и дневных свечей по 60 монетам (их выбирает правило: самые торгуемые фьючерсы, которые есть с 2023 года и раньше), часовые свечи основных монет с 2021 года и 15-минутные SOL, BTC, ETH с 2023 года. Займёт 20–30 минут. Пришлю два архива сюда. Торговля работает как обычно.');
                runResearch(m.chat.id);
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
  crowdRatio, wickBefore, premiumJob, stableCsv, onchainJob, liqJob, LIQ_EXTRA, trendSignal, trendSize, trendTick, btcAboveSma, msgTrendEntry, msgTrendExit, trendSummary, mergeMarket, collectMarket, marketCsv, tradesCsv, handleCommand, isWeekend, closedRecord, cbPremium, unzipFirst, metricsSnapshots, oiHistoryJob, historyCsv, shadowSummary, OI_HOLDOUT,
  RESEARCH, researchUniverse, pageAll, researchCoin, researchJob, zipFiles, crc32,
  liveIO, splitText, WICK_DEF, bybitClient, wickLevel, wickSigSeries, wickNervMedian, wickBase, wickDayLimit, wickFloor, wickRuleText, makeWick, msgWick, wickCsv, floorStep, ceilStep, nearStep, ACTIVE, ACTIVE30, M30, short30Tick, SHORTE, shortEarlyCheck, btcBearAt, btcLiveBearAt, shortOpen, shortUpdate, msgShortEntry, msgShortExit, activeCoins, corridorAt, activeCheck, earlyCheck, msgEarlyEntry, msgEarlyExit, btcBullAt, btcLiveBullAt, activeOpen, activeUpdate, activeTick, msgActiveEntry, msgActiveExit, activeSummary, msgActiveStatus, activeCsv };
if (require.main === module) main();
