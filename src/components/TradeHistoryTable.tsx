import React, { useState } from 'react';
import { ExecutedTrade, PaperPosition, BitkubTicker24h } from '../types';
import { History, Download, Trash2, ArrowUpRight, ArrowDownRight, Search, Activity, XCircle } from 'lucide-react';
import { formatCryptoPrice, formatCryptoAmount } from '../lib/bitkubApi';

interface TradeHistoryTableProps {
  trades: ExecutedTrade[];
  onClearHistory: () => void;
  activePositions?: PaperPosition[];
  onClosePosition?: (symbol: string) => void;
  allTickers?: BitkubTicker24h[];
}

export const TradeHistoryTable: React.FC<TradeHistoryTableProps> = ({
  trades,
  onClearHistory,
  activePositions = [],
  onClosePosition,
  allTickers = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSide, setFilterSide] = useState<'ALL' | 'LONG' | 'SHORT' | 'CLOSE'>('ALL');

  const filteredTrades = trades.filter((t) => {
    const matchesSymbol = t.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSymbol) return false;

    if (filterSide === 'ALL') return true;

    const reasonLower = (t.reason || '').toLowerCase();
    const isClose = t.side === 'CLOSE_LONG' || t.side === 'CLOSE_SHORT' || reasonLower.includes('close') || reasonLower.includes('exit');

    if (filterSide === 'CLOSE') return isClose;
    if (filterSide === 'LONG') return !isClose && (t.side === 'LONG' || t.side === 'BUY');
    if (filterSide === 'SHORT') return !isClose && (t.side === 'SHORT' || t.side === 'SELL');

    return true;
  });

  // Calculate Total Realtime PnL across all active open positions
  const totalInvested = activePositions.reduce((sum, pos) => sum + pos.usdtInvested, 0);
  const totalUnrealizedPnlUsdt = activePositions.reduce((sum, pos) => sum + (pos.currentPnlUsdt || 0), 0);
  const totalUnrealizedPnlPercent = totalInvested > 0 ? (totalUnrealizedPnlUsdt / totalInvested) * 100 : 0;

  const renderSideBadge = (side: string, reason: string) => {
    const rLower = (reason || '').toLowerCase();
    const isClose = side === 'CLOSE_LONG' || side === 'CLOSE_SHORT' || rLower.includes('close') || rLower.includes('exit');

    if (isClose) {
      const isShortClose = side === 'CLOSE_SHORT' || rLower.includes('short');
      if (isShortClose) {
        return (
          <span className="px-2 py-0.5 rounded font-extrabold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            CLOSE SHORT
          </span>
        );
      }
      return (
        <span className="px-2 py-0.5 rounded font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30">
          CLOSE LONG
        </span>
      );
    }

    if (side === 'SHORT' || side === 'SELL') {
      return (
        <span className="px-2 py-0.5 rounded font-extrabold bg-purple-500/20 text-purple-400 border border-purple-500/30">
          SHORT
        </span>
      );
    }

    return (
      <span className="px-2 py-0.5 rounded font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        LONG
      </span>
    );
  };

  const exportCsv = () => {
    if (trades.length === 0) return;
    const headers = ['ID', 'Date', 'Symbol', 'Timeframe', 'Side', 'Price', 'Amount', 'THB Value', 'PnL (฿)', 'Reason', 'Mode'];
    const rows = trades.map((t) => [
      t.id,
      new Date(t.timestamp).toLocaleString('th-TH'),
      t.symbol,
      t.timeframe,
      t.side,
      t.price,
      t.amount,
      t.usdtValue,
      t.pnlUsdt ?? 0,
      `"${t.reason}"`,
      t.mode,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CDC_Trade_History_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Active Open Positions & Real-time PnL Banner */}
      {activePositions.length > 0 && (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
              <h3 className="text-base font-bold text-white">
                โพซิชันที่กำลังเปิดอยู่ (Active Open Positions - {activePositions.length} ไม้)
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              <span className="text-slate-400">
                เงินลงทุนรวม: <strong className="text-slate-100">฿{totalInvested.toFixed(2)} THB</strong>
              </span>
              <div
                className={`px-3 py-1.5 rounded-xl font-extrabold flex items-center space-x-1.5 border shadow-sm ${
                  totalUnrealizedPnlUsdt >= 0
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}
              >
                <span>กำไร/ขาดทุน Realtime ทั้งหมด:</span>
                <span className="text-sm">
                  {totalUnrealizedPnlUsdt >= 0 ? '+' : ''}฿{totalUnrealizedPnlUsdt.toFixed(2)} (
                  {totalUnrealizedPnlPercent >= 0 ? '+' : ''}
                  {totalUnrealizedPnlPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-72 overflow-y-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="p-2.5">เหรียญ</th>
                  <th className="p-2.5">ฝั่ง</th>
                  <th className="p-2.5">ราคาเข้า (Entry)</th>
                  <th className="p-2.5">ราคาปัจจุบัน</th>
                  <th className="p-2.5">เงินลงทุน (Cost)</th>
                  <th className="p-2.5">กำไร/ขาดทุน Realtime</th>
                  <th className="p-2.5 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {activePositions.map((pos) => {
                  const ticker = (allTickers || []).find((t) => t.symbol === pos.symbol);
                  const livePrice = ticker ? ticker.lastPrice : pos.entryPrice;
                  const pnlUsdt = pos.currentPnlUsdt ?? 0;
                  const pnlPercent = pos.currentPnlPercent ?? 0;
                  const margin = pos.marginUsdt || pos.usdtInvested;
                  const lev = pos.leverage || 1;

                  return (
                    <tr key={pos.symbol} className="hover:bg-slate-800/50">
                      <td className="p-2.5 font-bold text-white text-sm">{pos.symbol}</td>
                      <td className="p-2.5 flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded font-extrabold text-[11px] border ${
                            pos.side === 'SHORT'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {pos.side}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-300">{formatCryptoPrice(pos.entryPrice)}</td>
                      <td className="p-2.5 font-bold text-white">{formatCryptoPrice(livePrice > 0 ? livePrice : pos.entryPrice)}</td>
                      <td className="p-2.5 text-emerald-400 font-bold">฿{margin.toFixed(2)}</td>
                      <td className="p-2.5">
                        <div
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg font-extrabold border shadow-sm ${
                            pnlUsdt >= 0
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                          }`}
                        >
                          {pnlUsdt >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          <span>
                            {pnlUsdt >= 0 ? '+' : ''}฿{pnlUsdt.toFixed(2)} ({pnlPercent >= 0 ? '+' : ''}
                            {pnlPercent.toFixed(2)}%)
                          </span>
                        </div>
                      </td>
                      <td className="p-2.5 text-right">
                        {onClosePosition && (
                          <button
                            onClick={() => onClosePosition(pos.symbol)}
                            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ml-auto"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>ปิดสัญญา</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Trade History Log Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        {/* Header & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">ประวัติการส่งคำสั่งซื้อขาย (Trade History Log)</h3>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={exportCsv}
              disabled={trades.length === 0}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ส่งออก CSV</span>
            </button>
            <button
              onClick={onClearHistory}
              disabled={trades.length === 0}
              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-slate-800 transition disabled:opacity-40"
              title="ล้างประวัติ"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex space-x-2">
            {(['ALL', 'LONG', 'SHORT', 'CLOSE'] as const).map((side) => (
              <button
                key={side}
                onClick={() => setFilterSide(side)}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  filterSide === side
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white bg-slate-950'
                }`}
              >
                {side === 'ALL'
                  ? 'ทั้งหมด'
                  : side === 'LONG'
                  ? 'LONG'
                  : side === 'SHORT'
                  ? 'SHORT'
                  : 'ปิดสัญญา (CLOSE)'}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="ค้นหาชื่อเหรียญ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 w-44"
          />
        </div>

        {/* History Table */}
        <div className="overflow-x-auto max-h-96 overflow-y-auto scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <th className="p-2.5">เวลา</th>
                <th className="p-2.5">เหรียญ</th>
                <th className="p-2.5">ฝั่ง</th>
                <th className="p-2.5">ราคา</th>
                <th className="p-2.5">จำนวน</th>
                <th className="p-2.5">มูลค่า (THB)</th>
                <th className="p-2.5">PnL Realtime (฿)</th>
                <th className="p-2.5">เหตุผล</th>
                <th className="p-2.5">โหมด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-500 font-sans">
                    ไม่พบประวัติออเดอร์
                  </td>
                </tr>
              ) : (
                filteredTrades.map((t, idx) => {
                  // Check if this trade corresponds to a currently open active position
                  const activePosForTrade = activePositions.find(
                    (p) =>
                      p.symbol === t.symbol &&
                      (p.side === t.side ||
                        (p.side === 'LONG' && t.side === 'BUY') ||
                        (p.side === 'SHORT' && t.side === 'SELL'))
                  );

                  return (
                    <tr key={t.id ? `${t.id}_${idx}` : `trade_${idx}`} className="hover:bg-slate-800/40">
                      <td className="p-2.5 text-slate-400 font-sans">
                        {new Date(t.timestamp).toLocaleTimeString('th-TH')}
                      </td>
                      <td className="p-2.5 font-bold text-white">{t.symbol}</td>
                      <td className="p-2.5">{renderSideBadge(t.side, t.reason)}</td>
                      <td className="p-2.5 font-bold text-white">{formatCryptoPrice(t.price)}</td>
                      <td className="p-2.5 font-mono">{formatCryptoAmount(t.amount)}</td>
                      <td className="p-2.5">฿{t.usdtValue.toFixed(2)}</td>
                      <td className="p-2.5">
                        {activePosForTrade ? (
                          <div
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded font-extrabold animate-pulse border ${
                              (activePosForTrade.currentPnlUsdt ?? 0) >= 0
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            <span>
                              ⚡ {(activePosForTrade.currentPnlUsdt ?? 0) >= 0 ? '+' : ''}฿
                              {(activePosForTrade.currentPnlUsdt ?? 0).toFixed(2)} (
                              {(activePosForTrade.currentPnlPercent ?? 0) >= 0 ? '+' : ''}
                              {(activePosForTrade.currentPnlPercent ?? 0).toFixed(2)}%)
                            </span>
                          </div>
                        ) : t.pnlUsdt !== undefined ? (
                          <span className={`font-bold ${t.pnlUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {t.pnlUsdt >= 0 ? '+' : ''}฿{t.pnlUsdt.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="p-2.5 font-sans text-slate-400">{t.reason}</td>
                      <td className="p-2.5">
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                          {t.mode}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

