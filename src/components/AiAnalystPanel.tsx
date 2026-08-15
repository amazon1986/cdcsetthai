import React, { useState } from 'react';
import { KlineData, Timeframe, AiAnalysisResponse } from '../types';
import { Cpu, RefreshCw, AlertCircle, CheckCircle, ShieldCheck, TrendingUp } from 'lucide-react';

interface AiAnalystPanelProps {
  symbol: string;
  timeframe: Timeframe;
  latestCandle: KlineData | null;
  recentCandles: KlineData[];
}

export const AiAnalystPanel: React.FC<AiAnalystPanelProps> = ({
  symbol,
  timeframe,
  latestCandle,
  recentCandles,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AiAnalysisResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAiAnalysis = async () => {
    if (!latestCandle) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          timeframe,
          currentPrice: latestCandle.close,
          zone: latestCandle.zone,
          emaFast: latestCandle.emaFast,
          emaSlow: latestCandle.emaSlow,
          candles: recentCandles.slice(-15),
        }),
      });

      if (!response.ok) {
        throw new Error('AI Analysis endpoint failed');
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('ไม่สามารถขอการวิเคราะห์จาก AI ได้ กรุณาตรวจสอบ API Key');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-6">
      {/* Top Title & AI Action Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-cyan-500 to-blue-600 p-2.5 rounded-xl shadow">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Gemini AI Technical Analyst <span className="text-xs text-cyan-400 font-mono">(CDC Specialist)</span>
            </h3>
            <p className="text-xs text-slate-400">
              วิเคราะห์โครงสร้างราคา แนวรับ-แนวต้าน และสภาวะความเสี่ยงของ {symbol} ({timeframe}) ด้วย AI
            </p>
          </div>
        </div>

        <button
          onClick={fetchAiAnalysis}
          disabled={isLoading || !latestCandle}
          className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-lg transition flex items-center space-x-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'วิเคราะห์กราฟด้วย Gemini AI...' : 'ประมวลผลการวิเคราะห์ AI'}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-3 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {analysis ? (
        <div className="space-y-6">
          {/* Summary Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">ภาพรวมเชิงเทคนิค (AI Summary)</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  analysis.marketTrend === 'BULLISH'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : analysis.marketTrend === 'BEARISH'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                }`}
              >
                {analysis.marketTrend}
              </span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed font-sans">{analysis.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Key Levels: Support & Resistance */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>แนวรับ & แนวต้านสำคัญ</span>
              </h4>

              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-emerald-400 block font-semibold text-[11px]">แนวรับ (Support Levels):</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {analysis.keyLevels?.support?.map((s, i) => (
                      <span key={i} className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-lg">
                        ฿{s.toLocaleString()}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-rose-400 block font-semibold text-[11px]">แนวต้าน (Resistance Levels):</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {analysis.keyLevels?.resistance?.map((r, i) => (
                      <span key={i} className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-2.5 py-1 rounded-lg">
                        ฿{r.toLocaleString()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Assessment & Bot Advice */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>คำแนะนำการตั้งค่าบอทและการคุมความเสี่ยง</span>
              </h4>
              <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <div>
                  <span className="text-slate-400 block text-[11px]">คำแนะนำสำหรับ Bot:</span>
                  <p className="font-semibold text-white mt-0.5">{analysis.botRecommendation}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">การประเมินความเสี่ยง:</span>
                  <p className="text-slate-300 mt-0.5">{analysis.riskAssessment}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-8 text-center space-y-2">
          <Cpu className="w-10 h-10 text-cyan-500/40 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-300">พร้อมประมวลผลการวิเคราะห์ด้วย Gemini AI</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            กดปุ่ม "ประมวลผลการวิเคราะห์ AI" ด้านบน เพื่อให้อัลกอริทึมวิเคราะห์สัญญาณ CDC Action Zone V2 ของหุ้น {symbol}
          </p>
        </div>
      )}
    </div>
  );
};
