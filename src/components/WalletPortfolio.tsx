import React, { useState, useMemo } from 'react';
import { PaperAccount, PaperPosition, BotConfig, StockTicker24h, Timeframe } from '../types';
import { formatStockPrice } from '../lib/stockApi';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PieChart,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Sliders,
  Layers,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Percent,
} from 'lucide-react';

interface WalletPortfolioProps {
  paperAccount: PaperAccount;
  botConfig: BotConfig;
  tickers?: StockTicker24h[];
  onSelectStock: (symbol: string) => void;
  onClosePosition: (symbol: string, currentPrice?: number) => void;
  onResetPaperAccount: () => void;
  onUpdateBalance?: (newBalance: number) => void;
  onOpenSettings: () => void;
}

export const WalletPortfolio: React.FC<WalletPortfolioProps> = ({
  paperAccount,
  botConfig,
  tickers = [],
  onSelectStock,
  onClosePosition,
  onResetPaperAccount,
  onUpdateBalance,
  onOpenSettings,
}) => {
  const [depositAmount, setDepositAmount] = useState<number>(50000);
  const [isDepositOpen, setIsDepositOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Map latest prices from ticker tape
  const tickerPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    tickers.forEach((t) => map.set(t.symbol, t.lastPrice));
    return map;
  }, [tickers]);

  // Compute live portfolio statistics
  const positionsWithLiveData = useMemo(() => {
    return paperAccount.activePositions.map((pos) => {
      const livePrice = tickerPriceMap.get(pos.symbol) || pos.entryPrice;
      const posLev = pos.leverage || 1;
      const margin = pos.marginUsdt || pos.usdtInvested || 0;
      const marketValue = pos.amount * livePrice;

      const pnlPercent =
        pos.side === 'SHORT'
          ? ((pos.entryPrice - livePrice) / pos.entryPrice) * 100 * posLev
          : ((livePrice - pos.entryPrice) / pos.entryPrice) * 100 * posLev;

      const pnlThb = (margin * pnlPercent) / 100;

      return {
        ...pos,
        livePrice,
        marketValue,
        livePnlThb: pnlThb,
        livePnlPercent: pnlPercent,
        lotsCount: pos.amount / 100,
      };
    });
  }, [paperAccount.activePositions, tickerPriceMap]);

  // Filter positions by search query
  const filteredPositions = useMemo(() => {
    if (!searchQuery.trim()) return positionsWithLiveData;
    return positionsWithLiveData.filter((p) =>
      p.symbol.toUpperCase().includes(searchQuery.toUpperCase().trim())
    );
  }, [positionsWithLiveData, searchQuery]);

  // Portfolio Totals
  const totalStockMarketValue = useMemo(() => {
    return positionsWithLiveData.reduce((sum, p) => sum + p.marketValue, 0);
  }, [positionsWithLiveData]);

  const totalInvestedCapital = useMemo(() => {
    return positionsWithLiveData.reduce((sum, p) => sum + (p.usdtInvested || p.marginUsdt || 0), 0);
  }, [positionsWithLiveData]);

  const totalUnrealizedPnlThb = useMemo(() => {
    return positionsWithLiveData.reduce((sum, p) => sum + p.livePnlThb, 0);
  }, [positionsWithLiveData]);

  const totalPortfolioEquity = paperAccount.usdtBalance + totalStockMarketValue;
  const initialCapital = paperAccount.initialUsdtBalance || 100000;
  const netReturnPercent = initialCapital > 0 ? ((totalPortfolioEquity - initialCapital) / initialCapital) * 100 : 0;

  const maxSlots = Math.max(1, Math.min(20, botConfig.maxOpenPositions || 5));
  const slotsUsed = paperAccount.activePositions.length;
  const cashWeightPercent = totalPortfolioEquity > 0 ? (paperAccount.usdtBalance / totalPortfolioEquity) * 100 : 100;
  const stockWeightPercent = totalPortfolioEquity > 0 ? (totalStockMarketValue / totalPortfolioEquity) * 100 : 0;

  const handleDeposit = () => {
    if (depositAmount <= 0) return;
    if (onUpdateBalance) {
      onUpdateBalance(paperAccount.usdtBalance + depositAmount);
    }
    setIsDepositOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* ================= 1. HEADER TITLE & QUICK ACTIONS ================= */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="p-3.5 bg-gradient-to-tr from-emerald-500/20 via-teal-500/20 to-blue-500/20 border border-emerald-500/30 rounded-2xl">
            <Wallet className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-xl font-black text-white tracking-tight">กระเป๋าเงิน & พอร์ตหุ้นไทย</h2>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                  botConfig.mode === 'SETTRADE_LIVE'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                }`}
              >
                {botConfig.mode === 'SETTRADE_LIVE' ? '⚡ InnovestX Live API' : '🟢 Paper Trading'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ตรวจสอบยอดเงินสดคงเหลือ สัดส่วนสินทรัพย์ และติดตามผลกำไร-ขาดทุนของหุ้นทุกตัวในพอร์ตแบบเรียลไทม์
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5">
          {botConfig.mode === 'PAPER' ? (
            <>
              <button
                onClick={() => setIsDepositOpen(!isDepositOpen)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>เติมเงินจำลอง</span>
              </button>
              <button
                onClick={onResetPaperAccount}
                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition cursor-pointer"
                title="รีเซ็ตพอร์ตเป็น ฿100,000"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>รีเซ็ตพอร์ต</span>
              </button>
            </>
          ) : (
            <button
              onClick={onOpenSettings}
              className="flex items-center space-x-1.5 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>ตั้งค่า InnovestX API</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= MODAL: ADD SIMULATED CASH ================= */}
      {isDepositOpen && (
        <div className="p-4 bg-slate-950 border border-emerald-500/40 rounded-2xl space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400">💵 เติมเงินทุนจำลองเข้าพอร์ต Paper Trading</span>
            <button
              onClick={() => setIsDepositOpen(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              ✕ ปิด
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              min="1000"
              step="10000"
              value={depositAmount}
              onChange={(e) => setDepositAmount(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-emerald-500 w-48"
            />
            <button
              onClick={() => setDepositAmount(50000)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 font-mono cursor-pointer"
            >
              +50K
            </button>
            <button
              onClick={() => setDepositAmount(100000)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 font-mono cursor-pointer"
            >
              +100K
            </button>
            <button
              onClick={handleDeposit}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition ml-auto cursor-pointer"
            >
              ยืนยันการเติมเงิน
            </button>
          </div>
        </div>
      )}

      {/* ================= 2. PORTFOLIO METRICS CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Net Worth / Total Equity */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>มูลค่าพอร์ตสุทธิ (Total Equity)</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight pt-1">
            ฿{totalPortfolioEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center space-x-1.5 text-xs pt-1">
            <span className="text-[11px] text-slate-400">ผลตอบแทนรวม:</span>
            <span
              className={`font-mono font-bold flex items-center ${
                netReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {netReturnPercent >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
              {netReturnPercent >= 0 ? `+${netReturnPercent.toFixed(2)}%` : `${netReturnPercent.toFixed(2)}%`}
            </span>
          </div>
        </div>

        {/* Card 2: Available Cash Balance */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>เงินสดคงเหลือ (Available Cash)</span>
            <Wallet className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-400 font-mono tracking-tight pt-1">
            ฿{paperAccount.usdtBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 pt-1">
            สัดส่วนเงินสด: <span className="font-mono font-bold text-white">{cashWeightPercent.toFixed(1)}%</span> ของพอร์ต
          </div>
        </div>

        {/* Card 3: Stock Holdings Market Value */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>มูลค่าหุ้นในพอร์ต (Stock Value)</span>
            <BarChart3 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono tracking-tight pt-1">
            ฿{totalStockMarketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 pt-1">
            ถือครอง: <span className="font-mono font-bold text-white">{positionsWithLiveData.length} ตัว</span> ({stockWeightPercent.toFixed(1)}%)
          </div>
        </div>

        {/* Card 4: Unrealized PnL */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>กำไร/ขาดทุนปัจจุบัน (Unrealized PnL)</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div
            className={`text-2xl font-black font-mono tracking-tight pt-1 ${
              totalUnrealizedPnlThb >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {totalUnrealizedPnlThb >= 0 ? `+฿${totalUnrealizedPnlThb.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `-฿${Math.abs(totalUnrealizedPnlThb).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          <div className="text-[11px] text-slate-400 pt-1">
            สล็อตบอทที่ใช้: <span className="font-mono font-bold text-white">{slotsUsed} / {maxSlots} สล็อต</span>
          </div>
        </div>
      </div>

      {/* ================= 3. ASSET ALLOCATION BAR & RISK PROFILE ================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PieChart className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">สัดส่วนการจัดสรรสินทรัพย์ (Asset Allocation)</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            เงินสด {cashWeightPercent.toFixed(1)}% | หุ้น {stockWeightPercent.toFixed(1)}%
          </span>
        </div>

        {/* Progress Bar of Allocation */}
        <div className="h-3.5 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
          <div
            style={{ width: `${cashWeightPercent}%` }}
            className="bg-cyan-500 transition-all duration-500"
            title={`เงินสดคงเหลือ: ${cashWeightPercent.toFixed(1)}%`}
          />
          <div
            style={{ width: `${stockWeightPercent}%` }}
            className="bg-purple-500 transition-all duration-500"
            title={`หุ้นในพอร์ต: ${stockWeightPercent.toFixed(1)}%`}
          />
        </div>

        {/* Asset Tags */}
        <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
            <span className="text-slate-300">เงินสด THB:</span>
            <span className="font-mono font-bold text-white">฿{paperAccount.usdtBalance.toLocaleString()} ({cashWeightPercent.toFixed(1)}%)</span>
          </div>

          {positionsWithLiveData.map((pos) => {
            const posWeight = totalPortfolioEquity > 0 ? (pos.marketValue / totalPortfolioEquity) * 100 : 0;
            return (
              <div
                key={pos.symbol}
                className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span className="text-slate-300 font-bold font-mono">{pos.symbol}:</span>
                <span className="font-mono text-slate-200">฿{pos.marketValue.toLocaleString()} ({posWeight.toFixed(1)}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= 4. ACTIVE STOCK HOLDINGS TABLE ================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <Layers className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-black text-white">รายการหุ้นที่ถือครองในพอร์ต (Active Holdings)</h3>
              <span className="text-xs text-slate-400">
                รวมทั้งหมด {positionsWithLiveData.length} ตัว (จำกัดสูงสุด {maxSlots} ตัว)
              </span>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="ค้นหาหุ้นในพอร์ต..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {filteredPositions.length === 0 ? (
          <div className="py-12 text-center space-y-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
            <Layers className="w-12 h-12 text-slate-600 mx-auto" />
            <div className="text-sm font-bold text-slate-300">ไม่มีหุ้นที่ถือครองอยู่ในขณะนี้</div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              เมื่อบอทตรวจพบสัญญาณ CDC Golden Cross (แท่งฟ้า/เขียว) ระบบจะทำการเข้าซื้อและนำหุ้นมาแสดงในหน้านี้โดยอัตโนมัติ
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3">ชื่อหุ้น / สถานะ</th>
                  <th className="py-3 px-3">จำนวนหุ้น (Lots)</th>
                  <th className="py-3 px-3">ราคาต้นทุน (Avg Cost)</th>
                  <th className="py-3 px-3">ราคาตลาดล่าสุด (Live)</th>
                  <th className="py-3 px-3">มูลค่าตลาดรวม (Value)</th>
                  <th className="py-3 px-3">กำไร/ขาดทุน (PnL)</th>
                  <th className="py-3 px-3 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPositions.map((pos) => {
                  const isPositive = pos.livePnlThb >= 0;
                  return (
                    <tr key={pos.symbol} className="hover:bg-slate-800/40 transition">
                      {/* Symbol & Side */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onSelectStock(pos.symbol)}
                            className="font-mono font-black text-sm text-white hover:text-emerald-400 transition cursor-pointer"
                            title="คลิกเพื่อดูกราฟ CDC"
                          >
                            {pos.symbol}
                          </button>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
                            {pos.side}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block font-mono">
                          เข้าเมื่อ: {new Date(pos.entryTime).toLocaleTimeString('th-TH')}
                        </span>
                      </td>

                      {/* Shares Amount & Lots */}
                      <td className="py-3.5 px-3">
                        <div className="font-mono font-bold text-white text-xs">
                          {pos.amount.toLocaleString()} หุ้น
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({pos.lotsCount.toLocaleString()} Lots)
                        </span>
                      </td>

                      {/* Avg Entry Price */}
                      <td className="py-3.5 px-3 font-mono font-semibold text-slate-200">
                        ฿{pos.entryPrice.toFixed(2)}
                      </td>

                      {/* Live Market Price */}
                      <td className="py-3.5 px-3 font-mono font-bold text-white">
                        ฿{pos.livePrice.toFixed(2)}
                      </td>

                      {/* Total Market Value */}
                      <td className="py-3.5 px-3 font-mono font-bold text-purple-300">
                        ฿{pos.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Unrealized PnL */}
                      <td className="py-3.5 px-3">
                        <div
                          className={`font-mono font-bold flex items-center ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? '+' : ''}฿{pos.livePnlThb.toFixed(2)}
                          <span className="text-[10px] ml-1">
                            ({isPositive ? '+' : ''}{pos.livePnlPercent.toFixed(2)}%)
                          </span>
                        </div>
                        {pos.trailingStopPrice && (
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Trailing SL: ฿{pos.trailingStopPrice.toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Actions: View Chart / Close Position */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => onSelectStock(pos.symbol)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                            title="ดูกราฟ CDC Action Zone"
                          >
                            ดูกราฟ
                          </button>
                          <button
                            onClick={() => onClosePosition(pos.symbol, pos.livePrice)}
                            className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold transition cursor-pointer"
                            title="ปิดสถานะ / ขายหุ้นตัวนี้ทันที"
                          >
                            ขายทันที
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= 5. RISK MANAGEMENT & SETTINGS SUMMARY ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risk & Rules Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>กฎเกณฑ์ความปลอดภัย & การจัดการความเสี่ยง (Risk Management)</span>
          </div>
          <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
            <li>
              <b>Board Lot Enforcement:</b> ซื้อขายขั้นต่ำครั้งละ 100 หุ้นตามเกณฑ์ตลาดหลักทรัพย์แห่งประเทศไทย (SET)
            </li>
            <li>
              <b>Equal Weight Allocation:</b> กระจายเงินลงทุนเท่ากันต่อไม้ (แบ่งสล็อตละ {maxSlots > 0 ? (100 / maxSlots).toFixed(0) : 20}%)
            </li>
            <li>
              <b>Whipsaw Protection:</b> ระบบล็อคหุ้นที่เพิ่ง Stop Loss ไม่ให้ซื้อซ้ำจนกว่าจะเข้าโซนแดงจบรอบ
            </li>
          </ul>
        </div>

        {/* Closed Realized Stats Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>ผลการดำเนินงานสะสม (Historical Performance)</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">ออเดอร์ทั้งหมด</span>
              <span className="text-base font-bold text-white">{paperAccount.totalTrades}</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">ชนะ / แพ้</span>
              <span className="text-base font-bold text-emerald-400">
                {paperAccount.winningTrades} <span className="text-slate-500">/</span> <span className="text-rose-400">{paperAccount.losingTrades}</span>
              </span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">กำไรสะสม</span>
              <span
                className={`text-base font-bold ${
                  paperAccount.totalProfitUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {paperAccount.totalProfitUsdt >= 0 ? '+' : ''}฿{paperAccount.totalProfitUsdt.toFixed(0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
