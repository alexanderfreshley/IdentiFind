/**
 * Dashboard screen — risk score ring, summary stats, and top findings.
 * Pull-to-refresh triggers a new scan.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/constants/colors';
import { RiskScoreRing } from '@/components/ui/RiskScoreRing';
import { FindingCard } from '@/components/ui/FindingCard';
import { DashboardSkeleton } from '@/components/ui/SkeletonLoader';
import { useAuth } from '@/hooks/useAuth';
import {
  useScanResults,
  useTriggerScan,
  useResolveFinding,
  useDismissImpersonation,
} from '@/hooks/useScan';

function StatChip({
  label,
  value,
  color = Colors.text,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <View style={styles.statChip}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { user }         = useAuth();
  const { data, isLoading, isRefetching } = useScanResults();
  const triggerScan      = useTriggerScan();
  const resolveFinding   = useResolveFinding();
  const dismissImpersonation = useDismissImpersonation();

  const onRefresh = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await triggerScan.mutateAsync();
    } catch {
      Alert.alert('Scan failed', 'Could not complete scan. Please try again.');
    }
  }, [triggerScan]);

  if (isLoading) return <DashboardSkeleton />;

  const riskScore     = data?.riskScore ?? 0;
  const findings      = data?.findings ?? [];
  const impersonations = data?.impersonations ?? [];

  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount     = findings.filter(f => f.severity === 'HIGH').length;
  const lastScanned   = data?.lastAuditedAt
    ? new Date(data.lastAuditedAt).toLocaleString()
    : 'Never';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || triggerScan.isPending}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Hello, {user?.name?.split(' ')[0] ?? 'there'}
          </Text>
          <Text style={styles.subtitle}>Identity Risk Overview</Text>
        </View>

        {/* Risk score ring */}
        <View style={styles.ringContainer}>
          <RiskScoreRing score={riskScore} />
          <Text style={styles.lastScanned}>Last scanned: {lastScanned}</Text>
          <Text style={styles.pullHint}>Pull down to run a new scan</Text>
        </View>

        {/* Stat chips */}
        <View style={styles.stats}>
          <StatChip label="Critical" value={criticalCount} color={Colors.critical} />
          <StatChip label="High"     value={highCount}     color={Colors.high} />
          <StatChip label="Impersonation" value={impersonations.length} color={Colors.medium} />
        </View>

        {/* Top findings */}
        {findings.length === 0 && impersonations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyTitle}>No active findings</Text>
            <Text style={styles.emptySubtitle}>
              Pull down to run a fresh scan and check for new exposure.
            </Text>
          </View>
        ) : (
          <>
            {findings.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Security Findings</Text>
                {findings.slice(0, 5).map(f => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    onResolve={(id) => resolveFinding.mutate(id)}
                  />
                ))}
              </>
            )}
            {impersonations.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Impersonation Alerts</Text>
                {impersonations.slice(0, 3).map(a => (
                  <FindingCard
                    key={a.id}
                    finding={{
                      id:          a.id,
                      title:       `@${a.suspectedUsername} on ${a.platform}`,
                      description: `Possible impersonation account detected. Confidence: ${a.confidenceScore}%`,
                      severity:    a.confidenceScore >= 70 ? 'HIGH' : 'MEDIUM',
                      category:    'IMPERSONATION',
                      isResolved:  false,
                      createdAt:   a.reportedAt,
                    }}
                    onResolve={(id) => dismissImpersonation.mutate(id)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { paddingBottom: 32 },

  header: {
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     8,
  },
  greeting: {
    fontSize:   22,
    fontWeight: '700',
    color:      Colors.text,
  },
  subtitle: {
    fontSize:  13,
    color:     Colors.textMuted,
    marginTop: 2,
  },

  ringContainer: {
    alignItems:   'center',
    paddingVertical: 24,
  },
  lastScanned: {
    fontSize:  12,
    color:     Colors.textFaint,
    marginTop: 12,
  },
  pullHint: {
    fontSize:  11,
    color:     Colors.textFaint,
    marginTop: 4,
  },

  stats: {
    flexDirection:    'row',
    justifyContent:   'space-around',
    marginHorizontal: 16,
    marginBottom:     24,
  },
  statChip: {
    backgroundColor: Colors.surface,
    borderRadius:    10,
    paddingVertical: 12,
    paddingHorizontal:20,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     Colors.border,
  },
  statValue: {
    fontSize:   24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize:  11,
    color:     Colors.textMuted,
    marginTop: 2,
  },

  sectionTitle: {
    fontSize:          13,
    fontWeight:        '700',
    color:             Colors.textMuted,
    textTransform:     'uppercase',
    letterSpacing:     0.8,
    marginHorizontal:  16,
    marginBottom:      10,
    marginTop:         8,
  },

  emptyState: {
    alignItems:   'center',
    paddingTop:   32,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize:     48,
    color:        Colors.low,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize:     17,
    fontWeight:   '600',
    color:        Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize:  13,
    color:     Colors.textMuted,
    textAlign: 'center',
    lineHeight:20,
  },
});
