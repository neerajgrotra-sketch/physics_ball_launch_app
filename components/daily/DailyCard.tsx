import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DAILY_WIN, TIER_NAMES, streak, untilTomorrow } from '../../game/daily';
import { FONTS, useColors } from '../../theme/colors';
import { ShotThumbnail } from '../levels/ShotThumbnail';
import { todaysDaily, useDaily } from './DailyProvider';

/**
 * The daily puzzle's card at the top of the levels screen: today's puzzle (number, toughness, a drawing), the streak, and once it's
 * won the result, a Share button and the time to the next one. The clock ticks every 30 s so the countdown and the day stay current.
 */
export function DailyCard({ width }: { width: number }) {
  const c = useColors();
  const router = useRouter();
  const { state, share } = useDaily();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const { day, number, level } = todaysDaily(now);
  const result = state.days[day];
  const run = streak(state, day);
  const thumb = Math.round(width * 0.34);
  const stars = result && !result.helped ? '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars) : null;
  return (
    <View style={{ width }}>
      <Pressable
        onPress={() => router.push('/daily')}
        accessibilityRole="button"
        accessibilityLabel={`Daily puzzle ${number}, ${TIER_NAMES[level.tier]}${result ? ', done today' : ''}${run ? `, ${run}-day streak` : ''}`}
        style={[styles.card, { borderColor: result ? c.pencil : c.red, backgroundColor: c.paper }]}
      >
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
          <Text style={[styles.line, { color: c.ink }]}>
            {run ? `🔥 ${run}-day streak` : 'Start a streak today'}
            {result ? <Text style={{ color: c.muted }}>{`  ·  next in ${untilTomorrow(now)}`}</Text> : null}
          </Text>
        </View>
      </Pressable>
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

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderRadius: 16, borderWidth: 2, padding: 8, gap: 10, alignItems: 'center' },
  thumb: { borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  body: { flex: 1, gap: 2, paddingRight: 4 },
  kicker: { fontSize: 12, letterSpacing: 1.2, fontFamily: FONTS.bodySemi },
  title: { fontSize: 20, fontFamily: FONTS.condensedBold },
  line: { fontSize: 14, fontFamily: FONTS.bodyMedium },
  pill: { position: 'absolute', right: 12, top: 10, height: 28, paddingHorizontal: 12, borderRadius: 14, justifyContent: 'center' },
  pillText: { color: '#fff', fontSize: 14, fontFamily: FONTS.condensedBold },
});
