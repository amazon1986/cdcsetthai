import React, { useState, useEffect } from 'react';
import { Timeframe, ScannerStockResult, CDCZoneColor } from '../types';
import { fetchStockKlines, fetchStockTicker24h, POPULAR_STOCKS, formatStockPrice } from '../lib/stockApi';
import { calculateCDCActionZone, getZoneColorHex, getZoneNameTh } from '../lib/cdcIndicator';
import { getStoredSymbols, saveStoredSymbols } from '../lib/botStore';
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
  Layers,
} from 'lucide-react';

interface MarketScannerProps {
  onSelectCoin?: (symbol: string) => void;
  onSelectStock?: (symbol: string) => void;
}

const PRESET_SUGGESTIONS = [
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

export const MarketScanner: React.FC<MarketScannerProps> = ({ onSelectCoin, onSelectStock }) => {
  const handleSelect = onSelectStock || onSelectCoin || (() => {});
  const [stockList, setStockList] = useState<string[]>(() => getStoredSymbols());
  const [newSymbolInput, setNewSymbolInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);

  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [filterZone, setFilterZone] = useState<CDCZoneColor | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScannerStockResult[]>([]);
  const [scanProgress, setScanProgress] = useState(0);

  const runScanner = async (symbolsToScan = stockList) => {
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
      for (const sym of symbolsToScan) {
        try {
          const rawCandles = await fetchStockKlines(sym, timeframe, 100);
          const cdcCandles = calculateCDCActionZone(rawCandles, 12, 26);

          if (cdcCandles.length > 0) {
            const latest = cdcCandles[cdcCandles.length - 1];
            const prev = cdcCandles.length > 1 ? cdcCandles[cdcCandles.length - 2] : latest;
            const ticker = tickerMap.get(sym);

            const currentPrice = latest.close;
            const priceChange24h = ticker ? ticker.priceChangePercent : ((currentPrice - prev.close) / prev.close) * 100;
            const volume24h = ticker ? ticker.quoteVolume : latest.volume * latest.close;

            const trendStrength =
              latest.emaFast && latest.emaSlow
                ? ((latest.emaFast - latest.emaSlow) / latest.emaSlow) * 100
                : 0;

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
            });
          }
        } catch (e) {
          console.error(`Failed to scan ${sym}:`, e);
        }

        completed += 1;
        setScanProgress(Math.round((completed / symbolsToScan.length) * 100));
      }

      setScanResults(results);
    } catch (err) {
      console.error('Market scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    runScanner(stockList);
  }, [timeframe]);

  // Handle Add New Stock Symbol
  const handleAddSymbol = (symToAdd?: string) => {
    const raw = (symToAdd || newSymbolInput).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    setInputError(null);
    setSuccessMsg(null);

    if (!raw) {
      setInputError('กรุณากรอกชื่อย่อหุ้น');
      return;
    }

    if (stockList.includes(raw)) {
      setInputError(`หุ้น ${raw} มีอยู่ในรายการสแกนแล้ว`);
      return;
    }

    const updated = [...stockList, raw];
    setStockList(updated);
    saveStoredSymbols(updated);
    setNewSymbolInput('');
    setSuccessMsg(`เพิ่มหุ้น ${raw} เรียบร้อยแล้ว`);

    // Auto clear success message after 3s
    setTimeout(() => {
      setSuccessMsg(null);
    }, 3000);

    // Auto run scan for the new list
    runScanner(updated);
  };

  // Handle Delete Symbol
  const handleDeleteSymbol = (symbolToDelete: string) => {
    if (stockList.length <= 1) {
      alert('ต้องมีหุ้นในรายการสแกนอย่างน้อย 1 ตัว');
      return;
    }

    const updated = stockList.filter((s) => s !== symbolToDelete);
    setStockList(updated);
    saveStoredSymbols(updated);
    setScanResults((prev) => prev.filter((r) => r.symbol !== symbolToDelete));
  };

  // Handle Reset to Default Popular Stocks
  const handleResetToDefault = () => {
    if (confirm('คุณต้องการรีเซ็ตรายการหุ้นทั้งหมดกลับเป็น SET50 เริ่มต้นใช่หรือไม่?')) {
      setStockList(POPULAR_STOCKS);
      saveStoredSymbols(POPULAR_STOCKS);
      runScanner(POPULAR_STOCKS);
    }
  };

  // Filtering results
  const filteredStocks = scanResults.filter((stock) => {
    const matchesSearch = stock.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesZone = filterZone === 'ALL' || stock.zone === filterZone;
    return matchesSearch && matchesZone;
  });

  const availableSuggestions = PRESET_SUGGESTIONS.filter((s) => !stockList.includes(s));

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-600 p-2.5 rounded-xl shadow">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                ระบบสแกนหุ้น CDC Action Zone V2 (ตลาดหุ้นไทย)
              </h2>
              <p className="text-xs text-slate-400">
                ตรวจจับสัญญาณซื้อ/ขาย หุ้นไทยตามสูตรลุงโฉลก ทั้งหมด {stockList.length} ตัว
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Toggle Manage Stocks Panel Button */}
            <button
              onClick={() => setIsManageOpen(!isManageOpen)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                isManageOpen
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>จัดการรายชื่อหุ้น ({stockList.length})</span>
            </button>

            {/* Timeframe Selector */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(['15m', '1h', '4h', '1d', '1w'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    timeframe === tf
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Scan Refresh Button */}
            <button
              onClick={() => runScanner(stockList)}
              disabled={isScanning}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg transition"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'กำลังสแกน...' : 'เริ่มสแกนใหม่'}</span>
            </button>
          </div>
        </div>

        {/* Manage Stocks Collapsible Section */}
        {isManageOpen && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>เพิ่มหรือลบรายชื่อหุ้นไทยที่ต้องการสแกน</span>
              </div>
              <button
                onClick={handleResetToDefault}
                className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center space-x-1 transition"
                title="รีเซ็ตเป็นหุ้นยอดนิยม SET50"
              >
                <RotateCcw className="w-3 h-3" />
                <span>คืนค่าเริ่มต้น (SET50)</span>
              </button>
            </div>

            {/* Add Stock Form Input */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="พิมพ์ชื่อย่อหุ้นไทย เช่น PTT, CPALL, DELTA, BDMS..."
                  value={newSymbolInput}
                  onChange={(e) => setNewSymbolInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 font-mono uppercase focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={() => handleAddSymbol()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มหุ้น</span>
              </button>
            </div>

            {/* Input Alert/Error/Success */}
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

            {/* Quick Preset Suggestions */}
            {availableSuggestions.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 font-medium block">
                  หุ้นไทยแนะนำ (คลิกเพื่อเพิ่มด่วน):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableSuggestions.slice(0, 15).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleAddSymbol(s)}
                      className="px-2 py-1 bg-slate-900 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40 border border-slate-800 text-slate-300 rounded-lg text-[11px] font-mono transition flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active Monitored Stocks List */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>รายการหุ้นที่กำลังสแกนอยู่ ({stockList.length} ตัว):</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {stockList.map((sym) => (
                  <div
                    key={sym}
                    className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono text-white"
                  >
                    <span>{sym}</span>
                    <button
                      onClick={() => handleDeleteSymbol(sym)}
                      className="text-slate-500 hover:text-rose-400 transition ml-1"
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

        {/* Scan Progress Bar */}
        {isScanning && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>กำลังดึงข้อมูลแท่งเทียนและคำนวณ CDC Action Zone...</span>
              <span className="font-mono">{scanProgress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Search & Zone Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="ค้นหาชื่อหุ้น..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Color Zone Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 flex items-center mr-1 text-[11px]">
              <Filter className="w-3 h-3 mr-1" /> กรองโซนสี:
            </span>

            <button
              onClick={() => setFilterZone('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition text-xs ${
                filterZone === 'ALL'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              ทั้งหมด ({scanResults.length})
            </button>

            <button
              onClick={() => setFilterZone('BLUE')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition text-xs flex items-center space-x-1 ${
                filterZone === 'BLUE'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-950 text-blue-400 hover:bg-slate-800'
              }`}
            >
              <span>🟦 สัญญาณซื้อ (ฟ้า)</span>
              <span className="opacity-75">
                ({scanResults.filter((r) => r.zone === 'BLUE').length})
              </span>
            </button>

            <button
              onClick={() => setFilterZone('GREEN')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition text-xs flex items-center space-x-1 ${
                filterZone === 'GREEN'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-950 text-emerald-400 hover:bg-slate-800'
              }`}
            >
              <span>🟩 ขาขึ้น (เขียว)</span>
              <span className="opacity-75">
                ({scanResults.filter((r) => r.zone === 'GREEN').length})
              </span>
            </button>

            <button
              onClick={() => setFilterZone('YELLOW')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition text-xs flex items-center space-x-1 ${
                filterZone === 'YELLOW'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-slate-950 text-yellow-400 hover:bg-slate-800'
              }`}
            >
              <span>🟨 เตือนระวัง (เหลือง)</span>
              <span className="opacity-75">
                ({scanResults.filter((r) => r.zone === 'YELLOW').length})
              </span>
            </button>

            <button
              onClick={() => setFilterZone('RED')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition text-xs flex items-center space-x-1 ${
                filterZone === 'RED'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-950 text-rose-400 hover:bg-slate-800'
              }`}
            >
              <span>🟥 ขายออก (แดง)</span>
              <span className="opacity-75">
                ({scanResults.filter((r) => r.zone === 'RED').length})
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid Display of Scanned Stocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredStocks.length === 0 && !isScanning ? (
          <div className="col-span-full bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
            <TrendingUp className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-semibold">ไม่พบหุ้นที่ตรงกับเงื่อนไขการกรอง</p>
            <p className="text-xs text-slate-500">ลองเปลี่ยนตัวกรองโซนสี หรือเพิ่มชื่อหุ้นในระบบ</p>
          </div>
        ) : (
          filteredStocks.map((stock) => (
            <div
              key={stock.symbol}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-xl flex flex-col justify-between space-y-3 transition group"
            >
              {/* Header: Symbol & Status Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-white text-base font-mono">{stock.symbol}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">{timeframe.toUpperCase()}</span>
                </div>
                <span
                  className="text-[11px] px-2.5 py-0.5 rounded-full font-bold text-slate-950 shadow"
                  style={{ backgroundColor: getZoneColorHex(stock.zone) }}
                >
                  {getZoneNameTh(stock.zone)}
                </span>
              </div>

              {/* Price & 24h Change */}
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-lg font-bold text-white">
                  {formatStockPrice(stock.currentPrice)}
                </span>
                <span
                  className={`text-xs font-bold flex items-center ${
                    stock.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {stock.priceChange24h >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                  {stock.priceChange24h >= 0 ? '+' : ''}
                  {stock.priceChange24h.toFixed(2)}%
                </span>
              </div>

              {/* EMA Fast & Slow Details */}
              <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800/80 text-[11px] font-mono grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block text-[9px]">EMA 12 (Fast)</span>
                  <span className="text-cyan-400">{formatStockPrice(stock.emaFast)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px]">EMA 26 (Slow)</span>
                  <span className="text-purple-400">{formatStockPrice(stock.emaSlow)}</span>
                </div>
              </div>

              {/* Action Button: Click to open in Chart */}
              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => handleSelect(stock.symbol)}
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 shadow"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>ดูชาร์ต & เทรด</span>
                </button>
                <button
                  onClick={() => handleDeleteSymbol(stock.symbol)}
                  className="p-1.5 bg-slate-950 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-slate-800 rounded-xl transition"
                  title={`ลบ ${stock.symbol} ออกจากรายการสแกน`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
