import React from 'react';
import { BotConfig, PaperAccount, BitkubTicker24h } from '../types';
import { formatCryptoPrice } from '../lib/bitkubApi';
import {
  TrendingUp,
  Cpu,
  BarChart3,
  Search,
  History,
  Settings,
  ShieldAlert,
  Wallet,
  Play,
  Pause,
  RefreshCw,
  PieChart,
  Coffee,
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'chart' | 'backtest' | 'scanner' | 'ai' | 'history' | 'stats' | 'coffee';
  setActiveTab: (tab: 'chart' | 'backtest' | 'scanner' | 'ai' | 'history' | 'stats' | 'coffee') => void;
  botConfig: BotConfig;
  paperAccount: PaperAccount;
  onOpenSettings: () => void;
  onResetPaperAccount: () => void;
  onToggleBot: () => void;
  btcPrice?: number;
  ethPrice?: number;
  tickers?: BitkubTicker24h[];
  onSelectSymbol?: (symbol: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  botConfig,
  paperAccount,
  onOpenSettings,
  onResetPaperAccount,
  onToggleBot,
  btcPrice,
  ethPrice,
  tickers = [],
  onSelectSymbol,
}) => {
  // Duplicate ticker list for seamless 100% infinite marquee loop
  const displayTickerItems = tickers.length > 0 ? [...tickers, ...tickers] : [];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-lg">
      {/* Top Bar: Title, Running Live Ticker, Paper Account & Settings */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="bg-gradient-to-tr from-emerald-500 via-teal-500 to-blue-600 p-2.5 rounded-xl shadow-md flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                CDC Action Zone <span className="text-emerald-400 font-extrabold">V2</span>
              </h1>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                Bitkub Bot
              </span>
            </div>
            <p className="text-xs text-slate-400">ระบบบอทเทรดคริปโตตามสัญญาณอินดิเคเตอร์ Chaloke.org</p>
          </div>
        </div>

        {/* Live Running Ticker Tape (ข้อความวิ่งราคาเหรียญทั้งหมดในระบบ) */}
        <div className="flex-1 max-w-xl mx-2 sm:mx-4 overflow-hidden rounded-xl bg-slate-950/80 border border-slate-800/80 py-1.5 px-3 relative group">
          {/* Gradient Edge Masks for Smooth Visual Fade */}
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />

          {tickers.length > 0 ? (
            <div className="animate-marquee flex items-center space-x-6 text-xs whitespace-nowrap">
              {displayTickerItems.map((t, idx) => {
                const isPositive = t.priceChangePercent >= 0;
                const formattedPrice = formatCryptoPrice(t.lastPrice);

                return (
                  <div
                    key={`${t.symbol}-${idx}`}
                    onClick={() => onSelectSymbol && onSelectSymbol(t.symbol)}
                    className="flex items-center space-x-1.5 cursor-pointer hover:bg-slate-800/90 px-2 py-0.5 rounded transition group/item"
                    title={`คลิกเพื่อดูชาร์ต ${t.symbol}`}
                  >
                    <span className="text-slate-400 font-semibold group-hover/item:text-emerald-400 transition">
                      {t.symbol.includes('_') ? t.symbol.split('_').join('/') : t.symbol}:
                    </span>
                    <span className="font-mono font-bold text-white">{formattedPrice}</span>
                    <span
                      className={`font-mono text-[11px] font-bold ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPositive ? `+${t.priceChangePercent.toFixed(2)}%` : `${t.priceChangePercent.toFixed(2)}%`}
                    </span>
                    <span className="text-slate-700 font-bold ml-3">|</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-4 text-xs text-slate-400 py-0.5">
              <span className="animate-pulse">กำลังดึงราคาเหรียญทั้งหมดในระบบ...</span>
              {btcPrice && (
                <span className="font-mono text-emerald-400">BTC: ฿{btcPrice.toLocaleString()}</span>
              )}
              {ethPrice && (
                <span className="font-mono text-cyan-400">ETH: ฿{ethPrice.toLocaleString()}</span>
              )}
            </div>
          )}
        </div>

        {/* Right Action Controls: Mode, Balance, Bot Switch, Settings */}
        <div className="flex items-center space-x-3">
          {/* Paper Balance Badge */}
          {botConfig.mode === 'PAPER' ? (
            <div className="flex items-center space-x-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-slate-400 block text-[10px] leading-tight">Paper Capital</span>
                <span className="font-mono font-bold text-white text-xs">
                  ฿{paperAccount.usdtBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <button
                onClick={onResetPaperAccount}
                title="Reset Paper Account Balance (฿30,000)"
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs text-amber-400">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span className="font-semibold">Bitkub Live API</span>
            </div>
          )}

          {/* Quick Bot Toggle Button */}
          <button
            onClick={onToggleBot}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow transition ${
              botConfig.isActive
                ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {botConfig.isActive ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>หยุด บอท</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>เปิดใช้งาน บอท</span>
              </>
            )}
          </button>

          {/* Settings Modal Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg transition"
            title="ตั้งค่า Bitkub API Key / Mode"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="bg-slate-950/80 border-t border-slate-800/80 px-3 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none touch-pan-x overscroll-x-contain">
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              activeTab === 'chart'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>ชาร์ต & ควบคุมบอท</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>ประวัติการเทรด</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              activeTab === 'stats'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>สถิติการเทรด</span>
          </button>

          <button
            onClick={() => setActiveTab('backtest')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              activeTab === 'backtest'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>ทดสอบย้อนหลัง (Backtest)</span>
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              activeTab === 'scanner'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>สแกนเหรียญ CDC</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              activeTab === 'ai'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>วิเคราะห์ด้วย AI</span>
          </button>

          <button
            onClick={() => setActiveTab('coffee')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              activeTab === 'coffee'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-semibold'
                : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10'
            }`}
          >
            <Coffee className="w-4 h-4 text-amber-400" />
            <span>เลี้ยงกาแฟ ☕</span>
          </button>
        </div>
      </div>
    </header>
  );
};
