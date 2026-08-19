import React, { useState, useEffect, useMemo } from 'react';
import { Timeframe, ScannerStockResult, CDCZoneColor } from '../types';
import {
  fetchStockKlines,
  fetchStockTicker24h,
  POPULAR_STOCKS,
  ALL_MARKET_STOCKS,
  formatStockPrice,
} from '../lib/stockApi';
import {
  calculateCDCActionZone,
  getZoneColorHex,
  getZoneNameTh,
  calculateCdcQualityScore,
  getBarsSinceZoneChange,
  getCrossoverInfo,
} from '../lib/cdcIndicator';
import {
  getStoredSymbols,
  saveStoredSymbols,
  getStoredWatchlist,
  toggleWatchlistSymbol,
} from '../lib/botStore';
import {
  Search,
  RefreshCw,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Plus,
  Trash2,
  SlidersHorizontal,
  RotateCcw,
  TrendingUp,
  AlertCircle,
  Check,
  X,
  Star,
  Globe,
  Bookmark,
  Award,
  Sparkles,
  Flame,
  BarChart3,
  List,
  LayoutGrid,
  Info,
  Activity,
} from 'lucide-react';

interface MarketScannerProps {
  onSelectCoin?: (symbol: string) => void;
  onSelectStock?: (symbol: string) => void;
}

type MarketScanMode = 'ALL_MARKET' | 'WATCHLIST' | 'CUSTOM';

type SignalFilterType =
  | 'ALL'
  | 'PRIME_ENTRY'
  | 'BUY_FRESH'
  | 'BULL_STRONG'
  | 'WARN_TAKE_PROFIT'
  | 'BEAR_CASH'
  | 'QUALITY_HIGH'
  | 'FRESH_SIGNAL'
  | 'HIGH_VOLUME'
  | 'TOP_GAINERS';

type SortOption = 'SCORE_DESC' | 'CHANGE_DESC' | 'CHANGE_ASC' | 'VOLUME_DESC' | 'RECENCY_ASC' | 'SYMBOL_ASC';

