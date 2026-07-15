/**
 * Login screen — the first screen unauthenticated users see.
 * Each button opens the OAuth flow for that provider via expo-auth-session.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth, type OAuthProvider } from '@/hooks/useAuth';
import { Colors } from '@/constants/colors';

const PROVIDERS: Array<{
  id:    OAuthProvider;
  label: string;
  icon:  keyof typeof Ionicons.glyphMap;
  color: string;
}> = [
  { id: 'google',   label: 'Continue with Google',   icon: 'logo-google',   color: '#EA4335' },
  { id: 'github',   label: 'Continue with GitHub',   icon: 'logo-github',   color: '#F0F6FC' },
  { id: 'linkedin', label: 'Continue with LinkedIn', icon: 'logo-linkedin', color: '#0A66C2' },
  { id: 'twitter',  label: 'Continue with Twitter',  icon: 'logo-twitter',  color: '#1DA1F2' },
];

export default function LoginScreen() {
  const { signIn }                = useAuth();
  const [loading, setLoading]     = useState<OAuthProvider | null>(null);

  async function handleSignIn(provider: OAuthProvider) {
    setLoading(provider);
    try {
      await signIn(provider);
    } catch (err) {
      Alert.alert(
        'Sign-in failed',
        'Could not connect to IdentiFind. Make sure the app server is running and your API URL is set correctly.',
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / wordmark */}
        <View style={styles.hero}>
          <View style={styles.logoMark}>
            <Ionicons name="shield-checkmark" size={36} color={Colors.accent} />
          </View>
          <Text style={styles.wordmark}>IdentiFind</Text>
          <Text style={styles.tagline}>
            Monitor your digital identity.{'\n'}Get alerted before it's too late.
          </Text>
        </View>

        {/* OAuth buttons */}
        <View style={styles.buttons}>
          {PROVIDERS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.providerBtn}
              onPress={() => handleSignIn(p.id)}
              disabled={loading !== null}
              activeOpacity={0.8}
            >
              {loading === p.id ? (
                <ActivityIndicator color={Colors.accent} size="small" />
              ) : (
                <Ionicons name={p.icon} size={20} color={p.color} />
              )}
              <Text style={styles.providerBtnText}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.legalNote}>
          By signing in you agree to IdentiFind's Terms of Service and Privacy Policy.
          Your data is encrypted at rest and never sold.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: Colors.bg,
  },
  container: {
    flexGrow:         1,
    alignItems:       'center',
    justifyContent:   'center',
    paddingHorizontal:32,
    paddingVertical:  40,
  },
  hero: {
    alignItems:   'center',
    marginBottom: 48,
  },
  logoMark: {
    width:           72,
    height:          72,
    borderRadius:    20,
    backgroundColor: Colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,
    borderWidth:     1,
    borderColor:     Colors.border,
  },
  wordmark: {
    fontSize:     28,
    fontWeight:   '700',
    color:        Colors.text,
    marginBottom: 10,
  },
  tagline: {
    fontSize:   15,
    color:      Colors.textMuted,
    textAlign:  'center',
    lineHeight: 22,
  },
  buttons: {
    width:        '100%',
    gap:          12,
    marginBottom: 32,
  },
  providerBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    backgroundColor: Colors.surface,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     Colors.border,
    paddingVertical: 14,
    paddingHorizontal:20,
  },
  providerBtnText: {
    fontSize:   15,
    fontWeight: '500',
    color:      Colors.text,
  },
  legalNote: {
    fontSize:  11,
    color:     Colors.textFaint,
    textAlign: 'center',
    lineHeight:17,
  },
});
