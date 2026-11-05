import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

// "Show touches" (Settings, off by default): a finger (the tutorial's 👆) wherever the player touches, following the finger and fading when it
// lifts, so a screen recording shows what was done (for the tutorial, investors and testers; iPhone recordings show no touches).
// The whole app is covered by TouchesOverlay (raw touch events on phones, pointer events on the web). On phones the board's drags are
// taken over by the gesture handler, which cuts the raw events off, so the board draws the same fingertip itself (`TouchSpot`, fed
// from its own drag positions) and says so (`setBoardTouching`), and the overlay steps aside meanwhile.

export const SHOW_TOUCHES_KEY = 'bank-shot/show-touches';
let on = false;
let boardTouching = false;
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;
const notify = () => listeners.forEach((f) => f());

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(SHOW_TOUCHES_KEY).then((v) => { if (v === '1') { on = true; notify(); } }).catch(() => {});
  return loading;
}

export function setShowTouches(v: boolean) {
  on = v;
  notify();
  AsyncStorage.setItem(SHOW_TOUCHES_KEY, v ? '1' : '0').catch(() => {});
}

/** The board has the finger (its own fingertip is showing): the overlay hides its own meanwhile. */
export function setBoardTouching(v: boolean) {
  if (boardTouching !== v) { boardTouching = v; notify(); }
}

/** Whether touches are shown, re-rendering when that changes. */
export function useShowTouches(): boolean {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    listeners.add(f);
    load().then(f);
    return () => { listeners.delete(f); };
  }, []);
  return on;
}

const RING = 30;

/**
 * The finger: the tutorial's ghost finger (👆, Apple's own hand on an iPhone) with its fingertip on the touch, the hand below it so
 * what's pressed stays in view, and a small ring at the point of contact. It presses in a touch as the finger lands and fades on lift.
 */
export function TouchSpot({ x, y, shown }: { x: SharedValue<number>; y: SharedValue<number>; shown: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));
  const press = useAnimatedStyle(() => ({ transform: [{ scale: 1.08 - 0.08 * shown.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.at, style]}>
      <View style={styles.ring} />
      <Animated.View style={[styles.handBox, press]}>
        <Text style={styles.hand}>👆</Text>
      </Animated.View>
    </Animated.View>
  );
}

/** Shared values for one fingertip, with press / move / lift. */
export function useSpot() {
  const x = useSharedValue(0), y = useSharedValue(0), shown = useSharedValue(0);
  return {
    x, y, shown,
    down(px: number, py: number) { x.value = px; y.value = py; shown.value = withTiming(1, { duration: 80 }); },
    move(px: number, py: number) { x.value = px; y.value = py; },
    up() { shown.value = withTiming(0, { duration: 260 }); },
  };
}

/**
 * Wraps the app: while "Show touches" is on, a fingertip follows every touch (the first finger). On phones it listens to raw touch
 * events, which never take a touch from anything; on the web to pointer events on the page, which also cover the board there.
 */
export function TouchesOverlay({ children }: { children: ReactNode }) {
  const showing = useShowTouches();
  const spot = useSpot();
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  // Web: pointer events on the whole page, captured, so nothing can stop them.
  useEffect(() => {
    if (Platform.OS !== 'web' || !showing || typeof window === 'undefined') return;
    let id: number | null = null;
    const downH = (e: PointerEvent) => { if (id == null) { id = e.pointerId; spot.down(e.clientX, e.clientY); } };
    const moveH = (e: PointerEvent) => { if (e.pointerId === id) spot.move(e.clientX, e.clientY); };
    const upH = (e: PointerEvent) => { if (e.pointerId === id) { id = null; spot.up(); } };
    window.addEventListener('pointerdown', downH, true);
    window.addEventListener('pointermove', moveH, true);
    window.addEventListener('pointerup', upH, true);
    window.addEventListener('pointercancel', upH, true);
    return () => {
      window.removeEventListener('pointerdown', downH, true);
      window.removeEventListener('pointermove', moveH, true);
      window.removeEventListener('pointerup', upH, true);
      window.removeEventListener('pointercancel', upH, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing]);
  const native = Platform.OS !== 'web' && showing;
  const at = (e: GestureResponderEvent) => e.nativeEvent.touches?.[0] ?? e.nativeEvent;
  return (
    <View
      style={styles.fill}
      onTouchStart={native ? (e) => { const t = at(e); spot.down(t.pageX, t.pageY); } : undefined}
      onTouchMove={native ? (e) => { const t = at(e); spot.move(t.pageX, t.pageY); } : undefined}
      onTouchEnd={native ? (e) => { if (!e.nativeEvent.touches?.length) spot.up(); } : undefined}
      onTouchCancel={native ? () => spot.up() : undefined}
    >
      {children}
      {showing && !boardTouching && <View pointerEvents="none" style={StyleSheet.absoluteFill}><TouchSpot x={spot.x} y={spot.y} shown={spot.shown} /></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Stands in for the root's own layout (it sits inside the root, which centres the 560-wide column): full width, centring its children.
  fill: { flex: 1, alignSelf: 'stretch', alignItems: 'center' },
  // A zero-size anchor at the touch point; the ring is centred on it and the hand hangs below with its fingertip on it (the same
  // offsets as the tutorial's ghost finger).
  at: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
  ring: {
    position: 'absolute', left: -RING / 2, top: -RING / 2, width: RING, height: RING, borderRadius: RING / 2,
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(40,40,40,0.18)',
  },
  handBox: { position: 'absolute', left: -15, top: -2, transformOrigin: '15px 2px' },
  hand: { fontSize: 40, lineHeight: 46, textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 } },
});
