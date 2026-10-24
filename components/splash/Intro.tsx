import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { FONTS, useColors } from '../../theme/colors';
import { BALL, BAR, BARREL_DEG, GLASS, INTRO_MS, LAUNCH, TITLE, TRAIL, backOut, ballAt, clamp01, quadOut } from './introPath';

/**
 * The intro played over the level list on every cold start, ~2.6 s, tap to skip.
 * It opens on exactly what the launch screen shows (the rounded icon on the panel colour, see
 * assets/splash-icon.png and app.json), so the handoff from the native splash is seamless. Then the
 * icon gives way to graph paper and the app's whole idea plays out once: the ball launches, banks off a
 * bar and drops into the glass, and the title lands. Reduced motion: icon, title, fade.
 * Every frame is a function of one clock (`t`, in ms), timeline in introPath.ts.
 */
export function Intro({ onDone, onShown }: { onDone: () => void; onShown: () => void }) {
  const c = useColors();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const fade = useSharedValue(1);
  const [leaving, setLeaving] = useState(false);
  // The stage the shot plays on: a square, as wide as a phone allows.
  const S = Math.min(width - 48, 340, height * 0.48);

  const leave = () => {
    if (leaving) return;
    setLeaving(true);
    fade.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) });
    setTimeout(onDone, 330);
  };

  useEffect(() => {
    t.value = withTiming(reduced ? TITLE.end : INTRO_MS, { duration: reduced ? 900 : INTRO_MS, easing: Easing.linear });
    const timer = setTimeout(leave, reduced ? 1100 : INTRO_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const root = useAnimatedStyle(() => ({ opacity: fade.value }));
  // The launch-screen icon fades and shrinks away as the paper appears.
  const icon = useAnimatedStyle(() => {
    const k = clamp01(t.value / 380);
    return { opacity: reduced ? 0 : 1 - k, transform: [{ scale: 1 - 0.25 * k }] };
  });
  const paper = useAnimatedStyle(() => ({ opacity: reduced ? 1 : clamp01((t.value - 120) / 300) }));
  const bar = useAnimatedStyle(() => {
    const k = backOut(clamp01((t.value - 300) / 380), 2.2);
    const hit = bounceAt(t.value, BALL.hitBar);
    return {
      opacity: clamp01((t.value - 300) / 120),
      transform: [{ translateY: (1 - k) * -40 }, { rotate: `${BAR.deg + (1 - k) * -35}deg` }, { scale: 1 + 0.12 * hit }],
    };
  });
  const glass = useAnimatedStyle(() => {
    const k = backOut(clamp01((t.value - 420) / 380), 1.8);
    const land = bounceAt(t.value, BALL.land);
    return {
      opacity: clamp01((t.value - 420) / 120),
      transform: [{ translateY: (1 - k) * 40 }, { scaleX: 1 + 0.08 * land }, { scaleY: 1 - 0.08 * land }],
    };
  });
  const launcher = useAnimatedStyle(() => ({ opacity: clamp01((t.value - 250) / 200) }));
  const ball = useAnimatedStyle(() => {
    const [x, y] = ballAt(t.value);
    return { opacity: clamp01((t.value - 250) / 200), transform: [{ translateX: x * S }, { translateY: y * S }] };
  });
  const titleBlock = useAnimatedStyle(() => ({ opacity: clamp01((t.value - TITLE.start) / 200) }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: c.panel }, root]} onLayout={onShown}>
      <Pressable style={StyleSheet.absoluteFill} onPress={leave} accessibilityLabel="Skip intro" accessibilityRole="button">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.paper }, paper]}>
          <Grid width={width} height={height} color={c.grid} />
        </Animated.View>

        <View style={styles.center}>
          <View style={{ width: S, height: S }}>
            {/* The trail the ball leaves, dot by dot. */}
            {TRAIL.map((d, i) => <TrailDot key={i} t={t} at={d} S={S} color={c.red} />)}
            <Animated.View style={[styles.abs, launcher, {
              left: LAUNCH.x * S - 15, top: LAUNCH.y * S - 15, width: 30, height: 30, borderRadius: 15,
              borderWidth: 3, borderColor: c.pencil,
            }]} />
            <Animated.View style={[styles.abs, launcher, {
              left: LAUNCH.x * S + 13 * Math.cos((BARREL_DEG * Math.PI) / 180) - 13,
              top: LAUNCH.y * S + 13 * Math.sin((BARREL_DEG * Math.PI) / 180) - 3,
              width: 26, height: 6, borderRadius: 3, backgroundColor: c.pencil,
              transform: [{ rotate: `${BARREL_DEG}deg` }],
            }]} />
            <Animated.View style={[styles.abs, bar, {
              left: (BAR.cx - BAR.len / 2) * S, top: BAR.cy * S - 6, width: BAR.len * S, height: 12, borderRadius: 6,
              backgroundColor: c.pencil,
            }]} />
            <Animated.View style={[styles.abs, glass, {
              left: GLASS.l * S, top: GLASS.top * S, width: (GLASS.r - GLASS.l) * S, height: (GLASS.base - GLASS.top) * S,
            }]}>
              <View style={[styles.glassFill, { backgroundColor: c.red }]} />
              <View style={[styles.wall, { left: 0, backgroundColor: c.red }]} />
              <View style={[styles.wall, { right: 0, backgroundColor: c.red }]} />
              <View style={[styles.base, { backgroundColor: c.red }]} />
            </Animated.View>
            <Animated.View style={[styles.abs, ball, {
              left: -BALL.r * S, top: -BALL.r * S, width: BALL.r * 2 * S, height: BALL.r * 2 * S, borderRadius: BALL.r * S,
              backgroundColor: c.steel, borderWidth: 2.5, borderColor: c.ink,
            }]} />
            <Ring t={t} at={BALL.hitBar} x={BAR.hitX * S} y={BAR.hitY * S} color={c.pencil} />
            <Ring t={t} at={BALL.land} x={BALL.rest[0] * S} y={BALL.rest[1] * S} color={c.red} />
          </View>

          <Animated.View style={[styles.titleBlock, titleBlock]}>
            <View style={styles.titleRow}>
              {'BANK SHOT'.split('').map((ch, i) => <Letter key={i} t={t} i={i} ch={ch} color={c.ink} reduced={reduced} />)}
            </View>
            <Text style={[styles.tagline, { color: c.muted }]}>Place the bars. Bounce it in.</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.center, styles.iconWrap, icon]} pointerEvents="none">
          <Image source={require('../../assets/splash-icon.png')} style={styles.icon} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** 0 → 1 → 0 over ~260 ms starting at `at`: a quick pulse on impact. */
