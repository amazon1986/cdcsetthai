import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { BotConfig, PaperAccount, PaperPosition, ExecutedTrade, KlineData, Timeframe } from './src/types';
import { calculateCDCActionZone, getCrossoverInfo } from './src/lib/cdcIndicator';
import { POPULAR_PAIRS, toBitkubSymbol } from './src/lib/bitkubApi';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ==================== SECURITY MIDDLEWARE ====================

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
}));

app.use(cors({
  origin: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const orderLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Order rate limit exceeded.' },
});

app.use('/api/', generalLimiter);
app.use(express.json({ limit: '200kb' }));

// ==================== STATE PERSISTENCE ON SERVER ====================

const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'bot_state.json');

interface ServerState {
  botConfig: BotConfig;
  paperAccount: PaperAccount;
  tradeHistory: ExecutedTrade[];
  botLogs: string[];
  liveApiKeys?: {
    apiKey: string;
    apiSecret: string;
    isTestnet?: boolean;
  };
}

const DEFAULT_SERVER_STATE: ServerState = {
  botConfig: {
    id: 'default_bot',
    symbol: 'PTT',
    timeframe: '1d',
    fastEmaPeriod: 12,
    slowEmaPeriod: 26,
    tradeAmountUsdt: 10000,
    usePercentBalance: true,
    balancePercent: 20,
    positionSizingMode: 'EQUAL_WEIGHT',
    leverage: 1,
    maxOpenPositions: 5,
    stopLossPercent: 5,
    takeProfitPercent: 15,
    useTrailingStop: false,
    trailingStopPercent: 3,
    buyOnSignal: ['BLUE', 'GREEN'],
    sellOnSignal: ['RED'],
    mode: 'PAPER',
    scanMode: 'SINGLE',
    directionMode: 'LONG_ONLY',
    isActive: false,
  },
  paperAccount: {
    usdtBalance: 100000,
    initialUsdtBalance: 100000,
    activePositions: [],
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalProfitUsdt: 0,
  },
  tradeHistory: [],
  botLogs: [
    `[${new Date().toLocaleTimeString('th-TH')}] 🚀 CDC Action Zone 24/7 Cloud Stock Bot Server initialized and ready.`,
  ],
};

let serverState: ServerState = { ...DEFAULT_SERVER_STATE };

function loadServerState() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      
      let cleanSymbol = parsed.botConfig?.symbol || 'PTT';
      if (cleanSymbol.includes('_') || cleanSymbol.includes('/') || ['BTC', 'ETH', 'USDT', 'KUB', 'ADA'].includes(cleanSymbol.toUpperCase())) {
        cleanSymbol = 'PTT';
      }
      if (parsed.botConfig) {
        parsed.botConfig.symbol = cleanSymbol;
      }

      if (parsed.paperAccount && (parsed.paperAccount.usdtBalance === 1000 || parsed.paperAccount.usdtBalance === 30000)) {
        parsed.paperAccount.usdtBalance = 100000;
        parsed.paperAccount.initialUsdtBalance = 100000;
      }

      serverState = {
        ...DEFAULT_SERVER_STATE,
        ...parsed,
        botConfig: { ...DEFAULT_SERVER_STATE.botConfig, ...(parsed.botConfig || {}) },
        paperAccount: { ...DEFAULT_SERVER_STATE.paperAccount, ...(parsed.paperAccount || {}) },
        tradeHistory: Array.isArray(parsed.tradeHistory) ? parsed.tradeHistory : [],
        botLogs: Array.isArray(parsed.botLogs) ? parsed.botLogs : [],
      };
      console.log('✅ Loaded persistent bot state from disk.');
    }
  } catch (err) {
    console.error('Error reading bot_state.json:', err);
    serverState = { ...DEFAULT_SERVER_STATE };
  }
}

function saveServerState() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(serverState, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing bot_state.json:', err);
  }
}

function addServerLog(msg: string) {
  const timestamp = new Date().toLocaleTimeString('th-TH', { hour12: false });
  const entry = `[${timestamp}] ${msg}`;
  serverState.botLogs.unshift(entry);
  if (serverState.botLogs.length > 200) {
    serverState.botLogs = serverState.botLogs.slice(0, 200);
  }
  saveServerState();
}

// Load state immediately on startup
loadServerState();

// ==================== INPUT VALIDATION HELPERS ====================

const VALID_SYMBOL_REGEX = /^[A-Z0-9_]{2,30}$/;
const VALID_SIDE_VALUES = ['BUY', 'SELL'];
const VALID_ORDER_TYPES = ['MARKET', 'LIMIT'];
const VALID_INTERVALS = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];

