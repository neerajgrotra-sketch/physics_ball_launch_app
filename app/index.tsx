import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useProgress } from '../components/progress/ProgressProvider';
import { LEVELS } from '../levels';
import { FONTS, useColors } from '../theme/colors';

// Level select. Levels open one at a time: winning a level unlocks the next.
export default function LevelSelect() {
  const c = useColors();
  const { unlocked } = useProgress();
  return (
    <FlatList
      data={LEVELS}
      keyExtractor={(l) => l.id}
      contentContainerStyle={styles.list}
      renderItem={({ item, index }) => {
        const locked = index > unlocked;
        const next = index === unlocked;
        const row = (
          <Pressable
            disabled={locked}
            accessibilityRole="button"
            accessibilityState={{ disabled: locked }}
            accessibilityLabel={`Level ${index + 1}, ${item.name}${locked ? ', locked' : ''}`}
            style={[
              styles.row,
              { backgroundColor: c.paper, borderColor: next ? c.pencil : c.line },
              locked && styles.locked,
            ]}
          >
            <Text style={[styles.num, { color: locked ? c.muted : c.pencil }]}>{String(index + 1).padStart(2, '0')}</Text>
            <View style={styles.text}>
              <Text style={[styles.name, { color: c.ink }]}>{item.name}</Text>
              <Text style={[styles.hint, { color: c.muted }]} numberOfLines={2}>
                {locked ? `Win level ${index} to unlock` : item.hint}
              </Text>
            </View>
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
});
