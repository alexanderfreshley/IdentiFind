/**
 * Skeleton loader — animated placeholder while data is fetching.
 * Uses Reanimated for a smooth shimmer pulse.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '@/constants/colors';

interface SkeletonBoxProps {
  width:        number | string;
  height:       number;
  borderRadius?: number;
  style?:       object;
}

export function SkeletonBox({ width, height, borderRadius = 6, style }: SkeletonBoxProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: Colors.border },
        animStyle,
        style,
      ]}
    />
  );
}

// ─── Preset skeletons ─────────────────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <View style={styles.container}>
      {/* Risk ring */}
      <SkeletonBox width={180} height={180} borderRadius={90} style={styles.centered} />
      <View style={{ height: 24 }} />
      {/* Stat row */}
      <View style={styles.row}>
        {[0, 1, 2].map((i) => (
          <SkeletonBox key={i} width={100} height={64} borderRadius={10} />
        ))}
      </View>
      <View style={{ height: 20 }} />
      {/* Finding cards */}
      {[0, 1, 2].map((i) => (
        <SkeletonBox key={i} width="100%" height={96} style={styles.card} />
      ))}
    </View>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBox key={i} width="100%" height={88} style={styles.card} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:    1,
    padding: 16,
  },
  centered: {
    alignSelf: 'center',
  },
  row: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    paddingHorizontal: 16,
  },
  card: {
    marginBottom: 12,
  },
});