function bounceAt(t: number, at: number) {
  'worklet';
  const k = (t - at) / 260;
  return k < 0 || k > 1 ? 0 : Math.sin(k * Math.PI) * (1 - k);
}

function TrailDot({ t, at, S, color }: { t: SharedValue<number>; at: { x: number; y: number; ms: number }; S: number; color: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: t.value < at.ms ? 0 : 0.75 * (1 - 0.6 * clamp01((t.value - at.ms) / 900)),
  }));
  return <Animated.View style={[styles.abs, styles.dot, { left: at.x * S - 2.5, top: at.y * S - 2.5, backgroundColor: color }, style]} />;
}

function Ring({ t, at, x, y, color }: { t: SharedValue<number>; at: number; x: number; y: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const k = (t.value - at) / 450;
    if (k < 0 || k > 1) return { opacity: 0 };
    return { opacity: 0.7 * (1 - k), transform: [{ scale: 0.3 + 1.6 * quadOut(k) }] };
  });
  return <Animated.View style={[styles.abs, styles.ring, { left: x - 24, top: y - 24, borderColor: color }, style]} pointerEvents="none" />;
}

function Letter({ t, i, ch, color, reduced }: { t: SharedValue<number>; i: number; ch: string; color: string; reduced: boolean }) {
  const style = useAnimatedStyle(() => {
    const k = reduced ? 1 : clamp01((t.value - TITLE.start - i * TITLE.stagger) / 340);
    const e = backOut(k, 2.6);
    return { opacity: clamp01(k * 3), transform: [{ translateY: (1 - e) * -28 }, { rotate: `${(1 - e) * (i % 2 ? 14 : -14)}deg` }] };
  });
  return <Animated.Text style={[styles.letter, { color }, ch === ' ' && styles.space, style]}>{ch}</Animated.Text>;
}

/** Graph paper: a fine grid with a heavier line every fifth, like the board. */
function Grid({ width, height, color }: { width: number; height: number; color: string }) {
  const step = 20;
  const lines = [];
  for (let x = 0, i = 0; x <= width; x += step, i++) {
    lines.push(<View key={`v${i}`} style={[styles.abs, { left: x, top: 0, bottom: 0, width: i % 5 ? 0.5 : 1, backgroundColor: color }]} />);
  }
  for (let y = 0, i = 0; y <= height; y += step, i++) {
    lines.push(<View key={`h${i}`} style={[styles.abs, { top: y, left: 0, right: 0, height: i % 5 ? 0.5 : 1, backgroundColor: color }]} />);
  }
  return <>{lines}</>;
}

const styles = StyleSheet.create({
  root: { zIndex: 100 },
  abs: { position: 'absolute' },
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { zIndex: 2 },
  icon: { width: 150, height: 150 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  ring: { width: 48, height: 48, borderRadius: 24, borderWidth: 3 },
  glassFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.12 },
  wall: { position: 'absolute', top: 0, bottom: 0, width: 6, borderRadius: 3 },
  base: { position: 'absolute', left: -10, right: -10, bottom: -3, height: 6, borderRadius: 3 },
  titleBlock: { alignItems: 'center', marginTop: 28 },
  titleRow: { flexDirection: 'row' },
  letter: { fontFamily: FONTS.condensedBold, fontSize: 54, lineHeight: 58, letterSpacing: 1 },
  space: { width: 16 },
  tagline: { fontFamily: FONTS.bodyMedium, fontSize: 17, marginTop: 4 },
});
