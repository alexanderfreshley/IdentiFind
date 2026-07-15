/**
 * Secure storage wrapper around expo-secure-store.
 * All session tokens and sensitive values go through here — never AsyncStorage.
 */
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  SESSION_TOKEN: 'identifind_session_token',
  USER_ID:       'identifind_user_id',
  BIOMETRIC_ENABLED: 'identifind_biometric_enabled',
} as const;

async function set(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

async function get(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

async function remove(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

// ─── Session token ────────────────────────────────────────────────────────────

export async function saveSessionToken(token: string): Promise<void> {
  await set(KEYS.SESSION_TOKEN, token);
}

export async function getSessionToken(): Promise<string | null> {
  return get(KEYS.SESSION_TOKEN);
}

export async function clearSessionToken(): Promise<void> {
  await remove(KEYS.SESSION_TOKEN);
}

// ─── Biometric preference ─────────────────────────────────────────────────────

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await set(KEYS.BIOMETRIC_ENABLED, String(enabled));
}

export async function getBiometricEnabled(): Promise<boolean> {
  const val = await get(KEYS.BIOMETRIC_ENABLED);
  return val === 'true';
}

// ─── Clear all (sign out) ─────────────────────────────────────────────────────

export async function clearAll(): Promise<void> {
  await Promise.all([
    remove(KEYS.SESSION_TOKEN),
    remove(KEYS.USER_ID),
  ]);
}
