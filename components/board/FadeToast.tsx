import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { FONTS, useColors } from '../../theme/colors';

/**
 * A short message over the middle of whatever it's placed in: each change of `trigger` (after the first) fades it in, holds it, and
 * fades it away. It floats over everything, so nothing on screen moves, and never takes a touch. `tone` red for "no", pencil for news.
 * Once faded it is removed, not left at zero opacity: iPhone Safari can keep painting a transparent box's border and shadow.
 */
export function FadeToast({ trigger, text, tone = 'red' }: { trigger: number; text: string; tone?: 'red' | 'pencil' }) {
  const c = useColors();
  const shown = useSharedValue(0);
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!trigger) return;
    setLive(true);
    shown.value = withSequence(
      withTiming(1, { duration: 180 }),
      // A newer message cancels this fade (finished is false), so only the last one's end removes the toast.
      withDelay(1900, withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) }, (finished) => { if (finished) runOnJS(setLive)(false); })),
    );
  }, [trigger, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ scale: 0.96 + 0.04 * shown.value }] }));
  if (!trigger || !live) return null;
  const color = tone === 'red' ? c.red : c.pencil;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.toast, { backgroundColor: c.paper, borderColor: color }, style]}>
        <Text accessibilityLiveRegion="polite" style={[styles.text, { color }]}>{text}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  toast: {
    maxWidth: 300, marginHorizontal: 24, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 14, borderWidth: 2,
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
  },
  text: { textAlign: 'center', fontSize: 16, lineHeight: 21, fontFamily: FONTS.bodySemi },
});
