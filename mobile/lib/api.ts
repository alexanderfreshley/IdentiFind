/**
 * API client for the IdentiFind mobile app.
 *
 * All requests go to the existing Next.js backend.
 * The session token (NextAuth JWT) is attached as a cookie header so
 * the existing /api/* routes work without modification.
 *
 * Base URL is set via EXPO_PUBLIC_API_URL in .env.
 * During local dev this should be your machine's LAN IP:
 *   e.g. http://192.168.1.42:3000
 */

import { getSessionToken } from './storage';
import type {
  ScanSummary,
  ScanTriggerResult,
  SocialAccount,
  UserProfile,
} from './types';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://identifindsolutions.io';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getSessionToken();

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // NextAuth session cookie — the backend reads this to identify the user
      ...(token ? { Cookie: `next-auth.session-token=${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, body);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function getSession(): Promise<UserProfile | null> {
  try {
    const data = await request<{ user: UserProfile }>('/api/auth/session');
    return data?.user ?? null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await request('/api/auth/signout', {
    method: 'POST',
    body: JSON.stringify({ csrfToken: '' }),
  }).catch(() => {});
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

export async function fetchScanResults(): Promise<ScanSummary> {
  return request<ScanSummary>('/api/scan');
}

export async function triggerScan(): Promise<ScanTriggerResult> {
  return request<ScanTriggerResult>('/api/scan', { method: 'POST' });
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export async function fetchAccounts(): Promise<SocialAccount[]> {
  return request<SocialAccount[]>('/api/accounts');
}

export async function removeAccount(id: string): Promise<void> {
  return request(`/api/accounts/${id}`, { method: 'DELETE' });
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export async function resolveFinding(id: string): Promise<void> {
  return request(`/api/alerts/finding/${id}`, { method: 'PATCH' });
}

export async function dismissImpersonation(id: string): Promise<void> {
  return request(`/api/alerts/impersonation/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'DISMISSED' }),
  });
}

// ─── Push notifications ───────────────────────────────────────────────────────

export async function registerPushToken(expoPushToken: string): Promise<void> {
  // Phase 3: endpoint to be added to the Next.js backend
  return request('/api/notifications/register', {
    method: 'POST',
    body: JSON.stringify({ token: expoPushToken }),
  });
}