export const MarketScanner: React.FC<MarketScannerProps> = ({ onSelectCoin, onSelectStock }) => {
  const handleSelect = onSelectStock || onSelectCoin || (() => {});

  // Market & Watchlist State
  const [scanMode, setScanMode] = useState<MarketScanMode>('ALL_MARKET');
  const [customList, setCustomList] = useState<string[]>(() => getStoredSymbols());
  const [watchlist, setWatchlist] = useState<string[]>(() => getStoredWatchlist());

  // Input & Modal States
  const [newSymbolInput, setNewSymbolInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [selectedStockForBreakdown, setSelectedStockForBreakdown] = useState<ScannerStockResult | null>(null);

  // Scanner Filters & Preferences
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [signalFilter, setSignalFilter] = useState<SignalFilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('SCORE_DESC');
  const [viewLayout, setViewLayout] = useState<'GRID' | 'TABLE'>('GRID');

  // Scanner Progress & Data State
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScannerStockResult[]>([]);
  const [scanProgress, setScanProgress] = useState(0);

  // Determine active symbol list based on mode
  const activeSymbolList = useMemo(() => {
    if (scanMode === 'ALL_MARKET') return ALL_MARKET_STOCKS;
    if (scanMode === 'WATCHLIST') return watchlist.length > 0 ? watchlist : ['PTT', 'CPALL', 'DELTA'];
    return customList;
  }, [scanMode, watchlist, customList]);

  // Core Scanner Engine
  const runScanner = async (symbolsToScan = activeSymbolList) => {
    if (symbolsToScan.length === 0) {
      setScanResults([]);
      return;
    }

    setIsScanning(true);
    setScanProgress(0);
    const results: ScannerStockResult[] = [];

    try {
      const tickers = await fetchStockTicker24h();
      const tickerMap = new Map<string, any>();
      tickers.forEach((t) => tickerMap.set(t.symbol, t));

      let completed = 0;
      // Parallel batching for faster scan (chunks of 4)
      const chunkSize = 4;
      for (let i = 0; i < symbolsToScan.length; i += chunkSize) {
        const chunk = symbolsToScan.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (sym) => {
            try {
              const rawCandles = await fetchStockKlines(sym, timeframe, 120);
              const cdcCandles = calculateCDCActionZone(rawCandles, 12, 26);

              if (cdcCandles.length > 0) {
                const latest = cdcCandles[cdcCandles.length - 1];
                const prev = cdcCandles.length > 1 ? cdcCandles[cdcCandles.length - 2] : latest;
                const ticker = tickerMap.get(sym);

                const currentPrice = latest.close;
                const priceChange24h = ticker
                  ? ticker.priceChangePercent
                  : prev.close > 0
                  ? ((currentPrice - prev.close) / prev.close) * 100
                  : 0;
                const volume24h = ticker
                  ? ticker.quoteVolume
                  : latest.volume * latest.close;

                const trendStrength =
                  latest.emaFast && latest.emaSlow && latest.emaSlow > 0
                    ? ((latest.emaFast - latest.emaSlow) / latest.emaSlow) * 100
                    : 0;

                const barsSinceZoneChange = getBarsSinceZoneChange(cdcCandles);
                const crossoverInfo = getCrossoverInfo(cdcCandles);
                const barsSinceGoldenCross = crossoverInfo.barsSinceGoldenCross;
                const isFreshGoldenCross = crossoverInfo.isFreshGoldenCross;
                const isFresh = barsSinceZoneChange <= 1 || isFreshGoldenCross;

                const qualityBreakdown = calculateCdcQualityScore({
                  zone: latest.zone || 'CYAN',
                  barsSinceZoneChange,
                  barsSinceGoldenCross,
                  isFreshGoldenCross,
                  trendStrength,
                  volume24h,
                  priceChange24h,
                });

                results.push({
                  symbol: sym,
                  currentPrice,
                  priceChange24h,
                  volume24h,
                  timeframe,
                  zone: latest.zone || 'CYAN',
                  signal: latest.signal || 'NEUTRAL',
                  emaFast: latest.emaFast || 0,
                  emaSlow: latest.emaSlow || 0,
                  trendStrength,
                  lastSignalTime: new Date(latest.time).toLocaleDateString('th-TH'),
                  barsSinceSignal: barsSinceZoneChange,
                  barsSinceGoldenCross,
                  isFresh,
                  isFreshGoldenCross,
                  isWatchlist: watchlist.includes(sym),
                  entryTimingCategory: qualityBreakdown.entryTimingCategory,
                  entryTimingLabel: qualityBreakdown.entryTimingLabel,
                  qualityScore: qualityBreakdown.totalScore,
                  qualityGrade: qualityBreakdown.grade,
                  qualityBreakdown,
                });
              }
            } catch (e) {
              console.warn(`Failed to scan ${sym}:`, e);
            } finally {
              completed++;
              setScanProgress(Math.round((completed / symbolsToScan.length) * 100));
            }
          })
        );
      }

      setScanResults(results);
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  // Re-run scan when activeSymbolList or timeframe changes
  useEffect(() => {
    runScanner(activeSymbolList);
  }, [scanMode, timeframe]);

  // Watchlist Toggle
  const handleToggleWatchlist = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    const updated = toggleWatchlistSymbol(symbol);
    setWatchlist(updated);
    setScanResults((prev) =>
      prev.map((r) => (r.symbol === symbol ? { ...r, isWatchlist: updated.includes(symbol) } : r))
    );
  };

  // Handle Add New Custom Stock Symbol
  const handleAddCustomSymbol = (symToAdd?: string) => {
    const raw = (symToAdd || newSymbolInput).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    setInputError(null);
    setSuccessMsg(null);

    if (!raw) {
      setInputError('กรุณากรอกชื่อย่อหุ้น');
      return;
    }

    if (customList.includes(raw)) {
      setInputError(`หุ้น ${raw} มีอยู่ในรายการแล้ว`);
      return;
    }

    const updated = [...customList, raw];
    setCustomList(updated);
    saveStoredSymbols(updated);
    setNewSymbolInput('');
    setSuccessMsg(`เพิ่มหุ้น ${raw} สำเร็จ`);

    setTimeout(() => setSuccessMsg(null), 3000);

    if (scanMode === 'CUSTOM') {
      runScanner(updated);
    }
  };

  // Handle Delete Custom Symbol
  const handleDeleteCustomSymbol = (symbolToDelete: string) => {
    if (customList.length <= 1) {
      alert('ต้องมีหุ้นในรายการกำหนดเองอย่างน้อย 1 ตัว');
      return;
    }
    const updated = customList.filter((s) => s !== symbolToDelete);
    setCustomList(updated);
    saveStoredSymbols(updated);
    if (scanMode === 'CUSTOM') {
      setScanResults((prev) => prev.filter((r) => r.symbol !== symbolToDelete));
    }
  };

  // Handle Reset Custom to Default Popular Stocks
  const handleResetCustomToDefault = () => {
    if (confirm('คุณต้องการรีเซ็ตรายการหุ้นกำหนดเองกลับเป็น SET50 เริ่มต้นใช่หรือไม่?')) {
      setCustomList(POPULAR_STOCKS);
      saveStoredSymbols(POPULAR_STOCKS);
      if (scanMode === 'CUSTOM') {
        runScanner(POPULAR_STOCKS);
      }
    }
  };

  // Filter and Sort Results
  const filteredAndSortedStocks = useMemo(() => {
    return scanResults
      .filter((stock) => {
        // Search query filter
        const matchesSearch = stock.symbol.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;

        // Signal Filter Badges
        switch (signalFilter) {
          case 'PRIME_ENTRY':
            return stock.barsSinceGoldenCross <= 1 && (stock.zone === 'BLUE' || stock.zone === 'GREEN');
          case 'BUY_FRESH':
            return stock.zone === 'BLUE';
          case 'BULL_STRONG':
            return stock.zone === 'GREEN';
          case 'WARN_TAKE_PROFIT':
            return stock.zone === 'YELLOW';
          case 'BEAR_CASH':
            return stock.zone === 'RED';
          case 'QUALITY_HIGH':
            return stock.qualityScore >= 75; // Grade S and A
          case 'FRESH_SIGNAL':
            return stock.barsSinceSignal <= 2;
          case 'HIGH_VOLUME':
            return stock.volume24h >= 20_000_000;
          case 'TOP_GAINERS':
            return stock.priceChange24h > 0;
          case 'ALL':
          default:
            return true;
        }
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'SCORE_DESC':
            return b.qualityScore - a.qualityScore;
          case 'CHANGE_DESC':
            return b.priceChange24h - a.priceChange24h;
          case 'CHANGE_ASC':
            return a.priceChange24h - b.priceChange24h;
          case 'VOLUME_DESC':
            return b.volume24h - a.volume24h;
          case 'RECENCY_ASC':
            return a.barsSinceSignal - b.barsSinceSignal;
          case 'SYMBOL_ASC':
          default:
            return a.symbol.localeCompare(b.symbol);
        }
      });
  }, [scanResults, searchQuery, signalFilter, sortBy]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const total = scanResults.length;
    const buySignals = scanResults.filter((r) => r.zone === 'BLUE' || r.zone === 'GREEN').length;
    const freshBuys = scanResults.filter((r) => r.zone === 'BLUE').length;
    const primeEntries = scanResults.filter(
      (r) => r.barsSinceGoldenCross <= 1 && (r.zone === 'BLUE' || r.zone === 'GREEN')
    ).length;
    const topQuality = scanResults.filter((r) => r.qualityScore >= 75).length;
    const avgScore =
      total > 0 ? Math.round(scanResults.reduce((acc, r) => acc + r.qualityScore, 0) / total) : 0;

    return { total, buySignals, freshBuys, primeEntries, topQuality, avgScore };
  }, [scanResults]);

  // Color helper for Quality Score Badges
  const getQualityScoreTheme = (score: number, _grade: string) => {
    if (score >= 85) {
      return {
        bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
        bar: 'from-emerald-500 to-teal-400',
        badge: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black',
      };
    }
    if (score >= 70) {
      return {
        bg: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400',
        bar: 'from-cyan-500 to-blue-400',
        badge: 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-black',
      };
    }
    if (score >= 55) {
      return {
        bg: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
        bar: 'from-amber-500 to-yellow-400',
        badge: 'bg-amber-500 text-slate-950 font-bold',
      };
    }
    if (score >= 40) {
      return {
        bg: 'bg-orange-500/15 border-orange-500/40 text-orange-400',
        bar: 'from-orange-500 to-rose-400',
        badge: 'bg-orange-500 text-slate-950 font-bold',
      };
    }
    return {
      bg: 'bg-rose-500/15 border-rose-500/40 text-rose-400',
      bar: 'from-rose-600 to-red-500',
      badge: 'bg-rose-600 text-white font-bold',
    };
  };

  return (
    <div className="space-y-6">
      {/* ================= TOP HEADER & CONTROLS ================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Main Title & Scanner Status */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 p-3 rounded-2xl shadow-lg shadow-emerald-900/30">
              <Sparkles className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black text-white tracking-wide">
                  CDC Action Zone V2 Market Scanner
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  CDC Quality Score Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                สแกนสัญญาณเทรดตามสูตรลุงโฉลก พร้อมคำนวณคะแนนคุณภาพสัญญาณ 5 ปัจจัย (0–100 คะแนน)
              </p>
            </div>
          </div>

          {/* Action Bar (Timeframe, Manage, Scan) */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Timeframe Selector */}
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 shadow-inner">
              {(['15m', '1h', '4h', '1d', '1w'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                    timeframe === tf
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Custom List Manager Button */}
            <button
              onClick={() => setIsManageOpen(!isManageOpen)}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold border transition shadow-sm ${
                isManageOpen
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>จัดการรายชื่อ ({customList.length})</span>
            </button>

            {/* Refresh / Start Scan Button */}
            <button
              onClick={() => runScanner(activeSymbolList)}
              disabled={isScanning}
              className="flex items-center space-x-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-slate-950 font-black rounded-2xl text-xs shadow-lg shadow-emerald-950/40 transition active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'กำลังสแกน...' : 'สแกนข้อมูลใหม่'}</span>
            </button>
          </div>
        </div>

        {/* ================= 1. SCAN SCOPE SELECTOR (ALL MARKET / WATCHLIST / CUSTOM) ================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Mode 1: All Market */}
          <button
            onClick={() => setScanMode('ALL_MARKET')}
            className={`p-3.5 rounded-2xl border transition text-left flex items-center justify-between cursor-pointer ${
              scanMode === 'ALL_MARKET'
                ? 'bg-gradient-to-r from-emerald-950/60 to-slate-900 border-emerald-500/60 shadow-lg shadow-emerald-950/30'
                : 'bg-slate-950/60 hover:bg-slate-800/40 border-slate-800/80 text-slate-400'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`p-2.5 rounded-xl ${
                  scanMode === 'ALL_MARKET' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-white">🌐 ทั้งตลาด (All Market)</span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                    {ALL_MARKET_STOCKS.length} หุ้น
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">ครอบคลุมหุ้นกลุ่ม SET100 และสภาพคล่องสูง</p>
              </div>
            </div>
            {scanMode === 'ALL_MARKET' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
          </button>

          {/* Mode 2: Watchlist */}
          <button
            onClick={() => setScanMode('WATCHLIST')}
            className={`p-3.5 rounded-2xl border transition text-left flex items-center justify-between cursor-pointer ${
              scanMode === 'WATCHLIST'
                ? 'bg-gradient-to-r from-amber-950/60 to-slate-900 border-amber-500/60 shadow-lg shadow-amber-950/30'
                : 'bg-slate-950/60 hover:bg-slate-800/40 border-slate-800/80 text-slate-400'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`p-2.5 rounded-xl ${
                  scanMode === 'WATCHLIST' ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Bookmark className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-white">⭐ รายการติดตาม (Watchlist)</span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                    {watchlist.length} หุ้น
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">เฉพาะหุ้นที่คุณกดติดดาวไว้เพื่อเฝ้าระวัง</p>
              </div>
            </div>
            {scanMode === 'WATCHLIST' && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
          </button>

          {/* Mode 3: Custom List */}
          <button
            onClick={() => setScanMode('CUSTOM')}
            className={`p-3.5 rounded-2xl border transition text-left flex items-center justify-between cursor-pointer ${
              scanMode === 'CUSTOM'
                ? 'bg-gradient-to-r from-cyan-950/60 to-slate-900 border-cyan-500/60 shadow-lg shadow-cyan-950/30'
                : 'bg-slate-950/60 hover:bg-slate-800/40 border-slate-800/80 text-slate-400'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`p-2.5 rounded-xl ${
                  scanMode === 'CUSTOM' ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-white">📝 กำหนดเอง (Custom List)</span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                    {customList.length} หุ้น
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">รายชื่อหุ้นไทยที่คุณเพิ่ม/ลดเองตามต้องการ</p>
              </div>
            </div>
            {scanMode === 'CUSTOM' && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
          </button>
        </div>

        {/* ================= SUMMARY METRICS BANNER ================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              สแกนทั้งหมด
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-black text-white font-mono">{summaryMetrics.total}</span>
              <span className="text-[11px] text-slate-500">หุ้น</span>
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider flex items-center">
              <Sparkles className="w-3 h-3 mr-1 text-emerald-300" /> จุดเข้าที่ดีที่สุด (0-1 แท่ง)
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-black text-emerald-400 font-mono">
                {summaryMetrics.primeEntries}
              </span>
              <span className="text-[11px] text-emerald-500/70">
                (ซื้อทั้งหมด {summaryMetrics.buySignals})
              </span>
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider flex items-center">
              <Award className="w-3 h-3 mr-1" /> คุณภาพสูง (Score ≥70)
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-black text-cyan-400 font-mono">
                {summaryMetrics.topQuality}
              </span>
              <span className="text-[11px] text-cyan-500/70">ตัว (Grade S/A)</span>
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider flex items-center">
              <Activity className="w-3 h-3 mr-1" /> คะแนนเฉลี่ยตลาด
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-black text-amber-400 font-mono">
                {summaryMetrics.avgScore}
              </span>
              <span className="text-[11px] text-amber-500/70">/ 100 คะแนน</span>
            </div>
          </div>
        </div>

        {/* ================= SCAN PROGRESS BAR ================= */}
        {isScanning && (
          <div className="space-y-1.5 bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/30">
            <div className="flex justify-between text-xs text-slate-300 font-medium">
              <span className="flex items-center space-x-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>กำลังดึงแท่งเทียน & คำนวณคะแนน CDC Quality Score (เน้นเขียวซื้อ แดงขาย)...</span>
              </span>
              <span className="font-mono text-emerald-400 font-bold">{scanProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-300 shadow-sm"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* ================= 2. SIGNAL FILTER BADGES (BAR) ================= */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-bold flex items-center space-x-1.5">
              <Filter className="w-3.5 h-3.5 text-emerald-400" />
              <span>แถบป้ายกรองสัญญาณ (Signal Filter Badges):</span>
            </span>
            <span className="text-[11px] text-slate-500">
              พบ {filteredAndSortedStocks.length} จาก {scanResults.length} หุ้น
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Badge: Prime Entry Only */}
            <button
              onClick={() => setSignalFilter('PRIME_ENTRY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                signalFilter === 'PRIME_ENTRY'
                  ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 shadow-lg shadow-emerald-950/40 font-black'
                  : 'bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-500/50 shadow-sm'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>🌟 จุดเข้าที่ดีที่สุด (เขียวแรก 0–1 แท่ง)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-900/90 text-emerald-200 font-mono font-bold">
                {scanResults.filter((r) => r.barsSinceGoldenCross <= 1 && (r.zone === 'BLUE' || r.zone === 'GREEN')).length}
              </span>
            </button>

            {/* Badge: All */}
            <button
              onClick={() => setSignalFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                signalFilter === 'ALL'
                  ? 'bg-slate-200 text-slate-950 shadow-md font-black'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
              }`}
            >
              <span>🌐 ทั้งหมด</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800/40 font-mono">
                {scanResults.length}
              </span>
            </button>

            {/* Badge: Blue Buy Signal */}
            <button
              onClick={() => setSignalFilter('BUY_FRESH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                signalFilter === 'BUY_FRESH'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 font-black'
                  : 'bg-slate-950 hover:bg-blue-950/40 text-blue-400 border border-blue-900/40'
              }`}
            >
              <span>🟦 สัญญาณซื้อใหม่ (ฟ้า)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-950/80 font-mono">
                {scanResults.filter((r) => r.zone === 'BLUE').length}
              </span>
            </button>

            {/* Badge: Green Strong Bull */}
            <button
              onClick={() => setSignalFilter('BULL_STRONG')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                signalFilter === 'BULL_STRONG'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40 font-black'
                  : 'bg-slate-950 hover:bg-emerald-950/40 text-emerald-400 border border-emerald-900/40'
              }`}
            >
              <span>🟩 รันเทรนด์ขาขึ้น (เขียว)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/80 font-mono">
                {scanResults.filter((r) => r.zone === 'GREEN').length}
              </span>
            </button>

            {/* Badge: Yellow Warning */}
            <button
              onClick={() => setSignalFilter('WARN_TAKE_PROFIT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                signalFilter === 'WARN_TAKE_PROFIT'
                  ? 'bg-yellow-500 text-slate-950 shadow-md shadow-yellow-900/40 font-black'
                  : 'bg-slate-950 hover:bg-yellow-950/40 text-yellow-400 border border-yellow-900/40'
              }`}
            >
              <span>🟨 เตือนเทคกำไร (เหลือง)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-yellow-950/80 font-mono">
                {scanResults.filter((r) => r.zone === 'YELLOW').length}
              </span>
            </button>

            {/* Badge: Red Bear */}
            <button
              onClick={() => setSignalFilter('BEAR_CASH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                signalFilter === 'BEAR_CASH'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40 font-black'
                  : 'bg-slate-950 hover:bg-rose-950/40 text-rose-400 border border-rose-900/40'
              }`}
            >
              <span>🟥 ขาลง/ถือเงินสด (แดง)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-950/80 font-mono">
                {scanResults.filter((r) => r.zone === 'RED').length}
              </span>
            </button>

            {/* Badge: High Quality (Score >= 75) */}
            <button
              onClick={() => setSignalFilter('QUALITY_HIGH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                signalFilter === 'QUALITY_HIGH'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-950 hover:bg-cyan-950/40 text-cyan-300 border border-cyan-900/40'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>🌟 คุณภาพพรีเมียม (Grade S/A)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-950/80 font-mono">
                {scanResults.filter((r) => r.qualityScore >= 75).length}
              </span>
            </button>

            {/* Badge: Fresh Signal */}
            <button
              onClick={() => setSignalFilter('FRESH_SIGNAL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                signalFilter === 'FRESH_SIGNAL'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-950 hover:bg-amber-950/40 text-amber-300 border border-amber-900/40'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>🔥 สัญญาณสดใหม่ (≤ 2 แท่ง)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950/80 font-mono">
                {scanResults.filter((r) => r.barsSinceSignal <= 2).length}
              </span>
            </button>

            {/* Badge: High Volume */}
            <button
              onClick={() => setSignalFilter('HIGH_VOLUME')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                signalFilter === 'HIGH_VOLUME'
                  ? 'bg-purple-600 text-white shadow-md font-black'
                  : 'bg-slate-950 hover:bg-purple-950/40 text-purple-300 border border-purple-900/40'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>🚀 วอลุ่มหนาแน่น (≥20M)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-950/80 font-mono">
                {scanResults.filter((r) => r.volume24h >= 20_000_000).length}
              </span>
            </button>

            {/* Badge: Top Gainers */}
            <button
              onClick={() => setSignalFilter('TOP_GAINERS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                signalFilter === 'TOP_GAINERS'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-950 hover:bg-emerald-950/40 text-emerald-300 border border-emerald-900/40'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>📈 บวกแรงวันนี้</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/80 font-mono">
                {scanResults.filter((r) => r.priceChange24h > 0).length}
              </span>
            </button>
          </div>
        </div>

        {/* ================= SEARCH, SORT & VIEW SWITCHER ================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="ค้นหาชื่อย่อหุ้น เช่น PTT, DELTA, BDMS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500 shadow-inner"
            />
          </div>

          {/* Sort Selector & Layout Toggle */}
          <div className="flex items-center space-x-2.5">
            {/* Sort Dropdown */}
            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-2xl text-xs text-slate-300">
              <span className="text-[11px] text-slate-500">เรียงตาม:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                <option value="SCORE_DESC" className="bg-slate-900 text-white">
                  🏆 CDC Quality Score (สูงสุด)
                </option>
                <option value="CHANGE_DESC" className="bg-slate-900 text-white">
                  📈 % ราคาบวกสูงสุด
                </option>
                <option value="CHANGE_ASC" className="bg-slate-900 text-white">
                  📉 % ราคาลบสูงสุด
                </option>
                <option value="VOLUME_DESC" className="bg-slate-900 text-white">
                  💰 วอลุ่มเทรด 24 ชม. สูงสุด
                </option>
                <option value="RECENCY_ASC" className="bg-slate-900 text-white">
                  🔥 สัญญาณสดใหม่สุด (แท่งน้อย)
                </option>
                <option value="SYMBOL_ASC" className="bg-slate-900 text-white">
                  🔤 ชื่อหุ้น (A-Z)
                </option>
              </select>
            </div>

            {/* Grid / Table View Switcher */}
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={() => setViewLayout('GRID')}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  viewLayout === 'GRID' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="มุมมองการ์ด (Grid)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewLayout('TABLE')}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  viewLayout === 'TABLE' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="มุมมองตาราง (Table)"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ================= MANAGE CUSTOM STOCKS COLLAPSIBLE ================= */}
        {isManageOpen && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                <span>จัดการรายชื่อหุ้นไทยในโหมดกำหนดเอง (Custom List)</span>
              </div>
              <button
                onClick={handleResetCustomToDefault}
                className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center space-x-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>คืนค่าเริ่มต้น (SET50)</span>
              </button>
            </div>

            {/* Add Input */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="พิมพ์ชื่อย่อหุ้น เช่น PTT, CPALL, BDMS..."
                  value={newSymbolInput}
                  onChange={(e) => setNewSymbolInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomSymbol()}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 font-mono uppercase focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={() => handleAddCustomSymbol()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มหุ้น</span>
              </button>
            </div>

            {inputError && (
              <div className="text-xs text-rose-400 flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{inputError}</span>
              </div>
            )}
            {successMsg && (
              <div className="text-xs text-emerald-400 flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Active Monitored Custom List */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400 font-medium block">
                รายชื่อหุ้นกำหนดเอง ({customList.length} ตัว):
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {customList.map((sym) => (
                  <div
                    key={sym}
                    className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono text-white"
                  >
                    <span>{sym}</span>
                    <button
                      onClick={() => handleDeleteCustomSymbol(sym)}
                      className="text-slate-500 hover:text-rose-400 transition ml-1 cursor-pointer"
                      title={`ลบ ${sym}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= 3. STOCKS DISPLAY (GRID VIEW) ================= */}
      {viewLayout === 'GRID' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAndSortedStocks.length === 0 && !isScanning ? (
            <div className="col-span-full bg-slate-900 border border-slate-800 rounded-3xl p-14 text-center text-slate-400 space-y-3 shadow-xl">
              <TrendingUp className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-bold text-slate-300">ไม่พบหุ้นที่ตรงกับเงื่อนไขการกรอง</p>
              <p className="text-xs text-slate-500">
                ลองคลิกเลือกแถบป้ายกรองสัญญาณอื่น หรือเปลี่ยนคำค้นหา
              </p>
            </div>
          ) : (
            filteredAndSortedStocks.map((stock) => {
              const theme = getQualityScoreTheme(stock.qualityScore, stock.qualityGrade);

              return (
                <div
                  key={stock.symbol}
                  className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 hover:shadow-2xl rounded-3xl p-4.5 flex flex-col justify-between space-y-3.5 transition group relative"
                >
                  {/* Top Bar: Symbol, Watchlist Star, and CDC Zone Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => handleToggleWatchlist(e, stock.symbol)}
                        className={`p-1 rounded-lg transition cursor-pointer ${
                          stock.isWatchlist
                            ? 'text-amber-400 hover:text-amber-300'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                        title={stock.isWatchlist ? 'ถอดออกจาก Watchlist' : 'เพิ่มใน Watchlist'}
                      >
                        <Star className={`w-4 h-4 ${stock.isWatchlist ? 'fill-amber-400' : ''}`} />
                      </button>
                      <span className="font-black text-white text-base font-mono tracking-tight">
                        {stock.symbol}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {timeframe.toUpperCase()}
                      </span>
                    </div>

                    <span
                      className="text-[11px] px-2.5 py-0.5 rounded-full font-bold text-slate-950 shadow"
                      style={{ backgroundColor: getZoneColorHex(stock.zone) }}
                    >
                      {getZoneNameTh(stock.zone)}
                    </span>
                  </div>

                  {/* CDC QUALITY SCORE CARD METER */}
                  <div
                    onClick={() => setSelectedStockForBreakdown(stock)}
                    className={`rounded-2xl p-2.5 border transition cursor-pointer hover:scale-[1.01] ${theme.bg}`}
                    title="คลิกเพื่อดูรายละเอียดการวิเคราะห์ 5 ปัจจัย"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-1.5">
                        <Award className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold">CDC Quality Score</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-[10px] px-2 py-0.2 rounded-md ${theme.badge}`}>
                          Grade {stock.qualityGrade}
                        </span>
                        <span className="text-xs font-black font-mono">
                          {stock.qualityScore}/100
                        </span>
                      </div>
                    </div>

                    {/* Progress Score Bar */}
                    <div className="w-full h-2 bg-slate-950/80 rounded-full overflow-hidden shadow-inner">
                      <div
                        className={`h-full bg-gradient-to-r ${theme.bar} transition-all duration-500 rounded-full`}
                        style={{ width: `${stock.qualityScore}%` }}
                      />
                    </div>

                    {/* Sub info: Entry Timing Badge & Golden Cross Info */}
                    <div className="flex items-center justify-between text-[10px] text-slate-300 mt-2 pt-1 border-t border-slate-800/40">
                      <span className="font-semibold">{stock.entryTimingLabel}</span>
                      {stock.barsSinceGoldenCross <= 1 && (stock.zone === 'BLUE' || stock.zone === 'GREEN') ? (
                        <span className="text-emerald-300 font-extrabold flex items-center bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/40 shadow-sm animate-pulse">
                          <Sparkles className="w-3 h-3 mr-0.5" /> จุดเข้าแรก!
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono">GC: {stock.barsSinceGoldenCross} แท่ง</span>
                      )}
                    </div>
                  </div>

                  {/* Price & 24h Change */}
                  <div className="flex items-baseline justify-between font-mono bg-slate-950/50 p-2 rounded-xl border border-slate-800/60">
                    <div>
                      <span className="text-[10px] text-slate-500 block">ราคาล่าสุด</span>
                      <span className="text-base font-bold text-white">
                        {formatStockPrice(stock.currentPrice)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">24h Change</span>
                      <span
                        className={`text-xs font-bold flex items-center justify-end ${
                          stock.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {stock.priceChange24h >= 0 ? (
                          <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                        )}
                        {stock.priceChange24h >= 0 ? '+' : ''}
                        {stock.priceChange24h.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* EMA Spread & 24h Volume */}
                  <div className="bg-slate-950 rounded-xl p-2 border border-slate-800/80 text-[11px] font-mono grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 block text-[9px]">EMA Spread</span>
                      <span
                        className={stock.trendStrength >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                      >
                        {stock.trendStrength >= 0 ? '+' : ''}
                        {stock.trendStrength.toFixed(2)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px]">วอลุ่ม 24 ชม.</span>
                      <span className="text-slate-300">
                        ฿{(stock.volume24h / 1_000_000).toFixed(1)}M
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      onClick={() => handleSelect(stock.symbol)}
                      className="flex-1 py-2 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-slate-950 rounded-xl text-xs font-black transition flex items-center justify-center space-x-1.5 shadow cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>เปิดดูกราฟ & เทรด</span>
                    </button>
                    <button
                      onClick={() => setSelectedStockForBreakdown(stock)}
                      className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-xl transition cursor-pointer"
                      title="วิเคราะห์ 5 ปัจจัย"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ================= 3. STOCKS DISPLAY (TABLE VIEW) ================= */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Watch</th>
                  <th className="py-3 px-4">ชื่อหุ้น</th>
                  <th className="py-3 px-4">ราคาล่าสุด</th>
                  <th className="py-3 px-4">24h Change</th>
                  <th className="py-3 px-4">CDC Action Zone</th>
                  <th className="py-3 px-4">CDC Quality Score</th>
                  <th className="py-3 px-4">ความสดใหม่</th>
                  <th className="py-3 px-4">EMA Spread</th>
                  <th className="py-3 px-4">วอลุ่ม 24h</th>
                  <th className="py-3 px-4 text-right">การกระทำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredAndSortedStocks.map((stock) => {
                  const theme = getQualityScoreTheme(stock.qualityScore, stock.qualityGrade);

                  return (
                    <tr
                      key={stock.symbol}
                      className="hover:bg-slate-800/40 transition cursor-pointer"
                      onClick={() => handleSelect(stock.symbol)}
                    >
                      {/* Watchlist Star */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleToggleWatchlist(e, stock.symbol)}
                          className={stock.isWatchlist ? 'text-amber-400 cursor-pointer' : 'text-slate-600 hover:text-slate-400 cursor-pointer'}
                        >
                          <Star className={`w-4 h-4 ${stock.isWatchlist ? 'fill-amber-400' : ''}`} />
                        </button>
                      </td>

                      {/* Symbol */}
                      <td className="py-3 px-4 font-black text-white text-sm">
                        {stock.symbol}
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 text-white font-bold">
                        {formatStockPrice(stock.currentPrice)}
                      </td>

                      {/* 24h Change */}
                      <td
                        className={`py-3 px-4 font-bold ${
                          stock.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {stock.priceChange24h >= 0 ? '+' : ''}
                        {stock.priceChange24h.toFixed(2)}%
                      </td>

                      {/* Zone */}
                      <td className="py-3 px-4">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-bold text-slate-950 shadow"
                          style={{ backgroundColor: getZoneColorHex(stock.zone) }}
                        >
                          {getZoneNameTh(stock.zone)}
                        </span>
                      </td>

                      {/* CDC Quality Score */}
                      <td className="py-3 px-4">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStockForBreakdown(stock);
                          }}
                          className="flex items-center space-x-2"
                        >
                          <span className={`text-[10px] px-2 py-0.2 rounded-md ${theme.badge}`}>
                            {stock.qualityGrade}
                          </span>
                          <span className="font-bold text-white">{stock.qualityScore}</span>
                          <div className="w-16 h-1.5 bg-slate-950 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className={`h-full bg-gradient-to-r ${theme.bar}`}
                              style={{ width: `${stock.qualityScore}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Recency & Entry Timing */}
                      <td className="py-3 px-4 text-slate-300">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-xs text-white">
                            {stock.entryTimingLabel}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            GC: {stock.barsSinceGoldenCross} แท่ง ({stock.barsSinceSignal} แท่งในโซน)
                          </div>
                        </div>
                      </td>

                      {/* EMA Spread */}
                      <td
                        className={`py-3 px-4 ${
                          stock.trendStrength >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {stock.trendStrength >= 0 ? '+' : ''}
                        {stock.trendStrength.toFixed(2)}%
                      </td>

                      {/* Volume */}
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        ฿{(stock.volume24h / 1_000_000).toFixed(1)}M
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleSelect(stock.symbol)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-lg text-xs transition cursor-pointer"
                        >
                          เปิดกราฟ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= 4. CDC QUALITY SCORE 5-FACTOR BREAKDOWN MODAL ================= */}
      {selectedStockForBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-black text-white font-mono">
                      {selectedStockForBreakdown.symbol}
                    </h3>
                    <span className="text-xs text-slate-400">วิเคราะห์ 5 ปัจจัย (ทฤษฎีเขียวซื้อ แดงขาย)</span>
                  </div>
                  <p className="text-xs text-emerald-400 font-bold">
                    {selectedStockForBreakdown.qualityBreakdown.gradeLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStockForBreakdown(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Total Score Meter Card */}
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800/90 text-center space-y-2">
              <span className="text-xs text-slate-400 font-bold">คะแนนคุณภาพจุดเข้าซื้อ (Total Quality Score)</span>
              <div className="text-4xl font-black font-mono text-white">
                {selectedStockForBreakdown.qualityScore}{' '}
                <span className="text-lg text-slate-500">/ 100</span>
              </div>
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full"
                  style={{ width: `${selectedStockForBreakdown.qualityScore}%` }}
                />
              </div>
            </div>

            {/* 5 Factors Breakdown List */}
            <div className="space-y-3 text-xs">
              {/* Factor 1: Recency & Golden Cross Timing */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/70 space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-300">1. {selectedStockForBreakdown.qualityBreakdown.recency.label}</span>
                  <span className="text-emerald-400 font-mono">
                    {selectedStockForBreakdown.qualityBreakdown.recency.score} / {selectedStockForBreakdown.qualityBreakdown.recency.maxScore}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {selectedStockForBreakdown.qualityBreakdown.recency.detail}
                </p>
              </div>

              {/* Factor 2: Zone */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/70 space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-300">2. {selectedStockForBreakdown.qualityBreakdown.zone.label}</span>
                  <span className="text-emerald-400 font-mono">
                    {selectedStockForBreakdown.qualityBreakdown.zone.score} / {selectedStockForBreakdown.qualityBreakdown.zone.maxScore}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {selectedStockForBreakdown.qualityBreakdown.zone.detail}
                </p>
              </div>

              {/* Factor 3: Trend Strength */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/70 space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-300">3. {selectedStockForBreakdown.qualityBreakdown.trendStrength.label}</span>
                  <span className="text-emerald-400 font-mono">
                    {selectedStockForBreakdown.qualityBreakdown.trendStrength.score} / {selectedStockForBreakdown.qualityBreakdown.trendStrength.maxScore}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {selectedStockForBreakdown.qualityBreakdown.trendStrength.detail}
                </p>
              </div>

              {/* Factor 4: Volume */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/70 space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-300">4. {selectedStockForBreakdown.qualityBreakdown.volume24h.label}</span>
                  <span className="text-emerald-400 font-mono">
                    {selectedStockForBreakdown.qualityBreakdown.volume24h.score} / {selectedStockForBreakdown.qualityBreakdown.volume24h.maxScore}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {selectedStockForBreakdown.qualityBreakdown.volume24h.detail}
                </p>
              </div>

              {/* Factor 5: Price Change */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/70 space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-300">5. {selectedStockForBreakdown.qualityBreakdown.priceChange.label}</span>
                  <span className="text-emerald-400 font-mono">
                    {selectedStockForBreakdown.qualityBreakdown.priceChange.score} / {selectedStockForBreakdown.qualityBreakdown.priceChange.maxScore}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {selectedStockForBreakdown.qualityBreakdown.priceChange.detail}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => {
                  handleSelect(selectedStockForBreakdown.symbol);
                  setSelectedStockForBreakdown(null);
                }}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs transition shadow-lg flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>เปิดดูกราฟ {selectedStockForBreakdown.symbol}</span>
              </button>
              <button
                onClick={() => setSelectedStockForBreakdown(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
