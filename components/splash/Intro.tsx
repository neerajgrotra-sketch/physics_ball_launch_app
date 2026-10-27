import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { skinFill } from '../../game/skins';
import { FONTS, useColors } from '../../theme/colors';
import { useBallSkin } from '../settings/BallSkin';
import { useFeedback } from '../feedback/useFeedback';
import { VERSION_LABEL } from '../version';
import { BALL, BAR, CONTACT, FLOOR, GLASS, GO_BUTTON, INTRO_MS, LAUNCHER, TITLE, TRAIL, backOut, ballAt, clamp01, quadOut } from './introPath';

/**
 * The intro played over the level list on every cold start: ~2.7 s of animation, then it waits on the
 * finished picture until the player taps "Let's go" (or anywhere). A tap mid-animation jumps to the end.
 * It opens on exactly what the launch screen shows (the rounded icon on the panel colour, see
 * assets/splash-icon.png and app.json), so the handoff from the native splash is seamless. Then the
 * icon gives way to graph paper and the app's whole idea plays out once: the ball launches, banks off a
 * bar and drops into the glass, and the title lands. Reduced motion: icon, title, fade.
 * Every frame is a function of one clock (`t`, in ms), timeline in introPath.ts.
 */
export function Intro({ onDone, onShown }: { onDone: () => void; onShown: () => void }) {
  const c = useColors();
  const { skin } = useBallSkin();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const fade = useSharedValue(1);
  const [leaving, setLeaving] = useState(false);
  const [ready, setReady] = useState(false); // the animation has finished; waiting for "Let's go"
  // The stage the shot plays on: a square, as wide as a phone allows.
  const S = Math.min(width - 48, 340, height * 0.48);

  const leave = () => {
    if (leaving) return;
    setLeaving(true);
    fade.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) });
    setTimeout(onDone, 330);
  };

  // The shot's sounds, in time with the animation: launch, the bar, the glass. On the web they only play
  // if audio is already unlocked (browsers need a tap first), so the intro is often silent there.
  const feedback = useFeedback();
  const sounds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stopSounds = () => { sounds.current.forEach(clearTimeout); sounds.current = []; };

  const finish = () => {
    stopSounds();
    t.value = INTRO_MS; // also cancels the running animation
    setReady(true);
  };

  useEffect(() => {
    t.value = withTiming(INTRO_MS, { duration: reduced ? 900 : INTRO_MS, easing: Easing.linear });
    const timer = setTimeout(() => setReady(true), reduced ? 900 : INTRO_MS);
    if (!reduced) {
      const at = (ms: number, f: () => void) => sounds.current.push(setTimeout(f, ms));
      at(BALL.launch, () => feedback.launched());
      at(BALL.hitBar, () => feedback.hit({ i: 0, kind: 'piece', speed: 650, counts: true }));
      at(BALL.land, () => { feedback.hit({ i: 0, kind: 'glass', speed: 420, counts: false }); feedback.landed(); });
    }
    return () => { clearTimeout(timer); stopSounds(); };
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
  const titleBlock = useAnimatedStyle(() => ({ opacity: reduced ? clamp01(t.value / 600) : clamp01((t.value - TITLE.start) / 200) }));
  const go = useAnimatedStyle(() => {
    const k = clamp01((t.value - GO_BUTTON.start) / (GO_BUTTON.end - GO_BUTTON.start));
    return { opacity: clamp01(k * 2), transform: [{ translateY: (1 - quadOut(k)) * 16 }, { scale: 0.85 + 0.15 * backOut(k, 2) }] };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: c.panel }, root]} onLayout={onShown}>
      <Pressable
        style={StyleSheet.absoluteFill} onPress={ready ? leave : finish}
        accessibilityLabel={ready ? 'Continue' : 'Skip intro'} accessibilityRole="button"
      >
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.paper }, paper]}>
          <Grid width={width} height={height} color={c.grid} />
        </Animated.View>

        <View style={styles.center}>
          <View style={{ width: S, height: S }}>
            {/* The trail the ball leaves, dot by dot. */}
            {TRAIL.map((d, i) => <TrailDot key={i} t={t} at={d} S={S} color={c.red} />)}
            {/* The floor everything stands on. */}
            <Animated.View style={[styles.abs, launcher, { left: 0, right: 0, top: FLOOR * S - 1, height: 2, backgroundColor: c.line }]} />
            {/* The launcher: a barrel pivoting on a dome, aimed along the shot. */}
            <Animated.View style={[styles.abs, launcher, {
              left: (LAUNCHER.x + (LAUNCHER.len / 2) * Math.cos((LAUNCHER.deg * Math.PI) / 180)) * S - (LAUNCHER.len * S) / 2,
              top: (FLOOR - LAUNCHER.lift + (LAUNCHER.len / 2) * Math.sin((LAUNCHER.deg * Math.PI) / 180)) * S - 5.5,
              width: LAUNCHER.len * S, height: 11, borderRadius: 3, backgroundColor: c.ink,
              transform: [{ rotate: `${LAUNCHER.deg}deg` }],
            }]} />
            <Animated.View style={[styles.abs, launcher, {
              left: LAUNCHER.x * S - 17, top: FLOOR * S - 17, width: 34, height: 17,
              borderTopLeftRadius: 17, borderTopRightRadius: 17, backgroundColor: c.pencil,
            }]} />
            <Animated.View style={[styles.abs, bar, {
              left: (BAR.cx - BAR.len / 2) * S, top: (BAR.cy - BAR.th / 2) * S, width: BAR.len * S, height: BAR.th * S,
              borderRadius: (BAR.th * S) / 2, backgroundColor: c.pencil,
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
              backgroundColor: skinFill(skin, c.steel), borderWidth: 2.5, borderColor: c.ink,
            }]} />
            {/* A faint imprint of the ball where it struck the bar, so the finished picture shows the contact. */}
            <Imprint t={t} x={CONTACT[0] * S} y={CONTACT[1] * S} r={BALL.r * S} color={c.ink} />
            <Ring t={t} at={BALL.hitBar} x={BAR.hitX * S} y={BAR.hitY * S} color={c.pencil} />
            <Ring t={t} at={BALL.land} x={BALL.rest[0] * S} y={BALL.rest[1] * S} color={c.red} />
          </View>

          <Animated.View style={[styles.titleBlock, titleBlock]}>
            <View style={styles.titleRow}>
              {'BANK SHOT'.split('').map((ch, i) => <Letter key={i} t={t} i={i} ch={ch} color={c.ink} reduced={reduced} />)}
            </View>
            <Text style={[styles.tagline, { color: c.muted }]}>Place the bars. Bounce it in.</Text>
          </Animated.View>

          <Animated.View style={go}>
            <Pressable
              onPress={ready ? leave : finish} accessibilityRole="button" accessibilityLabel="Let's go"
              style={({ pressed }) => [styles.go, { backgroundColor: c.pencil, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={[styles.goText, { color: c.paper }]}>{"Let's go ›"}</Text>
            </Pressable>
          </Animated.View>
        </View>

        <Animated.Text style={[styles.version, { color: c.muted }, go]}>{VERSION_LABEL}</Animated.Text>

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
  return <Animated.View style={[styles.abs, styles.dot, { left: at.x * S - 2, top: at.y * S - 2, backgroundColor: color }, style]} />;
}

function Imprint({ t, x, y, r, color }: { t: SharedValue<number>; x: number; y: number; r: number; color: string }) {
  const style = useAnimatedStyle(() => ({ opacity: t.value < BALL.hitBar ? 0 : 0.3 }));
  return (
    <Animated.View
      style={[styles.abs, { left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: r, borderWidth: 1.5, borderColor: color, borderStyle: 'dashed' }, style]}
      pointerEvents="none"
    />
  );
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
  dot: { width: 4, height: 4, borderRadius: 2 },
  ring: { width: 48, height: 48, borderRadius: 24, borderWidth: 3 },
  glassFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.12 },
  wall: { position: 'absolute', top: 0, bottom: 0, width: 6, borderRadius: 3 },
  base: { position: 'absolute', left: -10, right: -10, bottom: -3, height: 6, borderRadius: 3 },
  titleBlock: { alignItems: 'center', marginTop: 28 },
  titleRow: { flexDirection: 'row' },
  letter: { fontFamily: FONTS.condensedBold, fontSize: 54, lineHeight: 58, letterSpacing: 1 },
  space: { width: 16 },
  version: { position: 'absolute', left: 0, right: 0, bottom: 34, textAlign: 'center', fontSize: 13, fontFamily: FONTS.body },
  tagline: { fontFamily: FONTS.bodyMedium, fontSize: 17, marginTop: 4 },
  go: { marginTop: 28, height: 54, paddingHorizontal: 44, borderRadius: 27, justifyContent: 'center',
    boxShadow: '0 6px 18px rgba(0,0,0,0.18)' },
  goText: { fontFamily: FONTS.condensedBold, fontSize: 24, letterSpacing: 0.5 },
});
