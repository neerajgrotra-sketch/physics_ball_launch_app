import { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { FONTS, useColors } from '../../theme/colors';

/**
 * The idle coach's ghost finger (game/coach.ts picks what it shows). It points at (x, y), in the
 * coordinates of the view it's placed in, and either taps there or drags by (dx, dy), over and over,
 * with a ripple where it presses and a caption above. It never takes touches: the first touch anywhere
 * hides it (the level screen does that).
 */
export function GhostFinger({ x, y, dx = 0, dy = 0, mode, text }: {
  x: number; y: number; dx?: number; dy?: number; mode: 'tap' | 'drag'; text: string;
}) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const t = useSharedValue(0); // 0..1 through one loop
  const appear = useSharedValue(0);

  useEffect(() => {
    appear.value = withTiming(1, { duration: 300 });
    t.value = withRepeat(withSequence(withTiming(1, { duration: 1500, easing: Easing.linear }), withDelay(300, withTiming(0, { duration: 0 }))), -1);
    return () => { cancelAnimation(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const capW = Math.min(280, width - 32);
  const capLeft = Math.max(16 - 0, Math.min(width - 16 - capW, x - capW / 2));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.caption, { left: capLeft, top: y - 92, width: capW, backgroundColor: c.ink }, caption]}>
        <Text style={[styles.captionText, { color: c.paper }]}>{text}</Text>
      </Animated.View>
      <Animated.View style={[styles.ripple, { left: x - 22, top: y - 22, borderColor: c.pencil }, ripple]} />
      <Animated.View style={[styles.finger, { left: x - 15, top: y - 2 }, finger]}>
        <Text style={styles.hand}>👆</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { position: 'absolute', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, opacity: 0.94 },
  captionText: { fontSize: 15, lineHeight: 19, fontFamily: FONTS.bodySemi, textAlign: 'center' },
  ripple: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
  finger: { position: 'absolute' },
  hand: { fontSize: 40, lineHeight: 46, textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 } },
});
