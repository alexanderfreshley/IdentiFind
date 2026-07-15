/**
 * Deep-link callback screen — identifind://auth/callback
 *
 * After the OAuth provider redirects back into the app, Expo Router
 * renders this screen. It extracts the session token from the URL,
 * saves it, then redirects to the tab shell.
 *
 * This screen should never be visible — it transitions immediately.
 */

import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { saveSessionToken } from '@/lib/storage';
import { getSession } from '@/lib/api';
import { Colors } from '@/constants/colors';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ token?: string }>();

  useEffect(() => {
    (async () => {
      const token = params.token;
      if (!token) {
        // No token — fall back to login
        router.replace('/(auth)/login');
        return;
      }

      await saveSessionToken(token);
      const session = await getSession();

      if (session) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    })();
  }, [params.token]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={Colors.accent} size="large" />
    </View>
  );
}
