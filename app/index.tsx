import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { LEVELS } from '../levels';
import { FONTS, useColors } from '../theme/colors';

// Level select. Progress and locking come in build step 6.
export default function LevelSelect() {
  const c = useColors();
  return (
    <FlatList
      data={LEVELS}
      keyExtractor={(l) => l.id}
      contentContainerStyle={styles.list}
      renderItem={({ item, index }) => (
        <Link href={{ pathname: '/level/[id]', params: { id: item.id } }} asChild>
          <Pressable style={[styles.row, { backgroundColor: c.paper, borderColor: c.line }]}>
            <Text style={[styles.num, { color: c.pencil }]}>{String(index + 1).padStart(2, '0')}</Text>
            <View style={styles.text}>
              <Text style={[styles.name, { color: c.ink }]}>{item.name}</Text>
              <Text style={[styles.hint, { color: c.muted }]} numberOfLines={2}>{item.hint}</Text>
            </View>
          </Pressable>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 10, borderWidth: 1.5 },
  num: { fontSize: 22, fontFamily: FONTS.condensedBold, fontVariant: ['tabular-nums'] },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 18, fontFamily: FONTS.bodySemi },
  hint: { fontSize: 13, fontFamily: FONTS.body },
});
