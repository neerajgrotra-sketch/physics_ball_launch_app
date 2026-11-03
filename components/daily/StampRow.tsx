import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Polygon, Text as SvgText } from 'react-native-svg';
import { TIER_NAMES, WEEKDAYS, WEEKDAY_NAMES, type StampSlot } from '../../game/daily';
import { FONTS, useColors, type Palette } from '../../theme/colors';

/** Each weekday's stamp lands at its own slight tilt, like real rubber stamps (degrees). */
const TILT = [-8, 5, -3, 7, -6, 4, -10];
const S = 30;
const GOLD = '#d4a536';
const ICE = '#5bc8f5';

/**
 * The week's stamp card on the daily card (game/daily.ts weekSlots): seven slots, Monday to Sunday. A won day is an inked stamp with
 * its stars, a helped one lighter with a 💡, a frozen one an ice ❄, a missed one a faint ✗, today a dashed ring that breathes until
 * it's won, and the days to come a dotted ring (Sunday's, the toughest, in gold). `stampIn`: today's stamp has just been won and
 * not shown yet, so it thumps down (then `onStamped`, once, with the moment it lands for the sound).
 */
export function StampRow({ slots, stampIn, onLand, onStamped }: {
  slots: StampSlot[]; stampIn: boolean; onLand: () => void; onStamped: () => void;
}) {
  const c = useColors();
  return (
    <View style={styles.row}>
      {slots.map((s) => (
        <View key={s.day} style={styles.slot} accessible accessibilityLabel={slotLabel(s)}>
          <Text style={[styles.day, { color: s.state === 'today' ? c.red : c.muted }]}>{WEEKDAYS[s.weekday]}</Text>
          {s.state === 'today' ? <TodayRing c={c} boss={s.weekday === 6} />
            : s.state === 'won' || s.state === 'helped' ? (
              stampIn && isToday(s, slots) ? <Thump slot={s} c={c} onLand={onLand} onDone={onStamped} /> : <Stamp slot={s} c={c} />
            ) : <Empty slot={s} c={c} />}
        </View>
      ))}
    </View>
  );
}

/** The won slot that is today's: the last won one on or before today (today is the latest day that can be won). */
const isToday = (s: StampSlot, slots: StampSlot[]) => s.day === [...slots].reverse().find((x) => x.state === 'won' || x.state === 'helped')?.day;

function slotLabel(s: StampSlot): string {
  const name = WEEKDAY_NAMES[s.weekday];
  switch (s.state) {
    case 'won': return `${name}, won, ${s.stars} star${s.stars === 1 ? '' : 's'}`;
    case 'helped': return `${name}, won with help`;
    case 'frozen': return `${name}, missed, kept by a streak freeze`;
    case 'missed': return `${name}, missed`;
    case 'today': return `${name}, today's puzzle, ${TIER_NAMES[s.tier]}, not played yet`;
    case 'future': return `${name}, ${TIER_NAMES[s.tier]}, still to come`;
    default: return `${name}, before your first daily`;
  }
}

/** An inked stamp: a double ring tilted on the paper, the day's stars inside (a helped win is lighter, with a 💡). */
function Stamp({ slot, c }: { slot: StampSlot; c: Palette }) {
  const helped = slot.state === 'helped';
  const ink = helped ? c.pencil : slot.weekday === 6 ? GOLD : c.red;
  const n = Math.max(1, Math.min(3, slot.stars));
  return (
    <Svg width={S} height={S} viewBox="-15 -15 30 30">
      <G rotation={TILT[slot.weekday]} opacity={helped ? 0.7 : 0.95}>
        <Circle r={13} fill={ink} fillOpacity={0.12} stroke={ink} strokeWidth={2.2} />
        <Circle r={10} fill="none" stroke={ink} strokeWidth={0.8} />
        {helped
          ? <SvgText y={4} fontSize={11} textAnchor="middle">💡</SvgText>
          : STAR_SPOTS[n].map(([x, y, r], k) => <Polygon key={k} points={starPoints(x, y, r)} fill={ink} />)}
      </G>
    </Svg>
  );
}

/** Where a stamp's stars go: one big in the middle, two side by side, three in a triangle ([x, y, outer radius]). */
const STAR_SPOTS: Record<number, [number, number, number][]> = {
  1: [[0, 0.5, 6.5]],
  2: [[-4.2, 0.5, 4.2], [4.2, 0.5, 4.2]],
  3: [[0, -3.4, 3.8], [-4.4, 3.2, 3.8], [4.4, 3.2, 3.8]],
};

