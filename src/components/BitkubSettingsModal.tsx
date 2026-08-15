import React, { useState } from 'react';
import { BitkubApiKeys, BotConfig } from '../types';
import { X, Key, Shield, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface BitkubSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  keys: BitkubApiKeys;
  botConfig: BotConfig;
  onSaveKeys: (newKeys: BitkubApiKeys) => void;
  onSaveConfig: (newConfig: BotConfig) => void;
}

export const BitkubSettingsModal: React.FC<BitkubSettingsModalProps> = ({
  isOpen,
  onClose,
  keys,
  botConfig,
  onSaveKeys,
  onSaveConfig,
}) => {
  const [apiKey, setApiKey] = useState(keys.apiKey || '');
  const [apiSecret, setApiSecret] = useState(keys.apiSecret || '');
  const [tradingMode, setTradingMode] = useState<'PAPER' | 'BITKUB_LIVE'>(botConfig.mode);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{
    success: boolean;
    message: string;
    canTrade?: boolean;
  } | null>(null);

  if (!isOpen) return null;

  const testConnection = async () => {
    setIsVerifying(true);
    setVerifyStatus(null);
    try {
      const res = await fetch('/api/bitkub/balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, apiSecret }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setVerifyStatus({
          success: true,
          message: `เชื่อมต่อบัญชี Settrade Sandbox สำเร็จ! ดึงข้อมูลยอดเงินสำเร็จ 🟢`,
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveKeys({ apiKey, apiSecret });
    onSaveConfig({ ...botConfig, mode: tradingMode });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">ตั้งค่าการเชื่อมต่อ Settrade API & Mode</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Trading Mode Radio */}
          <div className="space-y-2">
            <label className="text-slate-300 font-semibold block">เลือกโหมดการทำงานของ บอท</label>
            <div className="grid grid-cols-2 gap-3">
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
                  ใช้เงินจำลอง (฿100,000) ไม่มีความเสี่ยง ปลอดภัย 100%
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTradingMode('BITKUB_LIVE')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between space-y-1 ${
                  tradingMode === 'BITKUB_LIVE'
                    ? 'bg-amber-500/15 border-amber-500/50 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="text-amber-400 font-bold">⚡ Settrade Sandbox API</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  ส่งคำสั่งซื้อขายจริงเข้า Settrade Sandbox/โบรกเกอร์ (ตลาดหุ้นไทย)
                </span>
              </button>
            </div>
          </div>

          {/* Warning spot only */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start space-x-2 text-[10px] text-slate-400">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>SET Stock Market</strong>: บอทนี้จะทำงานในระบบตลาดหลักทรัพย์แห่งประเทศไทย (SET) ซึ่งจะทำการเปิดฝั่ง Buy (เพื่อซื้อหุ้น) และ Sell (เพื่อขายหุ้นออก) ตามสัญญาณ CDC Action Zone เป็นหลัก
            </span>
          </div>

          {/* App Key Input */}
          <div className="space-y-1">
            <label className="text-slate-300 font-medium block">Settrade App Key (Sandbox)</label>
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
            <label className="text-slate-300 font-medium block">Settrade App Secret (Sandbox)</label>
            <input
              type="password"
              placeholder="กรอก App Secret..."
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500"
            />
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

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg"
            >
              บันทึกการตั้งค่า
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
