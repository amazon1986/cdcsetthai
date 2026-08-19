import React, { useState, useEffect, useCallback } from 'react';
import {
  KlineData,
  Timeframe,
  BotConfig,
  PaperAccount,
  ExecutedTrade,
  SettradeApiKeys,
  PaperPosition,
  StockTicker24h,
} from './types';
import {
  getStoredBotConfig,
  saveBotConfig,
  getStoredPaperAccount,
  savePaperAccount,
  getStoredTradeHistory,
  saveTradeHistory,
  addTradeToHistory,
  getStoredBrokerKeys,
  saveBrokerKeys,
  getStoredTelegramConfig,
  saveTelegramConfig,
  getStoredLogs,
  addBotLog,
  getStoredSymbols,
  DEFAULT_PAPER_ACCOUNT,
} from './lib/botStore';
import {
  fetchBotServerState,
  saveBotServerConfig,
  toggleBotServer,
  sendManualOrderToServer,
  closePositionOnServer,
  clearBotServerLogs,
  resetBotServerPaperAccount,
  saveBrokerKeysToServer,
  unlockSymbolOnServer,
} from './lib/botApi';
import {
  fetchStockKlines,
  fetchStockTicker24h,
  POPULAR_STOCKS,
  formatStockPrice,
} from './lib/stockApi';
import { calculateCDCActionZone, getCrossoverInfo } from './lib/cdcIndicator';
import { Header } from './components/Header';
import { CDCChart } from './components/CDCChart';
import { BotControlPanel } from './components/BotControlPanel';
import { BacktestingView } from './components/BacktestingView';
import { MarketScanner } from './components/MarketScanner';
import { AiAnalystPanel } from './components/AiAnalystPanel';
import { SettradeSettingsModal } from './components/SettradeSettingsModal';
import { TradeHistoryTable } from './components/TradeHistoryTable';
import { TradingStats } from './components/TradingStats';
import { CoffeeDonation } from './components/CoffeeDonation';

/**
 * Calculates equal-weight / fixed / percentage position size based on Total Portfolio Equity.
 */
