import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Board, type TouchPhase, type Trail } from '../../components/board/Board';
import { usePlayback } from '../../components/board/usePlayback';
import { AimControls } from '../../components/controls/AimControls';
import { aimAt, nearLauncher } from '../../game/aim';
import { LEVELS } from '../../levels';
import { buildWorld, simulate, solutionPieces, type PlacedPiece } from '../../physics';
import { FONTS, useColors } from '../../theme/colors';

const MAX_TRAILS = 4;

// Level screen, laid out like the prototype: board, hint, aim controls, then Solve and Launch.
// Each launch runs simulate() once and plays the path back. Piece placement comes in build step 5.
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
  const aiming = useRef(false);

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

  // Until the win card lands in step 6, Reset is the way back into a level after winning.
  const reset = () => {
    if (flying) return;
    setPieces([]);
    setTrails([]);
    setTries(0);
    setDone(false);
  };

  const clearTrails = () => {
    if (!flying) setTrails([]);
  };

  const aimTo = (p: { x: number; y: number }) => {
    const a = aimAt(p);
    setAngle(a.angle);
    setPower(a.power);
  };

  // Drag out from the launcher to aim. Piece moves and rotations join this in step 5.
  const onTouch = (phase: TouchPhase, p: { x: number; y: number }) => {
    if (phase === 'down') {
      if (flying || done || !nearLauncher(p)) return;
      aiming.current = true;
      aimTo(p);
    } else if (phase === 'move') {
      if (aiming.current) aimTo(p);
    } else {
      aiming.current = false;
    }
  };

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 12 }]}>
      <Stack.Screen options={{ title: level.name }} />
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
          onTouch={onTouch}
        />
      </View>
      <Text style={[styles.hint, { color: c.muted }]}>{level.hint}</Text>
      <View style={styles.controls}>
        <AimControls angle={angle} power={power} onAngle={setAngle} onPower={setPower} />
        <View style={styles.bottom}>
          <View style={styles.tray}>
            {level.pieces.length === 0 && (
              <Text style={[styles.none, { color: c.muted }]}>No pieces on this level</Text>
            )}
          </View>
          <Ghost label="Reset" onPress={reset} />
          <Ghost label="Clear trails" onPress={clearTrails} />
        </View>
        <View style={[styles.actions, flying && styles.busy]}>
          <Ghost label="Solve" onPress={solve} big />
          <Pressable
            onPress={launch}
            disabled={flying || done}
            accessibilityRole="button"
            style={[styles.launch, { backgroundColor: c.red, opacity: done ? 0.5 : 1 }]}
          >
            <Text style={styles.launchText}>Launch</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Ghost({ label, onPress, big }: { label: string; onPress: () => void; big?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.ghost, big && styles.ghostBig, { borderColor: c.line }]}
    >
      <Text style={[styles.ghostText, big && styles.ghostTextBig, { color: c.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  stage: { flex: 1, paddingHorizontal: 10, paddingTop: 4 },
  hint: { marginHorizontal: 14, marginTop: 6, fontSize: 13, minHeight: 18, fontFamily: FONTS.body },
  controls: { paddingHorizontal: 14, paddingTop: 6, gap: 8 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tray: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  none: { fontSize: 13, fontFamily: FONTS.body },
  actions: { flexDirection: 'row', gap: 8 },
  busy: { opacity: 0.5 },
  ghost: { height: 38, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1.5, justifyContent: 'center' },
  ghostBig: { height: 46, paddingHorizontal: 20, borderRadius: 23 },
  ghostText: { fontSize: 14, fontFamily: FONTS.bodyMedium },
  ghostTextBig: { fontSize: 15 },
  launch: { flex: 1, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  launchText: { color: '#fff', fontSize: 20, letterSpacing: 0.3, fontFamily: FONTS.condensedBold },
});
