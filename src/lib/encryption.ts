/**
 * Lightweight, synchronous encryption utility to protect Settrade / Broker API Keys
 * stored in the browser's localStorage from direct inspection.
 */

const ENCRYPTION_KEY = 'cdc_action_zone_stock_bot_secure_salt_987654321';

/**
 * Encrypts plaintext using XOR cipher with a static salt and encodes to Base64
 */
export function encryptText(text: string | undefined | null): string {
  if (!text) return '';
  try {
    let encrypted = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const keyChar = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      // XOR the char code with the key char and convert to a padded 4-digit hex
      const ciphered = (charCode ^ keyChar).toString(16).padStart(4, '0');
      encrypted += ciphered;
    }
    return btoa(encrypted);
  } catch (error) {
    console.error('Encryption failed:', error);
    return '';
  }
}

/**
 * Decrypts a Base64 encoded cipher text back to plaintext
 */
export function decryptText(cipherText: string | undefined | null): string {
  if (!cipherText) return '';
  try {
    const decodedHex = atob(cipherText);
    let decrypted = '';
    for (let i = 0; i < decodedHex.length; i += 4) {
      const hexChunk = decodedHex.substring(i, i + 4);
      const cipherCode = parseInt(hexChunk, 16);
      const keyChar = ENCRYPTION_KEY.charCodeAt((i / 4) % ENCRYPTION_KEY.length);
      decrypted += String.fromCharCode(cipherCode ^ keyChar);
    }
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}
