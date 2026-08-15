import { BotConfig, PaperAccount, ExecutedTrade, BitkubApiKeys, PaperPosition, Timeframe } from '../types';
import { encryptText, decryptText } from './crypto';
import { POPULAR_PAIRS } from './bitkubApi';

const STORAGE_KEYS = {
  BOT_CONFIG: 'cdc_bot_config_v2',
  PAPER_ACCOUNT: 'cdc_paper_account_v2',
  TRADE_HISTORY: 'cdc_trade_history_v2',
  BITKUB_KEYS: 'cdc_bitkub_keys_v2',
  BOT_LOGS: 'cdc_bot_logs_v2',
  CUSTOM_SYMBOLS: 'cdc_custom_symbols_v2',
};

export const DEFAULT_BOT_CONFIG: BotConfig = {
  id: 'default_bot',
  symbol: 'PTT',
  timeframe: '1d', // 🚀 Default to 1D (Daily) as requested by user
  fastEmaPeriod: 12,
  slowEmaPeriod: 26,
  tradeAmountUsdt: 10000, // THB value
  usePercentBalance: true,
  balancePercent: 20,
  positionSizingMode: 'EQUAL_WEIGHT', // 🎯 ถัวเฉลี่ยเท่ากันทุกหุ้น (Equal Weight Sizing)
  leverage: 1, // ⚡ Default 1x (1x to 10x)
  maxOpenPositions: 5, // 🎯 ถือครองสูงสุด 5 ไม้ (แบ่งเท่ากันไม้ละ 20% ของพอร์ตรวม)
  stopLossPercent: 5,
  takeProfitPercent: 15,
  useTrailingStop: false,
  trailingStopPercent: 3,
  buyOnSignal: ['BLUE', 'GREEN'], // 🎯 สัญญาณฟ้าแรก หรือ เขียวแรกคอนเฟิร์มตามลุงโฉลก (Safe Confirmed Entry)
  sellOnSignal: ['RED'], // 🎯 ขายออก/Short เฉพาะสัญญาณแดงแรกคอนเฟิร์ม (Bearish Cash Out)
  mode: 'PAPER',
  scanMode: 'SINGLE',
  directionMode: 'LONG_ONLY',
  isActive: false,
};

export const DEFAULT_PAPER_ACCOUNT: PaperAccount = {
  usdtBalance: 100000, // Initial THB balance
  initialUsdtBalance: 100000,
  activePositions: [],
  totalTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  totalProfitUsdt: 0,
};

// Store Helper Functions

export function getStoredBotConfig(): BotConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOT_CONFIG);
    if (!raw) return DEFAULT_BOT_CONFIG;
    const parsed = JSON.parse(raw);
    const lev = Math.min(Math.max(1, parseInt(parsed.leverage || 1, 10)), 10);
    return {
      ...DEFAULT_BOT_CONFIG,
      ...parsed,
      leverage: isNaN(lev) ? 1 : lev,
      timeframe: parsed.timeframe || '1d',
      maxOpenPositions: parsed.maxOpenPositions && parsed.maxOpenPositions > 0 ? parsed.maxOpenPositions : 5,
      positionSizingMode: parsed.positionSizingMode || 'EQUAL_WEIGHT',
      buyOnSignal: parsed.buyOnSignal && parsed.buyOnSignal.length > 0 ? parsed.buyOnSignal : ['BLUE', 'GREEN'],
      sellOnSignal: parsed.sellOnSignal && parsed.sellOnSignal.length > 0 ? parsed.sellOnSignal : ['RED'],
    };
  } catch {
    return DEFAULT_BOT_CONFIG;
  }
}

export function saveBotConfig(config: BotConfig): void {
  localStorage.setItem(STORAGE_KEYS.BOT_CONFIG, JSON.stringify(config));
}

export function getStoredPaperAccount(): PaperAccount {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PAPER_ACCOUNT);
    return raw ? JSON.parse(raw) : DEFAULT_PAPER_ACCOUNT;
  } catch {
    return DEFAULT_PAPER_ACCOUNT;
  }
}

export function savePaperAccount(account: PaperAccount): void {
  localStorage.setItem(STORAGE_KEYS.PAPER_ACCOUNT, JSON.stringify(account));
}

export function getStoredTradeHistory(): ExecutedTrade[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRADE_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTradeHistory(trades: ExecutedTrade[]): void {
  localStorage.setItem(STORAGE_KEYS.TRADE_HISTORY, JSON.stringify(trades));
}

export function addTradeToHistory(trade: ExecutedTrade): void {
  const history = getStoredTradeHistory();
  const updated = [trade, ...history];
  saveTradeHistory(updated);
}

export function getStoredBitkubKeys(): BitkubApiKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BITKUB_KEYS);
    if (!raw) return { apiKey: '', apiSecret: '' };
    const parsed = JSON.parse(raw);
    return {
      apiKey: decryptText(parsed.apiKey),
      apiSecret: decryptText(parsed.apiSecret),
    };
  } catch {
    return { apiKey: '', apiSecret: '' };
  }
}

export function saveBitkubKeys(keys: BitkubApiKeys): void {
  const encryptedKeys = {
    apiKey: encryptText(keys.apiKey),
    apiSecret: encryptText(keys.apiSecret),
  };
  localStorage.setItem(STORAGE_KEYS.BITKUB_KEYS, JSON.stringify(encryptedKeys));
}

export function getStoredLogs(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOT_LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addBotLog(logMessage: string): string[] {
  const time = new Date().toLocaleTimeString('th-TH');
  const formattedMsg = `[${time}] ${logMessage}`;
  const logs = getStoredLogs();
  const newLogs = [formattedMsg, ...logs].slice(0, 100);
  localStorage.setItem(STORAGE_KEYS.BOT_LOGS, JSON.stringify(newLogs));
  return newLogs;
}

export function getStoredSymbols(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_SYMBOLS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    return POPULAR_PAIRS;
  } catch {
    return POPULAR_PAIRS;
  }
}

export function saveStoredSymbols(symbols: string[]): void {
  localStorage.setItem(STORAGE_KEYS.CUSTOM_SYMBOLS, JSON.stringify(symbols));
}