/** A five-pointed star's points round (cx, cy), point up. */
function starPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    return `${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`;
  }).join(' ');
}

/** Today, not yet won: a dashed ring that breathes. */
function TodayRing({ c, boss }: { c: Palette; boss: boolean }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (!reduced) o.value = withRepeat(withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [o, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={style}>
      <Svg width={S} height={S} viewBox="-15 -15 30 30">
        <Circle r={12.5} fill="none" stroke={boss ? GOLD : c.red} strokeWidth={2} strokeDasharray="4 3" />
        <SvgText y={4} fontSize={11} fill={boss ? GOLD : c.red} textAnchor="middle" fontWeight="bold">?</SvgText>
      </Svg>
    </Animated.View>
  );
}

/** Missed (a faint ✗), frozen (an ice ❄), still to come (a dotted ring, gold for Sunday), or before the first daily (blank). */
function Empty({ slot, c }: { slot: StampSlot; c: Palette }) {
  const boss = slot.weekday === 6;
  return (
    <Svg width={S} height={S} viewBox="-15 -15 30 30">
      {slot.state === 'frozen' && (
        <>
          <Circle r={12.5} fill={ICE} fillOpacity={0.15} stroke={ICE} strokeWidth={1.6} />
          <SvgText y={4.5} fontSize={13} fill={ICE} textAnchor="middle">❄</SvgText>
        </>
      )}
      {slot.state === 'missed' && (
        <>
          <Circle r={12.5} fill="none" stroke={c.line} strokeWidth={1.2} />
          <SvgText y={5} fontSize={14} fill={c.muted} fillOpacity={0.6} textAnchor="middle">✗</SvgText>
        </>
      )}
      {slot.state === 'future' && <Circle r={12.5} fill="none" stroke={boss ? GOLD : c.line} strokeWidth={boss ? 1.8 : 1.2} strokeDasharray="1.5 3" />}
      {slot.state === 'blank' && <Circle r={2} fill={c.line} />}
    </Svg>
  );
}

/**
 * Today's stamp, just won: held up over the card, it drops and thumps down (a quick squash and settle), an ink ring splashes out, and
 * the sound and buzz play as it lands (`onLand`), then `onDone`. Reduced motion: it's simply there.
 */
function Thump({ slot, c, onLand, onDone }: { slot: StampSlot; c: Palette; onLand: () => void; onDone: () => void }) {
  const reduced = useReducedMotion();
  const drop = useSharedValue(reduced ? 1 : 0);   // 0 held up, 1 on the paper
  const squash = useSharedValue(1);
  const splash = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { onDone(); return; }
    drop.value = withDelay(DROP_AT, withTiming(1, { duration: DROP_MS, easing: Easing.in(Easing.quad) }, (ok) => { if (ok) runOnJS(onLand)(); }));
    squash.value = withDelay(DROP_AT + DROP_MS, withSequence(
      withTiming(0.86, { duration: 60 }),
      withTiming(1, { duration: 180, easing: Easing.out(Easing.back(2)) }, (ok) => { if (ok) runOnJS(onDone)(); }),
    ));
    splash.value = withDelay(DROP_AT + DROP_MS, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const stampStyle = useAnimatedStyle(() => ({
    opacity: drop.value <= 0 ? 0 : Math.min(1, 0.25 + drop.value),
    transform: [{ scale: (2.6 - 1.6 * drop.value) * squash.value }, { rotate: `${(1 - drop.value) * -24}deg` }],
  }));
  const splashStyle = useAnimatedStyle(() => ({
    opacity: splash.value > 0 && splash.value < 1 ? 0.6 * (1 - splash.value) : 0,
    transform: [{ scale: 0.8 + 1.1 * splash.value }],
  }));
  const ink = slot.weekday === 6 ? GOLD : slot.state === 'helped' ? c.pencil : c.red;
  return (
    <View style={styles.thumpBox}>
      <Animated.View pointerEvents="none" style={[styles.splash, { borderColor: ink }, splashStyle]} />
      <Animated.View style={stampStyle}>
        <Stamp slot={slot} c={c} />
      </Animated.View>
    </View>
  );
}

/** The stamp waits this long after the card appears (ms), then drops for DROP_MS. */
const DROP_AT = 450;
const DROP_MS = 240;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  slot: { flex: 1, alignItems: 'center', gap: 1 },
  day: { fontSize: 11, fontFamily: FONTS.condensedBold, letterSpacing: 0.5 },
  thumpBox: { width: S, height: S, alignItems: 'center', justifyContent: 'center' },
  splash: { position: 'absolute', width: S, height: S, borderRadius: S / 2, borderWidth: 2 },
});
