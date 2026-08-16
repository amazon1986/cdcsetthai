import { BotConfig, PaperAccount, ExecutedTrade, SettradeApiKeys } from '../types';

export interface BotServerState {
  botConfig: BotConfig;
  paperAccount: PaperAccount;
  tradeHistory: ExecutedTrade[];
  botLogs: string[];
  serverTime: number;
  isServerRunning: boolean;
}

/**
 * Fetches the central bot state from the server.
 */
export async function fetchBotServerState(): Promise<BotServerState | null> {
  try {
    const res = await fetch('/api/bot/state');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Updates bot configuration on the server.
 */
export async function saveBotServerConfig(config: BotConfig): Promise<boolean> {
  try {
    const res = await fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Toggles bot active state on the server.
 */
export async function toggleBotServer(isActive?: boolean): Promise<{ success: boolean; isActive: boolean }> {
  try {
    const res = await fetch('/api/bot/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    if (!res.ok) return { success: false, isActive: false };
    return await res.json();
  } catch {
    return { success: false, isActive: false };
  }
}

/**
 * Sends a manual buy/long or sell order to the server.
 */
export async function sendManualOrderToServer(params: {
  symbol: string;
  side: 'LONG' | 'SHORT';
  amountUsdt: number;
  currentPrice: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/bot/manual-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return { success: res.ok && !data.error, error: data.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Closes an active position on the server.
 */
export async function closePositionOnServer(params: {
  symbol: string;
  currentPrice: number;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/bot/close-position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return { success: res.ok && !data.error, error: data.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Clears bot execution logs on the server.
 */
export async function clearBotServerLogs(): Promise<boolean> {
  try {
    const res = await fetch('/api/bot/clear-logs', { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resets paper trading balance on the server.
 */
export async function resetBotServerPaperAccount(): Promise<boolean> {
  try {
    const res = await fetch('/api/bot/reset-paper', { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Saves encrypted Settrade / Broker API keys to backend server for 24/7 automated execution.
 */
export async function saveBrokerKeysToServer(keys: SettradeApiKeys): Promise<boolean> {
  try {
    const res = await fetch('/api/stock/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(keys),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Sends a test notification to Telegram via backend with client fallback
 */
export async function sendTelegramTestAlert(params: {
  botToken: string;
  chatId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { botToken, chatId } = params;
  if (!botToken || !chatId) {
    return { success: false, error: 'กรุณาระบุ Bot Token และ Chat ID' };
  }

  const testMsg =
    `🔔 <b>ทดสอบการเชื่อมต่อ Telegram สำเร็จ!</b>\n\n` +
    `🚀 ระบบ <b>CDC Action Zone V2 SET Thai Stock Bot</b> เชื่อมต่อระบบแจ้งเตือนสำเร็จ พร้อมส่งสัญญาณเทรดและสรุปผลกำไร-ขาดทุนให้คุณแบบ Realtime 24/7 ครับ 📈✨`;

  // 1. Try sending through backend endpoint first
  try {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true };
      }
      if (data.error) {
        return { success: false, error: data.error };
      }
    }
  } catch (backendErr) {
    console.warn('Backend Telegram test endpoint unavailable, trying direct Telegram API fallback...', backendErr);
  }

  // 2. Direct Telegram API Fallback (client-side fallback for Vite dev mode / standalone)
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: testMsg,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    if (data.ok) {
      return { success: true };
    }
    return {
      success: false,
      error: data.description || 'เกิดข้อผิดพลาดจาก Telegram API (กรุณาเช็ค Bot Token หรือ Chat ID)',
    };
  } catch (directErr: any) {
    return {
      success: false,
      error: directErr.message || 'ไม่สามารถส่งข้อความได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
    };
  }
}

