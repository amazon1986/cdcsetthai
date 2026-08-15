import React, { useState } from 'react';
import { Timeframe, BacktestResult, BacktestTrade } from '../types';
import { fetchBitkubKlines, formatCryptoPrice } from '../lib/bitkubApi';
import { getStoredSymbols } from '../lib/botStore';
import { calculateCDCActionZone } from '../lib/cdcIndicator';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Play, TrendingUp, Award, AlertTriangle, ArrowUpRight, ArrowDownRight, RefreshCw, BarChart2 } from 'lucide-react';

export const BacktestingView: React.FC = () => {
  const [symbol, setSymbol] = useState('PTT');
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [candleCount, setCandleCount] = useState(500);
  const [initialCapital, setInitialCapital] = useState<number | string>(100000);
  const [stopLossPct, setStopLossPct] = useState<number | string>(5);
  const [takeProfitPct, setTakeProfitPct] = useState<number | string>(20);
  const [directionMode, setDirectionMode] = useState<'LONG_ONLY' | 'SHORT_ONLY' | 'BOTH'>('LONG_ONLY');
  const [buyZone, setBuyZone] = useState<'BLUE' | 'GREEN'>('BLUE');

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const runBacktest = async () => {
    setIsLoading(true);
    try {
      const rawCandles = await fetchBitkubKlines(symbol, timeframe, candleCount);
      const cdcCandles = calculateCDCActionZone(rawCandles, 12, 26);

      if (cdcCandles.length < 30) {
        setIsLoading(false);
        alert('ข้อมูลแท่งเทียนไม่เพียงพอสำหรับการทำ Backtest');
        return;
      }

      const numInitialCapital = Number(initialCapital) || 1000;
      const numStopLossPct = Number(stopLossPct) || 0;
      const numTakeProfitPct = Number(takeProfitPct) || 0;

      let usdtBalance = numInitialCapital;
      let inPosition = false;
      let posSide: 'LONG' | 'SHORT' = 'LONG';
      let entryPrice = 0;
      let entryTime = 0;
      let positionCoins = 0;
      let entryReason = '';

      const trades: BacktestTrade[] = [];
      const equityCurve: { time: number; equity: number; price: number; dateStr: string }[] = [];

      let tradeId = 1;
      let peakCapital = numInitialCapital;
      let maxDrawdown = 0;

      for (let i = 1; i < cdcCandles.length; i++) {
        const candle = cdcCandles[i];
        const prevCandle = cdcCandles[i - 1];

        // Track Current Portfolio Equity
        let currentEquity = usdtBalance;
        if (inPosition) {
          if (posSide === 'LONG') {
            currentEquity = positionCoins * candle.close;
          } else {
            const pnl = positionCoins * (entryPrice - candle.close);
            currentEquity = usdtBalance + pnl;
          }
        }

        if (currentEquity > peakCapital) peakCapital = currentEquity;
        const currentDd = ((peakCapital - currentEquity) / peakCapital) * 100;
        if (currentDd > maxDrawdown) maxDrawdown = currentDd;

        const dateStr = new Date(candle.time).toLocaleDateString('th-TH', {
          day: 'numeric',
          month: 'short',
        });

        equityCurve.push({
          time: candle.time,
          equity: Number(currentEquity.toFixed(2)),
          price: candle.close,
          dateStr,
        });

        // 1. Check Exit triggers if in position
        if (inPosition) {
          const currentProfitPct =
            posSide === 'LONG'
              ? ((candle.close - entryPrice) / entryPrice) * 100
              : ((entryPrice - candle.close) / entryPrice) * 100;

          let shouldExit = false;
          let exitReason = '';

          // A. Stop Loss
          if (numStopLossPct > 0 && currentProfitPct <= -numStopLossPct) {
            shouldExit = true;
            exitReason = `Stop Loss (-${numStopLossPct}%)`;
          }
          // B. Take Profit
          else if (numTakeProfitPct > 0 && currentProfitPct >= numTakeProfitPct) {
            shouldExit = true;
            exitReason = `Take Profit (+${numTakeProfitPct}%)`;
          }
          // C. CDC Signal Exit
          else if (posSide === 'LONG' && (candle.zone === 'RED' || candle.zone === 'YELLOW')) {
            shouldExit = true;
            exitReason = `CDC ${candle.colorNameTh}`;
          } else if (posSide === 'SHORT' && (candle.zone === 'BLUE' || candle.zone === 'GREEN')) {
            shouldExit = true;
            exitReason = `CDC ${candle.colorNameTh}`;
          }

          if (shouldExit) {
            let pnlUsdt = 0;
            let pnlPercent = 0;

            if (posSide === 'LONG') {
              usdtBalance = positionCoins * candle.close;
              pnlUsdt = usdtBalance - positionCoins * entryPrice;
              pnlPercent = ((candle.close - entryPrice) / entryPrice) * 100;
            } else {
              pnlUsdt = positionCoins * (entryPrice - candle.close);
              pnlPercent = ((entryPrice - candle.close) / entryPrice) * 100;
              usdtBalance = usdtBalance + pnlUsdt;
            }

            trades.push({
              id: tradeId++,
              entryTime,
              exitTime: candle.time,
              entryPrice,
              exitPrice: candle.close,
              side: posSide === 'LONG' ? 'BUY' : 'SELL',
              pnlUsdt: Number(pnlUsdt.toFixed(2)),
              pnlPercent: Number(pnlPercent.toFixed(2)),
              entryReason,
              exitReason,
              holdingCandles: i - (entryTime ? cdcCandles.findIndex((c) => c.time === entryTime) : i),
            });

            inPosition = false;
            positionCoins = 0;
          }
        }

        // 2. Check Entry triggers if not in position (Uncle Chaloke Confirmed Next Bar Rule)
        if (!inPosition && usdtBalance > 0) {
          const isFirstBlue = candle.zone === 'BLUE' && (!prevCandle || prevCandle.zone !== 'BLUE');
          const isFirstConfirmedGreen =
            candle.zone === 'GREEN' &&
            prevCandle &&
            (prevCandle.zone === 'BLUE' || prevCandle.zone === 'YELLOW' || prevCandle.zone === 'RED');

          const isLongTrigger = buyZone === 'BLUE' ? isFirstBlue : isFirstConfirmedGreen || isFirstBlue;
          const isShortTrigger = candle.zone === 'RED' && (!prevCandle || prevCandle.zone !== 'RED');

          if ((directionMode === 'LONG_ONLY' || directionMode === 'BOTH') && isLongTrigger) {
            inPosition = true;
            posSide = 'LONG';
            entryPrice = candle.close;
            entryTime = candle.time;
            positionCoins = usdtBalance / entryPrice;
            entryReason = `CDC ${candle.colorNameTh}`;
            usdtBalance = 0;
          } else if ((directionMode === 'SHORT_ONLY' || directionMode === 'BOTH') && isShortTrigger) {
            inPosition = true;
            posSide = 'SHORT';
            entryPrice = candle.close;
            entryTime = candle.time;
            positionCoins = usdtBalance / entryPrice;
            entryReason = `CDC ${candle.colorNameTh}`;
          }
        }
      }

      // Close open position at end of backtest for accounting
      if (inPosition) {
        const lastCandle = cdcCandles[cdcCandles.length - 1];
        let pnlUsdt = 0;
        let pnlPercent = 0;

        if (posSide === 'LONG') {
          usdtBalance = positionCoins * lastCandle.close;
          pnlUsdt = usdtBalance - positionCoins * entryPrice;
          pnlPercent = ((lastCandle.close - entryPrice) / entryPrice) * 100;
        } else {
          pnlUsdt = positionCoins * (entryPrice - lastCandle.close);
          pnlPercent = ((entryPrice - lastCandle.close) / entryPrice) * 100;
          usdtBalance = usdtBalance + pnlUsdt;
        }

        trades.push({
          id: tradeId++,
          entryTime,
          exitTime: lastCandle.time,
          entryPrice,
          exitPrice: lastCandle.close,
          side: posSide === 'LONG' ? 'BUY' : 'SELL',
          pnlUsdt: Number(pnlUsdt.toFixed(2)),
          pnlPercent: Number(pnlPercent.toFixed(2)),
          entryReason,
          exitReason: 'End of Backtest Period',
          holdingCandles: cdcCandles.length - cdcCandles.findIndex((c) => c.time === entryTime),
        });
      }

      const totalReturnPercent = ((usdtBalance - numInitialCapital) / numInitialCapital) * 100;
      const firstPrice = cdcCandles[0].close;
      const lastPrice = cdcCandles[cdcCandles.length - 1].close;
      const buyAndHoldReturnPercent = ((lastPrice - firstPrice) / firstPrice) * 100;

      const winningTrades = trades.filter((t) => t.pnlUsdt > 0).length;
      const losingTrades = trades.filter((t) => t.pnlUsdt <= 0).length;
      const winRatePercent = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;

      const totalWinsUsdt = trades.filter((t) => t.pnlUsdt > 0).reduce((acc, t) => acc + t.pnlUsdt, 0);
      const totalLossesUsdt = Math.abs(
        trades.filter((t) => t.pnlUsdt < 0).reduce((acc, t) => acc + t.pnlUsdt, 0)
      );

      const profitFactor = totalLossesUsdt > 0 ? totalWinsUsdt / totalLossesUsdt : totalWinsUsdt > 0 ? 99 : 0;

      setResult({
        symbol,
        timeframe,
        initialCapital: numInitialCapital,
        finalCapital: Number(usdtBalance.toFixed(2)),
        totalReturnPercent: Number(totalReturnPercent.toFixed(2)),
        buyAndHoldReturnPercent: Number(buyAndHoldReturnPercent.toFixed(2)),
        totalTrades: trades.length,
        winningTrades,
        losingTrades,
        winRatePercent: Number(winRatePercent.toFixed(2)),
        maxDrawdownPercent: Number(maxDrawdown.toFixed(2)),
        profitFactor: Number(profitFactor.toFixed(2)),
        trades,
        equityCurve,
      });
    } catch (err) {
      console.error('Backtest calculation error:', err);
      alert('เกิดข้อผิดพลาดขณะรัน Backtest');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Backtest Config Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">ตั้งค่าการทดสอบย้อนหลัง (CDC Strategy Backtest)</h3>
          </div>
          <span className="text-xs text-slate-400">ทดสอบผลตอบแทนและวินัยการเทรดตาม CDC Action Zone</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {/* Symbol */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">สัญลักษณ์หุ้น (SET)</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500"
            >
              {getStoredSymbols().map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">ไทม์เฟรม (Timeframe)</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as Timeframe)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500"
            >
              <option value="15m">15m</option>
              <option value="1h">1H</option>
              <option value="4h">4H</option>
              <option value="1d">1D (แนะนำ)</option>
              <option value="1w">1W</option>
            </select>
          </div>

          {/* Candle Count */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">จำนวนแท่งเทียนย้อนหลัง</label>
            <select
              value={candleCount}
              onChange={(e) => setCandleCount(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500"
            >
              <option value={300}>300 แท่ง</option>
              <option value={500}>500 แท่ง</option>
              <option value={1000}>1000 แท่ง</option>
            </select>
          </div>

          {/* Initial Capital */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">เงินทุนเริ่มต้น (THB)</label>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500"
            />
          </div>

          {/* Stop Loss % */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">Stop Loss %</label>
            <input
              type="number"
              value={stopLossPct}
              onChange={(e) => setStopLossPct(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500"
            />
          </div>

          {/* Take Profit % */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">Take Profit Target %</label>
            <input
              type="number"
              value={takeProfitPct}
              onChange={(e) => setTakeProfitPct(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500"
            />
          </div>

          {/* Direction Mode (Locked for Spot) */}

          {/* Buy Trigger Zone */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">เงื่อนไขเข้าซื้อ Long</label>
            <select
              value={buyZone}
              onChange={(e) => setBuyZone(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500"
            >
              <option value="BLUE">โซนฟ้า (Buy Trigger สัญญาณเข้าแรก ⭐)</option>
              <option value="GREEN">โซนเขียว (Green Confirmation คอนเฟิร์ม ⭐)</option>
            </select>
          </div>

          {/* Start Backtest Button */}
          <div className="flex items-end">
            <button
              onClick={runBacktest}
              disabled={isLoading}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>กำลังคำนวณ...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>เริ่มการทดสอบ Backtest</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Backtest Results Section */}
      {result && (
        <div className="space-y-6">
          {/* Performance Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Return Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium">กำไรสุทธิ CDC Bot</span>
              <div
                className={`text-lg font-extrabold font-mono ${
                  result.totalReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {result.totalReturnPercent >= 0 ? '+' : ''}
                {result.totalReturnPercent}%
              </div>
              <span className="text-[10px] text-slate-500 block font-mono">
                ฿{result.finalCapital.toLocaleString()} THB
              </span>
            </div>

            {/* Buy & Hold Benchmark Return */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium">Buy & Hold (ซื้อถือเฉยๆ)</span>
              <div
                className={`text-lg font-extrabold font-mono ${
                  result.buyAndHoldReturnPercent >= 0 ? 'text-cyan-400' : 'text-rose-400'
                }`}
              >
                {result.buyAndHoldReturnPercent >= 0 ? '+' : ''}
                {result.buyAndHoldReturnPercent}%
              </div>
              <span className="text-[10px] text-slate-500 block">เกณฑ์เปรียบเทียบ</span>
            </div>

            {/* Win Rate */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium">อัตราชนะ (Win Rate)</span>
              <div className="text-lg font-extrabold font-mono text-emerald-400">
                {result.winRatePercent}%
              </div>
              <span className="text-[10px] text-slate-500 block">
                ชนะ {result.winningTrades} / แพ้ {result.losingTrades}
              </span>
            </div>

            {/* Total Trades */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium">จำนวนเทรดทั้งหมด</span>
              <div className="text-lg font-extrabold font-mono text-white">
                {result.totalTrades} ครั้ง
              </div>
              <span className="text-[10px] text-slate-500 block">รอบสัญญาณ</span>
            </div>

            {/* Max Drawdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium">Max Drawdown</span>
              <div className="text-lg font-extrabold font-mono text-rose-400">
                -{result.maxDrawdownPercent}%
              </div>
              <span className="text-[10px] text-slate-500 block">ความย่อสูงสุด</span>
              <p className="text-[10px] text-slate-500">ความเสี่ยงย่อตัวสูงสุด</p>
            </div>

            {/* Profit Factor */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1 shadow-md">
              <span className="text-slate-400 block text-[11px]">Profit Factor</span>
              <div className="text-lg font-bold text-purple-400 font-mono">
                {result.profitFactor}
              </div>
              <p className="text-[10px] text-slate-500">อัตราส่วนกำไรต่อขาดทุน</p>
            </div>
          </div>

          {/* Equity Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-emerald-400" />
                <span>กราฟการเติบโตของพอร์ต (Portfolio Equity Curve)</span>
              </h4>
              <span className="text-xs text-slate-400 font-mono">
                เงินทุนสุดท้าย: <strong className="text-emerald-400">฿{result.finalCapital.toLocaleString()} THB</strong>
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="dateStr" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    name="พอร์ต CDC Bot"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Backtest Trades Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h4 className="text-sm font-bold text-white">รายละเอียดออเดอร์ Backtest ทุกรอบ ({result.trades.length} รอบ)</h4>
            <div className="overflow-x-auto max-h-80 overflow-y-auto scrollbar-thin">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">ฝั่ง</th>
                    <th className="p-2.5">วันที่เปิด</th>
                    <th className="p-2.5">วันที่ปิด</th>
                    <th className="p-2.5">ราคาเข้า</th>
                    <th className="p-2.5">ราคาออก</th>
                    <th className="p-2.5">กำไร/ขาดทุน (฿)</th>
                    <th className="p-2.5">กำไร (%)</th>
                    <th className="p-2.5">เหตุผลการออก</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {result.trades.map((t, idx) => (
                    <tr key={`bt_trade_${t.id}_${idx}`} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold text-slate-400">{t.id}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            t.side === 'BUY'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {t.side === 'BUY' ? 'LONG' : 'SHORT'}
                        </span>
                      </td>
                      <td className="p-2.5">{new Date(t.entryTime).toLocaleDateString('th-TH')}</td>
                      <td className="p-2.5">{new Date(t.exitTime).toLocaleDateString('th-TH')}</td>
                      <td className="p-2.5">{formatCryptoPrice(t.entryPrice)}</td>
                      <td className="p-2.5">{formatCryptoPrice(t.exitPrice)}</td>
                      <td
                        className={`p-2.5 font-bold ${
                          t.pnlUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {t.pnlUsdt >= 0 ? '+' : ''}฿{t.pnlUsdt}
                      </td>
                      <td
                        className={`p-2.5 font-bold ${
                          t.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent}%
                      </td>
                      <td className="p-2.5 font-sans text-slate-400">{t.exitReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
