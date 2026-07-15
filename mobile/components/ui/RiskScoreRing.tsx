/**
 * Circular risk score meter — the centerpiece of the Dashboard screen.
 * Renders an SVG ring that fills from green → red based on the score (0–100).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';

interface Props {
  score: number;  // 0–100
  size?: number;  // diameter in px (default 180)
}

function scoreColor(score: number): string {
  if (score >= 70) return Colors.critical;
  if (score >= 40) return Colors.high;
  if (score >= 20) return Colors.medium;
  return Colors.low;
}

function scoreLabel(score: number): string {
  if (score >= 70) return 'Critical';
  if (score >= 40) return 'High Risk';
  if (score >= 20) return 'Moderate';
  return 'Low Risk';
}

export function RiskScoreRing({ score, size = 180 }: Props) {
  const strokeWidth = 12;
  const radius      = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled    = circumference * (score / 100);
  const remaining = circumference - filled;
  const color     = scoreColor(score);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.surface}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Score arc — starts from top (rotate -90°) */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${filled} ${remaining}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.label}>
        <Text style={[styles.score, { color }]}>{score}</Text>
        <Text style={styles.subLabel}>{scoreLabel(score)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  label: {
    position:       'absolute',
    alignItems:     'center',
    justifyContent: 'center',
  },
  score: {
    fontSize:   42,
    fontWeight: '700',
    lineHeight: 48,
  },
  subLabel: {
    fontSize:   13,
    color:      Colors.textMuted,
    fontWeight: '500',
    marginTop:  2,
  },
});
