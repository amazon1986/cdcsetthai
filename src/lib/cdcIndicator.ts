import { KlineData, CDCZoneColor, CDCSignalType } from '../types';

/**
 * Calculates Exponential Moving Average (EMA) for an array of prices
 */
export function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = new Array(prices.length).fill(0);
  if (prices.length < period) return ema;

  // Initial SMA as first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  ema[period - 1] = sum / period;

  const k = 2 / (period + 1);

  for (let i = period; i < prices.length; i++) {
    ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
  }

  // Backfill earlier indices with SMA approximations
  let cumulative = 0;
  for (let i = 0; i < period - 1; i++) {
    cumulative += prices[i];
    ema[i] = cumulative / (i + 1);
  }

  return ema;
}

/**
 * Calculates CDC Action Zone V2 / V3 indicators for a series of candlestick data.
 */
export function calculateCDCActionZone(
  rawCandles: KlineData[],
  fastPeriod = 12,
  slowPeriod = 26
): KlineData[] {
  if (!rawCandles || rawCandles.length === 0) return [];

  const closePrices = rawCandles.map((c) => c.close);
  const emaFastList = calculateEMA(closePrices, fastPeriod);
  const emaSlowList = calculateEMA(closePrices, slowPeriod);

  const result: KlineData[] = [];

  for (let i = 0; i < rawCandles.length; i++) {
    const candle = rawCandles[i];
    const close = candle.close;
    const fast = emaFastList[i];
    const slow = emaSlowList[i];

    const prevCandle = i > 0 ? result[i - 1] : null;
    const prevFast = prevCandle?.emaFast ?? fast;
    const prevSlow = prevCandle?.emaSlow ?? slow;
    const prevClose = prevCandle?.close ?? close;

    let zone: CDCZoneColor = 'CYAN';
    let signal: CDCSignalType = 'NEUTRAL';
    let colorNameTh = 'โซนสถิตย์';
    let actionRecommendation = 'รอสัญญาณ';

    const isBullishCross = prevFast <= prevSlow && fast > slow;
    const isBearishCross = prevFast >= prevSlow && fast < slow;

    // CDC Action Zone V2 Logic
    if (fast > slow) {
      // Bullish Regime
      if (close >= fast) {
        // Above Fast EMA
        if (isBullishCross || (prevCandle && (prevCandle.zone === 'YELLOW' || prevCandle.zone === 'RED' || prevCandle.zone === 'ORANGE'))) {
          zone = 'BLUE';
          signal = 'BUY';
          colorNameTh = 'โซนฟ้า (สัญญาณซื้อ)';
          actionRecommendation = 'เข้าซื้อ / Buy Trigger';
        } else {
          zone = 'GREEN';
          signal = 'HOLD_BULL';
          colorNameTh = 'โซนเขียว (ขาขึ้นรุนแรง)';
          actionRecommendation = 'ถือครอง / Hold Long';
        }
      } else {
        // Close < Fast EMA while Fast > Slow EMA
        zone = 'YELLOW';
        signal = 'WARNING';
        colorNameTh = 'โซนเหลือง (เตือนระวัง)';
        actionRecommendation = 'เตรียมขาย / Take Profit Warning';
      }
    } else if (fast < slow) {
      // Bearish Regime
      if (close <= fast) {
        // Below Fast EMA
        if (isBearishCross) {
          signal = 'SELL';
        } else {
          signal = 'HOLD_BEAR';
        }
        zone = 'RED';
        colorNameTh = 'โซนแดง (ขาลง / ถือเงินสด)';
        actionRecommendation = 'ขายออก / Hold Cash / Short';
      } else {
        // Close > Fast EMA while Fast < Slow EMA
        zone = 'ORANGE';
        signal = 'NEUTRAL';
        colorNameTh = 'โซนส้ม (รีบาวด์หลอก)';
        actionRecommendation = 'อย่าเพิ่งซื้อ / Bearish Bounce';
      }
    } else {
      zone = 'CYAN';
      signal = 'NEUTRAL';
      colorNameTh = 'โซนไซแอน (ไซด์เวย์)';
      actionRecommendation = 'เฝ้าระวัง';
    }

    result.push({
      ...candle,
      emaFast: fast,
      emaSlow: slow,
      zone,
      signal,
      colorNameTh,
      actionRecommendation,
    });
  }

  return result;
}

