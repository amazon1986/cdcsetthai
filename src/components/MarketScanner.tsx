import React, { useState, useEffect } from 'react';
import { Timeframe, ScannerCoinResult, CDCZoneColor } from '../types';
import { fetchBitkubKlines, fetchBitkubTicker24h, POPULAR_PAIRS, formatCryptoPrice } from '../lib/bitkubApi';
import { calculateCDCActionZone, getZoneColorHex, getZoneNameTh } from '../lib/cdcIndicator';
import { getStoredSymbols, saveStoredSymbols, getStoredPaperAccount } from '../lib/botStore';
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
  Coins,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';

interface MarketScannerProps {
  onSelectCoin: (symbol: string) => void;
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
];

export const MarketScanner: React.FC<MarketScannerProps> = ({ onSelectCoin }) => {
  const [coinList, setCoinList] = useState<string[]>(() => getStoredSymbols());
  const [newSymbolInput, setNewSymbolInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);

  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [filterZone, setFilterZone] = useState<CDCZoneColor | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScannerCoinResult[]>([]);
  const [scanProgress, setScanProgress] = useState(0);

  const runScanner = async (symbolsToScan = coinList) => {
    if (symbolsToScan.length === 0) {
      setScanResults([]);
      return;
    }

    setIsScanning(true);
    setScanProgress(0);
    const results: ScannerCoinResult[] = [];

    // Fetch 24h tickers first for price changes
    const tickers = await fetchBitkubTicker24h();
    const tickerMap = new Map(tickers.map((t) => [t.symbol, t]));

    for (let i = 0; i < symbolsToScan.length; i++) {
      const sym = symbolsToScan[i];
      try {
        const rawCandles = await fetchBitkubKlines(sym, timeframe, 100);
        const cdcCandles = calculateCDCActionZone(rawCandles, 12, 26);

        if (cdcCandles.length > 0) {
          const latest = cdcCandles[cdcCandles.length - 1];
          const ticker = tickerMap.get(sym);

          const emaFast = latest.emaFast ?? latest.close;
          const emaSlow = latest.emaSlow ?? latest.close;
          const diffPct = ((emaFast - emaSlow) / emaSlow) * 100;

          results.push({
            symbol: sym,
            currentPrice: latest.close,
            priceChange24h: ticker ? ticker.priceChangePercent : 0,
            volume24h: ticker ? ticker.quoteVolume : 0,
            timeframe,
            zone: latest.zone,
            signal: latest.signal,
            emaFast,
            emaSlow,
            trendStrength: Number(diffPct.toFixed(2)),
            lastSignalTime: new Date(latest.time).toLocaleTimeString('th-TH', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          });
        }
      } catch (err) {
        console.warn(`Failed scanning ${sym}:`, err);
      }
      setScanProgress(Math.round(((i + 1) / symbolsToScan.length) * 100));
    }

    setScanResults(results);
    setIsScanning(false);
  };

  useEffect(() => {
    runScanner(coinList);
  }, [timeframe]);

  // Handle Adding Symbol
  const handleAddSymbol = (symbolToAdd?: string) => {
    setInputError(null);
    setSuccessMsg(null);

    const raw = (symbolToAdd || newSymbolInput).trim().toUpperCase();
    if (!raw) {
      setInputError('กรุณากรอกชื่อหุ้น (เช่น PTT)');
      return;
    }

    // Validation
    if (!/^[A-Z0-9.]+$/.test(raw)) {
      setInputError('รูปแบบสัญลักษณ์ไม่ถูกต้อง (เช่น PTT หรือ PTT.BK)');
      return;
    }

    if (coinList.includes(raw)) {
      setInputError(`หุ้น ${raw} มีอยู่ในรายการแล้ว`);
      return;
    }

    const updated = [...coinList, raw];
    setCoinList(updated);
    saveStoredSymbols(updated);
    setNewSymbolInput('');
    setSuccessMsg(`เพิ่มหุ้น ${raw} เรียบร้อยแล้ว`);

    setTimeout(() => setSuccessMsg(null), 3000);

    // Trigger re-scan with updated list
    runScanner(updated);
  };

  // Handle Deleting Symbol
  const handleDeleteSymbol = (symbolToDelete: string) => {
    const paperAccount = getStoredPaperAccount();
    const hasOpenPos = paperAccount.activePositions.some((p) => p.symbol === symbolToDelete);

    if (hasOpenPos) {
      const confirmDelete = window.confirm(
        `⚠️ หุ้น ${symbolToDelete} มีโพซิชันที่เปิดอยู่ในการเทรดจำลอง คุณแน่ใจหรือไม่ว่าต้องการลบออกจากรายการสแกน?`
      );
      if (!confirmDelete) return;
    }

    const updated = coinList.filter((s) => s !== symbolToDelete);
    if (updated.length === 0) {
      alert('ต้องมีหุ้นอย่างน้อย 1 ตัวในรายการ');
      return;
    }

    setCoinList(updated);
    saveStoredSymbols(updated);
    setSuccessMsg(`ลบหุ้น ${symbolToDelete} เรียบร้อยแล้ว`);
    setTimeout(() => setSuccessMsg(null), 3000);

    // Filter results directly & re-scan
    setScanResults((prev) => prev.filter((r) => r.symbol !== symbolToDelete));
  };

  // Reset to default popular pairs
  const handleResetDefault = () => {
    if (window.confirm('คุณต้องการรีเซ็ตรายการหุ้นทั้งหมดกลับเป็นค่าเริ่มต้น (15 หุ้นหลัก) หรือไม่?')) {
      setCoinList(POPULAR_PAIRS);
      saveStoredSymbols(POPULAR_PAIRS);
      setSuccessMsg('รีเซ็ตรายการหุ้นเป็นค่าเริ่มต้นแล้ว');
      setTimeout(() => setSuccessMsg(null), 3000);
      runScanner(POPULAR_PAIRS);
    }
  };

  const filteredCoins = scanResults.filter((coin) => {
    const matchesSearch = coin.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesZone = filterZone === 'ALL' || coin.zone === filterZone;
    return matchesSearch && matchesZone;
  });

  const availableSuggestions = PRESET_SUGGESTIONS.filter((s) => !coinList.includes(s));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-6">
      {/* Top Header & Scan Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              ระบบสแกนสัญญาณ CDC Action Zone V2 (Multi-Stock Scanner)
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
              {coinList.length} หุ้น
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            สแกนหาหุ้นบนตลาดหลักทรัพย์ไทย (SET50) ที่กำลังตัดเข้า <span className="text-blue-400 font-bold">โซนฟ้า (สัญญาณซื้อ)</span> หรือ <span className="text-emerald-400 font-bold">โซนเขียว (ขาขึ้น)</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Toggle Manage Coins Panel Button */}
          <button
            onClick={() => setIsManageOpen(!isManageOpen)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
              isManageOpen
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{isManageOpen ? 'ซ่อนการจัดการหุ้น' : '⚙️ เพิ่ม/ลบ หุ้น'}</span>
          </button>

          {/* Timeframe Selector */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(['1h', '4h', '1d'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  timeframe === tf
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => runScanner(coinList)}
            disabled={isScanning}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition flex items-center space-x-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? `สแกนแล้ว ${scanProgress}%` : 'เริ่มสแกนใหม่'}</span>
          </button>
        </div>
      </div>

      {/* Manage Coins Collapsible Section */}
      {isManageOpen && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-white">จัดการรายชื่อหุ้นสำหรับสแกนและเทรดอัตโนมัติ (Watchlist)</h4>
            </div>

            <button
              onClick={handleResetDefault}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition"
              title="คืนค่ากลับเป็นหุ้นหลักเริ่มต้น"
            >
              <RotateCcw className="w-3 h-3" />
              <span>รีเซ็ตค่าเริ่มต้น ({POPULAR_PAIRS.length} หุ้น)</span>
            </button>
          </div>

          {/* Add Coin Form Input */}
          <div className="space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddSymbol();
              }}
              className="flex flex-wrap sm:flex-nowrap gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="พิมพ์ชื่อหุ้น เช่น PTT, CPALL, AOT..."
                  value={newSymbolInput}
                  onChange={(e) => {
                    setNewSymbolInput(e.target.value.toUpperCase());
                    if (inputError) setInputError(null);
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center space-x-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มหุ้น</span>
              </button>
            </form>

            {/* Error or Success notification */}
            {inputError && (
              <div className="flex items-center space-x-1.5 text-xs text-rose-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{inputError}</span>
              </div>
            )}
            {successMsg && (
              <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>

          {/* Quick Suggestions Chips */}
          {availableSuggestions.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 font-medium">💡 แนะนำหุ้นยอดนิยม (กดเพื่อเพิ่มทันที):</span>
              <div className="flex flex-wrap gap-1.5">
                {availableSuggestions.slice(0, 10).map((sug) => (
                  <button
                    key={sug}
                    onClick={() => handleAddSymbol(sug)}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 hover:text-emerald-400 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300 transition flex items-center space-x-1"
                  >
                    <span>+ {sug}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Monitored Coins List */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>รายการหุ้นที่กำลังสแกนอยู่ ({coinList.length} ตัว):</span>
              <span className="text-[10px] text-slate-500">กดปุ่ม ✖ บนหุ้นเพื่อลบ</span>
            </div>

            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto scrollbar-thin p-1">
              {coinList.map((sym) => (
                <div
                  key={sym}
                  className="group flex items-center space-x-2 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-mono text-white shadow-sm transition"
                >
                  <span className="font-bold">{sym}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteSymbol(sym)}
                    className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 p-0.5 rounded transition"
                    title={`ลบ ${sym} ออกจากรายการ`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar when scanning */}
      {isScanning && (
        <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${scanProgress}%` }}
          />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterZone('ALL')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              filterZone === 'ALL'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ทั้งหมด ({scanResults.length})
          </button>
          <button
            onClick={() => setFilterZone('BLUE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1 ${
              filterZone === 'BLUE'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                : 'text-blue-400/70 hover:text-blue-400'
            }`}
          >
            <span>🟦 สัญญาณซื้อ BLUE</span>
            <span>({scanResults.filter((c) => c.zone === 'BLUE').length})</span>
          </button>
          <button
            onClick={() => setFilterZone('GREEN')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1 ${
              filterZone === 'GREEN'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'text-emerald-400/70 hover:text-emerald-400'
            }`}
          >
            <span>🟩 ขาขึ้น GREEN</span>
            <span>({scanResults.filter((c) => c.zone === 'GREEN').length})</span>
          </button>
          <button
            onClick={() => setFilterZone('YELLOW')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1 ${
              filterZone === 'YELLOW'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                : 'text-yellow-400/70 hover:text-yellow-400'
            }`}
          >
            <span>🟨 เตือนขาย YELLOW</span>
            <span>({scanResults.filter((c) => c.zone === 'YELLOW').length})</span>
          </button>
          <button
            onClick={() => setFilterZone('RED')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1 ${
              filterZone === 'RED'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'text-rose-400/70 hover:text-rose-400'
            }`}
          >
            <span>🟥 ขาลง RED</span>
            <span>({scanResults.filter((c) => c.zone === 'RED').length})</span>
          </button>
        </div>

        {/* Search input */}
        <input
          type="text"
          placeholder="ค้นหาชื่อหุ้น..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 w-44"
        />
      </div>

      {/* Grid Display of Scanned Coins */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredCoins.length === 0 && !isScanning ? (
          <div className="col-span-full p-8 text-center bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl text-slate-400 text-xs space-y-2">
            <Coins className="w-8 h-8 mx-auto text-slate-600" />
            <p className="font-bold text-white">ไม่พบหุ้นที่ตรงกับเงื่อนไขการค้นหาหรือตัวกรอง</p>
            <p className="text-slate-500">
              ลองกดปุ่ม <span className="text-emerald-400">"⚙️ เพิ่ม/ลบ หุ้น"</span> เพื่อเพิ่มหุ้นใหม่ หรือเปลี่ยนตัวกรองโซน
            </p>
          </div>
        ) : (
          filteredCoins.map((coin) => (
            <div
              key={coin.symbol}
              className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-lg space-y-3 transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-white text-base font-mono">{coin.symbol}</span>
                  <span className="text-[10px] text-slate-500 block font-mono">SET50 Market</span>
                </div>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold text-slate-950 shadow-sm"
                  style={{ backgroundColor: getZoneColorHex(coin.zone) }}
                >
                  {getZoneNameTh(coin.zone)}
                </span>
              </div>

              <div className="flex items-baseline justify-between font-mono">
                <span className="text-lg font-extrabold text-white">
                  {formatCryptoPrice(coin.currentPrice)}
                </span>
                <span
                  className={`text-xs font-bold flex items-center ${
                    coin.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {coin.priceChange24h >= 0 ? '+' : ''}
                  {coin.priceChange24h.toFixed(2)}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-900">
                <div>
                  <span className="block text-slate-500">EMA 12 (Fast):</span>
                  <span className="text-cyan-400">{formatCryptoPrice(coin.emaFast)}</span>
                </div>
                <div>
                  <span className="block text-slate-500">EMA 26 (Slow):</span>
                  <span className="text-purple-400">{formatCryptoPrice(coin.emaSlow)}</span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => onSelectCoin(coin.symbol)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-400 font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1 border border-slate-700 hover:border-emerald-500"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>เปิดชาร์ต & บอท</span>
                </button>

                <button
                  onClick={() => handleDeleteSymbol(coin.symbol)}
                  className="p-2 bg-slate-900 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 rounded-xl transition"
                  title={`ลบ ${coin.symbol} ออกจากรายการ`}
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
