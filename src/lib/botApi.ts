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