function sanitizeSymbol(symbol: string | undefined): string | null {
  if (!symbol) return null;
  const cleaned = String(symbol).toUpperCase().replace(/[^A-Z0-9_]/g, '');
  return VALID_SYMBOL_REGEX.test(cleaned) ? cleaned : null;
}

function sanitizeErrorMessage(error: any): string {
  if (process.env.NODE_ENV === 'production') {
    return 'An internal error occurred. Please try again.';
  }
  const msg = error?.message || 'Unknown error';
  return msg.replace(/\b[A-Z]:\\[^\s]+/gi, '[path]').substring(0, 200);
}

function buildBitkubSignature(timestamp: number, method: string, path: string, bodyString: string, secretKey: string): string {
  const payload = `${timestamp}${method.toUpperCase()}${path}${bodyString}`;
  return crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
}

// Time sync helper with Bitkub server
let bitkubTimeOffset = 0;
const lastTimeSync: Record<string, number> = {};

async function getBitkubTimestamp(): Promise<number> {
  const now = Date.now();
  const lastSync = lastTimeSync['bitkub'] || 0;

  if (now - lastSync > 60 * 1000) {
    try {
      const start = Date.now();
      const res = await fetch('https://api.bitkub.com/api/v3/servertime');
      if (res.ok) {
        const text = await res.text();
        const serverTimeSec = parseInt(text, 10);
        const serverTimeMs = serverTimeSec < 99999999999 ? serverTimeSec * 1000 : serverTimeSec;
        const end = Date.now();
        const latency = Math.floor((end - start) / 2);
        bitkubTimeOffset = serverTimeMs + latency - end;
        lastTimeSync['bitkub'] = end;
      }
    } catch (e) {
      console.warn('Failed to sync time with Bitkub:', e);
    }
  }

  return now + bitkubTimeOffset;
}

// ==================== SERVER-SIDE BOT SIZING & TRADING ENGINE ====================

function calculateOrderSize(config: BotConfig, account: PaperAccount): number {
  const maxPositions = config.maxOpenPositions || 5;
  if (account.activePositions.length >= maxPositions) return 0;

  const totalPositionsValue = account.activePositions.reduce((sum, p) => sum + (p.usdtInvested || 0), 0);
  const totalEquity = account.usdtBalance + totalPositionsValue;

  const mode = config.positionSizingMode || 'EQUAL_WEIGHT';
  let targetUsdt = 0;

  if (mode === 'EQUAL_WEIGHT') {
    targetUsdt = totalEquity / maxPositions;
  } else if (mode === 'PERCENT_EQUITY') {
    targetUsdt = (totalEquity * (config.balancePercent || 20)) / 100;
  } else {
    targetUsdt = config.tradeAmountUsdt || 100;
  }

  return Math.min(targetUsdt, account.usdtBalance);
}

