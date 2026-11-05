import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DAILY_WIN, TIER_NAMES, applyFreezes, fullWeek, streak, untilTomorrow, weekOf, weekSlots } from '../../game/daily';
import { useFeedback } from '../feedback/useFeedback';
import { StampRow } from './StampRow';
import { useIntroDone } from '../splash/introState';
import { useTips } from '../coach/Tips';
import { FONTS, useColors } from '../../theme/colors';
import { ShotThumbnail } from '../levels/ShotThumbnail';
import { todaysDaily, useDaily } from './DailyProvider';
import { ensurePermission, remindersSupported } from '../notifications/Reminders';
import { setReminderPrefs, useReminderPrefs } from '../notifications/reminderPrefs';

/**
 * The daily puzzle's card at the top of the levels screen: today's puzzle (number, toughness, a drawing), the result once it's won,
 * a Share button, and the week's stamp card (StampRow, game/daily.ts weekSlots) with the streak, freezes and time to the next one
 * under it. The day just won thumps its stamp down the first time the card is seen after the win. A full week turns the card gold.
 * The clock ticks every 30 s so the countdown and the day stay current.
 */
export function DailyCard({ width }: { width: number }) {
  const c = useColors();
  const router = useRouter();
  const { state: saved, share, markStamped } = useDaily();
  const feedback = useFeedback();
  const reminders = useReminderPrefs();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const { day, number, level } = todaysDaily(now);
  const state = applyFreezes(saved, day);
  const result = state.days[day];
  const run = streak(state, day);
  const slots = weekSlots(state, day);
  const full = fullWeek(state, weekOf(day));
  // Only once the levels screen is in view again: it stays mounted under the daily while that's played.
  // Nor under the intro or the first-run tour.
  const focused = useIsFocused();
  const introDone = useIntroDone();
  const { tourSeen } = useTips();
  const stampIn = focused && introDone && tourSeen && !!result && state.stamped !== day;
  const thumb = Math.round(width * 0.34);
  const stars = result && !result.helped ? '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars) : null;
  return (
    <View style={{ width }}>
      <Pressable
        onPress={() => router.push('/daily')}
        accessibilityRole="button"
        accessibilityLabel={`Daily puzzle ${number}, ${TIER_NAMES[level.tier]}${result ? ', done today' : ''}${run ? `, ${run}-day streak` : ''}${state.freezes ? `, ${state.freezes} streak freeze${state.freezes === 1 ? '' : 's'}` : ''}`}
        style={[styles.card, { borderColor: full ? GOLD : result ? c.pencil : c.red, backgroundColor: c.paper }]}
      >
        <View style={styles.top}>
        <View style={[styles.thumb, { borderColor: c.line }]}>
          <ShotThumbnail level={level} width={thumb} height={thumb * 0.85} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.kicker, { color: c.red }]}>DAILY PUZZLE</Text>
          <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>#{number} · {level.name}</Text>
          <Text style={[styles.line, { color: c.muted }]}>{TIER_NAMES[level.tier]} · par {level.par}</Text>
          {result ? (
            <Text style={[styles.line, { color: c.ink }]}>
              {stars ? <Text style={{ color: c.red }}>{stars} </Text> : 'Solved with help · '}
              {result.bounces} bounces
            </Text>
          ) : (
            <Text style={[styles.line, { color: c.pencil }]}>Win it for +{DAILY_WIN} 💡</Text>
          )}
        </View>
        </View>
        <View style={[styles.week, { borderColor: c.line }]}>
          <StampRow slots={slots} stampIn={stampIn} onLand={() => feedback.stamped()} onStamped={() => markStamped(day)} />
          <Text style={[styles.foot, { color: c.ink }]} numberOfLines={1}>
            {full ? <Text style={{ color: GOLD }}>✦ Full week!  </Text> : null}
            {run ? `🔥 ${run}-day streak` : 'Start a streak today'}
            {state.freezes ? <Text style={{ color: ICE }}>{`  ·  ❄️ ${state.freezes}`}</Text> : null}
            {result ? <Text style={{ color: c.muted }}>{`  ·  next in ${untilTomorrow(now)}`}</Text> : null}
          </Text>
        </View>
      </Pressable>
      {remindersSupported && !reminders.asked && Object.keys(state.days).length > 0 && (
        // Asked once, after the player's first daily win (not at first launch, when most people say no).
        <View style={[styles.ask, { borderColor: c.line, backgroundColor: c.paper }]}>
          <Text style={[styles.askText, { color: c.ink }]}>🔔 Want a nudge when tomorrow's puzzle is ready?</Text>
          <View style={styles.askRow}>
            <Pressable
              onPress={() => setReminderPrefs({ asked: true })} accessibilityRole="button" hitSlop={6}
              style={[styles.askBtn, { borderColor: c.line }]}
            >
              <Text style={[styles.askBtnText, { color: c.muted }]}>No thanks</Text>
            </Pressable>
            <Pressable
              onPress={async () => { const ok = await ensurePermission(); setReminderPrefs({ asked: true, daily: ok, streak: ok }); }}
              accessibilityRole="button" hitSlop={6} style={[styles.askBtn, { backgroundColor: c.pencil, borderColor: c.pencil }]}
            >
              <Text style={[styles.askBtnText, { color: '#fff' }]}>Yes please</Text>
            </Pressable>
          </View>
        </View>
      )}
      {result ? (
        <Pressable
          onPress={() => share(day)} accessibilityRole="button" accessibilityLabel="Share today's result" hitSlop={6}
          style={[styles.pill, { backgroundColor: c.pencil }]}
        >
          <Text style={styles.pillText}>Share</Text>
        </Pressable>
      ) : (
        <View pointerEvents="none" style={[styles.pill, { backgroundColor: c.red }]}>
          <Text style={styles.pillText}>Play ▶︎</Text>
        </View>
      )}
    </View>
  );
}

const GOLD = '#d4a536';
const ICE = '#3aa7d9';

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 2, padding: 8, gap: 6 },
  top: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  week: { borderTopWidth: 1, paddingTop: 6, gap: 3 },
  foot: { fontSize: 13, fontFamily: FONTS.bodyMedium, textAlign: 'center' },
  thumb: { borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  body: { flex: 1, gap: 2, paddingRight: 4 },
  kicker: { fontSize: 12, letterSpacing: 1.2, fontFamily: FONTS.bodySemi },
  title: { fontSize: 20, fontFamily: FONTS.condensedBold },
  line: { fontSize: 14, fontFamily: FONTS.bodyMedium },
  pill: { position: 'absolute', right: 12, top: 10, height: 28, paddingHorizontal: 12, borderRadius: 14, justifyContent: 'center' },
  pillText: { color: '#fff', fontSize: 14, fontFamily: FONTS.condensedBold },
  ask: { marginTop: 8, borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
  askText: { fontSize: 15, fontFamily: FONTS.bodyMedium, textAlign: 'center' },
  askRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  askBtn: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 7 },
  askBtnText: { fontSize: 15, fontFamily: FONTS.condensedBold },
});
