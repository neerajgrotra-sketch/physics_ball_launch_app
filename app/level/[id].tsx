import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Board, type TouchPhase, type Trail } from '../../components/board/Board';
import { usePlayback } from '../../components/board/usePlayback';
import { WinCard } from '../../components/board/WinCard';
import { AimControls } from '../../components/controls/AimControls';
import { Tray } from '../../components/controls/Tray';
import { useFeedback } from '../../components/feedback/useFeedback';
import { useProgress } from '../../components/progress/ProgressProvider';
import { aimAt } from '../../game/aim';
import {
  boardIndex, boardPieces, dragTo, emptySlots, pressAt, solutionSlots, tapChip, type Drag, type Slot,
} from '../../game/pieces';
import { winText } from '../../game/progress';
import { LEVELS } from '../../levels';
import { buildWorld, simulate, type PlacedPiece } from '../../physics';
import { FONTS, useColors } from '../../theme/colors';

const MAX_TRAILS = 4;

/**
 * Resolves the level from the route. The game below is keyed by level and replay count, so moving to
 * another level or replaying starts from a clean slate, like the prototype's loadLevel().
 */
export default function LevelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { unlocked } = useProgress();
  const [round, setRound] = useState(0);
  const index = LEVELS.findIndex((l) => l.id === id);

  if (index < 0 || index > unlocked) {
    return (
      <View style={styles.wrap}>
        <Stack.Screen options={{ title: index < 0 ? 'Not found' : 'Locked' }} />
        <Text style={[styles.hint, { color: c.muted }]}>
          {index < 0 ? 'Level not found.' : 'Win the earlier levels to open this one.'}
        </Text>
      </View>
    );
  }
  return <LevelGame key={`${id}:${round}`} index={index} onReplay={() => setRound((r) => r + 1)} />;
}

