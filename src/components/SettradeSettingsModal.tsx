import React, { useState } from 'react';
import { SettradeApiKeys, BotConfig, TelegramConfig } from '../types';
import { X, Key, Shield, AlertTriangle, CheckCircle, RefreshCw, Send, Bell, Info } from 'lucide-react';
import { sendTelegramTestAlert } from '../lib/botApi';

interface SettradeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  keys: SettradeApiKeys;
  botConfig: BotConfig;
  telegramConfig?: TelegramConfig;
  onSaveKeys: (newKeys: SettradeApiKeys) => void;
  onSaveConfig: (newConfig: BotConfig) => void;
  onSaveTelegramConfig?: (newTelegramConfig: TelegramConfig) => void;
}

export const SettradeSettingsModal: React.FC<SettradeSettingsModalProps> = ({
  isOpen,
  onClose,
  keys,
  botConfig,
  telegramConfig,
  onSaveKeys,
  onSaveConfig,
  onSaveTelegramConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'broker' | 'telegram'>('broker');

  // Broker State
  const [apiKey, setApiKey] = useState(keys.apiKey || '');
  const [apiSecret, setApiSecret] = useState(keys.apiSecret || '');
  const [appCode, setAppCode] = useState(keys.appCode || '');
  const [brokerId, setBrokerId] = useState(keys.brokerId || 'SANDBOX');
  const [tradingMode, setTradingMode] = useState<'PAPER' | 'SETTRADE_LIVE'>(
    botConfig.mode === 'SETTRADE_LIVE' ? 'SETTRADE_LIVE' : 'PAPER'
  );

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{
    success: boolean;
    message: string;
    canTrade?: boolean;
  } | null>(null);

  // Telegram State
  const [tgBotToken, setTgBotToken] = useState(
    telegramConfig?.botToken || botConfig.telegramConfig?.botToken || ''
  );
  const [tgChatId, setTgChatId] = useState(
    telegramConfig?.chatId || botConfig.telegramConfig?.chatId || ''
  );
  const [tgEnabled, setTgEnabled] = useState<boolean>(
    telegramConfig?.isEnabled !== undefined
      ? telegramConfig.isEnabled
      : botConfig.telegramConfig?.isEnabled !== undefined
      ? botConfig.telegramConfig.isEnabled
      : true
  );

  const [isTestingTg, setIsTestingTg] = useState(false);
  const [tgTestStatus, setTgTestStatus] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const testConnection = async () => {
    setIsVerifying(true);
    setVerifyStatus(null);
    try {
      const res = await fetch('/api/stock/balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, apiSecret, appCode, brokerId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setVerifyStatus({
          success: true,
          message: `เชื่อมต่อบัญชี Settrade Open API สำเร็จ! บัญชีพร้อมเทรดหุ้นไทย 🟢`,
          canTrade: true,
        });
      } else {
        setVerifyStatus({
          success: false,
          message: data.error || 'การเชื่อมต่อล้มเหลว กรุณาตรวจสอบ App Key และ App Secret',
        });
      }
    } catch (err: any) {
      setVerifyStatus({
        success: false,
        message: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!tgBotToken || !tgChatId) {
      setTgTestStatus({
        success: false,
        message: 'กรุณากรอก Telegram Bot Token และ Chat ID ก่อนทดสอบ',
      });
      return;
    }

    setIsTestingTg(true);
    setTgTestStatus(null);
    try {
      const res = await sendTelegramTestAlert({
        botToken: tgBotToken,
        chatId: tgChatId,
      });

      if (res.success) {
        setTgTestStatus({
          success: true,
          message: 'ส่งข้อความทดสอบเข้า Telegram สำเร็จ! กรุณาเช็คในแอป Telegram ของคุณ 📲',
        });
      } else {
        setTgTestStatus({
          success: false,
          message: res.error || 'ส่งข้อความไม่สำเร็จ กรุณาตรวจสอบ Token และ Chat ID',
        });
      }
    } catch (err: any) {
      setTgTestStatus({
        success: false,
        message: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Telegram',
      });
    } finally {
      setIsTestingTg(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedTelegramConfig: TelegramConfig = {
      botToken: tgBotToken,
      chatId: tgChatId,
      isEnabled: tgEnabled,
    };

    onSaveKeys({ apiKey, apiSecret, appCode, brokerId });
    onSaveConfig({
      ...botConfig,
      mode: tradingMode,
      telegramConfig: updatedTelegramConfig,
    });
    if (onSaveTelegramConfig) {
      onSaveTelegramConfig(updatedTelegramConfig);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">ตั้งค่าระบบ (Settings & Integrations)</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('broker')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center space-x-2 transition ${
              activeTab === 'broker'
                ? 'bg-slate-800 text-emerald-400 shadow font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Settrade API & โหมดเทรด</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('telegram')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center space-x-2 transition ${
              activeTab === 'telegram'
                ? 'bg-slate-800 text-cyan-400 shadow font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>แจ้งเตือน Telegram 📲</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* TAB 1: Settrade Broker Settings */}
          {activeTab === 'broker' && (
            <div className="space-y-4">
              {/* Trading Mode Radio */}
              <div className="space-y-2">
                <label className="text-slate-300 font-semibold block">เลือกโหมดการทำงานของบอท</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTradingMode('PAPER')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between space-y-1 ${
                      tradingMode === 'PAPER'
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-emerald-400 font-bold">🟢 Paper Trading (จำลอง)</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ใช้เงินจำลอง (฿100,000 THB) ไม่มีความเสี่ยง ปลอดภัย 100%
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTradingMode('SETTRADE_LIVE')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between space-y-1 ${
                      tradingMode === 'SETTRADE_LIVE'
                        ? 'bg-amber-500/15 border-amber-500/50 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-amber-400 font-bold">⚡ Settrade Live / Sandbox</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ส่งคำสั่งซื้อขายเข้าพอร์ต Settrade Open API (ตลาดหุ้นไทย SET)
                    </span>
                  </button>
                </div>
              </div>

              {/* Thai Stock Market Info */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start space-x-2 text-[10px] text-slate-400">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>ตลาดหลักทรัพย์แห่งประเทศไทย (SET)</strong>: บอทนี้ทำงานด้วยสูตร CDC Action Zone V2 (ลุงโฉลก - Chaloke.org) ซื้อเมื่อสัญญาณฟ้า/เขียวคอนเฟิร์ม และขายออกเพื่อถือเงินสดเมื่อสัญญาณแดง
                </span>
              </div>

              {/* App Key Input */}
              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">Settrade App Key</label>
                <input
                  type="text"
                  placeholder="กรอก App Key จาก Settrade Open API..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500"
                />
              </div>

              {/* App Secret Input */}
              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">Settrade App Secret</label>
                <input
                  type="password"
                  placeholder="กรอก App Secret..."
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500"
                />
              </div>

              {/* App Code / Broker ID Input */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">App Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="เช่น SANDBOX_APP"
                    value={appCode}
                    onChange={(e) => setAppCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium block">Broker ID</label>
                  <input
                    type="text"
                    placeholder="SANDBOX / 098"
                    value={brokerId}
                    onChange={(e) => setBrokerId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500 text-xs"
                  />
                </div>
              </div>

              {/* Verify Connection Button */}
              <button
                type="button"
                onClick={testConnection}
                disabled={isVerifying || !apiKey || !apiSecret}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-semibold transition flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                <span>ทดสอบการเชื่อมต่อ API (Settrade)</span>
              </button>

              {/* Verification Result Message */}
              {verifyStatus && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                    verifyStatus.success
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                  }`}
                >
                  {verifyStatus.success ? (
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  )}
                  <span>{verifyStatus.message}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Telegram Notification Settings */}
          {activeTab === 'telegram' && (
            <div className="space-y-4">
              {/* Telegram Enable Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <Bell className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="text-white font-bold block">เปิดระบบแจ้งเตือนผ่าน Telegram</span>
                    <span className="text-[10px] text-slate-400">ส่งแจ้งเตือนสัญญาณซื้อขายและสรุป PnL อัตโนมัติ</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tgEnabled}
                    onChange={(e) => setTgEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Bot Token */}
              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">Telegram Bot Token</label>
                <input
                  type="text"
                  placeholder="เช่น 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                  value={tgBotToken}
                  onChange={(e) => setTgBotToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500"
                />
              </div>

              {/* Chat ID */}
              <div className="space-y-1">
                <label className="text-slate-300 font-medium block">Telegram Chat ID (หรือ Group ID)</label>
                <input
                  type="text"
                  placeholder="เช่น 123456789 หรือ -100123456789"
                  value={tgChatId}
                  onChange={(e) => setTgChatId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500"
                />
              </div>

              {/* How to get Token and Chat ID Guide */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2 text-[11px] text-slate-400">
                <div className="flex items-center space-x-1.5 text-cyan-400 font-bold">
                  <Info className="w-3.5 h-3.5" />
                  <span>วิธีสร้าง Telegram Bot & รับ Chat ID ใน 2 นาที:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>ค้นหา <span className="text-cyan-300 font-mono">@BotFather</span> ใน Telegram แล้วส่งคำสั่ง <code className="text-amber-400">/newbot</code> เพื่อสร้างบอทและรับ <b>Bot Token</b></li>
                  <li>กด <b>Start</b> คุยกับบอทที่คุณเพิ่งสร้างขึ้นมา 1 ครั้ง</li>
                  <li>ค้นหา <span className="text-cyan-300 font-mono">@userinfobot</span> ใน Telegram เพื่อดูเลข <b>Chat ID (Id)</b> ของคุณ</li>
                </ol>
              </div>

              {/* Test Telegram Alert Button */}
              <button
                type="button"
                onClick={handleTestTelegram}
                disabled={isTestingTg || !tgBotToken || !tgChatId}
                className="w-full py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/40 hover:border-cyan-500/60 rounded-xl font-semibold transition flex items-center justify-center space-x-2 disabled:opacity-40"
              >
                <Send className={`w-3.5 h-3.5 ${isTestingTg ? 'animate-bounce' : ''}`} />
                <span>{isTestingTg ? 'กำลังส่งข้อความ...' : '🔔 ทดสอบส่งข้อความเข้า Telegram (Test Alert)'}</span>
              </button>

              {/* Telegram Test Result */}
              {tgTestStatus && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                    tgTestStatus.success
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                  }`}
                >
                  {tgTestStatus.success ? (
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  )}
                  <span>{tgTestStatus.message}</span>
                </div>
              )}
            </div>
          )}

          {/* Footer Save / Cancel Buttons */}
          <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg transition"
            >
              บันทึกการตั้งค่าทั้งหมด
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
