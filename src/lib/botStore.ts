import { BotConfig, PaperAccount, ExecutedTrade, SettradeApiKeys, PaperPosition, Timeframe } from '../types';
import { encryptText, decryptText } from './encryption';
import { POPULAR_STOCKS } from './stockApi';

const STORAGE_KEYS = {
  BOT_CONFIG: 'cdc_stock_bot_config_v2',
  PAPER_ACCOUNT: 'cdc_stock_paper_account_v2',
  TRADE_HISTORY: 'cdc_stock_trade_history_v2',
  SETTRADE_KEYS: 'cdc_settrade_keys_v2',
  TELEGRAM_CONFIG: 'cdc_telegram_config_v2',
  BOT_LOGS: 'cdc_stock_bot_logs_v2',
  CUSTOM_SYMBOLS: 'cdc_stock_custom_symbols_v2',
  WATCHLIST: 'cdc_stock_watchlist_v2',
};

export const DEFAULT_BOT_CONFIG: BotConfig = {
  id: 'default_bot',
  symbol: 'PTT',
  timeframe: '1d', // 🎯 Standard Daily timeframe according to Uncle Chaloke
  fastEmaPeriod: 12,
  slowEmaPeriod: 26,
  tradeAmountUsdt: 10000, // Budget per order in THB (฿)
  usePercentBalance: true,
  balancePercent: 20,
  positionSizingMode: 'EQUAL_WEIGHT', // 🎯 ถัวเฉลี่ยเท่ากันทุกหุ้น (Equal Weight Sizing)
  leverage: 1,
  maxOpenPositions: 5, // 🎯 ถือครองสูงสุด 5 ตัว (ไม้ละ 20% ของพอร์ตรวม)
  stopLossPercent: 5,
  takeProfitPercent: 15,
  useTrailingStop: false,
  trailingStopPercent: 3,
  buyOnSignal: ['BLUE', 'GREEN'], // 🎯 สัญญาณฟ้าแรก หรือ เขียวแรกตามระบบ CDC Action Zone V2 ลุงโฉลก
  sellOnSignal: ['RED'], // 🎯 ขายออกตามสัญญาณแดงแรก (Bearish Cash Out)
  mode: 'PAPER',
  scanMode: 'SINGLE',
  directionMode: 'LONG_ONLY',
  isActive: false,
};

export const DEFAULT_PAPER_ACCOUNT: PaperAccount = {
  usdtBalance: 100000, // Initial THB ฿100,000
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

    let cleanSymbol = parsed.symbol || 'PTT';
    if (
      cleanSymbol.includes('_') ||
      cleanSymbol.includes('/') ||
      ['BTC', 'ETH', 'USDT', 'KUB', 'ADA', 'XRP', 'DOGE', 'SOL', 'BNB'].includes(cleanSymbol.toUpperCase())
    ) {
      cleanSymbol = 'PTT';
    }

    return {
      ...DEFAULT_BOT_CONFIG,
      ...parsed,
      symbol: cleanSymbol,
      mode: parsed.mode === 'SETTRADE_LIVE' ? 'SETTRADE_LIVE' : 'PAPER',
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
    if (!raw) return DEFAULT_PAPER_ACCOUNT;
    const parsed = JSON.parse(raw);
    if (parsed.usdtBalance === 1000 || parsed.usdtBalance === 30000 || !parsed.usdtBalance) {
      parsed.usdtBalance = 100000;
      parsed.initialUsdtBalance = 100000;
    }
    return parsed;
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

export function getStoredBrokerKeys(): SettradeApiKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTRADE_KEYS);
    if (!raw) return { apiKey: '', apiSecret: '' };
    const parsed = JSON.parse(raw);
    return {
      apiKey: decryptText(parsed.apiKey),
      apiSecret: decryptText(parsed.apiSecret),
      appCode: parsed.appCode ? decryptText(parsed.appCode) : '',
      brokerId: parsed.brokerId ? decryptText(parsed.brokerId) : '',
    };
  } catch {
    return { apiKey: '', apiSecret: '' };
  }
}

export function saveBrokerKeys(keys: SettradeApiKeys): void {
  const encryptedKeys = {
    apiKey: encryptText(keys.apiKey),
    apiSecret: encryptText(keys.apiSecret),
    appCode: encryptText(keys.appCode),
    brokerId: encryptText(keys.brokerId),
  };
  localStorage.setItem(STORAGE_KEYS.SETTRADE_KEYS, JSON.stringify(encryptedKeys));
}

export function getStoredTelegramConfig(): { botToken: string; chatId: string; isEnabled: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TELEGRAM_CONFIG);
    if (!raw) return { botToken: '', chatId: '', isEnabled: false };
    const parsed = JSON.parse(raw);
    return {
      botToken: parsed.botToken ? decryptText(parsed.botToken) : '',
      chatId: parsed.chatId || '',
      isEnabled: !!parsed.isEnabled,
    };
  } catch {
    return { botToken: '', chatId: '', isEnabled: false };
  }
}

export function saveTelegramConfig(config: { botToken: string; chatId: string; isEnabled: boolean }): void {
  const encrypted = {
    botToken: encryptText(config.botToken),
    chatId: config.chatId,
    isEnabled: config.isEnabled,
  };
  localStorage.setItem(STORAGE_KEYS.TELEGRAM_CONFIG, JSON.stringify(encrypted));
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
        const cleanList = parsed.filter(
          (s) => !['BTC', 'ETH', 'USDT', 'KUB', 'ADA', 'XRP', 'DOGE', 'SOL', 'BNB'].includes(s.toUpperCase())
        );
        if (cleanList.length > 0) return cleanList;
      }
    }
    return POPULAR_STOCKS;
  } catch {
    return POPULAR_STOCKS;
  }
}

export function saveStoredSymbols(symbols: string[]): void {
  localStorage.setItem(STORAGE_KEYS.CUSTOM_SYMBOLS, JSON.stringify(symbols));
}

export function getStoredWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WATCHLIST);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    // Default watchlist: Top 6 active stocks
    return ['PTT', 'CPALL', 'DELTA', 'KBANK', 'ADVANC', 'AOT'];
  } catch {
    return ['PTT', 'CPALL', 'DELTA', 'KBANK', 'ADVANC', 'AOT'];
  }
}

export function saveStoredWatchlist(watchlist: string[]): void {
  localStorage.setItem(STORAGE_KEYS.WATCHLIST, JSON.stringify(watchlist));
}

export function toggleWatchlistSymbol(symbol: string): string[] {
  const current = getStoredWatchlist();
  const upper = symbol.toUpperCase().trim();
  let updated: string[];
  if (current.includes(upper)) {
    updated = current.filter((s) => s !== upper);
  } else {
    updated = [...current, upper];
  }
  saveStoredWatchlist(updated);
  return updated;
}

export function isSymbolInWatchlist(symbol: string): boolean {
  const list = getStoredWatchlist();
  return list.includes(symbol.toUpperCase().trim());
}
