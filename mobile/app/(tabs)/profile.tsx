/**
 * Profile screen — user info, settings, and sign out.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { useScanResults } from '@/hooks/useScan';

function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger = false,
}: {
  icon:    keyof typeof Ionicons.glyphMap;
  label:   string;
  value?:  string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? Colors.error : Colors.accent} />
      </View>
      <Text style={[styles.settingLabel, danger && { color: Colors.error }]}>{label}</Text>
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        {onPress && (
          <Ionicons name="chevron-forward" size={16} color={Colors.textFaint} />
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, signOut }    = useAuth();
  const { data: scanData }   = useScanResults();

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const lastScanned = scanData?.lastAuditedAt
    ? new Date(scanData.lastAuditedAt).toLocaleDateString()
    : 'Never';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar + name */}
        <View style={styles.hero}>
          {user?.image ? (
            <Image source={{ uri: user.image }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={36} color={Colors.accent} />
            </View>
          )}
          <Text style={styles.name}>{user?.name ?? 'Unknown'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{scanData?.riskScore ?? 0}</Text>
            <Text style={styles.statLabel}>Risk Score</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{scanData?.findings?.length ?? 0}</Text>
            <Text style={styles.statLabel}>Findings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{lastScanned}</Text>
            <Text style={styles.statLabel}>Last scan</Text>
          </View>
        </View>

        {/* Settings sections */}
        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.settingsGroup}>
          <SettingRow icon="mail-outline"   label="Email"   value={user?.email ?? ''} />
          <SettingRow icon="calendar-outline" label="Last scan" value={lastScanned} />
        </View>

        <Text style={styles.sectionHeader}>Notifications</Text>
        <View style={styles.settingsGroup}>
          <SettingRow
            icon="notifications-outline"
            label="Push alerts"
            value="Enabled"
            onPress={() => Alert.alert('Coming in Phase 3', 'Push notification settings will be available once notification integration is complete.')}
          />
          <SettingRow
            icon="time-outline"
            label="Scan frequency"
            value="Daily"
            onPress={() => Alert.alert('Coming in Phase 3', 'Scan scheduling will be configurable once background scans are implemented.')}
          />
        </View>

        <Text style={styles.sectionHeader}>Security</Text>
        <View style={styles.settingsGroup}>
          <SettingRow
            icon="finger-print-outline"
            label="Biometric lock"
            value="Off"
            onPress={() => Alert.alert('Coming in Phase 4', 'Biometric authentication will be enabled in the polish phase.')}
          />
        </View>

        <Text style={styles.sectionHeader}>More</Text>
        <View style={styles.settingsGroup}>
          <SettingRow icon="globe-outline"   label="Web app"      onPress={() => {}} />
          <SettingRow icon="document-text-outline" label="Privacy policy" onPress={() => {}} />
          <SettingRow
            icon="log-out-outline"
            label="Sign out"
            onPress={handleSignOut}
            danger
          />
        </View>

        <Text style={styles.version}>IdentiFind v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: 40 },

  hero: {
    alignItems:    'center',
    paddingTop:    24,
    paddingBottom: 20,
  },
  avatar: {
    width:        80,
    height:       80,
    borderRadius: 40,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: Colors.surface,
    borderWidth:     1,
    borderColor:     Colors.border,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    12,
  },
  name:  { fontSize: 20, fontWeight: '700', color: Colors.text },
  email: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  statsRow: {
    flexDirection:    'row',
    marginHorizontal: 20,
    marginBottom:     24,
    backgroundColor:  Colors.surface,
    borderRadius:     12,
    borderWidth:      1,
    borderColor:      Colors.border,
    paddingVertical:  16,
  },
  statBlock:  { flex: 1, alignItems: 'center' },
  statDivider:{ width: 1, backgroundColor: Colors.border },
  statNumber: { fontSize: 16, fontWeight: '700', color: Colors.text },
  statLabel:  { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  sectionHeader: {
    fontSize:         11,
    fontWeight:       '700',
    color:            Colors.textFaint,
    textTransform:    'uppercase',
    letterSpacing:    0.8,
    marginHorizontal: 20,
    marginTop:        20,
    marginBottom:     6,
  },
  settingsGroup: {
    marginHorizontal: 20,
    backgroundColor:  Colors.surface,
    borderRadius:     12,
    borderWidth:      1,
    borderColor:      Colors.border,
    overflow:         'hidden',
  },
  settingRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 13,
    paddingHorizontal:14,
    borderBottomWidth:1,
    borderBottomColor:Colors.border,
  },
  settingIcon: {
    width:          32,
    height:         32,
    borderRadius:   8,
    backgroundColor:Colors.bg,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    12,
  },
  settingIconDanger: { backgroundColor: Colors.error + '20' },
  settingLabel: { flex: 1, fontSize: 14, color: Colors.text },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingValue: { fontSize: 13, color: Colors.textMuted },

  version: {
    textAlign:  'center',
    fontSize:   12,
    color:      Colors.textFaint,
    marginTop:  24,
  },
});