async function fetchKlinesDirect(symbol: string, interval: string, limit = 300): Promise<KlineData[]> {
  try {
    let cleanSymbol = symbol;
    // Auto convert crypto symbols left in bot state to PTT
    if (cleanSymbol.includes('_') || cleanSymbol.includes('/')) {
      const parts = cleanSymbol.split(/[_/]/);
      cleanSymbol = parts[0] === 'USDT' || parts[0] === 'BTC' || parts[0] === 'ETH' || parts[0] === 'KUB' ? 'PTT' : parts[0];
    }
    const yahooSymbol = cleanSymbol.endsWith('.BK') ? cleanSymbol.toUpperCase() : `${cleanSymbol.toUpperCase()}.BK`;

    let yahooInterval = '1d';
    let step = 86400;
    switch (interval) {
      case '1m': yahooInterval = '1m'; step = 60; break;
      case '5m': yahooInterval = '5m'; step = 300; break;
      case '15m': yahooInterval = '15m'; step = 900; break;
      case '1h': yahooInterval = '60m'; step = 3600; break;
      case '4h': yahooInterval = '60m'; step = 14400; break; // Fallback to 1h
      case '1d': yahooInterval = '1d'; step = 86400; break;
      case '1w': yahooInterval = '1wk'; step = 604800; break;
    }
    const to = Math.floor(Date.now() / 1000);
    const from = to - (limit * step);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${yahooInterval}&period1=${from}&period2=${to}`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result || !result.timestamp) return [];
    
    const quote = result.indicators?.quote?.[0];
    if (!quote) return [];

    const klines: KlineData[] = [];
    for (let i = 0; i < result.timestamp.length; i++) {
      const t = result.timestamp[i];
      const o = quote.open?.[i];
      const h = quote.high?.[i];
      const l = quote.low?.[i];
      const c = quote.close?.[i];
      const v = quote.volume?.[i] || 0;

      if (o == null || h == null || l == null || c == null) continue;

      klines.push({
        time: t,
        open: Number(o),
        high: Number(h),
        low: Number(l),
        close: Number(c),
        volume: Number(v),
      });
    }
    return klines;
  } catch (err) {
    return [];
  }
}

// ==================== SERVER-SIDE 24/7 AUTOMATED CYCLE ====================

let isCycleRunning = false;

async function runServerBotCycle() {
  if (isCycleRunning) return;
  const config = serverState.botConfig;
  if (!config.isActive) return;

  isCycleRunning = true;
  try {
    const dirMode = config.directionMode ?? 'LONG_ONLY';
    const isMultiScan = config.scanMode === 'MULTI_SCAN';
    const symbolsToEvaluate = isMultiScan ? POPULAR_PAIRS.slice(0, 15) : [config.symbol];

    for (const sym of symbolsToEvaluate) {
      if (!serverState.botConfig.isActive) break;

      const rawCandles = await fetchKlinesDirect(sym, config.timeframe, 300);
      if (rawCandles.length < 30) continue;

      const cdcCandles = calculateCDCActionZone(rawCandles, config.fastEmaPeriod, config.slowEmaPeriod);
      if (cdcCandles.length < 2) continue;

      const latestCandle = cdcCandles[cdcCandles.length - 1];
      const currentPrice = latestCandle.close;

      // 1. Check Exits on Active Positions for this symbol
      const existingPosIndex = serverState.paperAccount.activePositions.findIndex((p) => p.symbol === sym);
      if (existingPosIndex !== -1) {
        const pos = serverState.paperAccount.activePositions[existingPosIndex];
        const posLev = pos.leverage || 1;
        const margin = pos.marginUsdt || pos.usdtInvested;

        const pnlPercent = pos.side === 'SHORT'
          ? ((pos.entryPrice - currentPrice) / pos.entryPrice) * 100 * posLev
          : ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 * posLev;
        const pnlUsdt = (margin * pnlPercent) / 100;

        let exitReason = '';
        if (pnlPercent <= -90 || (pos.liquidationPrice && (pos.side === 'LONG' ? currentPrice <= pos.liquidationPrice : currentPrice >= pos.liquidationPrice))) {
          exitReason = '⚡ Auto Liquidation (Margin Call -90%)';
        } else if (config.stopLossPercent > 0 && pnlPercent <= -config.stopLossPercent) {
          exitReason = `Stop Loss (-${config.stopLossPercent}%)`;
        } else if (config.takeProfitPercent > 0 && pnlPercent >= config.takeProfitPercent) {
          exitReason = `Take Profit (+${config.takeProfitPercent}%)`;
        } else {
          const isExitSignal = pos.side === 'SHORT'
            ? config.buyOnSignal.includes(latestCandle.zone as any)
            : config.sellOnSignal.includes(latestCandle.zone as any);
          if (isExitSignal) {
            exitReason = `CDC Exit Signal ${latestCandle.colorNameTh}`;
          }
        }

        if (exitReason) {
          const returnUsdt = Math.max(0, margin + pnlUsdt);
          serverState.paperAccount.usdtBalance += returnUsdt;
          serverState.paperAccount.activePositions.splice(existingPosIndex, 1);
          serverState.paperAccount.totalTrades += 1;
          if (pnlUsdt > 0) {
            serverState.paperAccount.winningTrades += 1;
          } else {
            serverState.paperAccount.losingTrades += 1;
          }
          serverState.paperAccount.totalProfitUsdt += pnlUsdt;

          const trade: ExecutedTrade = {
            id: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            symbol: pos.symbol,
            timeframe: config.timeframe,
            side: pos.side === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT',
            price: currentPrice,
            amount: pos.amount,
            usdtValue: returnUsdt,
            leverage: posLev,
            pnlUsdt: Number(pnlUsdt.toFixed(2)),
            pnlPercent: Number(pnlPercent.toFixed(2)),
            reason: `[Cloud 24/7] ${exitReason}`,
            timestamp: Date.now(),
            mode: config.mode,
          };

          serverState.tradeHistory.unshift(trade);
          if (serverState.tradeHistory.length > 500) {
            serverState.tradeHistory = serverState.tradeHistory.slice(0, 500);
          }

          addServerLog(`🛑 [SERVER 24/7 ${exitReason.includes('Liquidation') ? 'LIQUIDATE' : 'AUTO CLOSE'} ${pos.side} ${posLev}x] ${pos.symbol} @ ฿${currentPrice} | PnL: ${pnlUsdt >= 0 ? '+' : ''}฿${pnlUsdt.toFixed(2)} (${pnlPercent.toFixed(2)}%) | เหตุผล: ${exitReason}`);
          saveServerState();
        } else {
          pos.currentPnlUsdt = Number(pnlUsdt.toFixed(2));
          pos.currentPnlPercent = Number(pnlPercent.toFixed(2));
        }
        continue;
      }

      // 2. Check Entries for this symbol
      const maxPositions = config.maxOpenPositions || 5;
      if (serverState.paperAccount.activePositions.length >= maxPositions) {
        break; // Max concurrent slots reached
      }

      const crossInfo = getCrossoverInfo(cdcCandles);
      const isBuySignal = crossInfo.isFreshGoldenCross && (
        (config.buyOnSignal.includes('BLUE') && latestCandle.zone === 'BLUE') ||
        (config.buyOnSignal.includes('GREEN') && latestCandle.zone === 'GREEN') ||
        (config.buyOnSignal.includes('BLUE') && config.buyOnSignal.includes('GREEN') && (latestCandle.zone === 'BLUE' || latestCandle.zone === 'GREEN'))
      );

      const isSellSignal = crossInfo.isFreshDeadCross && (
        (config.sellOnSignal.includes('RED') && latestCandle.zone === 'RED') ||
        (config.sellOnSignal.includes('YELLOW') && latestCandle.zone === 'YELLOW')
      );

      let targetSide: 'LONG' | 'SHORT' | null = null;
      if ((dirMode === 'LONG_ONLY' || dirMode === 'BOTH') && isBuySignal) {
        targetSide = 'LONG';
      } else if ((dirMode === 'SHORT_ONLY' || dirMode === 'BOTH') && isSellSignal) {
        targetSide = 'SHORT';
      }

      if (targetSide) {
        const tradeUsdt = calculateOrderSize(config, serverState.paperAccount);
        const lev = Math.min(Math.max(1, config.leverage || 1), 10);
        if (tradeUsdt >= 10 && serverState.paperAccount.usdtBalance >= tradeUsdt) {
          const notionalValue = tradeUsdt * lev;
          const coinAmount = notionalValue / currentPrice;
          const liqPrice = targetSide === 'LONG'
            ? currentPrice * (1 - 0.9 / lev)
            : currentPrice * (1 + 0.9 / lev);

          serverState.paperAccount.usdtBalance -= tradeUsdt;

          const newPos: PaperPosition = {
            symbol: sym,
            side: targetSide,
            entryPrice: currentPrice,
            amount: coinAmount,
            usdtInvested: tradeUsdt,
            marginUsdt: tradeUsdt,
            leverage: lev,
            liquidationPrice: Number(liqPrice.toFixed(6)),
            entryTime: Date.now(),
            currentPnlUsdt: 0,
            currentPnlPercent: 0,
          };

          serverState.paperAccount.activePositions.push(newPos);

          const trade: ExecutedTrade = {
            id: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            symbol: sym,
            timeframe: config.timeframe,
            side: targetSide === 'LONG' ? 'BUY' : 'SELL',
            price: currentPrice,
            amount: coinAmount,
            usdtValue: notionalValue,
            leverage: lev,
            reason: `[Cloud 24/7 Entry ${lev}x] CDC ${latestCandle.colorNameTh} (${targetSide})`,
            timestamp: Date.now(),
            mode: config.mode,
          };

          serverState.tradeHistory.unshift(trade);
          addServerLog(`🚀 [SERVER 24/7 OPEN ${targetSide} ${lev}x] ${sym} @ ฿${currentPrice} | ทุน ฿${tradeUsdt.toFixed(2)} THB (มูลค่าสัญญา ฿${notionalValue.toFixed(2)}) | สัญญาณ ${latestCandle.colorNameTh}`);
          saveServerState();
        }
      }
    }
  } catch (err) {
    console.error('Error in server bot cycle:', err);
  } finally {
    isCycleRunning = false;
  }
}

// Start continuous 24/7 background execution loop every 10 seconds
setInterval(runServerBotCycle, 10000);

// Self-ping heartbeat every 10 minutes to prevent Render Free Tier from sleeping
const RENDER_APP_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_APP_URL) {
  setInterval(async () => {
    try {
      await fetch(`${RENDER_APP_URL}/api/health`);
      console.log('💓 Anti-sleep heartbeat self-ping successful.');
    } catch (e) {
      console.warn('Heartbeat ping failed:', e);
    }
  }, 10 * 60 * 1000);
}

// ==================== CENTRAL BOT REST ENDPOINTS ====================

// 1. Get central server state
app.get('/api/bot/state', (req, res) => {
  return res.json({
    botConfig: serverState.botConfig,
    paperAccount: serverState.paperAccount,
    tradeHistory: serverState.tradeHistory,
    botLogs: serverState.botLogs,
    serverTime: Date.now(),
    isServerRunning: true,
  });
});

// 2. Update bot config
app.post('/api/bot/config', (req, res) => {
  try {
    const updated = req.body as Partial<BotConfig>;
    if (updated.leverage !== undefined) {
      updated.leverage = Math.min(Math.max(1, parseInt(String(updated.leverage), 10) || 1), 10);
    }
    serverState.botConfig = {
      ...serverState.botConfig,
      ...updated,
    };
    saveServerState();
    addServerLog(`⚙️ อัปเดตการตั้งค่าบอท: ${serverState.botConfig.symbol} | Leverage: ${serverState.botConfig.leverage || 1}x | TF: ${serverState.botConfig.timeframe} | สถานะ: ${serverState.botConfig.isActive ? 'เปิดทำงาน 🟢' : 'หยุด 🔴'}`);
    return res.json({ success: true, botConfig: serverState.botConfig });
  } catch (err: any) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// 3. Toggle bot active status
app.post('/api/bot/toggle', (req, res) => {
  const { isActive } = req.body;
  const next = typeof isActive === 'boolean' ? isActive : !serverState.botConfig.isActive;
  serverState.botConfig.isActive = next;
  saveServerState();
  addServerLog(next ? '🟢 [CLOUD 24/7 BOT ACTIVATED] เริ่มระบบเทรดอัตโนมัติบนคลาวด์' : '🔴 [CLOUD BOT STOPPED] หยุดระบบเทรดอัตโนมัติ');
  return res.json({ success: true, isActive: next });
});

// 4. Manual Order
app.post('/api/bot/manual-order', (req, res) => {
  try {
    const { symbol, side, amountUsdt, currentPrice } = req.body;
    if (!symbol || !side || !amountUsdt || !currentPrice) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    if (serverState.paperAccount.usdtBalance < amountUsdt) {
      return res.status(400).json({ error: 'ยอดเงินคงเหลือไม่เพียงพอ' });
    }

    const lev = Math.min(Math.max(1, serverState.botConfig.leverage || 1), 10);
    const notionalValue = amountUsdt * lev;
    const coinAmount = notionalValue / currentPrice;
    const liqPrice = side === 'LONG'
      ? currentPrice * (1 - 0.9 / lev)
      : currentPrice * (1 + 0.9 / lev);

    serverState.paperAccount.usdtBalance -= amountUsdt;

    const newPos: PaperPosition = {
      symbol,
      side,
      entryPrice: currentPrice,
      amount: coinAmount,
      usdtInvested: amountUsdt,
      marginUsdt: amountUsdt,
      leverage: lev,
      liquidationPrice: Number(liqPrice.toFixed(6)),
      entryTime: Date.now(),
      currentPnlUsdt: 0,
      currentPnlPercent: 0,
    };

    serverState.paperAccount.activePositions.push(newPos);

    const trade: ExecutedTrade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      symbol,
      timeframe: serverState.botConfig.timeframe,
      side: side === 'LONG' ? 'BUY' : 'SELL',
      price: currentPrice,
      amount: coinAmount,
      usdtValue: notionalValue,
      leverage: lev,
      reason: `[Manual Order ${lev}x] เปิด ${side} ด้วยตนเอง`,
      timestamp: Date.now(),
      mode: serverState.botConfig.mode,
    };

    serverState.tradeHistory.unshift(trade);
    addServerLog(`✋ [MANUAL ORDER ${lev}x] เปิด ${side} ${symbol} @ ฿${currentPrice} | ทุน ฿${amountUsdt} THB (มูลค่าสัญญา ฿${notionalValue.toFixed(2)})`);
    saveServerState();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// 5. Manual Close Position
app.post('/api/bot/close-position', async (req, res) => {
  try {
    let { symbol, currentPrice, reason = 'Manual Close' } = req.body;
    const idx = serverState.paperAccount.activePositions.findIndex((p) => p.symbol === symbol);
    if (idx === -1) {
      return res.status(404).json({ error: 'ไม่พบตำแหน่งที่เปิดอยู่' });
    }

    const pos = serverState.paperAccount.activePositions[idx];

    // Verification: If currentPrice is missing, zero, or has wild ratio error (>50x difference from entryPrice), fetch exact market price for this symbol
    const priceRatio = (currentPrice && pos.entryPrice) ? (currentPrice / pos.entryPrice) : 0;
    if (!currentPrice || currentPrice <= 0 || priceRatio > 50 || priceRatio < 0.02) {
      try {
        const liveKlines = await fetchKlinesDirect(pos.symbol, '1m', 1);
        if (liveKlines.length > 0 && liveKlines[0].close > 0) {
          currentPrice = liveKlines[0].close;
        }
      } catch (err) {
        console.warn(`Failed to verify close price for ${pos.symbol}:`, err);
      }
    }

    const posLev = pos.leverage || 1;
    const margin = pos.marginUsdt || pos.usdtInvested;
    const pnlPercent = pos.side === 'SHORT'
      ? ((pos.entryPrice - currentPrice) / pos.entryPrice) * 100 * posLev
      : ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 * posLev;
    const pnlUsdt = (margin * pnlPercent) / 100;
    const returnUsdt = Math.max(0, margin + pnlUsdt);

    serverState.paperAccount.usdtBalance += returnUsdt;
    serverState.paperAccount.activePositions.splice(idx, 1);
    serverState.paperAccount.totalTrades += 1;
    if (pnlUsdt > 0) serverState.paperAccount.winningTrades += 1;
    else serverState.paperAccount.losingTrades += 1;
    serverState.paperAccount.totalProfitUsdt += pnlUsdt;

    const trade: ExecutedTrade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      symbol: pos.symbol,
      timeframe: serverState.botConfig.timeframe,
      side: pos.side === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT',
      price: currentPrice,
      amount: pos.amount,
      usdtValue: returnUsdt,
      leverage: posLev,
      pnlUsdt: Number(pnlUsdt.toFixed(2)),
      pnlPercent: Number(pnlPercent.toFixed(2)),
      reason: `[Manual Close] ${reason}`,
      timestamp: Date.now(),
      mode: serverState.botConfig.mode,
    };

    serverState.tradeHistory.unshift(trade);
    addServerLog(`✋ [MANUAL CLOSE ${posLev}x] ปิดสัญญา ${pos.symbol} @ ฿${currentPrice} | PnL: ${pnlUsdt >= 0 ? '+' : ''}฿${pnlUsdt.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
    saveServerState();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// 6. Clear Logs
app.post('/api/bot/clear-logs', (req, res) => {
  serverState.botLogs = [];
  saveServerState();
  return res.json({ success: true });
});

// 7. Reset Paper Account
app.post('/api/bot/reset-paper', (req, res) => {
  serverState.paperAccount = {
    usdtBalance: 10000,
    initialUsdtBalance: 10000,
    activePositions: [],
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalProfitUsdt: 0,
  };
  serverState.tradeHistory = [];
  addServerLog('🔄 รีเซ็ตพอร์ตจำลอง (Paper Account) เรียบร้อยแล้ว');
  saveServerState();
  return res.json({ success: true });
});

// 8. Health check & uptime
app.get('/api/health', (req, res) => {
  return res.json({
    status: 'ok',
    uptime: process.uptime(),
    isBotActive: serverState.botConfig.isActive,
    time: new Date().toISOString(),
  });
});

// ==================== BITKUB PROXY ENDPOINTS ====================

// ==================== STOCK PORTAL ENDPOINTS (MOCKED & YAHOO FEED) ====================

app.get('/api/bitkub/klines', async (req, res) => {
  try {
    let symbol = (req.query.symbol as string) || 'PTT';
    // Auto convert crypto symbols left in bot state to PTT
    if (symbol.includes('_') || symbol.includes('/')) {
      const parts = symbol.split(/[_/]/);
      symbol = parts[0] === 'USDT' || parts[0] === 'BTC' || parts[0] === 'ETH' || parts[0] === 'KUB' ? 'PTT' : parts[0];
    }
    const resolution = String(req.query.resolution || '1D');
    const from = parseInt(String(req.query.from || '0'), 10);
    const to = parseInt(String(req.query.to || '0'), 10);

    const yahooSymbol = symbol.endsWith('.BK') ? symbol.toUpperCase() : `${symbol.toUpperCase()}.BK`;
    let interval = '1d';
    if (resolution === '1') interval = '1m';
    else if (resolution === '5') interval = '5m';
    else if (resolution === '15') interval = '15m';
    else if (resolution === '60') interval = '60m';
    else if (resolution === '240') interval = '60m'; // yahoo limits, fallback to 1h
    else if (resolution === '1D' || resolution === 'D') interval = '1d';
    else if (resolution === '1W' || resolution === 'W') interval = '1wk';

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${interval}&period1=${from}&period2=${to}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ s: 'error', error: 'Yahoo API request failed' });
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result || !result.timestamp) {
      return res.json({ s: 'no_data', t: [], o: [], h: [], l: [], c: [], v: [] });
    }

    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0];
    if (!quote) {
      return res.json({ s: 'no_data', t: [], o: [], h: [], l: [], c: [], v: [] });
    }

    const t: number[] = [];
    const o: number[] = [];
    const h: number[] = [];
    const l: number[] = [];
    const c: number[] = [];
    const v: number[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (
        quote.open?.[i] == null ||
        quote.high?.[i] == null ||
        quote.low?.[i] == null ||
        quote.close?.[i] == null
      ) {
        continue;
      }
      t.push(timestamps[i]);
      o.push(Number(quote.open[i]));
      h.push(Number(quote.high[i]));
      l.push(Number(quote.low[i]));
      c.push(Number(quote.close[i]));
      v.push(Number(quote.volume?.[i] || 0));
    }

    return res.json({
      s: 'ok',
      t, o, h, l, c, v
    });
  } catch (error: any) {
    return res.status(500).json({ error: sanitizeErrorMessage(error) });
  }
});

