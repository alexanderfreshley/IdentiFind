/**
 * Card component for displaying a security finding or impersonation alert.
 * Used on the Alerts screen and the Dashboard findings list.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors, SeverityColors, type SeverityLevel } from '@/constants/colors';
import type { SecurityFinding, ImpersonationAlert } from '@/lib/types';

// ─── SecurityFinding card ─────────────────────────────────────────────────────

interface FindingCardProps {
  finding:   SecurityFinding;
  onResolve: (id: string) => void;
}

export function FindingCard({ finding, onResolve }: FindingCardProps) {
  const color = SeverityColors[finding.severity as SeverityLevel] ?? Colors.textMuted;

  return (
    <View style={styles.card}>
      <View style={[styles.severityBar, { backgroundColor: color }]} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.badge, { color, borderColor: color }]}>
            {finding.severity}
          </Text>
          <Text style={styles.category}>{finding.category.replace(/_/g, ' ')}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{finding.title}</Text>
        <Text style={styles.description} numberOfLines={3}>{finding.description}</Text>
        <TouchableOpacity
          style={styles.resolveBtn}
          onPress={() => onResolve(finding.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.resolveBtnText}>Mark Resolved</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── ImpersonationAlert card ──────────────────────────────────────────────────

interface ImpersonationCardProps {
  alert:     ImpersonationAlert;
  onDismiss: (id: string) => void;
}

export function ImpersonationCard({ alert, onDismiss }: ImpersonationCardProps) {
  const confidence = alert.confidenceScore;
  const color = confidence >= 70 ? Colors.high : Colors.medium;

  return (
    <View style={styles.card}>
      <View style={[styles.severityBar, { backgroundColor: color }]} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.badge, { color, borderColor: color }]}>IMPERSONATION</Text>
          <Text style={styles.category}>{alert.platform}</Text>
        </View>
        <Text style={styles.title}>@{alert.suspectedUsername}</Text>
        <Text style={styles.description}>
          An account using a variant of your username was detected on {alert.platform}.
          {alert.suspectedProfileUrl ? `\n${alert.suspectedProfileUrl}` : ''}
        </Text>
        <Text style={styles.confidence}>Confidence: {confidence}%</Text>
        <TouchableOpacity
          style={styles.resolveBtn}
          onPress={() => onDismiss(alert.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.resolveBtnText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius:    12,
    marginHorizontal:16,
    marginBottom:    12,
    flexDirection:   'row',
    overflow:        'hidden',
  },
  severityBar: {
    width:  4,
  },
  content: {
    flex:    1,
    padding: 14,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    marginBottom:   6,
  },
  badge: {
    fontSize:     10,
    fontWeight:   '700',
    borderWidth:  1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  category: {
    fontSize:   11,
    color:      Colors.textMuted,
    fontWeight: '500',
  },
  title: {
    fontSize:     14,
    fontWeight:   '600',
    color:        Colors.text,
    marginBottom: 4,
  },
  description: {
    fontSize:     12,
    color:        Colors.textMuted,
    lineHeight:   18,
    marginBottom: 10,
  },
  confidence: {
    fontSize:     11,
    color:        Colors.textFaint,
    marginBottom: 10,
  },
  resolveBtn: {
    alignSelf:       'flex-start',
    backgroundColor: Colors.border,
    borderRadius:    6,
    paddingHorizontal:10,
    paddingVertical:  5,
  },
  resolveBtnText: {
    fontSize:   12,
    fontWeight: '500',
    color:      Colors.textMuted,
  },
});
