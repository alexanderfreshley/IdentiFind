/**
 * Accounts screen — connected social accounts with MFA and verification status.
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';
import { ListSkeleton } from '@/components/ui/SkeletonLoader';
import { useAccounts } from '@/hooks/useScan';
import type { SocialAccount } from '@/lib/types';

const PLATFORM_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  GITHUB:    'logo-github',
  TWITTER_X: 'logo-twitter',
  LINKEDIN:  'logo-linkedin',
  FACEBOOK:  'logo-facebook',
  INSTAGRAM: 'logo-instagram',
  YOUTUBE:   'logo-youtube',
  REDDIT:    'logo-reddit',
  DISCORD:   'chatbubbles',
  TIKTOK:    'musical-notes',
};

const PLATFORM_COLORS: Record<string, string> = {
  GITHUB:    '#F0F6FC',
  TWITTER_X: '#1DA1F2',
  LINKEDIN:  '#0A66C2',
  FACEBOOK:  '#1877F2',
  INSTAGRAM: '#E1306C',
  YOUTUBE:   '#FF0000',
  REDDIT:    '#FF4500',
  DISCORD:   '#5865F2',
  TIKTOK:    '#69C9D0',
};

function StatusDot({ ok }: { ok: boolean | null }) {
  if (ok === null) return null;
  return (
    <View style={[styles.statusDot, { backgroundColor: ok ? Colors.success : Colors.error }]} />
  );
}

function AccountRow({ account }: { account: SocialAccount }) {
  const icon  = PLATFORM_ICONS[account.platform] ?? 'globe-outline';
  const color = PLATFORM_COLORS[account.platform] ?? Colors.textMuted;

  return (
    <View style={styles.row}>
      <View style={[styles.platformIcon, { borderColor: color + '40' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.info}>
        <Text style={styles.username}>@{account.username}</Text>
        <Text style={styles.platform}>{account.platform.replace(/_/g, ' ')}</Text>
      </View>
      <View style={styles.checks}>
        <View style={styles.checkItem}>
          <StatusDot ok={account.mfaEnabled} />
          <Text style={styles.checkLabel}>2FA</Text>
        </View>
        <View style={styles.checkItem}>
          <StatusDot ok={account.emailVerified} />
          <Text style={styles.checkLabel}>Email</Text>
        </View>
      </View>
    </View>
  );
}

export default function AccountsScreen() {
  const { data: accounts, isLoading } = useAccounts();

  if (isLoading) return <ListSkeleton rows={4} />;

  const active   = accounts?.filter(a => a.isActive) ?? [];
  const inactive = accounts?.filter(a => !a.isActive) ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Accounts</Text>
        <Text style={styles.subtitle}>{active.length} connected</Text>
      </View>

      {active.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={52} color={Colors.textFaint} />
          <Text style={styles.emptyTitle}>No accounts connected</Text>
          <Text style={styles.emptySubtitle}>
            Connect your social accounts from the web app to start monitoring them here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={active}
          keyExtractor={a => a.id}
          renderItem={({ item }) => <AccountRow account={item} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <Text style={styles.sectionHeader}>Connected Accounts</Text>
          }
          ListFooterComponent={
            inactive.length > 0 ? (
              <>
                <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Inactive</Text>
                {inactive.map(a => (
                  <AccountRow key={a.id} account={a} />
                ))}
              </>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     12,
  },
  title:    { fontSize: 24, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  list:    { paddingBottom: 32 },
  sectionHeader: {
    fontSize:         12,
    fontWeight:       '700',
    color:            Colors.textMuted,
    textTransform:    'uppercase',
    letterSpacing:    0.8,
    marginHorizontal: 20,
    marginTop:        12,
    marginBottom:     8,
  },

  row: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal:20,
    paddingVertical:  14,
    backgroundColor:  Colors.bg,
  },
  separator: { height: 1, backgroundColor: Colors.border, marginHorizontal: 20 },

  platformIcon: {
    width:          44,
    height:         44,
    borderRadius:   12,
    backgroundColor:Colors.surface,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    14,
  },

  info:     { flex: 1 },
  username: { fontSize: 15, fontWeight: '600', color: Colors.text },
  platform: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  checks:    { flexDirection: 'row', gap: 12 },
  checkItem: { alignItems: 'center', gap: 3 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  checkLabel:{ fontSize: 10, color: Colors.textFaint },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.text, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