app.get('/api/bitkub/ticker', async (req, res) => {
  try {
    const popularStocks = [
      'PTT', 'CPALL', 'AOT', 'DELTA', 'ADVANC', 'BDMS', 'KBANK', 'SCB', 'GULF', 'PTTEP', 'TRUE', 'KTB', 'CPF', 'HMPRO', 'SCC'
    ];
    const symbolsQuery = popularStocks.map(s => `${s}.BK`).join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolsQuery}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const tickerResult: Record<string, any> = {};

    if (response.ok) {
      const data = await response.json();
      const quotes = data.quoteResponse?.result || [];
      quotes.forEach((q: any) => {
        const rawSym = q.symbol.replace('.BK', '');
        const formatKey = `THB_${rawSym}`;
        const last = q.regularMarketPrice || 0;
        const changePercent = q.regularMarketChangePercent || 0;
        const volume = q.regularMarketVolume || 0;

        tickerResult[formatKey] = {
          last: last,
          percentChange: changePercent,
          lowestAsk: last,
          highestBid: last,
          baseVolume: volume,
          quoteVolume: volume * last
        };
      });
    }

    // Fallback/fill missing stocks
    popularStocks.forEach(s => {
      const key = `THB_${s}`;
      if (!tickerResult[key]) {
        tickerResult[key] = {
          last: 40.0,
          percentChange: 0.0,
          lowestAsk: 40.0,
          highestBid: 40.0,
          baseVolume: 500000,
          quoteVolume: 20000000
        };
      }
    });

    return res.json(tickerResult);
  } catch (error: any) {
    return res.status(500).json({ error: sanitizeErrorMessage(error) });
  }
});