/**
 * Returns hex color code for CDC Action Zone
 */
export function getZoneColorHex(zone?: CDCZoneColor): string {
  switch (zone) {
    case 'GREEN':
      return '#22c55e'; // Green 500
    case 'BLUE':
      return '#3b82f6'; // Blue 500
    case 'YELLOW':
      return '#eab308'; // Yellow 500
    case 'RED':
      return '#ef4444'; // Red 500
    case 'ORANGE':
      return '#f97316'; // Orange 500
    case 'CYAN':
    default:
      return '#06b6d4'; // Cyan 500
  }
}

/**
 * Returns Thai name for CDC Zone
 */
export function getZoneNameTh(zone?: CDCZoneColor): string {
  switch (zone) {
    case 'GREEN':
      return 'โซนเขียว (Buy & Hold)';
    case 'BLUE':
      return 'โซนฟ้า (Buy Signal)';
    case 'YELLOW':
      return 'โซนเหลือง (Take Profit)';
    case 'RED':
      return 'โซนแดง (Sell / Hold Cash)';
    case 'ORANGE':
      return 'โซนส้ม (Bearish Bounce)';
    case 'CYAN':
    default:
      return 'โซนไซแอน (Sideways)';
  }
}

export interface CrossoverInfo {
  lastGoldenCrossBarIndex: number;
  lastDeadCrossBarIndex: number;
  barsSinceGoldenCross: number;
  barsSinceDeadCross: number;
  isFreshGoldenCross: boolean; // True ONLY if Golden Cross occurred on bar 0 (crossover) or bar 1 (next confirmation bar)
  isFreshDeadCross: boolean;   // True ONLY if Dead Cross occurred on bar 0 (crossunder) or bar 1 (next confirmation bar)
}

/**
 * Calculates exact bars since the last true EMA 12 / EMA 26 Crossover.
 * This guarantees the bot NEVER enters late into an old trend (preventing buying tops or shorting bottoms).
 */
export function getCrossoverInfo(candles: KlineData[]): CrossoverInfo {
  let lastGoldenCross = -1;
  let lastDeadCross = -1;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    if (
      prev.emaFast !== undefined &&
      prev.emaSlow !== undefined &&
      curr.emaFast !== undefined &&
      curr.emaSlow !== undefined
    ) {
      if (prev.emaFast <= prev.emaSlow && curr.emaFast > curr.emaSlow) {
        lastGoldenCross = i;
      } else if (prev.emaFast >= prev.emaSlow && curr.emaFast < curr.emaSlow) {
        lastDeadCross = i;
      }
    }
  }

  const n = candles.length;
  const barsSinceGoldenCross = lastGoldenCross >= 0 ? n - 1 - lastGoldenCross : 999;
  const barsSinceDeadCross = lastDeadCross >= 0 ? n - 1 - lastDeadCross : 999;

  return {
    lastGoldenCrossBarIndex: lastGoldenCross,
    lastDeadCrossBarIndex: lastDeadCross,
    barsSinceGoldenCross,
    barsSinceDeadCross,
    // 🎯 Only within 0 (crossover bar) or 1 (next confirmation bar) according to Uncle Chaloke's rule:
    isFreshGoldenCross: barsSinceGoldenCross <= 1,
    isFreshDeadCross: barsSinceDeadCross <= 1,
  };
}

/**
 * Calculates bars since the current CDC Action Zone started
 */
