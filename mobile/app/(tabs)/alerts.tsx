/**
 * Alerts screen — full list of all active security findings and impersonation alerts.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import { FindingCard, ImpersonationCard } from '@/components/ui/FindingCard';
import { ListSkeleton } from '@/components/ui/SkeletonLoader';
import {
  useScanResults,
  useResolveFinding,
  useDismissImpersonation,
} from '@/hooks/useScan';
import type { SecurityFinding, ImpersonationAlert } from '@/lib/types';

type FilterTab = 'all' | 'findings' | 'impersonation';

export default function AlertsScreen() {
  const [filter, setFilter] = useState<FilterTab>('all');
  const { data, isLoading } = useScanResults();
  const resolveFinding      = useResolveFinding();
  const dismissImpersonation = useDismissImpersonation();

  if (isLoading) return <ListSkeleton rows={5} />;

  const findings      = data?.findings ?? [];
  const impersonations = data?.impersonations ?? [];

  const sections = [];
  if (filter !== 'impersonation' && findings.length > 0) {
    sections.push({ title: 'Security Findings', data: findings, type: 'finding' as const });
  }
  if (filter !== 'findings' && impersonations.length > 0) {
    sections.push({ title: 'Impersonation Alerts', data: impersonations, type: 'impersonation' as const });
  }

  const totalCount = findings.length + impersonations.length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
        <Text style={styles.count}>{totalCount} active</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'findings', 'impersonation'] as FilterTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
              {tab === 'all' ? 'All' : tab === 'findings' ? 'Findings' : 'Impersonation'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {totalCount === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🛡️</Text>
          <Text style={styles.emptyTitle}>All clear</Text>
          <Text style={styles.emptySubtitle}>No active alerts. Run a scan from the dashboard to check for new issues.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections as any}
          keyExtractor={(item: any) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{(section as any).title}</Text>
          )}
          renderItem={({ item, section }: any) =>
            section.type === 'finding' ? (
              <FindingCard
                finding={item as SecurityFinding}
                onResolve={(id) => resolveFinding.mutate(id)}
              />
            ) : (
              <ImpersonationCard
                alert={item as ImpersonationAlert}
                onDismiss={(id) => dismissImpersonation.mutate(id)}
              />
            )
          }
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection:    'row',
    alignItems:       'baseline',
    justifyContent:   'space-between',
    paddingHorizontal:20,
    paddingTop:       16,
    paddingBottom:    12,
  },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text },
  count: { fontSize: 13, color: Colors.textMuted },

  filterRow: {
    flexDirection:   'row',
    gap:             8,
    paddingHorizontal:16,
    marginBottom:    12,
  },
  filterTab: {
    paddingHorizontal:14,
    paddingVertical:  7,
    borderRadius:    20,
    backgroundColor: Colors.surface,
    borderWidth:     1,
    borderColor:     Colors.border,
  },
  filterTabActive: {
    backgroundColor: Colors.accent,
    borderColor:     Colors.accent,
  },
  filterTabText:       { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  filterTabTextActive: { color: Colors.text },

  sectionHeader: {
    fontSize:         12,
    fontWeight:       '700',
    color:            Colors.textMuted,
    textTransform:    'uppercase',
    letterSpacing:    0.8,
    marginHorizontal: 16,
    marginTop:        16,
    marginBottom:     8,
  },
  list: { paddingBottom: 32 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
