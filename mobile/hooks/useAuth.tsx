/**
 * Authentication context for the IdentiFind mobile app.
 *
 * Sign-in flow:
 *   1. expo-auth-session opens a browser to the OAuth provider
 *   2. The provider redirects to the Next.js callback URL on the backend
 *   3. NextAuth creates a session and sets a session cookie
 *   4. The browser is redirected back to the app via deep link (identifind://auth/callback)
 *   5. We extract the session token from the URL and persist it to SecureStore
 *
 * Note: Each OAuth provider must have the mobile redirect URI registered:
 *   identifind://auth/callback
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';

import { getSession, signOut as apiSignOut } from '@/lib/api';
import {
  clearAll,
  getSessionToken,
  saveSessionToken,
} from '@/lib/storage';
import type { UserProfile } from '@/lib/types';

// Required so the auth session browser closes properly on iOS
WebBrowser.maybeCompleteAuthSession();

// ─── Context types ────────────────────────────────────────────────────────────

interface AuthContextValue {
  user:       UserProfile | null;
  isLoading:  boolean;
  signIn:     (provider: OAuthProvider) => Promise<void>;
  signOut:    () => Promise<void>;
}

export type OAuthProvider = 'google' | 'github' | 'linkedin' | 'twitter' | 'facebook';

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider component ───────────────────────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://identifindsolutions.io';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<UserProfile | null>(null);
  const [isLoading, setLoading] = useState(true);

  // On mount: check if a stored session token is still valid
  useEffect(() => {
    (async () => {
      const token = await getSessionToken();
      if (token) {
        const session = await getSession();
        setUser(session);
      }
      setLoading(false);
    })();
  }, []);

  /**
   * Opens the OAuth flow in a system browser.
   * The backend NextAuth route handles the OAuth handshake.
   * On success, NextAuth redirects to identifind://auth/callback?token=...
   */
  const signIn = useCallback(async (provider: OAuthProvider) => {
    // The redirect URI the native app is listening on
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: 'identifind',
      path:   'auth/callback',
    });

    // Send the user to the NextAuth sign-in endpoint for this provider.
    // callbackUrl tells NextAuth where to redirect after a successful sign-in —
    // we use the deep link URI so the OS routes it back into the app.
    const authUrl =
      `${API_BASE}/api/auth/signin/${provider}` +
      `?callbackUrl=${encodeURIComponent(redirectUri)}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type !== 'success') return;

    // Extract the session token NextAuth set in the redirect URL.
    // NextAuth appends it as a query param when callbackUrl is a custom scheme.
    const url    = new URL(result.url);
    const token  = url.searchParams.get('token') ??
                   url.searchParams.get('next-auth.session-token');

    if (!token) {
      console.warn('[Auth] No session token in callback URL:', result.url);
      return;
    }

    await saveSessionToken(token);
    const session = await getSession();
    setUser(session);
    router.replace('/(tabs)');
  }, []);

  const signOut = useCallback(async () => {
    await apiSignOut().catch(() => {});
    await clearAll();
    setUser(null);
    router.replace('/(auth)/login');
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