app.get('/api/bitkub/depth', async (req, res) => {
  try {
    const rawSymbol = (req.query.symbol as string) || 'PTT';
    let symbol = rawSymbol;
    if (symbol.includes('_')) {
      const parts = symbol.split('_');
      symbol = parts[1] === 'THB' ? parts[0] : parts[1];
    }
    
    const yahooSymbol = symbol.endsWith('.BK') ? symbol.toUpperCase() : `${symbol.toUpperCase()}.BK`;
    let lastPrice = 50.0;
    try {
      const response = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSymbol}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (response.ok) {
        const data = await response.json();
        lastPrice = data.quoteResponse?.result?.[0]?.regularMarketPrice || 50.0;
      }
    } catch (e) {
      console.warn('Depth price fetch failed, using fallback 50.0');
    }

    const bids: [string, string][] = [];
    const asks: [string, string][] = [];
    const limit = Math.min(Math.max(1, parseInt(String(req.query.limit || '15'), 10) || 15), 50);

    let tickSize = 0.25;
    if (lastPrice < 2) tickSize = 0.01;
    else if (lastPrice < 5) tickSize = 0.02;
    else if (lastPrice < 10) tickSize = 0.05;
    else if (lastPrice < 25) tickSize = 0.10;
    else if (lastPrice < 100) tickSize = 0.25;
    else if (lastPrice < 200) tickSize = 0.50;
    else if (lastPrice < 400) tickSize = 1.00;
    else tickSize = 2.00;

    for (let i = 1; i <= limit; i++) {
      const bidPrice = (lastPrice - (i * tickSize)).toFixed(2);
      const askPrice = (lastPrice + (i * tickSize)).toFixed(2);
      const bidQty = (Math.floor(Math.random() * 500) * 100 + 100).toString();
      const askQty = (Math.floor(Math.random() * 500) * 100 + 100).toString();
      bids.push([bidPrice, bidQty]);
      asks.push([askPrice, askQty]);
    }

    return res.json({ bids, asks });
  } catch (error: any) {
    return res.status(500).json({ error: sanitizeErrorMessage(error) });
  }
});

