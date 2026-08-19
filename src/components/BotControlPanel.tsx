import React, { useState } from 'react';
import { BotConfig, PaperAccount, PaperPosition, ExecutedTrade, Timeframe, StopLossLockInfo } from '../types';
import { formatStockPrice, formatStockAmount } from '../lib/stockApi';
import {
  Play,
  Pause,
  Sliders,
  Terminal,
  Shield,
  Zap,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  Unlock,
  Layers,
  Percent,
  Flame,
  Clock,
  Sparkles,
  RefreshCw,
  Info,
} from 'lucide-react';

interface BotControlPanelProps {
  botConfig: BotConfig;
  paperAccount: PaperAccount;
  currentPrice: number;
  onSaveConfig: (updated: BotConfig) => void;
  onToggleBot: () => void;
  onManualBuy: (customAmountUsdt?: number) => void;
  onManualShort?: (customAmountUsdt?: number) => void;
  onManualSell: () => void;
  onUnlockSymbol?: (symbol: string) => void;
  botLogs: string[];
  onClearLogs: () => void;
}

export const BotControlPanel: React.FC<BotControlPanelProps> = ({
  botConfig,
  paperAccount,
  currentPrice,
  onSaveConfig,
  onToggleBot,
  onManualBuy,
  onManualShort,
  onManualSell,
  onUnlockSymbol,
  botLogs,
  onClearLogs,
}) => {
  const [configForm, setConfigForm] = useState<BotConfig>({ ...botConfig });
  const [isEditing, setIsEditing] = useState(false);
  const [manualPercent, setManualPercent] = useState<number>(botConfig.balancePercent || 20);

  // Active position for current symbol
  const activePos = paperAccount.activePositions.find((p) => p.symbol === botConfig.symbol);

  // Computed Portfolio Equity & Allocation
  const totalPositionsValue = paperAccount.activePositions.reduce(
    (sum, p) => sum + (p.usdtInvested || p.marginUsdt || 0),
    0
  );
  const totalEquity = paperAccount.usdtBalance + totalPositionsValue;
  const maxSlots = Math.max(1, Math.min(20, configForm.maxOpenPositions || 5));
  const equalWeightPerSlot = totalEquity / maxSlots;

  // Computed Manual Trade USDT amount based on selected percentage of portfolio
  const computedManualUsdt = (paperAccount.usdtBalance * manualPercent) / 100;

  // Active Stop Loss Locked symbols
  const lockedSymbolsList: StopLossLockInfo[] = Object.values(botConfig.stopLossLocks || {}) as StopLossLockInfo[];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedConfig: BotConfig = {
      ...configForm,
      fastEmaPeriod: Number(configForm.fastEmaPeriod) || 12,
      slowEmaPeriod: Number(configForm.slowEmaPeriod) || 26,
      balancePercent: Number(configForm.balancePercent) || 20,
      tradeAmountUsdt: Number(configForm.tradeAmountUsdt) || 10000,
      maxOpenPositions: Math.max(1, Math.min(20, Number(configForm.maxOpenPositions) || 5)),
      stopLossPercent: Number(configForm.stopLossPercent) || 0,
      takeProfitPercent: Number(configForm.takeProfitPercent) || 0,
      trailingStopPercent: Number(configForm.trailingStopPercent) || 3,
      useTrailingStop: Boolean(configForm.useTrailingStop),
      useStopLossLock: configForm.useStopLossLock !== false,
      leverage: Math.min(Math.max(1, Number(configForm.leverage) || 1), 10),
    };
    onSaveConfig(sanitizedConfig);
    setConfigForm(sanitizedConfig);
    setIsEditing(false);
  };

  const handleUnlock = (symbol: string) => {
    if (onUnlockSymbol) {
      onUnlockSymbol(symbol);
    } else {
      const updatedLocks = { ...(botConfig.stopLossLocks || {}) };
      delete updatedLocks[symbol];
      onSaveConfig({ ...botConfig, stopLossLocks: updatedLocks });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Column 1 & 2: Bot Strategy Configuration & Active Position */}
      <div className="lg:col-span-2 space-y-6">
        {/* ================= 1. ACTIVE POSITION / QUICK TRADE EXECUTION ================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center space-x-2.5">
              <Zap className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-black text-white">
                สถานะการถือครองหุ้น ({botConfig.symbol})
              </h3>
            </div>
            <span
              className={`text-xs px-3 py-1 rounded-full font-bold border transition ${
                botConfig.isActive
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm animate-pulse'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {botConfig.isActive
                ? `🟢 Bot Auto Active (${botConfig.scanMode === 'MULTI_SCAN' ? 'สแกนหุ้นทั้งหมด' : botConfig.symbol})`
                : '🔴 Bot ปิดการทำงาน'}
            </span>
          </div>

          {/* Active Position Card Details */}
          {activePos ? (
            <div className="bg-slate-950/90 border border-emerald-500/40 rounded-2xl p-4.5 space-y-3.5 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs font-mono">
                    {activePos.side}
                  </span>
                  <span className="text-base font-black text-white font-mono">{activePos.symbol}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">กำไร/ขาดทุนปัจจุบัน (Unrealized PnL):</span>
                  <span
                    className={`text-base font-black font-mono ${
                      activePos.currentPnlUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {activePos.currentPnlUsdt >= 0 ? '+' : ''}
                    {formatStockPrice(activePos.currentPnlUsdt)} ({activePos.currentPnlPercent >= 0 ? '+' : ''}
                    {activePos.currentPnlPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">ราคาเข้า (Entry)</span>
                  <span className="text-white font-bold">{formatStockPrice(activePos.entryPrice)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">จำนวนหุ้น (Shares)</span>
                  <span className="text-white font-bold">{activePos.amount.toLocaleString()} หุ้น</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">เงินลงทุน (Capital)</span>
                  <span className="text-white font-bold">{formatStockPrice(activePos.usdtInvested)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">ราคาสูงสุดที่ทำได้</span>
                  <span className="text-emerald-300 font-bold">
                    {formatStockPrice(activePos.highestPriceSinceEntry || activePos.entryPrice)}
                  </span>
                </div>
              </div>

              {/* Trailing Stop Dynamic Monitor */}
              {botConfig.useTrailingStop && activePos.trailingStopPrice && (
                <div className="bg-purple-950/40 border border-purple-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center space-x-1.5 text-purple-300">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>Trailing Stop Trigger (-{botConfig.trailingStopPercent}%):</span>
                  </div>
                  <span className="text-purple-300 font-bold">
                    {formatStockPrice(activePos.trailingStopPrice)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-2xl p-4 text-center space-y-1">
              <p className="text-xs text-slate-400 font-medium">ยังไม่มีโพสิชันถือครองในหุ้น {botConfig.symbol}</p>
              <p className="text-[11px] text-slate-500">
                บอทจะส่งคำสั่งเข้าซื้อเมื่อเกิดสัญญาณ <span className="text-blue-400 font-bold">ฟ้า/เขียว (Buy)</span> ตามระบบ
              </p>
            </div>
          )}

          {/* Quick Manual Trade Slider */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4.5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <label className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>ส่งคำสั่งซื้อขายเอง (Manual Trade Execution)</span>
              </label>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">เงินสดคงเหลือ:</span>
                <span className="font-mono text-xs font-bold text-emerald-400">
                  {formatStockPrice(paperAccount.usdtBalance)}
                </span>
              </div>
            </div>

            {/* Slider */}
            <div className="space-y-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800/60">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">สัดส่วนเงินทุน (% ของเงินสดคงเหลือ):</span>
                <div className="text-right">
                  <span className="text-emerald-400 font-black text-sm mr-1">{manualPercent}%</span>
                  <span className="text-slate-300">(≈ {formatStockPrice(computedManualUsdt)})</span>
                </div>
              </div>

              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={manualPercent}
                onChange={(e) => setManualPercent(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />

              <div className="flex items-center justify-between gap-1.5 pt-1">
                {[10, 20, 25, 50, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setManualPercent(pct)}
                    className={`flex-1 py-1 rounded-lg text-[11px] font-bold font-mono transition border cursor-pointer ${
                      manualPercent === pct
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs">
                <span className="block text-[10px] text-slate-500">ราคา {botConfig.symbol}:</span>
                <span className="font-mono font-bold text-white text-sm">
                  {formatStockPrice(currentPrice)}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => onManualBuy(computedManualUsdt)}
                  className="flex items-center space-x-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl text-xs shadow-lg transition cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Manual BUY ({manualPercent}%)</span>
                </button>
                <button
                  type="button"
                  onClick={onManualSell}
                  disabled={!activePos}
                  className="flex items-center space-x-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>ขายหุ้น (Sell)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 2. MAX OPEN POSITIONS SLOTS VISUALIZER ================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <Layers className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-base font-black text-white">
                  Max Open Positions Slots ({paperAccount.activePositions.length}/{maxSlots} Slots)
                </h3>
                <p className="text-[11px] text-slate-400">
                  ระบบจำกัดจำนวนหุ้นที่ถือครองพร้อมกัน ป้องกันเงินทุนจม และกระจายความเสี่ยงอย่างสมดุล
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-cyan-400">
              พอร์ตรวม: {formatStockPrice(totalEquity)}
            </span>
          </div>

          {/* Slots Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {Array.from({ length: maxSlots }).map((_, index) => {
              const pos = paperAccount.activePositions[index];

              if (pos) {
                return (
                  <div
                    key={index}
                    className="bg-emerald-950/30 border border-emerald-500/50 rounded-2xl p-3 space-y-1.5 transition hover:scale-[1.02]"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-white font-mono">{pos.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 font-black">
                        Slot {index + 1}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono font-bold text-slate-300">
                      {formatStockPrice(pos.usdtInvested)}
                    </div>
                    <div
                      className={`text-[10px] font-mono font-extrabold ${
                        pos.currentPnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {pos.currentPnlPercent >= 0 ? '+' : ''}
                      {pos.currentPnlPercent.toFixed(1)}%
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={index}
                  className="bg-slate-950/60 border border-slate-800/80 border-dashed rounded-2xl p-3 space-y-1 text-center flex flex-col justify-center items-center"
                >
                  <span className="text-[10px] text-slate-500 font-bold">Slot {index + 1} (ว่าง)</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ≈ {formatStockPrice(equalWeightPerSlot)}
                  </span>
                  <span className="text-[9px] text-slate-600 font-mono">
                    ({Math.round(100 / maxSlots)}% พอร์ต)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= 3. STOP LOSS LOCK & WHIPSAW PROTECTION ================= */}
        {lockedSymbolsList.length > 0 && (
          <div className="bg-rose-950/20 border border-rose-500/40 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-2.5">
              <div className="flex items-center space-x-2 text-rose-400 text-xs font-black">
                <Lock className="w-4 h-4" />
                <span>Stop Loss Lock & Whipsaw Protection (หุ้นที่ถูกล็อกการเข้าซื้อซ้ำ)</span>
              </div>
              <span className="text-[11px] text-rose-300/80 font-mono">
                {lockedSymbolsList.length} รายการถูกล็อก
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              หุ้นต่อไปนี้เพิ่งแตะจุด Stop Loss ในรอบปัจจุบัน ระบบล็อกไม่ให้เข้าซื้อซ้ำเพื่อป้องกันการโดนหลอก (Whipsaw)
              และจะปลดล็อกอัตโนมัติเมื่อเกิดรอบสัญญาณ CDC ใหม่ (หรือกดปลดล็อกด้วยตนเอง):
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {lockedSymbolsList.map((lock) => (
                <div
                  key={lock.symbol}
                  className="flex items-center space-x-2 bg-slate-900 border border-rose-500/40 px-3 py-1.5 rounded-xl text-xs font-mono"
                >
                  <span className="font-bold text-white">{lock.symbol}</span>
                  <span className="text-[10px] text-rose-400">@ ฿{lock.triggerPrice.toFixed(2)}</span>
                  <button
                    onClick={() => handleUnlock(lock.symbol)}
                    className="p-1 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-slate-950 transition flex items-center space-x-1 cursor-pointer text-[10px] font-bold"
                    title={`ปลดล็อก ${lock.symbol}`}
                  >
                    <Unlock className="w-3 h-3" />
                    <span>ปลดล็อก</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= 4. BOT STRATEGY CONFIGURATION FORM ================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <Sliders className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-black text-white">
                ตั้งค่ากลยุทธ์ CDC Action Zone V2 & Risk Engine
              </h3>
            </div>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer"
              >
                แก้ไขพารามิเตอร์
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-1.5 bg-slate-800 text-slate-400 hover:text-white text-xs rounded-xl transition cursor-pointer"
              >
                ยกเลิก
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Row 1: Timeframe, EMAs, SL, TP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">ไทม์เฟรมบอท</label>
                <select
                  disabled={!isEditing}
                  value={configForm.timeframe || '1d'}
                  onChange={(e) => setConfigForm({ ...configForm, timeframe: e.target.value as Timeframe })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-bold font-mono focus:border-emerald-500 disabled:opacity-60"
                >
                  <option value="15m">15m</option>
                  <option value="1h">1H</option>
                  <option value="4h">4H</option>
                  <option value="1d">1D (แนะนำ ⭐)</option>
                  <option value="1w">1W</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Fast EMA (เส้นเร็ว)</label>
                <input
                  type="number"
                  disabled={!isEditing}
                  value={configForm.fastEmaPeriod ?? ''}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      fastEmaPeriod: e.target.value === '' ? ('' as any) : Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Slow EMA (เส้นช้า)</label>
                <input
                  type="number"
                  disabled={!isEditing}
                  value={configForm.slowEmaPeriod ?? ''}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      slowEmaPeriod: e.target.value === '' ? ('' as any) : Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Stop Loss Cut (%)</label>
                <input
                  type="number"
                  step="0.5"
                  disabled={!isEditing}
                  value={configForm.stopLossPercent ?? ''}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      stopLossPercent: e.target.value === '' ? ('' as any) : Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-rose-400 font-bold font-mono focus:border-emerald-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Take Profit Target (%)</label>
                <input
                  type="number"
                  step="0.5"
                  disabled={!isEditing}
                  value={configForm.takeProfitPercent ?? ''}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      takeProfitPercent: e.target.value === '' ? ('' as any) : Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-bold font-mono focus:border-emerald-500 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Position Sizing & Equal Weight Section */}
            <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800/80 pb-2">
                <span className="text-xs font-black text-emerald-400 flex items-center space-x-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>การจัดสรรเงินทุนต่อไม้ (Equal Weight Sizing Engine)</span>
                </span>
                <span className="text-xs font-mono text-emerald-300 font-bold">
                  {configForm.positionSizingMode === 'EQUAL_WEIGHT'
                    ? `แบ่งเท่ากันไม้ละ ≈ ${formatStockPrice(equalWeightPerSlot)} (${Math.round(100 / maxSlots)}% พอร์ต)`
                    : configForm.positionSizingMode === 'PERCENT_EQUITY'
                    ? `ไม้ละ ${configForm.balancePercent}% ของพอร์ตรวม`
                    : `ไม้ละ ฿${configForm.tradeAmountUsdt} THB`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">รูปแบบการจัดสรรเงิน</label>
                  <select
                    disabled={!isEditing}
                    value={configForm.positionSizingMode || 'EQUAL_WEIGHT'}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        positionSizingMode: e.target.value as any,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 disabled:opacity-60"
                  >
                    <option value="EQUAL_WEIGHT">ถัวเฉลี่ยเท่ากันทุกไม้ (Equal Weight ⭐ แนะนำ)</option>
                    <option value="PERCENT_EQUITY">% ของมูลค่าพอร์ตรวม (Total Equity %)</option>
                    <option value="FIXED_USDT">ระบุเงินบาทคงที่ (Fixed THB)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">
                    จำนวนหุ้นถือสูงสุด (Max Slots: 1–20)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    disabled={!isEditing}
                    value={configForm.maxOpenPositions ?? 5}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        maxOpenPositions: e.target.value === '' ? ('' as any) : Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-cyan-400 font-bold font-mono focus:border-emerald-500 disabled:opacity-60"
                  />
                </div>

                {configForm.positionSizingMode === 'PERCENT_EQUITY' ? (
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">% ต่อนัด</label>
                    <input
                      type="number"
                      disabled={!isEditing}
                      value={configForm.balancePercent ?? ''}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          balancePercent: e.target.value === '' ? ('' as any) : Number(e.target.value),
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 disabled:opacity-60"
                    />
                  </div>
                ) : configForm.positionSizingMode === 'FIXED_USDT' ? (
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">เงินลงทุนต่อไม้ (THB)</label>
                    <input
                      type="number"
                      disabled={!isEditing}
                      value={configForm.tradeAmountUsdt ?? ''}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          tradeAmountUsdt: e.target.value === '' ? ('' as any) : Number(e.target.value),
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 disabled:opacity-60"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">สัดส่วนต่อหุ้นอัตโนมัติ</label>
                    <div className="bg-slate-900 border border-slate-800/80 rounded-xl px-3 py-2 text-emerald-400 font-mono font-black">
                      {Math.round(100 / maxSlots)}% ต่อ 1 ไม้ (เป๊ะ)
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Trailing Stop & Whipsaw Protection Controls */}
            <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl space-y-3.5">
              <span className="text-xs font-black text-purple-400 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Trailing Stop & Whipsaw Protection Engines</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Trailing Stop */}
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-2">
                  <label className="flex items-center space-x-2 text-slate-200 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isEditing}
                      checked={configForm.useTrailingStop}
                      onChange={(e) => setConfigForm({ ...configForm, useTrailingStop: e.target.checked })}
                      className="rounded bg-slate-950 border-slate-700 text-purple-500 focus:ring-0"
                    />
                    <span>เปิดใช้ Trailing Stop (ล็อกกำไรสูงสุดตามการวิ่งของราคา)</span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    เลื่อนจุดตัดขาดทุนขึ้นตามราคาสูงสุด และปิดทำกำไรเมื่อราคาย่อตัวลงมาตาม % ที่ตั้งไว้
                  </p>
                  {configForm.useTrailingStop && (
                    <div className="flex items-center space-x-2 pt-1 font-mono">
                      <span className="text-slate-400 text-[11px]">Trailing %:</span>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="20"
                        disabled={!isEditing}
                        value={configForm.trailingStopPercent ?? 3}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, trailingStopPercent: Number(e.target.value) })
                        }
                        className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-purple-300 font-bold"
                      />
                      <span className="text-slate-500 text-[11px]">% จากจุดสูงสุด</span>
                    </div>
                  )}
                </div>

                {/* Stop Loss Lock */}
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-2">
                  <label className="flex items-center space-x-2 text-slate-200 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isEditing}
                      checked={configForm.useStopLossLock !== false}
                      onChange={(e) => setConfigForm({ ...configForm, useStopLossLock: e.target.checked })}
                      className="rounded bg-slate-950 border-slate-700 text-rose-500 focus:ring-0"
                    />
                    <span>เปิดใช้ Stop Loss Lock (Whipsaw Protection)</span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    ล็อกหุ้นที่โดน Stop Loss ไม่ให้เข้าซื้อซ้ำในรอบเดิม ป้องกันการโดนสับขาหลอกซ้ำๆ
                  </p>
                </div>
              </div>
            </div>

            {/* Triggers Checkboxes */}
            <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-bold block mb-2">เงื่อนไขการเข้าซื้อ (Entry Signals)</span>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isEditing}
                      checked={configForm.buyOnSignal.includes('BLUE')}
                      onChange={(e) => {
                        const newBuy = e.target.checked
                          ? [...configForm.buyOnSignal, 'BLUE' as const]
                          : configForm.buyOnSignal.filter((s) => s !== 'BLUE');
                        setConfigForm({ ...configForm, buyOnSignal: newBuy });
                      }}
                      className="rounded bg-slate-950 border-slate-700 text-blue-500 focus:ring-0"
                    />
                    <span className="font-bold text-blue-400">โซนฟ้า (Buy Trigger - แท่งฟ้าแรก ⭐)</span>
                  </label>
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isEditing}
                      checked={configForm.buyOnSignal.includes('GREEN')}
                      onChange={(e) => {
                        const newBuy = e.target.checked
                          ? [...configForm.buyOnSignal, 'GREEN' as const]
                          : configForm.buyOnSignal.filter((s) => s !== 'GREEN');
                        setConfigForm({ ...configForm, buyOnSignal: newBuy });
                      }}
                      className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <span className="font-bold text-emerald-400">โซนเขียว (Green Run Trend ⭐)</span>
                  </label>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-bold block mb-2">เงื่อนไขการขายออก (Exit Signals)</span>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isEditing}
                      checked={configForm.sellOnSignal.includes('RED')}
                      onChange={(e) => {
                        const newSell = e.target.checked
                          ? [...configForm.sellOnSignal, 'RED' as const]
                          : configForm.sellOnSignal.filter((s) => s !== 'RED');
                        setConfigForm({ ...configForm, sellOnSignal: newSell });
                      }}
                      className="rounded bg-slate-950 border-slate-700 text-rose-500 focus:ring-0"
                    />
                    <span className="font-bold text-rose-400">โซนแดง (Bearish Cash Out ⭐)</span>
                  </label>
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isEditing}
                      checked={configForm.sellOnSignal.includes('YELLOW')}
                      onChange={(e) => {
                        const newSell = e.target.checked
                          ? [...configForm.sellOnSignal, 'YELLOW' as const]
                          : configForm.sellOnSignal.filter((s) => s !== 'YELLOW');
                        setConfigForm({ ...configForm, sellOnSignal: newSell });
                      }}
                      className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <span className="text-amber-400 font-bold">โซนเหลือง (Warning เตือนระวัง)</span>
                  </label>
                </div>
              </div>
            </div>

            {isEditing && (
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-2xl font-black text-xs shadow-lg transition cursor-pointer"
              >
                บันทึกการตั้งค่าพารามิเตอร์ทั้งหมด
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Column 3: Live Bot Terminal Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between h-[600px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-black text-white">Bot Activity Console</h3>
          </div>
          <button
            onClick={onClearLogs}
            className="text-slate-500 hover:text-slate-300 p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
            title="ล้างบันทึก"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Console Log Window */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 my-3 flex-1 overflow-y-auto space-y-2 font-mono text-[11px] text-slate-300 scrollbar-thin">
          {botLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 text-xs font-bold">
              ยังไม่มีบันทึกกิจกรรมบอท
            </div>
          ) : (
            botLogs.map((log, idx) => (
              <div
                key={idx}
                className={`leading-relaxed border-b border-slate-900/60 pb-1 ${
                  log.includes('BUY') || log.includes('ซื้อ')
                    ? 'text-emerald-400'
                    : log.includes('SELL') || log.includes('ขาย')
                    ? 'text-rose-400'
                    : log.includes('LOCK')
                    ? 'text-rose-300 font-bold'
                    : log.includes('UNLOCK')
                    ? 'text-cyan-300 font-bold'
                    : log.includes('TRAILING') || log.includes('Trailing')
                    ? 'text-purple-400 font-bold'
                    : log.includes('BLUE')
                    ? 'text-blue-400'
                    : log.includes('GREEN')
                    ? 'text-emerald-300'
                    : log.includes('YELLOW')
                    ? 'text-amber-400'
                    : 'text-slate-300'
                }`}
              >
                {log}
              </div>
            ))
          )}
        </div>

        <div className="text-[10px] text-slate-500 flex items-center justify-between">
          <span>ตรวจสอบสัญญาณ CDC ทุกๆ 10 วินาที</span>
          <span>โหมด: {botConfig.mode}</span>
        </div>
      </div>
    </div>
  );
};