// Laid out like the prototype: board, hint, aim controls, tray, then Solve and Launch.
// Each launch runs simulate() once and plays the path back.
function LevelGame({ index, onReplay }: { index: number; onReplay: () => void }) {
  const level = LEVELS[index];
  const last = index === LEVELS.length - 1;
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { unlocked, won } = useProgress();

  const [slots, setSlots] = useState<Slot[]>(() => emptySlots(level));
  const [selected, setSelected] = useState<number | null>(null);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [angle, setAngle] = useState(52);
  const [power, setPower] = useState(45);
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState(false);
  /** The Solve button took the winning shot, which changes the win card's wording. */
  const [solved, setSolved] = useState(false);
  const [winShot, setWinShot] = useState({ angle: 0, power: 0 });
  /** Shown in place of the hint after a shot that needs explaining. */
  const [notice, setNotice] = useState<string | null>(null);
  const { flight, flying, play } = usePlayback();
  const feedback = useFeedback();
  const drag = useRef<Drag | null>(null);

  // The trail and the win only land once playback reaches the end of the path, as in the prototype.
  // Bounces tap and tink as the ball reaches them; the end of the shot chimes or thumps.
  const fire = (placed: PlacedPiece[], a: number, p: number) => {
    const res = simulate(buildWorld(level, placed), a, p);
    setTries((n) => n + 1);
    const finished = () => {
      setTrails((ts) => [...ts, { path: res.path, ok: res.success, end: res.end }].slice(-MAX_TRAILS));
      setNotice(res.end === 'skipped' ? 'In the glass, but it has to bounce off a bar first.' : null);
      if (res.end === 'dead') feedback.died();
      if (res.success) {
        feedback.landed();
        setWinShot({ angle: a, power: p });
        setDone(true);
        won(index);
      }
    };
    play(res.path, finished, res.hits.map((h) => h.i), (k) => feedback.hit(res.hits[k]));
  };

  const goTo = (i: number) => {
    if (!flying) router.setParams({ id: LEVELS[i].id });
  };

  const launch = () => {
    if (flying || done) return;
    setSelected(null);
    fire(boardPieces(slots), angle, power);
  };

  // Places the stored solution's pieces (unused ones go back to the tray), sets angle and power, launches.
  const solve = () => {
    const s = level.solution;
    if (flying || !s) return;
    const next = solutionSlots(level);
    setSlots(next);
    setSelected(null);
    setAngle(s.angle);
    setPower(s.power);
    if (done) {
      setTrails([]);
      setDone(false);
    }
    setSolved(true);
    fire(boardPieces(next), s.angle, s.power);
  };

  const clearTrails = () => {
    if (!flying) setTrails([]);
  };

  const aimTo = (p: { x: number; y: number }) => {
    const a = aimAt(p);
    setAngle(a.angle);
    setPower(a.power);
  };

  // One finger on the board: rotate the selected piece by its end handle, move a piece, or aim from the
  // launcher. Pieces can't be edited mid-flight, and there's no aiming once the level is won.
  const onTouch = (phase: TouchPhase, p: { x: number; y: number }) => {
    if (phase === 'down') {
      drag.current = null;
      if (flying) return;
      const r = pressAt(slots, selected, p, !done);
      drag.current = r.drag;
      setSelected(r.selected);
      if (r.drag?.mode === 'aim') aimTo(p);
    } else if (phase === 'move') {
      const d = drag.current;
      if (!d) return;
      if (d.mode === 'aim') aimTo(p);
      else setSlots((s) => dragTo(s, d, p));
    } else {
      drag.current = null;
    }
  };

  const onChip = (k: number) => {
    if (flying) return;
    const r = tapChip(slots, selected, k);
    setSlots(r.slots);
    setSelected(r.selected);
  };

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 12 }]}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View>
              <Text style={[styles.title, { color: c.ink }]}>{level.name}</Text>
              <Text style={[styles.sub, { color: c.muted }]}>Level {index + 1} of {LEVELS.length}</Text>
            </View>
          ),
          headerRight: () => (
            <View style={styles.nav}>
              <IconButton label="‹" a11y="Previous level" disabled={index === 0} onPress={() => goTo(index - 1)} />
              <IconButton label="›" a11y="Next level" disabled={index >= unlocked} onPress={() => goTo(index + 1)} />
            </View>
          ),
        }}
      />
      <View style={styles.stage}>
        <Board
          level={level}
          pieces={boardPieces(slots)}
          selected={boardIndex(slots, selected)}
          trails={trails}
          angle={angle}
          power={power}
          tries={tries}
          flight={flight}
          done={done}
          onTouch={onTouch}
        />
        {done && !flying && (
          <WinCard
            text={winText({ solved, tries, ...winShot, last })}
            onAgain={onReplay}
            onGo={() => (last ? onReplay() : goTo(index + 1))}
          />
        )}
      </View>
      <Text style={[styles.hint, { color: notice ? c.red : c.muted }]}>{notice ?? level.hint}</Text>
      <View style={styles.controls}>
        <AimControls angle={angle} power={power} onAngle={setAngle} onPower={setPower} />
        <View style={styles.bottom}>
          <View style={styles.tray}>
            <Tray slots={slots} selected={selected} onTap={onChip} disabled={flying} />
          </View>
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

function IconButton({ label, a11y, disabled, onPress }: { label: string; a11y: string; disabled: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      style={[styles.icon, { borderColor: c.line, opacity: disabled ? 0.3 : 1 }]}
    >
      <Text style={[styles.iconText, { color: c.ink }]}>{label}</Text>
    </Pressable>
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
  title: { fontSize: 26, lineHeight: 28, letterSpacing: 0.2, fontFamily: FONTS.condensedBold },
  sub: { fontSize: 13, fontFamily: FONTS.body },
  nav: { flexDirection: 'row', gap: 10 },
  icon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 20, lineHeight: 22, fontFamily: FONTS.bodySemi },
  stage: { flex: 1, paddingHorizontal: 10, paddingTop: 4 },
  hint: { marginHorizontal: 14, marginTop: 6, fontSize: 13, minHeight: 18, fontFamily: FONTS.body },
  controls: { paddingHorizontal: 14, paddingTop: 6, gap: 8 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tray: { flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  busy: { opacity: 0.5 },
  ghost: { height: 38, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1.5, justifyContent: 'center' },
  ghostBig: { height: 46, paddingHorizontal: 20, borderRadius: 23 },
  ghostText: { fontSize: 14, fontFamily: FONTS.bodyMedium },
  ghostTextBig: { fontSize: 15 },
  launch: { flex: 1, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  launchText: { color: '#fff', fontSize: 20, letterSpacing: 0.3, fontFamily: FONTS.condensedBold },
});