export function getBarsSinceZoneChange(candles: KlineData[]): number {
  if (!candles || candles.length === 0) return 999;
  const latestZone = candles[candles.length - 1].zone;
  let count = 0;
  for (let i = candles.length - 2; i >= 0; i--) {
    if (candles[i].zone === latestZone) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * 5-Factor CDC Quality Score Algorithm (0-100 Points)
 * Analyzes:
 * 1. Recency (0-25 pts): Signal freshness
 * 2. Zone (0-25 pts): CDC Action Zone state
 * 3. Trend Strength (0-20 pts): Fast vs Slow EMA spread & divergence
 * 4. Volume 24h (0-15 pts): Turnover liquidity backing
 * 5. Price Change % (0-15 pts): Balanced momentum without extreme overbought
 */
export function calculateCdcQualityScore(params: {
  zone: CDCZoneColor;
  barsSinceSignal: number;
  trendStrength: number;
  volume24h: number;
  priceChange24h: number;
}): import('../types').QualityScoreBreakdown {
  const { zone, barsSinceSignal, trendStrength, volume24h, priceChange24h } = params;

  // 1. Recency (0-25)
  let recencyScore = 2;
  let recencyDetail = `สัญญาณดำเนินมานาน (${barsSinceSignal} แท่ง)`;
  if (barsSinceSignal === 0) {
    recencyScore = 25;
    recencyDetail = 'สดใหม่มาก! สัญญาณเพิ่งเกิดในแท่งปัจจุบัน (0 แท่ง)';
  } else if (barsSinceSignal === 1) {
    recencyScore = 23;
    recencyDetail = 'ยืนยันสัญญาณแรก แท่งที่ 1 (Fresh Confirmation)';
  } else if (barsSinceSignal <= 3) {
    recencyScore = 18;
    recencyDetail = `สัญญาณต้นรอบ (${barsSinceSignal} แท่งก่อนหน้า)`;
  } else if (barsSinceSignal <= 7) {
    recencyScore = 12;
    recencyDetail = `เทรนด์กำลังดำเนิน (${barsSinceSignal} แท่ง)`;
  } else if (barsSinceSignal <= 15) {
    recencyScore = 6;
    recencyDetail = `เทรนด์ดำเนินมาระยะหนึ่ง (${barsSinceSignal} แท่ง)`;
  }

  // 2. Zone (0-25)
  let zoneScore = 0;
  let zoneDetail = 'โซนแดง ขาลง / ควรถือเงินสด';
  if (zone === 'BLUE') {
    zoneScore = 25;
    zoneDetail = 'โซนฟ้า สัญญาณซื้อเริ่มต้นรอบใหม่ (Buy Trigger)';
  } else if (zone === 'GREEN') {
    zoneScore = 20;
    zoneDetail = 'โซนเขียว รันเทรนด์ขาขึ้นเต็มตัว (Strong Bull)';
  } else if (zone === 'CYAN') {
    zoneScore = 10;
    zoneDetail = 'โซนไซแอน ไซด์เวย์ พักตัวรอทิศทาง';
  } else if (zone === 'ORANGE') {
    zoneScore = 8;
    zoneDetail = 'โซนส้ม รีบาวด์ระยะสั้นในขาลง';
  } else if (zone === 'YELLOW') {
    zoneScore = 5;
    zoneDetail = 'โซนเหลือง เตือนระวังเริ่มชะลอตัว / เตรียมขายทำกำไร';
  }

  // 3. Trend Strength (0-20)
  let trendScore = 0;
  let trendDetail = `แนวโน้มอ่อนแอ / ตัดลง (${trendStrength >= 0 ? '+' : ''}${trendStrength.toFixed(2)}%)`;
  if (trendStrength >= 3.0) {
    trendScore = 20;
    trendDetail = `เส้น EMA กางกว้างแข็งแกร่งมาก (+${trendStrength.toFixed(2)}%)`;
  } else if (trendStrength >= 1.5) {
    trendScore = 16;
    trendDetail = `แนวโน้มขาขึ้นแข็งแรง (+${trendStrength.toFixed(2)}%)`;
  } else if (trendStrength >= 0.5) {
    trendScore = 12;
    trendDetail = `เริ่มกางออกเป็นบวก (+${trendStrength.toFixed(2)}%)`;
  } else if (trendStrength >= 0.0) {
    trendScore = 8;
    trendDetail = `กางเล็กน้อย (+${trendStrength.toFixed(2)}%)`;
  } else if (trendStrength >= -1.0) {
    trendScore = 4;
    trendDetail = `บีบตัวใกล้จุดเปลี่ยน (${trendStrength.toFixed(2)}%)`;
  }

  // 4. Volume 24h (0-15)
  let volumeScore = 2;
  const volMil = volume24h / 1_000_000;
  let volumeDetail = `วอลุ่มเบาบาง (฿${volMil.toFixed(2)}M)`;
  if (volume24h >= 50_000_000) {
    volumeScore = 15;
    volumeDetail = `วอลุ่มหนาแน่นสูงมาก (฿${volMil.toFixed(1)}M)`;
  } else if (volume24h >= 20_000_000) {
    volumeScore = 12;
    volumeDetail = `วอลุ่มหนาแน่นปานกลางค่อนข้างสูง (฿${volMil.toFixed(1)}M)`;
  } else if (volume24h >= 5_000_000) {
    volumeScore = 9;
    volumeDetail = `วอลุ่มปานกลาง (฿${volMil.toFixed(1)}M)`;
  } else if (volume24h >= 1_000_000) {
    volumeScore = 6;
    volumeDetail = `วอลุ่มระดับพอใช้ (฿${volMil.toFixed(1)}M)`;
  }

  // 5. Price Change 24h % (0-15)
  let priceScore = 1;
  let priceDetail = `ราคาติดลบหนัก (${priceChange24h.toFixed(2)}%)`;
  if (priceChange24h >= 2.0 && priceChange24h <= 7.0) {
    priceScore = 15;
    priceDetail = `โมเมนตัมกำลังสวย ไม่ overbought (+${priceChange24h.toFixed(2)}%)`;
  } else if (priceChange24h > 0.5 && priceChange24h < 2.0) {
    priceScore = 12;
    priceDetail = `เริ่มขยับบวกเบาๆ (+${priceChange24h.toFixed(2)}%)`;
  } else if (priceChange24h > 7.0) {
    priceScore = 9;
    priceDetail = `พุ่งแรง ระวังการไล่ราคา (+${priceChange24h.toFixed(2)}%)`;
  } else if (priceChange24h >= 0.0 && priceChange24h <= 0.5) {
    priceScore = 7;
    priceDetail = `ราคาทรงตัว (+${priceChange24h.toFixed(2)}%)`;
  } else if (priceChange24h >= -2.0 && priceChange24h < 0.0) {
    priceScore = 5;
    priceDetail = `ย่อตัวเล็กน้อย (${priceChange24h.toFixed(2)}%)`;
  }

  const totalScore = Math.min(100, Math.max(0, recencyScore + zoneScore + trendScore + volumeScore + priceScore));

  let grade: 'S' | 'A' | 'B' | 'C' | 'D' = 'D';
  let gradeLabel = '🚫 ไม่แนะนำ (D)';
  if (totalScore >= 90) {
    grade = 'S';
    gradeLabel = '🌟 คุณภาพพรีเมียม (Grade S)';
  } else if (totalScore >= 75) {
    grade = 'A';
    gradeLabel = '💎 คุณภาพสูง (Grade A)';
  } else if (totalScore >= 60) {
    grade = 'B';
    gradeLabel = '⚡ คุณภาพปานกลาง (Grade B)';
  } else if (totalScore >= 40) {
    grade = 'C';
    gradeLabel = '⚠️ สัญญาณเฝ้าระวัง (Grade C)';
  }

  return {
    totalScore,
    grade,
    gradeLabel,
    recency: { score: recencyScore, maxScore: 25, label: 'ความสดใหม่ (Recency)', detail: recencyDetail },
    zone: { score: zoneScore, maxScore: 25, label: 'โซนสี CDC (Zone)', detail: zoneDetail },
    trendStrength: { score: trendScore, maxScore: 20, label: 'ความแข็งแกร่ง (Trend)', detail: trendDetail },
    volume24h: { score: volumeScore, maxScore: 15, label: 'วอลุ่ม 24 ชม. (Volume)', detail: volumeDetail },
    priceChange: { score: priceScore, maxScore: 15, label: 'การเปลี่ยนแปลงราคา (Price %)', detail: priceDetail },
  };
}
