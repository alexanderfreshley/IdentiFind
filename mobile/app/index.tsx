/**
 * Entry point — immediately redirects based on auth state.
 * This file is required by Expo Router to handle the root "/" route.
 */

import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/colors';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return user
    ? <Redirect href="/(tabs)" />
    : <Redirect href="/(auth)/login" />;
}
