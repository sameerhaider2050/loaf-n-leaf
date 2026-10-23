// Cryptographic Device Authentication Manager for Loaf n Leaf POS
// Uses W3C Web Cryptography API (crypto.subtle) with non-extractable ECDSA P-256 keypair

const DB_NAME = 'loaf_n_leaf_device_vault';
const STORE_NAME = 'device_keys';
const KEY_NAME = 'current_device_identity';

export interface DeviceIdentity {
  fingerprint: string;
  publicKeySpki: string; // Base64
  deviceName: string;
  createdAt: string;
}

export interface StoredSession {
  sessionToken: string;
  deviceId: string;
  deviceName: string;
  permittedRoles: string[];
  user: any;
  savedAt: string;
}

// Open IndexedDB database for key storage
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Convert ArrayBuffer to Base64
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert ArrayBuffer to Hex String
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Detect client device platform info
export function getDevicePlatformInfo(): {
  os: string;
  browser: string;
  screen: string;
  userAgent: string;
} {
  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS / iPadOS';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Chrome|Chromium|CriOS/i.test(ua) && !/Edge|Edg|OPR/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox|FxiOS/i.test(ua)) browser = 'Firefox';
  else if (/Edg/i.test(ua)) browser = 'Edge';

  const screen = `${window.screen.width}x${window.screen.height}`;
  return { os, browser, screen, userAgent: ua };
}

// Suggest a default friendly terminal name based on platform
export function suggestDeviceName(): string {
  const info = getDevicePlatformInfo();
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) {
    return `${info.os} Handheld Terminal`;
  }
  return `${info.os} Counter Station`;
}

class DeviceCryptoService {
  private cachedPrivateKey: CryptoKey | null = null;
  private cachedIdentity: DeviceIdentity | null = null;

  /**
   * Retrieves existing non-extractable device keypair from IndexedDB
   * or creates a new ECDSA P-256 keypair if this is the first visit.
   */
  async getOrCreateDeviceIdentity(customName?: string): Promise<{
    identity: DeviceIdentity;
    isNew: boolean;
  }> {
    if (this.cachedIdentity && this.cachedPrivateKey) {
      return { identity: this.cachedIdentity, isNew: false };
    }

    const db = await openDb();

    // Check if key already exists in vault
    const record = await new Promise<{
      privateKey: CryptoKey;
      identity: DeviceIdentity;
    } | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_NAME);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (record && record.privateKey && record.identity) {
      this.cachedPrivateKey = record.privateKey;
      this.cachedIdentity = record.identity;
      return { identity: record.identity, isNew: false };
    }

    // Generate new non-extractable ECDSA P-256 keypair
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      false, // extractable: false -> private key cannot be exported or scraped
      ['sign']
    );

    // Export public key to SPKI format
    const spkiBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeySpki = bufferToBase64(spkiBuffer);

    // Compute cryptographic SHA-256 fingerprint hash
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', spkiBuffer);
    const fullHex = bufferToHex(hashBuffer);
    const fingerprint = fullHex.substring(0, 32); // 32-char hex fingerprint

    const identity: DeviceIdentity = {
      fingerprint,
      publicKeySpki,
      deviceName: customName || suggestDeviceName(),
      createdAt: new Date().toISOString(),
    };

    // Store private key and identity in IndexedDB
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ privateKey: keyPair.privateKey, identity }, KEY_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    this.cachedPrivateKey = keyPair.privateKey;
    this.cachedIdentity = identity;

    return { identity, isNew: true };
  }

  /**
   * Cryptographically signs a server challenge nonce using the non-extractable private key.
   * Returns Base64-encoded IEEE P1363 signature.
   */
  async signChallenge(nonce: string): Promise<string> {
    if (!this.cachedPrivateKey) {
      await this.getOrCreateDeviceIdentity();
    }

    if (!this.cachedPrivateKey) {
      throw new Error('Device private key not initialized in cryptographic vault');
    }

    const enc = new TextEncoder();
    const data = enc.encode(nonce);

    const signatureBuffer = await window.crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      this.cachedPrivateKey,
      data
    );

    return bufferToBase64(signatureBuffer);
  }

  /**
   * Updates friendly name of current device in IndexedDB
   */
  async updateDeviceName(newName: string): Promise<void> {
    if (!this.cachedIdentity) return;
    this.cachedIdentity.deviceName = newName;
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(KEY_NAME);
    req.onsuccess = () => {
      if (req.result) {
        req.result.identity.deviceName = newName;
        store.put(req.result, KEY_NAME);
      }
    };
  }

  /**
   * Session Management: Saves active authorized device session
   */
  saveSession(session: StoredSession): void {
    try {
      localStorage.setItem('lnl_device_session', JSON.stringify(session));
    } catch (e) {
      console.error('Failed to store session in localStorage:', e);
    }
  }

  getStoredSession(): StoredSession | null {
    try {
      const raw = localStorage.getItem('lnl_device_session');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  clearSession(): void {
    localStorage.removeItem('lnl_device_session');
  }

  /**
   * Clear device cryptographic keys from vault (for testing or device reset)
   */
  async resetDeviceVault(): Promise<void> {
    this.cachedPrivateKey = null;
    this.cachedIdentity = null;
    this.clearSession();
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  }
}

export const deviceCrypto = new DeviceCryptoService();
