import React, { useState } from 'react';
import { BotConfig, PaperAccount, PaperPosition, ExecutedTrade, Timeframe } from '../types';
import { formatCryptoPrice, formatCryptoAmount } from '../lib/bitkubApi';
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
  botLogs,
  onClearLogs,
}) => {
  const [configForm, setConfigForm] = useState<BotConfig>({ ...botConfig });
  const [isEditing, setIsEditing] = useState(false);
  const [manualPercent, setManualPercent] = useState<number>(botConfig.balancePercent || 25);

  // Active position for current symbol
  const activePos = paperAccount.activePositions.find((p) => p.symbol === botConfig.symbol);

  // Computed Manual Trade USDT amount based on selected percentage of portfolio
  const computedManualUsdt = (paperAccount.usdtBalance * manualPercent) / 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedConfig: BotConfig = {
      ...configForm,
      fastEmaPeriod: Number(configForm.fastEmaPeriod) || 12,
      slowEmaPeriod: Number(configForm.slowEmaPeriod) || 26,
      balancePercent: Number(configForm.balancePercent) || 20,
      tradeAmountUsdt: Number(configForm.tradeAmountUsdt) || 100,
      stopLossPercent: Number(configForm.stopLossPercent) || 0,
      takeProfitPercent: Number(configForm.takeProfitPercent) || 0,
      leverage: Math.min(Math.max(1, Number(configForm.leverage) || 1), 10),
    };
    onSaveConfig(sanitizedConfig);
    setConfigForm(sanitizedConfig);
    setIsEditing(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Column 1 & 2: Bot Strategy Configuration & Active Position */}
      <div className="lg:col-span-2 space-y-6">
        {/* Active Position / Quick Execution Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">สถานะการถือครองหุ้น ({botConfig.symbol})</h3>
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                botConfig.isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {botConfig.isActive
                ? `🟢 Bot Auto (${botConfig.scanMode === 'MULTI_SCAN' ? 'สแกนหุ้นทั้งหมด' : botConfig.symbol})`
                : '🔴 Bot ปิดการทำงาน'}
            </span>
          </div>

          {/* Trading Scope Mode Selector */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
            <label className="text-xs font-bold text-slate-200 block">
              โหมดการสแกนของบอท (Trading Scope Mode)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  const updated = { ...botConfig, scanMode: 'SINGLE' as const };
                  onSaveConfig(updated);
                  setConfigForm(updated);
                }}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between space-y-1 ${
                  (botConfig.scanMode ?? 'SINGLE') === 'SINGLE'
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-white font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>🎯 เล่นเฉพาะหุ้นปัจจุบัน</span>
                  {(botConfig.scanMode ?? 'SINGLE') === 'SINGLE' && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-extrabold">
                      ใช้งานอยู่
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 font-normal leading-normal">
                  เฝ้าระวังและส่งคำสั่งซื้อเฉพาะหุ้น {botConfig.symbol} ที่เลือกอยู่นี้เท่านั้น
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  const updated = { ...botConfig, scanMode: 'MULTI_SCAN' as const };
                  onSaveConfig(updated);
                  setConfigForm(updated);
                }}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between space-y-1 ${
                  botConfig.scanMode === 'MULTI_SCAN'
                    ? 'bg-blue-500/10 border-blue-500/50 text-white font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>🌐 สแกนเปิดออเดอร์หุ้นทุกตัวอัตโนมัติ</span>
                  {botConfig.scanMode === 'MULTI_SCAN' && (
                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-extrabold">
                      ใช้งานอยู่
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 font-normal leading-normal">
                  สแกนหุ้นทั้งหมดในตลาดและส่งคำสั่งเข้าซื้อทุกหุ้นที่เกิดสัญญาณ CDC
                </p>
              </button>
            </div>
          </div>



          {activePos ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 block">สถานะโพสิชันปัจจุบัน</span>
                  </div>
                  <span className={`text-lg font-extrabold font-mono ${activePos.side === 'SHORT' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {activePos.side} {activePos.symbol}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">กำไร/ขาดทุน (Unrealized PnL)</span>
                  <div
                    className={`text-lg font-extrabold font-mono flex items-center justify-end ${
                      activePos.currentPnlUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {activePos.currentPnlUsdt >= 0 ? (
                      <ArrowUpRight className="w-5 h-5 mr-1" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 mr-1" />
                    )}
                    ฿{activePos.currentPnlUsdt.toFixed(2)} ({activePos.currentPnlPercent.toFixed(2)}%)
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">ราคาเข้า (Entry)</span>
                  <span className="text-slate-200">{formatCryptoPrice(activePos.entryPrice)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">เงินลงทุน (Cost)</span>
                  <span className="text-emerald-400 font-bold">฿{(activePos.marginUsdt || activePos.usdtInvested).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">มูลค่าปัจจุบัน</span>
                  <span className="text-slate-200">
                    ฿{(activePos.amount * currentPrice).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-4 text-center space-y-1">
              <p className="text-xs text-slate-400">ยังไม่มีโพสิชันถือครองในหุ้น {botConfig.symbol}</p>
              <p className="text-[11px] text-slate-500">
                บอทจะส่งคำสั่งเข้าซื้อเมื่อเกิดสัญญาณ <span className="text-blue-400">ฟ้า/เขียว (Buy)</span>
              </p>
            </div>
          )}

          {/* Quick Manual Order Execution Controls with Portfolio % Slider */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <label className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>ส่งคำสั่งซื้อขายเอง (Manual Trade Execution)</span>
              </label>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">ยอดพอร์ตคงเหลือ:</span>
                <span className="font-mono text-xs font-bold text-emerald-400">
                  ฿{paperAccount.usdtBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB
                </span>
              </div>
            </div>

            {/* Slider & % Display */}
            <div className="space-y-2 bg-slate-900/80 p-3 rounded-lg border border-slate-800/60">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">กำหนดสัดส่วนเงินทุน (% ของพอร์ต):</span>
                <div className="text-right">
                  <span className="text-emerald-400 font-extrabold text-sm mr-1">{manualPercent}%</span>
                  <span className="text-slate-300">
                    (≈ ฿{computedManualUsdt.toFixed(2)} THB)
                  </span>
                </div>
              </div>

              {/* Range Slider */}
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={manualPercent}
                onChange={(e) => setManualPercent(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />

              {/* Quick Percent Buttons */}
              <div className="flex items-center justify-between gap-1.5 pt-1">
                {[10, 25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setManualPercent(pct)}
                    className={`flex-1 py-1 rounded text-[11px] font-bold font-mono transition border ${
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

            {/* CDC Exit Strategy Protection Notice */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2.5 flex items-start space-x-2 text-[11px] text-blue-200">
              <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="leading-normal">
                <span className="font-bold text-blue-300 block">การเฝ้าระวังขายออกตามกลยุทธ์ CDC Action Zone V2:</span>
                โพสิชัน Manual จะถูกเฝ้าระวังและขายออกอัตโนมัติเมื่อเกิดสัญญาณ CDC Exit Zone (
                <span className="text-amber-300 font-semibold">โซนเหลือง/แดง</span>) หรือเมื่อถึง Stop Loss ({botConfig.stopLossPercent}%) / Take Profit ({botConfig.takeProfitPercent}%)
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs">
                <span className="block text-[10px] text-slate-500">ราคา {botConfig.symbol}:</span>
                <span className="font-mono font-bold text-white text-sm">฿{currentPrice.toLocaleString()}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => onManualBuy(computedManualUsdt)}
                  className="flex items-center space-x-1 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition"
                  title={`ซื้อหุ้นด้วยเงิน ฿${computedManualUsdt.toFixed(2)} THB (${manualPercent}%)`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Manual BUY ({manualPercent}%)</span>
                </button>

                <button
                  type="button"
                  onClick={onManualSell}
                  disabled={!activePos}
                  className="flex items-center space-x-1 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title="ขายโพสิชันปัจจุบันทันที"
                >
                  <span>ขายหุ้น (Sell)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bot Strategy Configuration Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Sliders className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">ตั้งค่ากลยุทธ์ CDC Action Zone V2</h3>
            </div>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold rounded-lg border border-slate-700 transition"
              >
                แก้ไขพารามิเตอร์
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 bg-slate-800 text-slate-400 hover:text-white text-xs rounded-lg transition"
              >
                ยกเลิก
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
              {/* Bot Trading Timeframe */}
              <div>
                <label className="text-slate-300 font-medium block mb-1">ไทม์เฟรมกลยุทธ์บอท</label>
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

              {/* Fast EMA Period */}
              <div>
                <label className="text-slate-300 font-medium block mb-1">Fast EMA (เส้นเร็ว)</label>
                <input
                  type="number"
                  disabled={!isEditing}
                  value={configForm.fastEmaPeriod ?? ''}
                  onChange={(e) => setConfigForm({ ...configForm, fastEmaPeriod: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 disabled:opacity-60"
                />
              </div>

              {/* Slow EMA Period */}
              <div>
                <label className="text-slate-300 font-medium block mb-1">Slow EMA (เส้นช้า)</label>
                <input
                  type="number"
                  disabled={!isEditing}
                  value={configForm.slowEmaPeriod ?? ''}
                  onChange={(e) => setConfigForm({ ...configForm, slowEmaPeriod: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 disabled:opacity-60"
                />
              </div>

              {/* Stop Loss % */}
              <div>
                <label className="text-slate-300 font-medium block mb-1">Stop Loss Cut-Loss (%)</label>
                <input
                  type="number"
                  step="0.5"
                  disabled={!isEditing}
                  value={configForm.stopLossPercent ?? ''}
                  onChange={(e) => setConfigForm({ ...configForm, stopLossPercent: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 disabled:opacity-60"
                />
              </div>

              {/* Take Profit % */}
              <div>
                <label className="text-slate-300 font-medium block mb-1">Target Take Profit (%)</label>
                <input
                  type="number"
                  step="0.5"
                  disabled={!isEditing}
                  value={configForm.takeProfitPercent ?? ''}
                  onChange={(e) => setConfigForm({ ...configForm, takeProfitPercent: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 disabled:opacity-60"
                />
              </div>
            </div>



            {/* Position Sizing & Equal Weight Money Management */}
            <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>การจัดสรรเงินทุนต่อไม้ (Equal Weight Money Management)</span>
                </span>
                <span className="text-[11px] font-mono text-emerald-300/90 font-semibold">
                  {configForm.positionSizingMode === 'EQUAL_WEIGHT'
                    ? `แบ่งเท่ากันไม้ละ ≈ ฿${(
                        (paperAccount.usdtBalance +
                          paperAccount.activePositions.reduce((s, p) => s + (p.usdtInvested || 0), 0)) /
                        (configForm.maxOpenPositions || 5)
                      ).toFixed(2)} THB`
                    : configForm.positionSizingMode === 'PERCENT_EQUITY'
                    ? `ไม้ละ ${configForm.balancePercent}% ของพอร์ตรวม`
                    : `ไม้ละ ฿${configForm.tradeAmountUsdt} THB`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* Sizing Mode */}
                <div>
                  <label className="text-slate-300 font-medium block mb-1">รูปแบบการจัดสรรเงิน</label>
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

                {/* Max Concurrent Positions */}
                <div>
                  <label className="text-slate-300 font-medium block mb-1">จำนวนเหรียญถือสูงสุด (Slots)</label>
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
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 disabled:opacity-60"
                  />
                </div>

                {/* Dynamic Value Input */}
                {configForm.positionSizingMode === 'PERCENT_EQUITY' ? (
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">% ต่อนัด</label>
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
                    <label className="text-slate-300 font-medium block mb-1">เงินลงทุนต่อไม้ (THB)</label>
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
                    <label className="text-slate-400 font-medium block mb-1">สัดส่วนต่อหุ้นโดยประมาณ</label>
                    <div className="bg-slate-900 border border-slate-800/80 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold">
                      {Math.round(100 / (configForm.maxOpenPositions || 5))}% / ไม้
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Triggers Checkboxes */}
            <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium block mb-1.5">เงื่อนไขการเข้าซื้อ (Entry Signals)</span>
                <div className="space-y-1.5">
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
                    <span className="font-semibold text-blue-400">โซนฟ้า (Buy Trigger - แท่งฟ้าแรกหลังจุดตัด ⭐)</span>
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
                    <span className="font-semibold text-emerald-400">โซนเขียว (Green Confirmation - แท่งเขียวแรกคอนเฟิร์มตามลุงโฉลก ⭐)</span>
                  </label>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-medium block mb-1.5">เงื่อนไขการขายออก (Exit Signals)</span>
                <div className="space-y-1.5">
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
                    <span className="font-semibold text-rose-400">โซนแดง (Bearish Cash Out / Short คอนเฟิร์มแรก ⭐)</span>
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
                    <span className="text-amber-400">โซนเหลือง (Warning - เตือนพักตัว)</span>
                  </label>
                </div>
              </div>
            </div>

            {isEditing && (
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-lg transition"
              >
                บันทึกการตั้งค่าพารามิเตอร์
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Column 3: Live Bot Terminal Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between h-[520px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Bot Activity Console</h3>
          </div>
          <button
            onClick={onClearLogs}
            className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-800 transition"
            title="ล้างบันทึก"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Console Log Window */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 my-3 flex-1 overflow-y-auto space-y-2 font-mono text-[11px] text-slate-300 scrollbar-thin">
          {botLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 text-xs">
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
