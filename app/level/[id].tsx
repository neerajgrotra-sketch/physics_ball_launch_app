import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LEVELS } from '../../levels';
import { buildWorld, simulate, solutionPieces } from '../../physics';
import { useColors } from '../../theme/colors';

// Placeholder level screen. The Skia board replaces this in build step 2.
// For now it runs the stored solution once, which proves the shared physics runs on this engine.
export default function LevelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const level = LEVELS.find((l) => l.id === id);

  const check = useMemo(() => {
    if (!level?.solution) return null;
    const { angle, power } = level.solution;
    return simulate(buildWorld(level, solutionPieces(level)), angle, power);
  }, [level]);

  if (!level) {
    return <Text style={[styles.body, { color: c.ink }]}>Level not found.</Text>;
  }

  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ title: level.name }} />
      <Text style={[styles.body, { color: c.muted }]}>{level.hint}</Text>
      <View style={[styles.card, { backgroundColor: c.paper, borderColor: c.line }]}>
        <Text style={[styles.label, { color: c.muted }]}>Stored solution on this device</Text>
        <Text style={[styles.result, { color: check?.success ? c.pencil : c.red }]}>
          {check ? (check.success ? 'Lands in the glass' : `Missed (${check.end})`) : 'No stored solution'}
        </Text>
        {check && (
          <Text style={[styles.label, { color: c.muted }]}>
            {check.path.length} path points, {check.t.toFixed(2)} s
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 16 },
  body: { fontSize: 15, lineHeight: 21 },
  card: { padding: 16, borderRadius: 10, borderWidth: 1.5, gap: 6 },
  label: { fontSize: 13 },
  result: { fontSize: 20, fontWeight: '700' },
});
