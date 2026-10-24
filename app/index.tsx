import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useProgress } from '../components/progress/ProgressProvider';
import { VERSION_LABEL } from '../components/version';
import { totalScore } from '../game/score';
import { LEVELS } from '../levels';
import { FONTS, useColors } from '../theme/colors';

// Level select. Levels open one at a time: winning a level unlocks the next.
export default function LevelSelect() {
  const c = useColors();
  const { unlocked, best } = useProgress();
  const total = totalScore(best);
  return (
    <FlatList
      data={LEVELS}
      keyExtractor={(l) => l.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={total > 0 ? (
        <Text style={[styles.total, { color: c.ink }]}>Score {total.toLocaleString()}</Text>
      ) : undefined}
      ListFooterComponent={<Text style={[styles.version, { color: c.muted }]}>{VERSION_LABEL}</Text>}
      renderItem={({ item, index }) => {
        const locked = index > unlocked;
        const next = index === unlocked;
        const b = best[item.id];
        const row = (
          <Pressable
            disabled={locked}
            accessibilityRole="button"
            accessibilityState={{ disabled: locked }}
            accessibilityLabel={`Level ${index + 1}, ${item.name}${locked ? ', locked' : ''}`}
            // Flattened: Link asChild passes this through a Slot, which rejects style arrays on web.
            style={StyleSheet.flatten([
              styles.row,
              { backgroundColor: c.paper, borderColor: next ? c.pencil : c.line },
              locked && styles.locked,
            ])}
          >
            <Text style={[styles.num, { color: locked ? c.muted : c.pencil }]}>{String(index + 1).padStart(2, '0')}</Text>
            <View style={styles.text}>
              <Text style={[styles.name, { color: c.ink }]}>{item.name}</Text>
              <Text style={[styles.hint, { color: c.muted }]} numberOfLines={2}>
                {locked ? `Win level ${index} to unlock` : b ? `Best: ${b.bounces} bounce${b.bounces === 1 ? '' : 's'} · par ${item.par} · ${b.score} pts` : `Par ${item.par}`}
              </Text>
            </View>
            {!locked && (
              <Text style={styles.stars} accessibilityLabel={`${b?.stars ?? 0} of 3 stars`}>
                {[0, 1, 2].map((k) => <Text key={k} style={{ color: b && k < b.stars ? c.red : c.line }}>★</Text>)}
              </Text>
            )}
          </Pressable>
        );
        return locked ? row : (
          <Link href={{ pathname: '/level/[id]', params: { id: item.id } }} asChild>{row}</Link>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 10, borderWidth: 1.5 },
  locked: { opacity: 0.55, borderStyle: 'dashed' },
  num: { fontSize: 22, fontFamily: FONTS.condensedBold, fontVariant: ['tabular-nums'] },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 18, fontFamily: FONTS.bodySemi },
  hint: { fontSize: 13, fontFamily: FONTS.body },
  total: { fontSize: 20, fontFamily: FONTS.condensedBold, textAlign: 'center', marginBottom: 2 },
  stars: { fontSize: 20, letterSpacing: 1 },
  version: { marginTop: 14, textAlign: 'center', fontSize: 12, fontFamily: FONTS.body },
});