app.post('/api/bitkub/balances', async (req, res) => {
  try {
    const { apiKey } = req.body;
    return res.json({
      success: true,
      canTrade: true,
      accountType: 'SET_SANDBOX',
      balances: [
        { asset: 'THB', free: '1000000.00', locked: '0.00' }
      ]
    });
  } catch (error: any) {
    return res.status(500).json({ error: sanitizeErrorMessage(error) });
  }
});

app.post('/api/bitkub/order', orderLimiter, async (req, res) => {
  try {
    const { apiKey, symbol, side, quantity, price, orderType = 'MARKET' } = req.body;
    return res.json({
      success: true,
      order: {
        orderId: `set_${Date.now()}`,
        symbol: symbol,
        side: side,
        quantity: quantity,
        price: price || 'MARKET',
        status: 'SUCCESS'
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: sanitizeErrorMessage(error) });
  }
});

app.post('/api/bitkub/keys', (req, res) => {
  try {
    const { apiKey, apiSecret } = req.body;
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: 'กรุณากรอก App Key และ App Secret ให้ครบถ้วน' });
    }
    serverState.liveApiKeys = { apiKey, apiSecret, isTestnet: true };
    saveServerState();
    addServerLog(`🔑 ซิงก์ Settrade Sandbox API Key ขึ้นเซิร์ฟเวอร์เรียบร้อย`);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// ==================== AI ANALYST (GEMINI) ====================

app.post('/api/ai/analyze', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'GEMINI_API_KEY is not configured on server. Please set GEMINI_API_KEY in environment variables.',
      });
    }

    const { symbol, timeframe, currentPrice, zone, emaFast, emaSlow, recentCandles } = req.body;
    const ai = new GoogleGenAI({ apiKey });

    const recentCandlesSummary = Array.isArray(recentCandles)
      ? recentCandles.slice(-10).map((c: any) => `Time: ${new Date(c.time * 1000).toISOString().slice(0, 16)} | Close: ${c.close} | Zone: ${c.zone} | Color: ${c.colorNameTh}`).join('\n')
      : 'ไม่มีข้อมูลแท่งเทียนย้อนหลัง';

    const prompt = `คุณคือผู้เชี่ยวชาญด้าน Technical Analysis หุ้นไทย และเป็นศิษย์เอกของระบบ CDC Action Zone V2/V3 (สูตรลุงโฉลก - Chaloke.org)
วิเคราะห์หุ้น ${symbol} บนไทม์เฟรม ${timeframe}:
- ราคาปัจจุบัน: ฿${currentPrice}
- สถานะ CDC Zone: ${zone}
- EMA 12: ฿${emaFast} | EMA 26: ฿${emaSlow}
ข้อมูลแท่งเทียน:
${recentCandlesSummary}

ตอบเป็นรูปแบบ JSON:
{
  "summary": "สรุปการวิเคราะห์เชิงเทคนิค 2-3 ประโยค",
  "marketTrend": "BULLISH" หรือ "BEARISH" หรือ "SIDEWAYS",
  "keyLevels": { "support": [แนวรับ1, แนวรับ2], "resistance": [แนวต้าน1, แนวต้าน2] },
  "botRecommendation": "คำแนะนำสั้นๆ สำหรับตั้งค่า Bot CDC Action Zone",
  "riskAssessment": "ประเมินความเสี่ยงและคำแนะนำสัดส่วนพอร์ต"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const text = response.text || '';
    let parsedData;
    try {
      parsedData = JSON.parse(text);
    } catch {
      parsedData = {
        summary: text,
        marketTrend: 'SIDEWAYS',
        keyLevels: { support: [currentPrice * 0.95], resistance: [currentPrice * 1.05] },
        botRecommendation: 'ทำตามวินัย CDC Action Zone V2',
        riskAssessment: 'ตั้ง Stop loss ทุกครั้งเพื่อป้องกันความเสี่ยง',
      };
    }

    return res.json(parsedData);
  } catch (error: any) {
    return res.status(500).json({ error: sanitizeErrorMessage(error) });
  }
});

// ==================== VITE & SERVER LAUNCH ====================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CDC Action Zone 24/7 Cloud Bot Server running on port ${PORT}`);
  });
}

startServer();
