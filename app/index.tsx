import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShotThumbnail } from '../components/levels/ShotThumbnail';
import { useProgress } from '../components/progress/ProgressProvider';
import { VERSION_LABEL } from '../components/version';
import { totalScore } from '../game/score';
import { LEVELS } from '../levels';
import { FONTS, useColors } from '../theme/colors';

const COLUMNS = 2;
const GAP = 12;

// Level select: a grid of level cards, two across. Each shows a small drawing of the level with the
// player's last winning shot (bars and path), its number and name, and its best stars and bounces. The
// first level without a result is highlighted as the one to play next. Locked levels (when LOCK_LEVELS
// is on) are dashed with a lock.
export default function LevelSelect() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { unlocked, best, shots } = useProgress();
  const total = totalScore(best);
  const tile = Math.floor((Math.min(width, 560) - 2 * 18 - (COLUMNS - 1) * GAP) / COLUMNS);
  const nextUp = LEVELS.findIndex((l) => !best[l.id]);

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: c.ink }]}>Levels</Text>
        <Text style={[styles.total, { color: c.muted }]}>
          {total > 0 ? `Score ${total.toLocaleString()}` : 'Get each ball in with as few bounces as you can'}
        </Text>
      </View>
      <View style={styles.grid}>
        {LEVELS.map((level, index) => {
          const locked = index > unlocked;
          const b = best[level.id];
          const next = index === nextUp && !locked;
          const label = `Level ${index + 1}, ${level.name}${locked ? ', locked' : b ? `, ${b.stars} of 3 stars` : ''}`;
          const body = (
            <Pressable
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ disabled: locked }}
              // Flattened: Link asChild passes this through a Slot, which rejects style arrays on web.
              style={StyleSheet.flatten([
                styles.tile,
                { width: tile, backgroundColor: next ? c.pencil : c.paper, borderColor: next || b ? c.pencil : c.line },
                locked && styles.locked,
              ])}
            >
              <View style={[styles.thumb, { borderColor: c.line, backgroundColor: c.paper }]}>
                <ShotThumbnail level={level} shot={shots[level.id]} width={tile - 16} height={(tile - 16) * 0.85} />
                <View style={[styles.badge, { backgroundColor: next ? c.pencil : c.ink }]}>
                  <Text style={[styles.badgeText, { color: c.paper }]}>{index + 1}</Text>
                </View>
              </View>
              <Text style={[styles.name, { color: next ? c.paper : c.ink }]} numberOfLines={1}>{level.name}</Text>
              {locked ? (
                <Text style={styles.lock}>🔒</Text>
              ) : (
                <View style={styles.meta}>
                  <Text style={styles.stars}>
                    {[0, 1, 2].map((k) => (
                      <Text key={k} style={b && k < b.stars ? { color: next ? c.paper : c.red } : { color: next ? c.paper : c.line, opacity: next ? 0.45 : 1 }}>★</Text>
                    ))}
                  </Text>
                  <Text style={[styles.best, { color: next ? c.paper : c.muted }]}>
                    {b ? `best ${b.bounces}, par ${level.par}` : `par ${level.par}`}
                  </Text>
                </View>
              )}
            </Pressable>
          );
          return locked ? <View key={level.id}>{body}</View> : (
            <Link key={level.id} href={{ pathname: '/level/[id]', params: { id: level.id } }} asChild>{body}</Link>
          );
        })}
      </View>
      <Text style={[styles.version, { color: c.muted }]}>{VERSION_LABEL}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, gap: 18 },
  header: { alignItems: 'center', gap: 2 },
  heading: { fontSize: 34, fontFamily: FONTS.condensedBold },
  total: { fontSize: 15, fontFamily: FONTS.bodyMedium, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { borderRadius: 16, borderWidth: 2, padding: 6, gap: 6 },
  thumb: { borderRadius: 10, borderWidth: 1, overflow: 'hidden', alignItems: 'center' },
  badge: { position: 'absolute', top: 6, left: 6, minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 17, fontFamily: FONTS.condensedBold },
  name: { fontSize: 17, fontFamily: FONTS.bodySemi, paddingHorizontal: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 2 },
  best: { fontSize: 13, fontFamily: FONTS.bodyMedium },
  locked: { opacity: 0.55, borderStyle: 'dashed' },
  stars: { fontSize: 17, letterSpacing: 1 },
  lock: { fontSize: 14, paddingHorizontal: 4 },
  version: { marginTop: 8, textAlign: 'center', fontSize: 12, fontFamily: FONTS.body },
});
