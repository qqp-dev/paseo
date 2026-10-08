import { memo } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion } from "react-native-reanimated";
import { useRetainedPanelActive } from "@/components/retained-panel";
import { useAppVisible } from "@/hooks/use-app-visible";
import {
  StatusRingFrame,
  type StatusRingProps,
  rotatorStyles,
  styles,
} from "@/components/status-ring/frame";
import { useStatusRingRotation } from "@/components/status-ring/clock";

/**
 * Native running indicator. The rotation is published by one shared UI-thread clock rather than
 * per-instance timing, so a ring that mounts mid-flight is already in phase — see `clock.ts`.
 *
 * The rotated view carries no theme-tracked style; the coloured arc is nested inside it. Putting
 * a Unistyles style on a Reanimated view crashes on theme change (docs/unistyles.md).
 */
export const StatusRing = memo(function StatusRing({ backdrop }: StatusRingProps) {
  const panelActive = useRetainedPanelActive();
  const appVisible = useAppVisible();
  const reduceMotion = useReducedMotion();
  const active = panelActive && appVisible;
  const rotation = useStatusRingRotation({ active, reduceMotion });
  const rotatorStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <StatusRingFrame backdrop={backdrop}>
      {reduceMotion ? (
        <View style={styles.staticRing} />
      ) : (
        <Animated.View style={[rotatorStyles.rotator, rotatorStyle]}>
          <View style={styles.arc} />
        </Animated.View>
      )}
    </StatusRingFrame>
  );
});
