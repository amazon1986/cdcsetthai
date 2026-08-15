export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export type CDCZoneColor = 'GREEN' | 'BLUE' | 'YELLOW' | 'RED' | 'ORANGE' | 'CYAN';

export type CDCSignalType = 'BUY' | 'SELL' | 'HOLD_BULL' | 'HOLD_BEAR' | 'WARNING' | 'NEUTRAL';

export interface KlineData {
  time: number; // Timestamp in ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // Indicator calculations
  emaFast?: number;
  emaSlow?: number;
  zone?: CDCZoneColor;
  signal?: CDCSignalType;
  colorNameTh?: string;
  actionRecommendation?: string;
}

export interface BitkubTicker24h {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
}

export interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

export interface BotConfig {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  fastEmaPeriod: number;
  slowEmaPeriod: number;
  tradeAmountUsdt: number;
  usePercentBalance: boolean;
  balancePercent: number;
  positionSizingMode?: 'EQUAL_WEIGHT' | 'PERCENT_EQUITY' | 'FIXED_USDT';
  leverage?: number; // Leverage 1x to 10x
  maxOpenPositions?: number;
  stopLossPercent: number; // 0 = disabled
  takeProfitPercent: number; // 0 = disabled
  useTrailingStop: boolean;
  trailingStopPercent: number;
  buyOnSignal: ('BLUE' | 'GREEN')[];
  sellOnSignal: ('YELLOW' | 'RED')[];
  mode: 'PAPER' | 'BITKUB_LIVE';
  marketType?: 'SPOT' | 'FUTURES';
  scanMode?: 'SINGLE' | 'MULTI_SCAN';
  directionMode?: 'LONG_ONLY' | 'SHORT_ONLY' | 'BOTH';
  isActive: boolean;
  lastSignal?: CDCSignalType;
  lastExecutionTime?: number;
}

export interface PaperPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  amount: number; // Number of coins
  usdtInvested: number; // Initial Margin
  marginUsdt?: number; // Margin reserved
  leverage?: number; // Leverage 1x-10x used
  liquidationPrice?: number; // Estimated liquidation price
  entryTime: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  currentPnlUsdt: number;
  currentPnlPercent: number;
}

export interface PaperAccount {
  usdtBalance: number;
  initialUsdtBalance: number;
  activePositions: PaperPosition[];
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfitUsdt: number;
}

export interface ExecutedTrade {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT';
  price: number;
  amount: number;
  usdtValue: number;
  leverage?: number;
  pnlUsdt?: number;
  pnlPercent?: number;
  reason: string;
  timestamp: number;
  mode: 'PAPER' | 'BITKUB_LIVE';
}

export interface BacktestTrade {
  id: number;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  side: 'BUY' | 'SELL';
  pnlUsdt: number;
  pnlPercent: number;
  entryReason: string;
  exitReason: string;
  holdingCandles: number;
}

export interface BacktestResult {
  symbol: string;
  timeframe: Timeframe;
  initialCapital: number;
  finalCapital: number;
  totalReturnPercent: number;
  buyAndHoldReturnPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePercent: number;
  maxDrawdownPercent: number;
  profitFactor: number;
  trades: BacktestTrade[];
  equityCurve: { time: number; equity: number; price: number }[];
}

export interface ScannerCoinResult {
  symbol: string;
  currentPrice: number;
  priceChange24h: number;
  volume24h: number;
  timeframe: Timeframe;
  zone: CDCZoneColor;
  signal: CDCSignalType;
  emaFast: number;
  emaSlow: number;
  trendStrength: number; // % difference between Fast and Slow EMA
  lastSignalTime: string;
}

export interface BitkubApiKeys {
  apiKey: string;
  apiSecret: string;
}

export interface AiAnalysisResponse {
  summary: string;
  marketTrend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  keyLevels: {
    support: number[];
    resistance: number[];
  };
  botRecommendation: string;
  riskAssessment: string;
}
