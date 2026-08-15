import { KlineData, BitkubTicker24h, OrderBookData, Timeframe } from '../types';

const BITKUB_PUBLIC_BASE = 'https://api.bitkub.com';

/**
 * Helper to convert BASE_QUOTE symbol (e.g. BTC_THB) to Bitkub QUOTE_BASE (e.g. THB_BTC)
 */
export function toBitkubSymbol(symbol: string): string {
  const clean = symbol.toUpperCase().replace('/', '_');
  if (clean.includes('_')) {
    const [base, quote] = clean.split('_');
    return `${quote}_${base}`;
  }
  // Fallback
  return `THB_${clean}`;
}

/**
 * Helper to convert Bitkub QUOTE_BASE symbol (e.g. THB_BTC) to friendly BASE_QUOTE (e.g. BTC_THB)
 */
export function toFriendlySymbol(bitkubSymbol: string): string {
  if (bitkubSymbol.includes('_')) {
    const [quote, base] = bitkubSymbol.split('_');
    return `${base}_${quote}`;
  }
  return bitkubSymbol;
}

/**
 * Fetches historical Kline / Candlestick data from Bitkub TradingView history.
 */
export async function fetchBitkubKlines(
  symbol = 'BTC_THB',
  interval: Timeframe = '1d',
  limit = 300
): Promise<KlineData[]> {
  const friendlySymbol = symbol.toUpperCase().replace('/', '_');
  
  // Map interval to TradingView resolution
  let resolution = '1D';
  let timeStepSeconds = 86400;

  switch (interval) {
    case '1m':
      resolution = '1';
      timeStepSeconds = 60;
      break;
    case '5m':
      resolution = '5';
      timeStepSeconds = 300;
      break;
    case '15m':
      resolution = '15';
      timeStepSeconds = 900;
      break;
    case '1h':
      resolution = '60';
      timeStepSeconds = 3600;
      break;
    case '4h':
      resolution = '240';
      timeStepSeconds = 14400;
      break;
    case '1d':
      resolution = '1D';
      timeStepSeconds = 86400;
      break;
    case '1w':
      resolution = '1W';
      timeStepSeconds = 604800;
      break;
    default:
      resolution = '1D';
      timeStepSeconds = 86400;
  }

  const to = Math.floor(Date.now() / 1000);
  const from = to - (limit * timeStepSeconds);

  try {
    const response = await fetch(`/api/bitkub/klines?symbol=${friendlySymbol}&resolution=${resolution}&from=${from}&to=${to}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Bitkub Klines: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.s !== 'ok' || !Array.isArray(data.t)) {
      return [];
    }

    return data.t.map((t: number, i: number) => ({
      time: t * 1000, // convert to ms for client consumption
      open: parseFloat(data.o[i]),
      high: parseFloat(data.h[i]),
      low: parseFloat(data.l[i]),
      close: parseFloat(data.c[i]),
      volume: parseFloat(data.v[i]),
    }));
  } catch (error) {
    console.error('Error fetching Bitkub Klines:', error);
    return [];
  }
}

/**
 * Fetches 24h ticker info for a symbol or top symbols.
 */
export async function fetchBitkubTicker24h(symbol?: string): Promise<BitkubTicker24h[]> {
  try {
    const searchSymbol = symbol ? toBitkubSymbol(symbol) : '';
    const response = await fetch(`/api/bitkub/ticker`);

    if (!response.ok) throw new Error('Ticker fetch failed');

    const data = await response.json();
    
    let pairs: [string, any][] = [];
    if (searchSymbol) {
      if (data[searchSymbol]) {
        pairs = [[searchSymbol, data[searchSymbol]]];
      }
    } else {
      pairs = Object.entries(data);
    }

    return pairs.map(([key, t]: [string, any]) => {
      const friendlySym = toFriendlySymbol(key);
      return {
        symbol: friendlySym,
        lastPrice: parseFloat(t.last),
        priceChangePercent: parseFloat(t.percentChange),
        highPrice: parseFloat(t.lowestAsk || t.last), // Bitkub doesn't give 24h high directly, mock with lowestAsk
        lowPrice: parseFloat(t.highestBid || t.last),  // Mock with highestBid
        volume: parseFloat(t.baseVolume),
        quoteVolume: parseFloat(t.quoteVolume),
      };
    });
  } catch (err) {
    console.error('Error fetching 24h ticker:', err);
    return [];
  }
}

/**
 * Fetches orderbook depth (bids and asks) for a symbol.
 */
export async function fetchOrderBook(symbol = 'BTC_THB', limit = 15): Promise<OrderBookData> {
  try {
    const res = await fetch(`/api/bitkub/depth?symbol=${symbol}&limit=${limit}`);

    if (!res.ok) throw new Error('Orderbook fetch failed');

    const data = await res.json();
    let bidTotal = 0;
    const bids = (data.bids || []).map((b: [any, any]) => {
      const price = parseFloat(b[0]);
      const quantity = parseFloat(b[1]);
      bidTotal += quantity;
      return { price, quantity, total: bidTotal };
    });

    let askTotal = 0;
    const asks = (data.asks || []).map((a: [any, any]) => {
      const price = parseFloat(a[0]);
      const quantity = parseFloat(a[1]);
      askTotal += quantity;
      return { price, quantity, total: askTotal };
    });

    return { bids, asks };
  } catch (err) {
    console.error('Error fetching orderbook:', err);
    return { bids: [], asks: [] };
  }
}

/**
 * Formats crypto prices dynamically based on magnitude.
 * Displays with Thai Baht currency symbol (฿).
 */
export function formatCryptoPrice(price: number | undefined | null): string {
  if (price === undefined || price === null || isNaN(price)) return '฿0.00';
  if (price === 0) return '฿0.00';

  const absPrice = Math.abs(price);
  if (absPrice >= 1000) {
    return `฿${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (absPrice >= 1) {
    return `฿${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  } else if (absPrice >= 0.01) {
    return `฿${price.toFixed(4)}`;
  } else if (absPrice >= 0.0001) {
    return `฿${price.toFixed(6)}`;
  } else {
    return `฿${price.toFixed(8)}`;
  }
}

/**
 * Formats crypto quantities/amounts dynamically based on magnitude.
 */
export function formatCryptoAmount(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0';
  if (amount === 0) return '0';

  const absAmount = Math.abs(amount);
  if (absAmount >= 1000) {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  } else if (absAmount >= 1) {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 4 });
  } else if (absAmount >= 0.0001) {
    return amount.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  } else {
    return amount.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  }
}

/**
 * Popular crypto trading pairs on Bitkub
 */
export const POPULAR_PAIRS = [
  'BTC_THB',
  'ETH_THB',
  'KUB_THB',
  'USDT_THB',
  'SOL_THB',
  'XRP_THB',
  'ADA_THB',
  'DOGE_THB',
  'DOT_THB',
  'NEAR_THB',
  'OP_THB',
  'ARB_THB',
  'LINK_THB',
  'GALA_THB',
  'IOST_THB',
];

export interface SymbolExchangeRules {
  symbol: string;
  stepSize: number;
  minQty: number;
  tickSize: number;
  minNotional: number;
  baseAssetPrecision: number;
  quotePrecision: number;
}

/**
 * Helper to return static rules for Bitkub Spot trading.
 */
export async function fetchSymbolExchangeInfo(symbol: string): Promise<SymbolExchangeRules | null> {
  const formatted = symbol.toUpperCase().replace('/', '_');
  return {
    symbol: formatted,
    stepSize: 0.00000001,
    minQty: 0.0001,
    tickSize: formatted.startsWith('BTC') || formatted.startsWith('ETH') ? 1.0 : 0.01,
    minNotional: 10, // Bitkub minimum order size is 10 THB
    baseAssetPrecision: 8,
    quotePrecision: 2,
  };
}

/**
 * Formats quantity for Bitkub (up to 8 decimals, no trailing zeros).
 */
export function formatQuantityByStepSize(qty: number, stepSize?: number): number {
  return parseFloat(qty.toFixed(8));
}

/**
 * Formats price for Bitkub (up to 2 or 4 decimals, no trailing zeros).
 */
export function formatPriceByTickSize(price: number, tickSize?: number): number {
  const decimals = price < 1 ? 4 : 2;
  return parseFloat(price.toFixed(decimals));
}

/**
 * Sends a signed Live Order to Bitkub via backend proxy
 */
export async function executeLiveBitkubOrder(params: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number; // THB for BUY (Market), crypto for SELL or Limit
  price?: number; // 0 for market
  orderType?: 'MARKET' | 'LIMIT';
}): Promise<{ success: boolean; order?: any; error?: string }> {
  try {
    const res = await fetch('/api/bitkub/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return { success: false, error: data.error || 'Live order failed' };
    }
    return { success: true, order: data.order };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to connect to backend proxy' };
  }
}

/**
 * Fetches real account THB balance from Bitkub signed endpoint
 */
export async function fetchLiveBitkubBalances(keys: {
  apiKey: string;
  apiSecret: string;
}): Promise<number | null> {
  if (!keys.apiKey || !keys.apiSecret) return null;
  try {
    const res = await fetch('/api/bitkub/balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(keys),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || data.error) return null;

    // Bitkub returns available in data.balances under asset key
    const thb = (data.balances || []).find((b: any) => b.asset === 'THB');
    return thb ? parseFloat(thb.free) : 0;
  } catch (err) {
    console.error('Failed to fetch live THB balance:', err);
    return null;
  }
}
