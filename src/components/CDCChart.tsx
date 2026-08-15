import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  createSeriesMarkers,
  ColorType,
  CrosshairMode,
  LineStyle,
  IChartApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  SeriesMarker,
  Time,
} from 'lightweight-charts';
import { KlineData, Timeframe, CDCZoneColor } from '../types';
import { getStoredSymbols } from '../lib/botStore';
import { getZoneColorHex } from '../lib/cdcIndicator';
import { formatCryptoPrice } from '../lib/bitkubApi';
import { RefreshCw, Search, ChevronDown, Activity, Info, Zap, Layers } from 'lucide-react';

interface CDCChartProps {
  candles: KlineData[];
  symbol: string;
  timeframe: Timeframe;
  botTimeframe?: Timeframe;
  isBotActive?: boolean;
  onSymbolChange: (newSymbol: string) => void;
  onTimeframeChange: (newTimeframe: Timeframe) => void;
  onBotTimeframeChange?: (newBotTimeframe: Timeframe) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
];

export const CDCChart: React.FC<CDCChartProps> = ({
  candles,
  symbol,
  timeframe,
  botTimeframe,
  isBotActive,
  onSymbolChange,
  onTimeframeChange,
  onBotTimeframeChange,
  onRefresh,
  isLoading,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ema12SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema26SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const seriesMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showRibbon, setShowRibbon] = useState(true);
  const [showSignalDots, setShowSignalDots] = useState(true);
  const [showCalloutBanner, setShowCalloutBanner] = useState(false); // 🚀 Clean view like TradingView (no bulky bubble blocking candles)
  const [orderAmount, setOrderAmount] = useState('0.01');

  // Hovered or latest candle state for top OHLC header
  const [hoveredCandle, setHoveredCandle] = useState<KlineData | null>(null);
  const [calloutPosition, setCalloutPosition] = useState<{ x: number; y: number } | null>(null);

  const filteredPairs = useMemo(
    () => getStoredSymbols().filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase())),
    [searchQuery]
  );

  // Latest candle computation
  const latestCandle = useMemo(() => {
    return candles.length > 0 ? candles[candles.length - 1] : null;
  }, [candles]);

  const activeDisplayCandle = hoveredCandle || latestCandle;

  // OHLC Change Calculation
  const ohlcChange = useMemo(() => {
    if (!activeDisplayCandle) return { diff: 0, percent: 0, isPositive: true };
    const diff = activeDisplayCandle.close - activeDisplayCandle.open;
    const percent = activeDisplayCandle.open ? (diff / activeDisplayCandle.open) * 100 : 0;
    return {
      diff,
      percent,
      isPositive: diff >= 0,
    };
  }, [activeDisplayCandle]);

  // Clean deduplicated & sorted candle data for lightweight-charts
  const formattedCandles = useMemo(() => {
    if (!candles || candles.length === 0) return [];

    const map = new Map<number, KlineData>();
    candles.forEach((c) => {
      const timeInSec = Math.floor(c.time / 1000);
      map.set(timeInSec, c);
    });

    const sortedSecs = Array.from(map.keys()).sort((a, b) => a - b);
    return sortedSecs.map((sec) => ({
      sec,
      data: map.get(sec)!,
    }));
  }, [candles]);

  // Draw CDC Action Zone Ribbon (Cloud) between EMA 12 & EMA 26
  const drawRibbonCloud = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const chart = chartRef.current;
    const ema12Series = ema12SeriesRef.current;
    const ema26Series = ema26SeriesRef.current;

    if (!canvas || !chart || !ema12Series || !ema26Series || !showRibbon || formattedCandles.length === 0) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const timeScale = chart.timeScale();
    const visibleRange = timeScale.getVisibleLogicalRange();
    if (!visibleRange) return;

    const points: { x: number; y1: number; y2: number; isBullish: boolean }[] = [];

    formattedCandles.forEach(({ sec, data }) => {
      if (data.emaFast === undefined || data.emaSlow === undefined) return;

      const x = timeScale.timeToCoordinate(sec as Time);
      if (x === null) return;

      const y1 = ema12Series.priceToCoordinate(data.emaFast);
      const y2 = ema26Series.priceToCoordinate(data.emaSlow);

      if (y1 === null || y2 === null) return;

      points.push({
        x,
        y1,
        y2,
        isBullish: data.emaFast >= data.emaSlow,
      });
    });

    if (points.length < 2) return;

    // Draw shaded polygons between consecutive points
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y1);
      ctx.lineTo(p2.x, p2.y1);
      ctx.lineTo(p2.x, p2.y2);
      ctx.lineTo(p1.x, p1.y2);
      ctx.closePath();

      // Green ribbon for Bullish (EMA12 > EMA26), Red ribbon for Bearish (EMA12 < EMA26)
      if (p1.isBullish) {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
      } else {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
      }
      ctx.fill();
    }
  }, [formattedCandles, showRibbon]);

  // Update Callout Banner Position
  const updateCalloutPosition = useCallback(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries || formattedCandles.length === 0 || !showCalloutBanner) {
      setCalloutPosition(null);
      return;
    }

    const last = formattedCandles[formattedCandles.length - 1];
    const timeScale = chart.timeScale();
    const x = timeScale.timeToCoordinate(last.sec as Time);
    const y = candleSeries.priceToCoordinate(last.data.close);

    if (x !== null && y !== null) {
      setCalloutPosition({ x, y });
    } else {
      setCalloutPosition(null);
    }
  }, [formattedCandles, showCalloutBanner]);

  // 1. Initialize Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const initialHeight = isMobile ? 380 : 520;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#9b9b9b',
        fontSize: 11,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false, // 🚀 Allows smooth vertical page scrolling on mobile touch screens
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      grid: {
        vertLines: { color: '#1e222d', style: LineStyle.Solid },
        horzLines: { color: '#1e222d', style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#363c4e',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2b2b43',
        },
        horzLine: {
          color: '#363c4e',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2b2b43',
        },
      },
      rightPriceScale: {
        borderColor: '#2b2b43',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: '#2b2b43',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
      },
      width: container.clientWidth,
      height: initialHeight,
    });

    // Add Candlestick Series using CandlestickSeries
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => formatCryptoPrice(price).replace('$', ''),
        minMove: 0.00000001,
      },
    });

    // Add EMA Fast Series (12)
    const ema12Series = chart.addSeries(LineSeries, {
      color: '#06b6d4',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'EMA 12',
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => formatCryptoPrice(price).replace('$', ''),
        minMove: 0.00000001,
      },
    });

    // Add EMA Slow Series (26)
    const ema26Series = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'EMA 26',
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => formatCryptoPrice(price).replace('$', ''),
        minMove: 0.00000001,
      },
    });

    // Add Series Markers plugin (lightweight-charts v5)
    const seriesMarkers = createSeriesMarkers(candleSeries, []);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    ema12SeriesRef.current = ema12Series;
    ema26SeriesRef.current = ema26Series;
    seriesMarkersRef.current = seriesMarkers;

    // Crosshair move handler
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData.get(candleSeries)) {
        setHoveredCandle(null);
        return;
      }

      const candleSec = param.time as number;
      const found = formattedCandles.find((c) => c.sec === candleSec);
      if (found) {
        setHoveredCandle(found.data);
      }
    });

    // Sync ribbon and callout position on scroll/zoom
    const onRangeChange = () => {
      drawRibbonCloud();
      updateCalloutPosition();
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

    // Resize observer
    const handleResize = () => {
      if (container && chartRef.current) {
        const w = container.clientWidth;
        const h = window.innerWidth < 640 ? 380 : 520;
        chartRef.current.applyOptions({ width: w, height: h });
        if (overlayCanvasRef.current) {
          overlayCanvasRef.current.width = w;
          overlayCanvasRef.current.height = h;
        }
        drawRibbonCloud();
        updateCalloutPosition();
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (seriesMarkersRef.current) {
        try {
          seriesMarkersRef.current.detach();
        } catch {
          // ignore cleanup errors
        }
        seriesMarkersRef.current = null;
      }
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // 2. Update Series Data & Markers when Candles / Settings change
  useEffect(() => {
    if (!candleSeriesRef.current || !ema12SeriesRef.current || !ema26SeriesRef.current || !chartRef.current) return;

    if (formattedCandles.length === 0) return;

    // Dynamic price formatting for micro-cap / meme coins with many decimal digits
    const latestPrice = formattedCandles[formattedCandles.length - 1].data.close;
    let dynamicMinMove = 0.01;
    if (latestPrice < 0.0001) {
      dynamicMinMove = 0.00000001;
    } else if (latestPrice < 0.01) {
      dynamicMinMove = 0.000001;
    } else if (latestPrice < 1) {
      dynamicMinMove = 0.0001;
    }

    const customPriceFormat = {
      type: 'custom' as const,
      formatter: (price: number) => formatCryptoPrice(price).replace('$', ''),
      minMove: dynamicMinMove,
    };

    candleSeriesRef.current.applyOptions({ priceFormat: customPriceFormat });
    ema12SeriesRef.current.applyOptions({ priceFormat: customPriceFormat });
    ema26SeriesRef.current.applyOptions({ priceFormat: customPriceFormat });

    // Prepare Candlesticks with CDC Action Zone dynamic colors
    const candleData = formattedCandles.map(({ sec, data }) => {
      const colorHex = getZoneColorHex(data.zone);
      return {
        time: sec as Time,
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
        color: colorHex,
        borderColor: colorHex,
        wickColor: colorHex,
      };
    });

    candleSeriesRef.current.setData(candleData);

    // Prepare EMA 12 Data
    const ema12Data = formattedCandles
      .filter(({ data }) => data.emaFast !== undefined)
      .map(({ sec, data }) => ({
        time: sec as Time,
        value: data.emaFast!,
      }));
    ema12SeriesRef.current.setData(ema12Data);

    // Prepare EMA 26 Data
    const ema26Data = formattedCandles
      .filter(({ data }) => data.emaSlow !== undefined)
      .map(({ sec, data }) => ({
        time: sec as Time,
        value: data.emaSlow!,
      }));
    ema26SeriesRef.current.setData(ema26Data);

    // Prepare Buy / Sell Markers (Exact TradingView CDC Crossover Points)
    if (showSignalDots) {
      const markers: SeriesMarker<Time>[] = [];

      formattedCandles.forEach(({ sec, data }, idx) => {
        const prevData = idx > 0 ? formattedCandles[idx - 1].data : null;

        const prevFast = prevData?.emaFast;
        const prevSlow = prevData?.emaSlow;
        const currFast = data.emaFast;
        const currSlow = data.emaSlow;

        // 🎯 Crossover points: Fast EMA (12) crosses Slow EMA (26)
        const isBullishCross =
          prevFast !== undefined && prevSlow !== undefined && currFast !== undefined && currSlow !== undefined
            ? prevFast <= prevSlow && currFast > currSlow
            : data.signal === 'BUY';

        const isBearishCross =
          prevFast !== undefined && prevSlow !== undefined && currFast !== undefined && currSlow !== undefined
            ? prevFast >= prevSlow && currFast < currSlow
            : data.signal === 'SELL';

        if (isBullishCross) {
          markers.push({
            time: sec as Time,
            position: 'belowBar',
            color: '#3b82f6',
            shape: 'circle',
            size: 2,
            text: 'BUY',
          });
        } else if (isBearishCross) {
          markers.push({
            time: sec as Time,
            position: 'aboveBar',
            color: '#ef4444',
            shape: 'circle',
            size: 2,
            text: 'SELL',
          });
        }
      });

      if (seriesMarkersRef.current) {
        markers.sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));
        seriesMarkersRef.current.setMarkers(markers);
      }
    } else {
      if (seriesMarkersRef.current) {
        seriesMarkersRef.current.setMarkers([]);
      }
    }

    // Auto fit visible range on fresh load
    chartRef.current.timeScale().fitContent();

    // Redraw Overlay Ribbon & Update Callout
    setTimeout(() => {
      if (overlayCanvasRef.current && chartContainerRef.current) {
        overlayCanvasRef.current.width = chartContainerRef.current.clientWidth;
        overlayCanvasRef.current.height = 520;
      }
      drawRibbonCloud();
      updateCalloutPosition();
    }, 50);
  }, [formattedCandles, showSignalDots, drawRibbonCloud, updateCalloutPosition]);

  // Derived Signal Status for Callout Banner
  const signalBannerInfo = useMemo(() => {
    if (!latestCandle) return null;

    const isBearish =
      latestCandle.zone === 'RED' ||
      latestCandle.zone === 'YELLOW' ||
      latestCandle.zone === 'ORANGE' ||
      latestCandle.signal === 'SELL';

    const actionText = isBearish ? 'SELL next bar' : 'BUY next bar';
    const trendText = isBearish ? 'currently in a bearish trend' : 'currently in a bullish trend';

    return {
      isBearish,
      actionText,
      trendText,
      price: latestCandle.close,
      symbol,
    };
  }, [latestCandle, symbol]);

  return (
    <div className="bg-[#131722] text-slate-200 rounded-xl border border-[#2a2e39] shadow-2xl overflow-hidden font-sans">
      {/* 1. TradingView Style Header Bar */}
      <div className="bg-[#181c27] px-4 py-2.5 border-b border-[#2a2e39] flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left Section: Symbol, OHLC & Quick Buy/Sell Box */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Symbol Dropdown Selector */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2 bg-[#2a2e39] hover:bg-[#363c4e] text-white px-3 py-1.5 rounded font-medium transition border border-slate-700/60"
            >
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[8px]">
                SET50
              </div>
              <span className="font-semibold text-sm">{symbol}</span>
              <span className="text-slate-400 text-[10px]">· {timeframe.toUpperCase()} · SET50</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {isDropdownOpen && (
              <div className="absolute left-0 mt-1 w-64 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-2xl z-50 overflow-hidden">
                <div className="p-2 border-b border-[#2a2e39] flex items-center bg-[#131722]">
                  <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
                  <input
                    type="text"
                    placeholder="ค้นหาหุ้น..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/50">
                  {filteredPairs.map((pair) => (
                    <button
                      key={pair}
                      onClick={() => {
                        onSymbolChange(pair);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-[#2a2e39] flex items-center justify-between transition ${
                        pair === symbol ? 'text-amber-400 bg-amber-500/10 font-bold' : 'text-slate-300'
                      }`}
                    >
                      <span>{pair}</span>
                      <span className="text-[10px] text-slate-500">SET50</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* OHLC Bar Readout */}
          {activeDisplayCandle && (
            <div className="hidden lg:flex items-center space-x-3 text-[11px] font-mono">
              <span className="text-slate-400">
                O: <span className={ohlcChange.isPositive ? 'text-emerald-400' : 'text-rose-400'}>{formatCryptoPrice(activeDisplayCandle.open)}</span>
              </span>
              <span className="text-slate-400">
                H: <span className="text-slate-200">{formatCryptoPrice(activeDisplayCandle.high)}</span>
              </span>
              <span className="text-slate-400">
                L: <span className="text-slate-200">{formatCryptoPrice(activeDisplayCandle.low)}</span>
              </span>
              <span className="text-slate-400">
                C: <span className={ohlcChange.isPositive ? 'text-emerald-400' : 'text-rose-400'}>{formatCryptoPrice(activeDisplayCandle.close)}</span>
              </span>
              <span className={`font-bold ${ohlcChange.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {ohlcChange.isPositive ? '+' : ''}
                {formatCryptoPrice(ohlcChange.diff)} ({ohlcChange.percent.toFixed(2)}%)
              </span>
            </div>
          )}

          {/* Quick Buy/Sell Trading Pill Widget (Matching User Screenshot Top-Left) */}
          {latestCandle && (
            <div className="flex items-center bg-[#131722] border border-[#2a2e39] rounded-lg overflow-hidden shadow-inner p-0.5">
              <button
                onClick={() => alert(`สั่งขาย SELL ${symbol} @ ${formatCryptoPrice(latestCandle.close)}`)}
                className="bg-rose-600/90 hover:bg-rose-600 text-white font-bold px-2.5 py-1 text-[11px] transition flex items-center space-x-1"
              >
                <span>{formatCryptoPrice(latestCandle.close).replace('$', '')}</span>
                <span className="text-[9px] bg-black/30 px-1 rounded uppercase">SELL</span>
              </button>

              <div className="px-2 py-0.5 text-[11px] text-slate-300 font-mono bg-[#181c27] border-x border-[#2a2e39]">
                <input
                  type="text"
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(e.target.value)}
                  className="w-10 text-center bg-transparent focus:outline-none text-white font-semibold"
                />
              </div>

              <button
                onClick={() => alert(`สั่งซื้อ BUY ${symbol} @ ${formatCryptoPrice(latestCandle.close)}`)}
                className="bg-blue-600/90 hover:bg-blue-600 text-white font-bold px-2.5 py-1 text-[11px] transition flex items-center space-x-1"
              >
                <span>{formatCryptoPrice(latestCandle.close).replace('$', '')}</span>
                <span className="text-[9px] bg-black/30 px-1 rounded uppercase">BUY</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Section: Timeframes & Indicator Toggles */}
        <div className="flex items-center space-x-2">
          {/* Bot Strategy Timeframe Status Badge / Selector */}
          {botTimeframe && (
            <div
              className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-900/90 border border-slate-700/80 rounded-md text-[10px]"
              title="ไทม์เฟรมที่บอทใช้รันกลยุทธ์ซื้อขาย (คลิกเปลี่ยนได้ทันที)"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isBotActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span className="text-slate-400 font-medium hidden sm:inline">บอทกลยุทธ์:</span>
              <select
                value={botTimeframe}
                onChange={(e) => onBotTimeframeChange && onBotTimeframeChange(e.target.value as Timeframe)}
                className="bg-transparent text-emerald-400 font-bold font-mono uppercase cursor-pointer focus:outline-none"
              >
                <option value="15m" className="bg-slate-900 text-white">15M</option>
                <option value="1h" className="bg-slate-900 text-white">1H</option>
                <option value="4h" className="bg-slate-900 text-white">4H</option>
                <option value="1d" className="bg-slate-900 text-white">1D (แนะนำ)</option>
                <option value="1w" className="bg-slate-900 text-white">1W</option>
              </select>
            </div>
          )}

          {/* Timeframe Buttons */}
          <div className="flex items-center bg-[#131722] p-0.5 rounded-md border border-[#2a2e39]">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => onTimeframeChange(tf.value)}
                className={`px-2 py-1 text-[11px] font-semibold rounded transition ${
                  timeframe === tf.value
                    ? 'bg-[#2a2e39] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Indicator Toggles */}
          <div className="hidden sm:flex items-center space-x-1 bg-[#131722] p-0.5 rounded-md border border-[#2a2e39]">
            <button
              onClick={() => setShowRibbon(!showRibbon)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition flex items-center space-x-1 ${
                showRibbon ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="เปิด/ปิด CDC Cloud Ribbon"
            >
              <Layers className="w-3 h-3" />
              <span>ริบบอน</span>
            </button>

            <button
              onClick={() => setShowSignalDots(!showSignalDots)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition flex items-center space-x-1 ${
                showSignalDots ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="เปิด/ปิด จุดสัญญาณซื้อขาย"
            >
              <Zap className="w-3 h-3" />
              <span>จุดซื้อ/ขาย</span>
            </button>

            <button
              onClick={() => setShowCalloutBanner(!showCalloutBanner)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition flex items-center space-x-1 ${
                showCalloutBanner ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="เปิด/ปิด ป้ายบอกสัญญาณ Callout Banner"
            >
              <Activity className="w-3 h-3" />
              <span>ป้ายเตือน</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 bg-[#2a2e39] hover:bg-[#363c4e] text-slate-300 rounded transition border border-slate-700/60"
            title="อัปเดตราคากราฟ"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Main Chart Body with Overlay Ribbon & Callout Speech Bubble */}
      <div className="relative w-full h-[380px] sm:h-[520px] bg-[#131722] touch-pan-y">
        {/* Lightweight Charts Canvas Container */}
        <div ref={chartContainerRef} className="w-full h-full touch-pan-y" />

        {/* Overlay Canvas for CDC Action Zone Ribbon Cloud */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 pointer-events-none z-10 touch-pan-y"
          width={800}
          height={520}
        />

        {/* 3. Floating Callout Banner (Matching User's Screenshot Banner EXACTLY) */}
        {showCalloutBanner && signalBannerInfo && (
          <div
            className={`absolute z-30 transition-all duration-300 transform -translate-x-1/2 -translate-y-full ${
              calloutPosition ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
            }`}
            style={{
              left: calloutPosition ? Math.min(Math.max(calloutPosition.x, 150), 680) : '70%',
              top: calloutPosition ? Math.max(calloutPosition.y - 12, 120) : '60%',
            }}
          >
            <div
              className={`px-4 py-2.5 rounded-lg shadow-2xl border text-white font-sans text-center relative ${
                signalBannerInfo.isBearish
                  ? 'bg-rose-600 border-rose-400 shadow-rose-900/50'
                  : 'bg-emerald-600 border-emerald-400 shadow-emerald-900/50'
              }`}
            >
              <div className="text-[12px] font-black uppercase tracking-wider leading-tight">
                {signalBannerInfo.actionText}
              </div>
              <div className="text-[11px] font-extrabold my-0.5 tracking-tight drop-shadow-sm">
                {signalBannerInfo.symbol} {formatCryptoPrice(signalBannerInfo.price)}
              </div>
              <div className="text-[10px] font-medium opacity-90 leading-tight">
                {signalBannerInfo.trendText}
              </div>

              {/* Speech bubble pointer arrow tip */}
              <div
                className={`absolute left-1/2 -bottom-2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 ${
                  signalBannerInfo.isBearish ? 'border-t-rose-600' : 'border-t-emerald-600'
                }`}
              />
            </div>
          </div>
        )}

        {/* Loading Spinner Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-[#131722]/70 backdrop-blur-xs flex items-center justify-center z-40">
            <div className="flex items-center space-x-2 bg-[#1e222d] border border-[#2a2e39] px-4 py-2 rounded-lg text-amber-400 text-xs font-semibold shadow-xl">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>กำลังดึงข้อมูลกราฟ Bitkub...</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Footer Legend Bar */}
      <div className="bg-[#181c27] px-4 py-2.5 border-t border-[#2a2e39] flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-3">
        <div className="flex items-center space-x-2">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-medium text-slate-300">CDC Action Zone V2 Strategy Legend:</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block animate-ping" />
            <span className="text-blue-300 font-bold">● จุดฟ้า/เขียว: สัญญาณซื้อ (BUY)</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block animate-ping" />
            <span className="text-rose-300 font-bold">● จุดแดง: สัญญาณขาย (SELL)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>โซนเขียว (ถือครอง Long)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
            <span>โซนเหลือง (เตือนขาย)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span>โซนแดง (ถือเงินสด / Short)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