function calculateOrderSize(config: BotConfig, account: PaperAccount): number {
  const maxPositions = Math.max(1, Math.min(20, config.maxOpenPositions || 5));
  if (account.activePositions.length >= maxPositions) return 0;

  const totalPositionsValue = account.activePositions.reduce(
    (sum, p) => sum + (p.usdtInvested || p.marginUsdt || 0),
    0
  );
  const totalEquity = account.usdtBalance + totalPositionsValue;

  const mode = config.positionSizingMode || 'EQUAL_WEIGHT';
  let targetUsdt = 0;

  if (mode === 'EQUAL_WEIGHT') {
    targetUsdt = totalEquity / maxPositions;
  } else if (mode === 'PERCENT_EQUITY') {
    targetUsdt = (totalEquity * (config.balancePercent || 20)) / 100;
  } else {
    targetUsdt = config.tradeAmountUsdt || 10000;
  }

  return Math.min(targetUsdt, account.usdtBalance);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'chart' | 'backtest' | 'scanner' | 'ai' | 'history' | 'stats' | 'coffee'>('chart');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Core Central State (Synchronized with Server)
  const [botConfig, setBotConfig] = useState<BotConfig>(getStoredBotConfig);
  const [chartTimeframe, setChartTimeframe] = useState<Timeframe>(() => getStoredBotConfig().timeframe || '1d');
  const [paperAccount, setPaperAccount] = useState<PaperAccount>(getStoredPaperAccount);
  const [brokerKeys, setBrokerKeys] = useState<SettradeApiKeys>(getStoredBrokerKeys);
  const [telegramConfig, setTelegramConfig] = useState<{ botToken: string; chatId: string; isEnabled: boolean }>(getStoredTelegramConfig);
  const [tradeHistory, setTradeHistory] = useState<ExecutedTrade[]>(getStoredTradeHistory);
  const [botLogs, setBotLogs] = useState<string[]>(getStoredLogs);

  // Market & Kline State
  const [candles, setCandles] = useState<KlineData[]>([]);
  const [botCandles, setBotCandles] = useState<KlineData[]>([]);
  const [isLoadingCandles, setIsLoadingCandles] = useState(false);
  const [pttPrice, setPttPrice] = useState<number | undefined>(undefined);
  const [cpallPrice, setCpallPrice] = useState<number | undefined>(undefined);
  const [allTickers, setAllTickers] = useState<StockTicker24h[]>([]);

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'buy' | 'sell' | 'info' } | null>(null);

  const showToast = (text: string, type: 'buy' | 'sell' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const [currentPriceInfo, setCurrentPriceInfo] = useState<{ symbol: string; price: number }>({
    symbol: 'PTT',
    price: 0,
  });

  // 1. Fetch Market Candlestick Data (Separating Chart View from Bot Engine)
  const loadCandles = useCallback(async () => {
    setIsLoadingCandles(true);
    try {
      // A. Load Chart Viewing Candles (on chartTimeframe)
      const chartRaw = await fetchStockKlines(botConfig.symbol, chartTimeframe, 300);
      const chartCdc = calculateCDCActionZone(chartRaw, botConfig.fastEmaPeriod, botConfig.slowEmaPeriod);
      setCandles(chartCdc);
      if (chartCdc.length > 0) {
        const latest = chartCdc[chartCdc.length - 1];
        setCurrentPriceInfo({ symbol: botConfig.symbol, price: latest.close });
      }

      // B. Load Bot Strategy Candles (strictly on botConfig.timeframe)
      if (chartTimeframe === botConfig.timeframe) {
        setBotCandles(chartCdc);
      } else {
        const botRaw = await fetchStockKlines(botConfig.symbol, botConfig.timeframe, 300);
        const botCdc = calculateCDCActionZone(botRaw, botConfig.fastEmaPeriod, botConfig.slowEmaPeriod);
        setBotCandles(botCdc);
      }
    } catch (err) {
      console.error('Error loading klines:', err);
    } finally {
      setIsLoadingCandles(false);
    }
  }, [botConfig.symbol, botConfig.timeframe, chartTimeframe, botConfig.fastEmaPeriod, botConfig.slowEmaPeriod]);

  // 2. Fetch All Stock Prices for Header Running Ticker Tape
  const loadTickers = useCallback(async () => {
    try {
      const raw = await fetchStockTicker24h();
      if (raw && raw.length > 0) {
        const popularSet = new Set(POPULAR_STOCKS);
        const filtered = raw
          .filter((t) => popularSet.has(t.symbol))
          .sort((a, b) => {
            const indexA = POPULAR_STOCKS.indexOf(a.symbol);
            const indexB = POPULAR_STOCKS.indexOf(b.symbol);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return b.quoteVolume - a.quoteVolume;
          })
          .slice(0, 30);

        setAllTickers(filtered);

        const ptt = raw.find((t) => t.symbol === 'PTT');
        const cpall = raw.find((t) => t.symbol === 'CPALL');
        if (ptt) setPttPrice(ptt.lastPrice);
        if (cpall) setCpallPrice(cpall.lastPrice);
      }
    } catch (err) {
      console.warn('Ticker update failed:', err);
    }
  }, []);

  // Synchronize state with Cloud Server (every 3.5s) for 24/7 cross-device consistency
  useEffect(() => {
    let isMounted = true;
    const syncServerState = async () => {
      try {
        const serverData = await fetchBotServerState();
        if (serverData && isMounted) {
          setBotConfig((prev) => ({ ...prev, ...serverData.botConfig }));
          setPaperAccount(serverData.paperAccount);
          setTradeHistory(serverData.tradeHistory);
          setBotLogs(serverData.botLogs);
        }
      } catch {
        // Fallback to local storage if offline
      }
    };

    syncServerState();
    const syncInterval = setInterval(syncServerState, 3500);
    return () => {
      isMounted = false;
      clearInterval(syncInterval);
    };
  }, []);

  // Initial Load & Polling Intervals
  useEffect(() => {
    loadCandles();
    loadTickers();

    const candleInterval = setInterval(loadCandles, 10000);
    const tickerInterval = setInterval(loadTickers, 8000);

    return () => {
      clearInterval(candleInterval);
      clearInterval(tickerInterval);
    };
  }, [loadCandles, loadTickers]);

  // Real-time PnL update effect for ALL open positions when ticker prices update
  useEffect(() => {
    if (!allTickers || allTickers.length === 0) return;
    const tickerPriceMap = new Map<string, number>();
    for (const t of allTickers) {
      tickerPriceMap.set(t.symbol, t.lastPrice);
    }

    setPaperAccount((prev) => {
      let hasChanges = false;
      const updatedPositions = prev.activePositions.map((pos) => {
        const livePrice = tickerPriceMap.get(pos.symbol) || (pos.symbol === currentPriceInfo.symbol ? currentPriceInfo.price : 0);
        if (livePrice > 0) {
          const posLev = pos.leverage || 1;
          const margin = pos.marginUsdt || pos.usdtInvested;
          const pnlPercent = pos.side === 'SHORT'
            ? ((pos.entryPrice - livePrice) / pos.entryPrice) * 100 * posLev
            : ((livePrice - pos.entryPrice) / pos.entryPrice) * 100 * posLev;
          const pnlUsdt = (margin * pnlPercent) / 100;

          if (Math.abs((pos.currentPnlUsdt || 0) - pnlUsdt) > 0.001) {
            hasChanges = true;
            return {
              ...pos,
              currentPnlUsdt: Number(pnlUsdt.toFixed(2)),
              currentPnlPercent: Number(pnlPercent.toFixed(2)),
            };
          }
        }
        return pos;
      });

      if (hasChanges) {
        const newAcc = { ...prev, activePositions: updatedPositions };
        savePaperAccount(newAcc);
        return newAcc;
      }
      return prev;
    });
  }, [allTickers, currentPriceInfo]);

  // Save config state updates to storage and cloud server
  const handleSaveBotConfig = async (updated: BotConfig) => {
    setBotConfig(updated);
    saveBotConfig(updated);
    await saveBotServerConfig(updated);
  };

  const handleSaveBrokerKeys = async (updatedKeys: SettradeApiKeys) => {
    setBrokerKeys(updatedKeys);
    saveBrokerKeys(updatedKeys);
    await saveBrokerKeysToServer(updatedKeys);
    showToast(`อัปเดต Settrade API Key เรียบร้อย`, 'info');
  };

  const handleResetPaperAccount = async () => {
    if (confirm('คุณต้องการรีเซ็ตยอดเงินบัญชีทดลอง (Paper Trading) เป็น ฿100,000 THB หรือไม่?')) {
      await resetBotServerPaperAccount();
      setPaperAccount(DEFAULT_PAPER_ACCOUNT);
      savePaperAccount(DEFAULT_PAPER_ACCOUNT);
      showToast('รีเซ็ตยอดเงินพอร์ตจำลองเป็น ฿100,000 THB แล้ว', 'info');
    }
  };

  const currentPrice = currentPriceInfo.price;
  const currentCandle = candles.length > 0 ? candles[candles.length - 1] : null;

  // Manual Buy Handler (Manual LONG)
  const handleManualBuy = async (customAmountUsdt?: number) => {
    const price = currentPriceInfo.price;
    if (!price || price === 0) return;
    const existingPos = paperAccount.activePositions.find((p) => p.symbol === botConfig.symbol);
    if (existingPos) {
      showToast(`คุณมีสถานะถือครองหุ้น ${botConfig.symbol} อยู่แล้ว`, 'info');
      return;
    }

    const tradeUsdt = customAmountUsdt !== undefined && customAmountUsdt > 0
      ? customAmountUsdt
      : calculateOrderSize(botConfig, paperAccount);

    if (tradeUsdt < 10) {
      showToast('ยอดเงินคงเหลือไม่พอสำหรับซื้อหุ้น (ขั้นต่ำ ฿10 บาท)', 'info');
      return;
    }

    const res = await sendManualOrderToServer({
      symbol: botConfig.symbol,
      side: 'LONG',
      amountUsdt: tradeUsdt,
      currentPrice: price,
    });

    if (res.success) {
      showToast(`ซื้อหุ้น ${botConfig.symbol} สำเร็จ`, 'buy');
      const data = await fetchBotServerState();
      if (data) {
        setPaperAccount(data.paperAccount);
        setTradeHistory(data.tradeHistory);
        setBotLogs(data.botLogs);
      }
    } else {
      showToast(res.error || 'เกิดข้อผิดพลาดในการซื้อหุ้น', 'sell');
    }
  };

  // Manual Close Handler
  const handleManualSell = async (symbolToSell?: string) => {
    const sym = symbolToSell || botConfig.symbol;

    let price = 0;
    if (sym === currentPriceInfo.symbol && currentPriceInfo.price > 0) {
      price = currentPriceInfo.price;
    } else {
      const ticker = allTickers.find((t) => t.symbol === sym);
      if (ticker && ticker.lastPrice > 0) {
        price = ticker.lastPrice;
      } else {
        try {
          const tData = await fetchStockTicker24h(sym);
          if (tData.length > 0 && tData[0].lastPrice > 0) {
            price = tData[0].lastPrice;
          }
        } catch (e) {
          console.error(`Failed to fetch price for ${sym}:`, e);
        }
      }
    }

    if (!price || price === 0) {
      showToast(`ไม่สามารถดึงราคาปัจจุบันของ ${sym} ได้`, 'sell');
      return;
    }

    const res = await closePositionOnServer({
      symbol: sym,
      currentPrice: price,
      reason: 'Manual Close Button',
    });

    if (res.success) {
      showToast(`ขายปิดสถานะหุ้น ${sym} เรียบร้อยแล้ว`, 'info');
      const data = await fetchBotServerState();
      if (data) {
        setPaperAccount(data.paperAccount);
        setTradeHistory(data.tradeHistory);
        setBotLogs(data.botLogs);
      }
    } else {
      showToast(res.error || 'ไม่พบสถานะหุ้นที่ต้องการปิด', 'sell');
    }
  };

  const handleCloseSpecificPosition = async (sym: string) => {
    await handleManualSell(sym);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12 antialiased overflow-x-hidden">
      {/* Toast Notification Popup */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border flex items-center space-x-2 text-xs font-bold transition-all animate-bounce ${
            toastMessage.type === 'buy'
              ? 'bg-emerald-600 text-white border-emerald-400'
              : toastMessage.type === 'sell'
              ? 'bg-rose-600 text-white border-rose-400'
              : 'bg-slate-800 text-white border-slate-700'
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        botConfig={botConfig}
        paperAccount={paperAccount}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onResetPaperAccount={handleResetPaperAccount}
        onToggleBot={() => {
          const nextState = !botConfig.isActive;
          handleSaveBotConfig({ ...botConfig, isActive: nextState });
          showToast(nextState ? 'เปิดระบบอัตโนมัติ CDC Stock Bot แล้ว' : 'หยุดระบบอัตโนมัติ CDC Stock Bot แล้ว', 'info');
        }}
        pttPrice={pttPrice}
        cpallPrice={cpallPrice}
        tickers={allTickers}
        onSelectSymbol={(selectedSymbol) => {
          handleSaveBotConfig({ ...botConfig, symbol: selectedSymbol });
          setActiveTab('chart');
          showToast(`เลือกหุ้น ${selectedSymbol} ขึ้นชาร์ตเรียบร้อยแล้ว`, 'info');
        }}
      />

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {activeTab === 'chart' && (
          <div className="space-y-6">
            <CDCChart
              candles={candles}
              symbol={botConfig.symbol}
              timeframe={chartTimeframe}
              botTimeframe={botConfig.timeframe}
              isBotActive={botConfig.isActive}
              onSymbolChange={(newSym) => handleSaveBotConfig({ ...botConfig, symbol: newSym })}
              onTimeframeChange={(newTf) => setChartTimeframe(newTf)}
              onBotTimeframeChange={(newBotTf) => {
                handleSaveBotConfig({ ...botConfig, timeframe: newBotTf });
                showToast(`เปลี่ยนไทม์เฟรมบอทเป็น ${newBotTf.toUpperCase()} เรียบร้อยแล้ว`, 'info');
              }}
              onRefresh={loadCandles}
              isLoading={isLoadingCandles}
            />

            <BotControlPanel
              botConfig={botConfig}
              paperAccount={paperAccount}
              currentPrice={currentPrice}
              onSaveConfig={handleSaveBotConfig}
              onToggleBot={() => handleSaveBotConfig({ ...botConfig, isActive: !botConfig.isActive })}
              onManualBuy={handleManualBuy}
              onManualSell={handleManualSell}
              onUnlockSymbol={async (symToUnlock) => {
                await unlockSymbolOnServer(symToUnlock);
                const updatedLocks = { ...(botConfig.stopLossLocks || {}) };
                delete updatedLocks[symToUnlock];
                handleSaveBotConfig({ ...botConfig, stopLossLocks: updatedLocks });
                showToast(`ปลดล็อกหุ้น ${symToUnlock} เรียบร้อยแล้ว`, 'info');
              }}
              botLogs={botLogs}
              onClearLogs={() => {
                localStorage.removeItem('cdc_stock_bot_logs_v2');
                localStorage.removeItem('cdc_bot_logs_v2');
                setBotLogs([]);
              }}
            />
          </div>
        )}

        {activeTab === 'backtest' && <BacktestingView />}

        {activeTab === 'stats' && (
          <TradingStats
            trades={tradeHistory}
            onClearStats={() => {
              localStorage.removeItem('cdc_stock_trade_history_v2');
              localStorage.removeItem('cdc_trade_history_v2');
              setTradeHistory([]);
              showToast('ล้างสถิติและประวัติการเทรดทั้งหมดแล้ว', 'info');
            }}
          />
        )}

        {activeTab === 'scanner' && (
          <MarketScanner
            onSelectStock={(selectedSymbol) => {
              handleSaveBotConfig({ ...botConfig, symbol: selectedSymbol });
              setActiveTab('chart');
              showToast(`เลือกหุ้น ${selectedSymbol} ขึ้นชาร์ตและบอทเรียบร้อย`, 'info');
            }}
          />
        )}

        {activeTab === 'ai' && (
          <AiAnalystPanel
            symbol={botConfig.symbol}
            timeframe={botConfig.timeframe}
            latestCandle={currentCandle}
            recentCandles={candles}
          />
        )}

        {activeTab === 'coffee' && <CoffeeDonation />}

        {activeTab === 'history' && (
          <TradeHistoryTable
            trades={tradeHistory}
            onClearHistory={() => {
              localStorage.removeItem('cdc_stock_trade_history_v2');
              localStorage.removeItem('cdc_trade_history_v2');
              setTradeHistory([]);
              showToast('ล้างประวัติการเทรดแล้ว', 'info');
            }}
            activePositions={paperAccount.activePositions}
            onClosePosition={handleCloseSpecificPosition}
            allTickers={allTickers}
          />
        )}
      </main>

      {/* Settrade Broker Settings Modal */}
      <SettradeSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        keys={brokerKeys}
        botConfig={botConfig}
        telegramConfig={telegramConfig}
        onSaveKeys={handleSaveBrokerKeys}
        onSaveConfig={handleSaveBotConfig}
        onSaveTelegramConfig={(newTg) => {
          setTelegramConfig(newTg);
          saveTelegramConfig(newTg);
          showToast('บันทึกการตั้งค่า Telegram เรียบร้อย', 'info');
        }}
      />
    </div>
  );
}
