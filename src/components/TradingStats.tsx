import React, { useState, useMemo } from 'react';
import { getStoredTradeHistory } from '../lib/botStore';
import { ExecutedTrade } from '../types';
import { formatCryptoPrice } from '../lib/bitkubApi';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Award,
  Calendar,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  DollarSign,
  Activity,
  Percent,
  Trash2,
} from 'lucide-react';

interface TradingStatsProps {
  trades?: ExecutedTrade[];
  onClearStats?: () => void;
}

export const TradingStats: React.FC<TradingStatsProps> = ({ trades: propTrades, onClearStats }) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ALL');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('ALL');
  const [selectedMode, setSelectedMode] = useState<string>('ALL');
  const [localTrades, setLocalTrades] = useState<ExecutedTrade[]>(() => getStoredTradeHistory());

  // Use props trades if provided, else local/stored trades
  const tradeHistory = propTrades !== undefined ? propTrades : localTrades;

  const handleClearClick = () => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลสถิติและประวัติการเทรดทั้งหมด? สถิติจะถูกรีเซ็ตเป็น 0')) {
      if (onClearStats) {
        onClearStats();
      } else {
        localStorage.removeItem('cdc_trade_history_v2');
        setLocalTrades([]);
      }
    }
  };

  // Get unique coins list dynamically
  const uniqueSymbols = useMemo(() => {
    const symbols = tradeHistory.map((t) => t.symbol);
    return ['ALL', ...Array.from(new Set(symbols))];
  }, [tradeHistory]);

  // Filter trades
  const filteredTrades = useMemo(() => {
    return tradeHistory.filter((t) => {
      // 1. Filter by symbol
      if (selectedSymbol !== 'ALL' && t.symbol !== selectedSymbol) return false;

      // 2. Filter by mode (PAPER / LIVE)
      if (selectedMode !== 'ALL' && t.mode !== selectedMode) return false;

      // 3. Filter by time
      if (selectedTimeframe !== 'ALL') {
        const now = Date.now();
        const tradeTime = t.timestamp;
        if (selectedTimeframe === 'TODAY') {
          const startOfToday = new Date().setHours(0, 0, 0, 0);
          if (tradeTime < startOfToday) return false;
        } else if (selectedTimeframe === '7D') {
          const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
          if (tradeTime < sevenDaysAgo) return false;
        } else if (selectedTimeframe === '30D') {
          const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
          if (tradeTime < thirtyDaysAgo) return false;
        }
      }

      return true;
    });
  }, [tradeHistory, selectedSymbol, selectedTimeframe, selectedMode]);

  // Extract trades that have closed PnL
  const closedTrades = useMemo(() => {
    return filteredTrades.filter((t) => t.pnlUsdt !== undefined);
  }, [filteredTrades]);

  // Compute metrics
  const stats = useMemo(() => {
    let totalPnl = 0;
    let winCount = 0;
    let lossCount = 0;
    let maxWin = 0;
    let maxLoss = 0;
    let totalWinUsdt = 0;
    let totalLossUsdt = 0;

    closedTrades.forEach((t) => {
      const pnl = t.pnlUsdt || 0;
      totalPnl += pnl;

      if (pnl > 0) {
        winCount++;
        totalWinUsdt += pnl;
        if (pnl > maxWin) maxWin = pnl;
      } else {
        lossCount++;
        totalLossUsdt += Math.abs(pnl);
        if (pnl < maxLoss) maxLoss = pnl;
      }
    });

    const totalTrades = closedTrades.length;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
    const profitFactor = totalLossUsdt > 0 ? totalWinUsdt / totalLossUsdt : totalWinUsdt > 0 ? 99.9 : 0;
    const averagePnl = totalTrades > 0 ? totalPnl / totalTrades : 0;

    return {
      totalPnl,
      totalTrades,
      winCount,
      lossCount,
      winRate,
      profitFactor,
      averagePnl,
      maxWin,
      maxLoss,
    };
  }, [closedTrades]);

  // Chart Data preparation: Cumulative profit over time
  const cumulativeChartData = useMemo(() => {
    // Sort oldest first for progression chart
    const sorted = [...closedTrades].sort((a, b) => a.timestamp - b.timestamp);
    let runningSum = 0;

    return sorted.map((t, index) => {
      runningSum += t.pnlUsdt || 0;
      return {
        tradeIndex: index + 1,
        date: new Date(t.timestamp).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' }),
        time: new Date(t.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        symbol: t.symbol,
        pnl: parseFloat(runningSum.toFixed(2)),
        tradePnl: t.pnlUsdt || 0,
      };
    });
  }, [closedTrades]);

  // Distribution chart data
  const distributionData = useMemo(() => {
    return [
      { name: 'เทรดที่ชนะ (Win)', value: stats.winCount, color: '#10b981' },
      { name: 'เทรดที่แพ้ (Loss)', value: stats.lossCount, color: '#f43f5e' },
    ];
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Filters Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">ตัวกรองสถิติการเทรด</h3>
          </div>

          <button
            type="button"
            onClick={handleClearClick}
            disabled={tradeHistory.length === 0}
            className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title="ล้างข้อมูลประวัติและสถิติการเทรดทั้งหมด"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>ล้างสถิติทั้งหมด</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* Coin Symbol Filter */}
          <div className="space-y-1">
            <label className="text-slate-400 font-medium flex items-center space-x-1.5 mb-1">
              <Coins className="w-3.5 h-3.5 text-slate-500" />
              <span>เลือกเหรียญ / คู่เทรด</span>
            </label>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">🪙 เหรียญทั้งหมด (All Coins)</option>
              {uniqueSymbols.filter(s => s !== 'ALL').map((sym) => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe Filter */}
          <div className="space-y-1">
            <label className="text-slate-400 font-medium flex items-center space-x-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>ระยะเวลาย้อนหลัง</span>
            </label>
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">📅 ทั้งหมด (All Time)</option>
              <option value="TODAY">☀️ วันนี้ (Today)</option>
              <option value="7D">⏳ 7 วันล่าสุด (Past 7 Days)</option>
              <option value="30D">🗓️ 30 วันล่าสุด (Past 30 Days)</option>
            </select>
          </div>

          {/* Mode Filter */}
          <div className="space-y-1">
            <label className="text-slate-400 font-medium flex items-center space-x-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-slate-500" />
              <span>โหมดบอท</span>
            </label>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">⚙️ ทุกโหมด (All Modes)</option>
              <option value="PAPER">🟢 Paper Trade (จำลอง)</option>
              <option value="BINANCE_LIVE">⚡ Live Trade (เงินจริง)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Overview Statistics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Profit Metric */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow flex flex-col justify-between space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>กำไร / ขาดทุนสุทธิ</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className={`text-xl sm:text-2xl font-extrabold ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}
            </div>
            <p className="text-[10px] text-slate-500">รวมทุกไม้ที่ปิดแล้วในขอบเขตการกรอง</p>
          </div>
        </div>

        {/* Win Rate Metric */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow flex flex-col justify-between space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>อัตราชนะ (Win Rate)</span>
            <Percent className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-white">
              {stats.winRate.toFixed(1)}%
            </div>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className="text-[10px] text-emerald-400 font-bold">{stats.winCount} ชนะ</span>
              <span className="text-[10px] text-slate-600">/</span>
              <span className="text-[10px] text-rose-400 font-bold">{stats.lossCount} แพ้</span>
            </div>
          </div>
        </div>

        {/* Profit Factor Metric */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow flex flex-col justify-between space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Profit Factor</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-white">
              {stats.profitFactor.toFixed(2)}
            </div>
            <p className="text-[10px] text-slate-500">อัตรากำไรต่อขาดทุนสะสม (เป้าหมาย &gt; 1.5)</p>
          </div>
        </div>

        {/* Total Trades Count */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow flex flex-col justify-between space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>จำนวนไม้ที่ปิด (Closed Trades)</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-extrabold text-white">
              {stats.totalTrades} ไม้
            </div>
            <p className="text-[10px] text-slate-500">เฉลี่ย PnL {stats.averagePnl >= 0 ? '+' : ''}${stats.averagePnl.toFixed(2)} / ไม้</p>
          </div>
        </div>
      </div>

      {/* Advanced Metrics & charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cumulative Profit Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg lg:col-span-2 space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center space-x-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>กราฟการเติบโตของกำไรสะสม (Cumulative Profit Curve)</span>
          </h4>

          {cumulativeChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
              ไม่มีข้อมูลประวัติไม้ที่ปิดเพื่อแสดงกราฟ
            </div>
          ) : (
            <div className="h-64 w-full text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                  <XAxis dataKey="tradeIndex" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    labelFormatter={(label) => `เทรดไม้ที่ #${label}`}
                    formatter={(value: any, name: any, props: any) => {
                      if (name === 'pnl') return [`$${value}`, 'กำไรสะสม'];
                      return [value, name];
                    }}
                  />
                  <Area type="monotone" dataKey="pnl" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPnl)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Win/Loss & Max win/loss summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center space-x-1.5">
              <span>สัดส่วนและขีดจำกัด (Win/Loss Profile)</span>
            </h4>

            {/* Visual ratio bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400 font-medium">
                <span>อัตราการชนะ</span>
                <span>{stats.winRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full flex overflow-hidden border border-slate-800">
                <div
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${stats.winRate}%` }}
                />
                <div
                  className="bg-rose-500 transition-all duration-500"
                  style={{ width: `${100 - stats.winRate}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>ชนะ {stats.winCount} ไม้</span>
                <span>แพ้ {stats.lossCount} ไม้</span>
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* Extremes metrics */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs">
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-slate-400">ไม้ที่ชนะสูงสุด</span>
                </div>
                <span className="text-xs font-bold text-emerald-400">+${stats.maxWin.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs">
                  <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-400">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-slate-400">ไม้ที่แพ้สูงสุด</span>
                </div>
                <span className="text-xs font-bold text-rose-400">-${Math.abs(stats.maxLoss).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[10px] text-slate-500 leading-relaxed">
            💡 **คำแนะนำ:** พยายามให้ค่าเฉลี่ยไม้ที่ชนะมีมูลค่ามากกว่าค่าเฉลี่ยไม้ที่แพ้ เพื่อช่วยพยุงพอร์ตในระยะยาว แม้ว่าอัตราชนะจะอยู่ที่ประมาณ 50% ก็ตาม
          </div>
        </div>
      </div>

      {/* Recents summary list */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h4 className="text-sm font-bold text-white flex items-center space-x-1.5">
            <span>ประวัติไม้ปิดตัวกรอง ({closedTrades.length} ล่าสุด)</span>
          </h4>
        </div>

        <div className="overflow-x-auto max-h-60 overflow-y-auto scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <th className="p-2.5">เวลาปิดไม้</th>
                <th className="p-2.5">เหรียญ</th>
                <th className="p-2.5">ฝั่ง</th>
                <th className="p-2.5">กำไร/ขาดทุน ($)</th>
                <th className="p-2.5">มูลค่าการเทรด</th>
                <th className="p-2.5">เหตุผล</th>
                <th className="p-2.5">โหมด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {closedTrades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500 font-sans">
                    ไม่พบประวัติปิดออเดอร์ภายใต้ตัวกรองปัจจุบัน
                  </td>
                </tr>
              ) : (
                [...closedTrades].reverse().slice(0, 10).map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="p-2.5 text-slate-400 font-sans">
                      {new Date(t.timestamp).toLocaleDateString('th-TH')} {new Date(t.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-2.5 font-bold text-white">{t.symbol}</td>
                    <td className="p-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        t.side.includes('LONG') || t.side === 'BUY'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {t.side}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className={`font-bold ${(t.pnlUsdt || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(t.pnlUsdt || 0) >= 0 ? '+' : ''}${(t.pnlUsdt || 0).toFixed(2)} ({t.pnlPercent ? `${t.pnlPercent >= 0 ? '+' : ''}${t.pnlPercent.toFixed(2)}%` : '-'})
                      </span>
                    </td>
                    <td className="p-2.5">${t.usdtValue.toFixed(2)}</td>
                    <td className="p-2.5 text-slate-400 font-sans">{t.reason}</td>
                    <td className="p-2.5">
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                        {t.mode}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
