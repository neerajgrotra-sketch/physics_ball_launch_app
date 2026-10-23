import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Board, type Trail } from '../../components/board/Board';
import { usePlayback } from '../../components/board/usePlayback';
import { LEVELS } from '../../levels';
import { buildWorld, simulate, solutionPieces, type PlacedPiece } from '../../physics';
import { FONTS, useColors } from '../../theme/colors';

const MAX_TRAILS = 4;

// Level screen. Each launch runs simulate() once and plays the path back.
// Aiming comes in build step 4 and piece placement in step 5.
export default function LevelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const level = LEVELS.find((l) => l.id === id);

  const [pieces, setPieces] = useState<PlacedPiece[]>([]);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [angle, setAngle] = useState(52);
  const [power, setPower] = useState(45);
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState(false);
  const { flight, flying, play } = usePlayback();

  if (!level) {
    return <Text style={[styles.hint, { color: c.ink }]}>Level not found.</Text>;
  }

  // The trail and the win only land once playback reaches the end of the path, as in the prototype.
  const fire = (placed: PlacedPiece[], a: number, p: number) => {
    const res = simulate(buildWorld(level, placed), a, p);
    setTries((n) => n + 1);
    play(res.path, () => {
      setTrails((ts) => [...ts, { path: res.path, ok: res.success }].slice(-MAX_TRAILS));
      if (res.success) setDone(true);
    });
  };

  const launch = () => {
    if (flying || done) return;
    fire(pieces, angle, power);
  };

  const solve = () => {
    const s = level.solution;
    if (flying || !s) return;
    const placed = solutionPieces(level);
    setPieces(placed);
    setAngle(s.angle);
    setPower(s.power);
    if (done) {
      setTrails([]);
      setDone(false);
    }
    fire(placed, s.angle, s.power);
  };

  const reset = () => {
    if (flying) return;
    setPieces([]);
    setTrails([]);
    setTries(0);
    setDone(false);
  };

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 12 }]}>
      <Stack.Screen options={{ title: level.name }} />
      <Text style={[styles.hint, { color: c.muted }]}>{level.hint}</Text>
      <View style={styles.stage}>
        <Board
          level={level}
          pieces={pieces}
          trails={trails}
          angle={angle}
          power={power}
          tries={tries}
          flight={flight}
          done={done}
        />
      </View>
      <View style={[styles.actions, flying && styles.busy]}>
        <Button label="Reset" onPress={reset} color={c.muted} border={c.line} />
        <Button label="Solve" onPress={solve} color={c.muted} border={c.line} />
        <Pressable
          onPress={launch}
          disabled={flying || done}
          style={[styles.launch, { backgroundColor: c.red, opacity: done ? 0.5 : 1 }]}
        >
          <Text style={styles.launchText}>Launch</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Button({ label, onPress, color, border }: { label: string; onPress: () => void; color: string; border: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.ghost, { borderColor: border }]}>
      <Text style={[styles.ghostText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 8 },
  hint: { marginHorizontal: 14, marginTop: 6, fontSize: 13, minHeight: 18, fontFamily: FONTS.body },
  stage: { flex: 1, paddingHorizontal: 10 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 14 },
  busy: { opacity: 0.5 },
  ghost: { height: 46, paddingHorizontal: 20, borderRadius: 23, borderWidth: 1.5, justifyContent: 'center' },
  ghostText: { fontSize: 15, fontFamily: FONTS.bodyMedium },
  launch: { flex: 1, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  launchText: { color: '#fff', fontSize: 20, letterSpacing: 0.3, fontFamily: FONTS.condensedBold },
});
