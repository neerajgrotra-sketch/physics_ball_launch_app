import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { FONTS, useColors } from '../../theme/colors';

/** One thing the finger shows: press at (x, y), then either lift (tap) or slide by (dx, dy) (drag). */
export interface Demo { x: number; y: number; dx?: number; dy?: number; mode: 'tap' | 'drag' }

const LOOP_MS = 1800; // press, slide, lift, rest

/**
 * The ghost finger (game/coach.ts picks what it shows). It acts out each of `demos` in turn, over and over
 * (a step with two ways to do it shows both: the dotted line, then a slider), with a ripple where it
 * presses and a caption above the first one. Coordinates are in the view it's placed in. The finger and ripple
 * never take touches; the caption carries a small stop button (`stopLabel`, "Skip tutorial" or "Stop tips"),
 * the only touchable part. The level screen hides the whole thing on the first touch anywhere else.
 */
export function GhostFinger({ demos, text, stopLabel, onStop }: { demos: Demo[]; text: string; stopLabel: string; onStop: () => void }) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const t = useSharedValue(0); // 0..1 through one loop
  const appear = useSharedValue(0);
  const [which, setWhich] = useState(0);

  useEffect(() => {
    appear.value = withTiming(1, { duration: 300 });
    t.value = withRepeat(withSequence(withTiming(1, { duration: 1500, easing: Easing.linear }), withDelay(300, withTiming(0, { duration: 0 }))), -1);
    const next = demos.length > 1 ? setInterval(() => setWhich((i) => i + 1), LOOP_MS) : undefined;
    return () => { cancelAnimation(t); clearInterval(next); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const demo = demos[which % demos.length];
  const { x, y, dx = 0, dy = 0, mode } = demo;
  const lead = demos[0];

  // Loop: press (0–0.2), then for a drag slide by (dx, dy) (0.2–0.75), lift (0.75–0.9), rest.
  const finger = useAnimatedStyle(() => {
    const v = t.value;
    const press = v < 0.2 ? v / 0.2 : v < 0.75 ? 1 : v < 0.9 ? 1 - (v - 0.75) / 0.15 : 0;
    const slide = mode === 'drag' ? Math.min(1, Math.max(0, (v - 0.2) / 0.55)) : 0;
    const e = slide * slide * (3 - 2 * slide);
    return {
      opacity: appear.value,
      transform: [{ translateX: dx * e }, { translateY: dy * e + (1 - press) * 10 }, { scale: 1 - 0.1 * press }],
    };
  });
  const ripple = useAnimatedStyle(() => {
    const k = Math.min(1, Math.max(0, (t.value - 0.15) / 0.45));
    return { opacity: appear.value * (k > 0 && k < 1 ? 0.5 * (1 - k) : 0), transform: [{ scale: 0.4 + 1.2 * k }] };
  });
  const caption = useAnimatedStyle(() => ({ opacity: appear.value }));

  const capW = Math.min(290, width - 32);
  const capLeft = Math.max(16, Math.min(width - 16 - capW, lead.x - capW / 2));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        pointerEvents="box-none"
        style={[styles.caption, { left: capLeft, top: Math.max(8, lead.y - 118), width: capW, backgroundColor: c.ink }, caption]}
      >
        <Text pointerEvents="none" style={[styles.captionText, { color: c.paper }]}>{text}</Text>
        <Pressable onPress={onStop} accessibilityRole="button" accessibilityLabel={stopLabel} hitSlop={10} style={styles.stop}>
          <Text style={[styles.stopText, { color: c.paper }]}>{stopLabel}</Text>
        </Pressable>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.ripple, { left: x - 22, top: y - 22, borderColor: c.pencil }, ripple]} />
      <Animated.View pointerEvents="none" style={[styles.finger, { left: x - 15, top: y - 2 }, finger]}>
        <Text style={styles.hand}>👆</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { position: 'absolute', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, opacity: 0.95, alignItems: 'center', gap: 4 },
  captionText: { fontSize: 15, lineHeight: 19, fontFamily: FONTS.bodySemi, textAlign: 'center' },
  stop: { paddingVertical: 2, paddingHorizontal: 8 },
  stopText: { fontSize: 12, fontFamily: FONTS.bodyMedium, textDecorationLine: 'underline', opacity: 0.75 },
  ripple: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
  finger: { position: 'absolute' },
  hand: { fontSize: 40, lineHeight: 46, textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 } },
});
