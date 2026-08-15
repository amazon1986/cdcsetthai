import React, { useState } from 'react';
import {
  Coffee,
  Heart,
  QrCode,
  Copy,
  Check,
  Building2,
  Phone,
  Sparkles,
  Award,
  ExternalLink,
} from 'lucide-react';

export const CoffeeDonation: React.FC = () => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');

  const accountInfo = {
    name: 'นายสุรเดช ชูสวัสดิ์',
    bankName: 'ธนาคารกรุงไทย (Krungthai Bank)',
    branch: 'สาขาถลาง',
    accountNumber: '3880377316',
    accountNumberFormatted: '388-0-377316',
    promptPay: '0980178791',
    promptPayFormatted: '098-017-8791',
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2500);
  };

  // QR Code URL based on promptpay.io API
  const qrCodeUrl = customAmount && !isNaN(Number(customAmount)) && Number(customAmount) > 0
    ? `https://promptpay.io/${accountInfo.promptPay}/${customAmount}.png`
    : `https://promptpay.io/${accountInfo.promptPay}.png`;

  const presetAmounts = [
    { label: '☕ กาแฟ 1 แก้ว', amount: '50' },
    { label: '🍰 กาแฟ + ขนม', amount: '100' },
    { label: '☕☕ เลี้ยงกาแฟทีมงาน', amount: '200' },
    { label: '💖 สนับสนุนเต็มที่', amount: '500' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-blue-500/15 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-xs font-bold">
              <Coffee className="w-3.5 h-3.5" />
              <span>Buy Me a Coffee & Support Developer</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              เลี้ยงกาแฟผู้พัฒนาโปรแกรม ☕
            </h2>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              หากโปรแกรม <strong className="text-emerald-400">CDC Action Zone Trading Bot</strong> ช่วยให้การเทรดของคุณง่ายขึ้น มีวินัย และสร้างกำไรได้ คุณสามารถร่วมสนับสนุนค่าน้ำ ค่าไฟ ค่ากาแฟ เพื่อเป็นกำลังใจในการพัฒนาฟีเจอร์ใหม่ๆ ต่อไปได้ครับ
            </p>
          </div>

          <div className="shrink-0 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md rounded-2xl border border-amber-500/30 shadow-xl">
            <Heart className="w-16 h-16 text-rose-500 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Main Grid: QR Code & Bank Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: PromptPay QR Code Card */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center justify-between space-y-5 text-center">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              <QrCode className="w-4 h-4" />
              <span>สแกน QR Code พร้อมเพย์</span>
            </div>
            <h3 className="text-lg font-bold text-white">พร้อมเพย์ (PromptPay)</h3>
            <p className="text-xs text-slate-400">
              สแกนผ่านแอปธนาคารทุกแห่งในไทยได้ทันที
            </p>
          </div>

          {/* PromptPay QR Frame */}
          <div className="relative p-4 bg-white rounded-2xl shadow-2xl border-4 border-emerald-500/30">
            <img
              src={qrCodeUrl}
              alt="PromptPay QR Code"
              className="w-56 h-56 object-contain rounded-lg"
              onError={(e) => {
                // Fallback to QR server if promptpay.io is unreachable
                (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${accountInfo.promptPay}`;
              }}
            />
            {customAmount && Number(customAmount) > 0 && (
              <div className="mt-2 text-slate-900 font-bold font-mono text-sm">
                จำนวน: {Number(customAmount).toLocaleString()} บาท
              </div>
            )}
          </div>

          {/* Quick Amount Selectors */}
          <div className="w-full space-y-2">
            <span className="text-xs text-slate-400 font-medium block">
              เลือกจำนวนเงินสำหรับใส่ใน QR Code (หรือเว้นว่างไว้):
            </span>
            <div className="grid grid-cols-2 gap-2">
              {presetAmounts.map((preset) => (
                <button
                  key={preset.amount}
                  onClick={() => setCustomAmount(customAmount === preset.amount ? '' : preset.amount)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition border ${
                    customAmount === preset.amount
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  <span>{preset.label}</span>
                  <span className="block text-[10px] opacity-75">{preset.amount} ฿</span>
                </button>
              ))}
            </div>

            {/* Custom Amount Input */}
            <div className="pt-1">
              <input
                type="number"
                placeholder="หรือระบุจำนวนเงินเอง (บาท)..."
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 font-mono text-center focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Right: Bank Transfer & Developer Profile */}
        <div className="lg:col-span-7 space-y-6 flex flex-col justify-between">
          {/* Bank Account Details Card (Krungthai) */}
          <div className="bg-gradient-to-br from-slate-900 via-sky-950/40 to-slate-900 border border-sky-500/30 rounded-3xl p-6 shadow-xl space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shadow">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">บัญชีธนาคารกรุงไทย</h4>
                  <span className="text-xs text-sky-400 font-medium">Krungthai Bank (KTB)</span>
                </div>
              </div>

              <span className="px-3 py-1 bg-sky-500/15 text-sky-300 border border-sky-500/30 rounded-full text-xs font-bold">
                {accountInfo.branch}
              </span>
            </div>

            <div className="space-y-4">
              {/* Account Name */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">ชื่อบัญชี (Account Name)</span>
                  <span className="text-sm font-bold text-white">{accountInfo.name}</span>
                </div>
                <button
                  onClick={() => handleCopy(accountInfo.name, 'name')}
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition flex items-center space-x-1 text-xs"
                  title="คัดลอกชื่อบัญชี"
                >
                  {copiedField === 'name' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">คัดลอกแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>คัดลอก</span>
                    </>
                  )}
                </button>
              </div>

              {/* Account Number */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">เลขที่บัญชี (Account No.)</span>
                  <span className="text-lg font-extrabold text-sky-400 font-mono tracking-wider">
                    {accountInfo.accountNumberFormatted}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(accountInfo.accountNumber, 'acc')}
                  className="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold transition flex items-center space-x-1.5 text-xs shadow-lg"
                  title="คัดลอกเลขบัญชีธนาคาร"
                >
                  {copiedField === 'acc' ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>คัดลอกแล้ว!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>คัดลอกเลขบัญชี</span>
                    </>
                  )}
                </button>
              </div>

              {/* PromptPay Phone Number */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">เบอร์พร้อมเพย์ (PromptPay ID)</span>
                  <span className="text-base font-bold text-emerald-400 font-mono tracking-wider flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{accountInfo.promptPayFormatted}</span>
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(accountInfo.promptPay, 'promptpay')}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition flex items-center space-x-1.5 text-xs shadow-lg"
                  title="คัดลอกเบอร์พร้อมเพย์"
                >
                  {copiedField === 'promptpay' ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>คัดลอกแล้ว!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>คัดลอกเบอร์</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Thank You Note & Developer Profile */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
            <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
              <Sparkles className="w-4 h-4" />
              <span>ข้อความจากผู้พัฒนา (Developer's Note)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              ขอขอบคุณทุกท่านที่ให้ความสนใจและใช้งาน <strong>CDC Action Zone Bitkub Trading Bot</strong> หวังเป็นอย่างยิ่งว่าเครื่องมือนี้จะมีประโยชน์ต่อการเทรดของท่าน ทุกกำลังใจและทุกการสนับสนุนของท่านจะนำไปพัฒนาอัปเกรดระบบให้มีความแม่นยำ เสถียร และปลอดภัยยิ่งขึ้นต่อไปครับ 🙏
            </p>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>พัฒนาด้วย ❤️ โดย คุณสุรเดช ชูสวัสดิ์</span>
              <span className="text-emerald-400">CDC Action Zone V2 Engine</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
