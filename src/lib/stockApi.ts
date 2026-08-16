import { KlineData, StockTicker24h, OrderBookData, Timeframe, SettradeApiKeys } from '../types';

/**
 * Normalizes Thai stock symbol for Yahoo Finance or SET API format (e.g. PTT -> PTT.BK)
 */
export function toStockSymbol(symbol: string): string {
  const clean = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean || 'PTT';
}

export function toFriendlySymbol(symbol: string): string {
  if (symbol.includes('_')) {
    const parts = symbol.split('_');
    return parts[1] === 'THB' ? parts[0] : parts[1];
  }
  return symbol.replace('.BK', '').toUpperCase();
}

/**
 * Fetches historical Kline / Candlestick data for Thai Stock (SET)
 */
export async function fetchStockKlines(
  symbol = 'PTT',
  interval: Timeframe = '1d',
  limit = 300
): Promise<KlineData[]> {
  const friendlySymbol = toStockSymbol(symbol);

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
  const from = to - limit * timeStepSeconds;

  try {
    const response = await fetch(
      `/api/stock/klines?symbol=${friendlySymbol}&resolution=${resolution}&from=${from}&to=${to}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch Stock Klines: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.s !== 'ok' || !Array.isArray(data.t)) {
      return [];
    }

    return data.t.map((t: number, i: number) => ({
      time: t * 1000, // convert to ms for lightweight-charts
      open: parseFloat(data.o[i]),
      high: parseFloat(data.h[i]),
      low: parseFloat(data.l[i]),
      close: parseFloat(data.c[i]),
      volume: parseFloat(data.v[i]),
    }));
  } catch (error) {
    console.error('Error fetching Stock Klines:', error);
    return [];
  }
}

/**
 * Fetches 24h ticker info for Thai stocks.
 */
export async function fetchStockTicker24h(symbol?: string): Promise<StockTicker24h[]> {
  try {
    const searchSymbol = symbol ? toStockSymbol(symbol) : '';
    const response = await fetch(`/api/stock/ticker`);

    if (!response.ok) throw new Error('Ticker fetch failed');

    const data = await response.json();

    let pairs: [string, any][] = [];
    if (searchSymbol) {
      const key = `THB_${searchSymbol}`;
      if (data[key]) {
        pairs = [[key, data[key]]];
      } else if (data[searchSymbol]) {
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
        highPrice: parseFloat(t.lowestAsk || t.last),
        lowPrice: parseFloat(t.highestBid || t.last),
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
 * Fetches orderbook depth (bids and asks) for a stock.
 */
export async function fetchOrderBook(symbol = 'PTT', limit = 15): Promise<OrderBookData> {
  try {
    const res = await fetch(`/api/stock/depth?symbol=${symbol}&limit=${limit}`);

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
 * Formats stock prices in Thai Baht (฿).
 */
export function formatStockPrice(price: number | undefined | null): string {
  if (price === undefined || price === null || isNaN(price)) return '฿0.00';
  return `฿${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formats stock volume and share quantities.
 */
export function formatStockAmount(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0';
  return Math.round(amount).toLocaleString('en-US');
}

/**
 * Popular SET50 and SET100 Thai Stocks
 */
export const POPULAR_STOCKS = [
  'PTT',
  'CPALL',
  'AOT',
  'DELTA',
  'ADVANC',
  'BDMS',
  'KBANK',
  'SCB',
  'GULF',
  'PTTEP',
  'TRUE',
  'KTB',
  'CPF',
  'HMPRO',
  'SCC',
  'BBL',
  'MTC',
  'TOP',
  'GPSC',
  'INTUCH',
  'OR',
  'BANPU',
  'IVL',
  'MINT',
  'BEM',
  'WHA',
  'CBG',
  'KTC',
  'SAWAD',
  'CPN',
];

export interface StockExchangeRules {
  symbol: string;
  stepSize: number; // Standard lot size = 100 shares
  minQty: number;
  tickSize: number;
  minNotional: number;
}

/**
 * Standard Stock Exchange of Thailand (SET) Tick Size & Lot Rules
 */
export function getSetStockTickSize(price: number): number {
  if (price < 2.0) return 0.01;
  if (price < 5.0) return 0.02;
  if (price < 10.0) return 0.05;
  if (price < 25.0) return 0.10;
  if (price < 100.0) return 0.25;
  if (price < 200.0) return 0.50;
  if (price < 400.0) return 1.00;
  return 2.00;
}

export async function fetchSymbolExchangeInfo(symbol: string): Promise<StockExchangeRules | null> {
  const formatted = toStockSymbol(symbol);
  return {
    symbol: formatted,
    stepSize: 100, // 1 board lot = 100 shares
    minQty: 100,
    tickSize: 0.25,
    minNotional: 10,
  };
}

export function formatStockPriceByTickSize(price: number, tickSize?: number): number {
  const ts = tickSize || getSetStockTickSize(price);
  return parseFloat((Math.round(price / ts) * ts).toFixed(2));
}

/**
 * Sends a signed Live Order to Settrade Open API / Thai Broker
 */
export async function executeLiveStockOrder(params: {
  apiKey: string;
  apiSecret: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number; // shares count
  price?: number; // 0 for market
  orderType?: 'MARKET' | 'LIMIT';
}): Promise<{ success: boolean; order?: any; error?: string }> {
  try {
    const res = await fetch('/api/stock/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return { success: false, error: data.error || 'Live stock order failed' };
    }
    return { success: true, order: data.order };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to connect to backend proxy' };
  }
}

/**
 * Fetches real account THB balance from Settrade / Broker signed endpoint
 */
export async function fetchLiveStockBalances(keys: {
  apiKey: string;
  apiSecret: string;
}): Promise<number | null> {
  if (!keys.apiKey || !keys.apiSecret) return null;
  try {
    const res = await fetch('/api/stock/balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(keys),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || data.error) return null;

    const thb = (data.balances || []).find((b: any) => b.asset === 'THB');
    return thb ? parseFloat(thb.free) : 0;
  } catch (err) {
    console.error('Failed to fetch live THB balance:', err);
    return null;
  }
}
