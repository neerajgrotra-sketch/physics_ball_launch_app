import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Board, type TouchPhase, type Trail } from '../../components/board/Board';
import { usePlayback } from '../../components/board/usePlayback';
import { HelpCard } from '../../components/board/HelpCard';
import { NoticeCard } from '../../components/board/NoticeCard';
import { useRewardedAd } from '../../components/ads/RewardedAds';
import { SettingsSheet } from '../../components/settings/SettingsSheet';
import { WinCard } from '../../components/board/WinCard';
import { AimControls, RotateControls } from '../../components/controls/AimControls';
import { Tray } from '../../components/controls/Tray';
import { useSoundSettings } from '../../components/feedback/SoundSettings';
import { useFeedback } from '../../components/feedback/useFeedback';
import { useLevelMusic } from '../../components/feedback/useLevelMusic';
import { useProgress } from '../../components/progress/ProgressProvider';
import { aimAt, swingTo } from '../../game/aim';
import {
  boardIndex, boardNumbers, boardPieces, dragTo, emptySlots, illegalBars, pressAt, removeBar, rotateLegal, rotateToLegal,
  hintSlots, leverEnd, shotSlots, shownAngle, slotsLegal, solutionSlots, tapChip, type Drag, type End, type Slot,
} from '../../game/pieces';
import { skipNotice, winText } from '../../game/progress';
import { bestOf, goalText } from '../../game/score';
import type { Shot } from '../../game/shots';
import { LEVELS } from '../../levels';
import { buildWorld, simulate } from '../../physics';
import { FONTS, useColors } from '../../theme/colors';

const MAX_TRAILS = 4;

/**
 * Resolves the level from the route. The game below is keyed by level and replay count, so moving to
 * another level or replaying starts from a clean slate, like the prototype's loadLevel().
 * `?replay=1` (the Replay button on a won level's card) opens it with the player's saved winning shot set
 * up and plays it once; Start over then goes back to a clean slate.
 */
export default function LevelScreen() {
  const { id, replay } = useLocalSearchParams<{ id: string; replay?: string }>();
  const c = useColors();
  const { unlocked, shots } = useProgress();
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
  const shot = replay === '1' && round === 0 ? shots[id] : undefined;
  return <LevelGame key={`${id}:${round}:${shot ? 'replay' : ''}`} index={index} shot={shot} onReplay={() => setRound((r) => r + 1)} />;
}

// Laid out like the prototype: board, hint, aim controls, tray, then Solve and Launch.
// Each launch runs simulate() once and plays the path back.
function LevelGame({ index, shot, onReplay }: { index: number; shot?: Shot; onReplay: () => void }) {
  const level = LEVELS[index];
  const last = index === LEVELS.length - 1;
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { unlocked, won } = useProgress();

  const [slots, setSlots] = useState<Slot[]>(() => (shot ? shotSlots(level, shot) : emptySlots(level)));
  const [selected, setSelected] = useState<number | null>(null);
  /** Which end of the selected bar has the rotate lever; picked when a bar is selected, moved by tapping the other end. */
  const [lever, setLever] = useState<End>(2);
  const select = (k: number | null, s: Slot[] = slots) => {
    if (k !== selected && k != null && s[k]?.onBoard) setLever(leverEnd(s[k]));
    setSelected(k);
  };
  const [trails, setTrails] = useState<Trail[]>([]);
  const [angle, setAngle] = useState(shot?.angle ?? 52);
  const [power, setPower] = useState(shot?.power ?? 45);
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState(false);
  /** The Solve button took the winning shot, which changes the win card's wording. */
  const [solved, setSolved] = useState(false);
  /** A hint or Solve was used this round: wins earn no stars or score until Start over. */
  const [helped, setHelped] = useState(false);
  /** The Solve button's help card (hint or full solution) is open. */
  const [help, setHelp] = useState(false);
  /** Scored bounces of the shot in flight (ticking up live) or the last shot; null before the first. */
  const [bounces, setBounces] = useState<number | null>(null);
  /** The winning shot exactly as fired (bars, angle, power), so Watch again can replay it. */
  const [winShot, setWinShot] = useState<{ angle: number; power: number; slots: Slot[]; bounces: number }>({ angle: 0, power: 0, slots: [], bounces: 0 });
  const ads = useRewardedAd();
  const par = level.par ?? level.pieces.length;
  /** Shown in place of the hint after a shot that needs explaining. */
  const [notice, setNotice] = useState<string | null>(null);
  const { flight, flying, play, skip } = usePlayback();
  const feedback = useFeedback();
  const { musicOn } = useSoundSettings();
  const [settings, setSettings] = useState(false);
  const music = useLevelMusic(level.id, musicOn, flying); // music dips while the ball flies
  // Browsers only start audio from a tap, so every tap on the level unlocks it (no-op on phones).
  const primeAudio = () => { feedback.prime(); music.prime(); };
  const drag = useRef<Drag | null>(null);
  const lastLegal = useRef<Slot[]>([]);

  // The trail and the win only land once playback reaches the end of the path, as in the prototype.
  // Bounces tap and tink as the ball reaches them; the end of the shot chimes or thumps.
  // `shot` is the bar setup fired: the win keeps it for Watch again, and a near miss uses its bar
  // numbers to say which bar the ball skipped.
  // The bounce counter ticks up as the ball reaches each scored bounce, and shows the full count at the end.
  const fire = (shot: Slot[], a: number, p: number, assisted = helped) => {
    const placed = boardPieces(shot), numbers = boardNumbers(shot);
    const res = simulate(buildWorld(level, placed), a, p);
    const tryNo = tries + 1;
    setTries(tryNo);
    setBounces(0);
    const finished = () => {
      setBounces(res.bounces);
      setTrails((ts) => [...ts, { path: res.path, ok: res.success, end: res.end }].slice(-MAX_TRAILS));
      setNotice(res.end === 'skipped' ? skipNotice(level.pieces.length, numbers, res.touched) : null);
      if (res.end === 'dead') feedback.died();
      if (res.success) {
        feedback.landed();
        setWinShot({ angle: a, power: p, slots: shot, bounces: res.bounces });
        setDone(true);
        if (assisted) won(index);
        else won(index, bestOf({ bounces: res.bounces, par, tries: tryNo }), {
          pieces: placed.map(({ x, y, deg, len }) => ({ x, y, deg, len })), angle: a, power: p,
        });
      }
    };
    feedback.launched();
    play(res.path, finished, res.hits.map((h) => h.i), (k) => {
      feedback.hit(res.hits[k]);
      if (res.hits[k].counts) setBounces((n) => (n ?? 0) + 1);
    });
  };

  // Opened with a saved shot (Replay on the level card): play it once, like Watch again. It isn't a try
  // and isn't scored; the bars and aim are left set up, so the player carries on from there.
  useEffect(() => {
    if (!shot) return;
    const timer = setTimeout(() => {
      const res = simulate(buildWorld(level, shot.pieces), shot.angle, shot.power);
      setBounces(0);
      feedback.launched();
      play(res.path, () => {
        setBounces(res.bounces);
        setTrails([{ path: res.path, ok: res.success, end: res.end }]);
        if (res.success) feedback.landed();
      }, res.hits.map((h) => h.i), (k) => {
        feedback.hit(res.hits[k]);
        if (res.hits[k].counts) setBounces((n) => (n ?? 0) + 1);
      });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (i: number) => {
    if (!flying) router.setParams({ id: LEVELS[i].id });
  };

  // After a win: replay the winning shot exactly (same bars, angle and power; physics is deterministic, so
  // it's the same path). Nothing resets and it isn't a try. Bars moved since the win are put back first.
  const watchAgain = () => {
    if (flying || !done) return;
    primeAudio();
    const { slots: shot, angle: a, power: p } = winShot;
    setSlots(shot);
    setSelected(null);
    setAngle(a);
    setPower(p);
    setNotice(null);
    const res = simulate(buildWorld(level, boardPieces(shot)), a, p);
    feedback.launched();
    play(res.path, () => { if (res.success) feedback.landed(); }, res.hits.map((h) => h.i), (k) => feedback.hit(res.hits[k]));
  };

  const launch = () => {
    if (flying || done) return;
    setNotice(null);
    // Backstop: drags snap back and rotation skips clipping angles, so this shouldn't trigger.
    if (!slotsLegal(level, slots)) {
      setNotice('A bar is touching the glass, the launcher or another bar. Move it first.');
      return;
    }
    primeAudio();
    setSelected(null);
    fire(slots, angle, power);
  };

  // Solve opens the help card: a hint or the full solution, each after a rewarded ad (components/ads).
  const openHelp = () => {
    if (flying || !level.solution) return;
    primeAudio();
    keepPlaying();
    setSelected(null);
    setHelp(true);
  };
  const hint = async () => {
    setHelp(false);
    if (!(await ads.show('hint'))) return;
    const h = hintSlots(level, slots);
    if (!h) return;
    setHelped(true);
    setSlots(h.slots);
    select(h.k, h.slots);
  };
  const fullSolution = async () => {
    setHelp(false);
    if (await ads.show('solve')) solve();
  };

  // Places the stored solution's pieces (unused ones go back to the tray), sets angle and power, launches.
  const solve = () => {
    const s = level.solution;
    if (flying || !s) return;
    primeAudio();
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
    setHelped(true);
    fire(next, s.angle, s.power, true);
  };

  // After a win, any edit (board touch, bar chip, slider, rotation) or the card's ✕ goes back to normal play:
  // the card closes and Launch launches again. Bars, trails and tries stay; the level stays won.
  const keepPlaying = () => {
    setNotice(null); // any edit also closes a near-miss card
    setHelp(false);
    if (!done || flying) return;
    setDone(false);
    setSolved(false);
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
  // launcher. A tap during a flight skips to the end of the shot (the whole path is drawn and the
  // result counts), and does nothing else. There's no aiming once the level is won.
  // A bar dragged somewhere it isn't allowed (game/placement) shows red, and snaps back to the last
  // allowed spot when the finger lifts.
  const onTouch = (phase: TouchPhase, p: { x: number; y: number }) => {
    if (phase === 'down') {
      drag.current = null;
      if (flying) {
        skip();
        return;
      }
      primeAudio();
      keepPlaying();
      const r = pressAt(slots, selected, p, true, { angle, power }, lever);
      drag.current = r.drag;
      lastLegal.current = slots;
      select(r.selected);
      if (r.lever) setLever(r.lever);
      if (r.drag?.mode === 'aim') aimTo(p);
    } else if (phase === 'move') {
      const d = drag.current;
      if (!d) return;
      if (d.mode === 'aim') aimTo(p);
      else if (d.mode === 'swing') {
        const a = swingTo(p, d.grab);
        setAngle(a.angle);
        setPower(a.power);
      }
      else setSlots((s) => {
        const next = dragTo(s, d, p);
        if (slotsLegal(level, next)) lastLegal.current = next;
        return next;
      });
    } else {
      const d = drag.current;
      drag.current = null;
      if (d && (d.mode === 'move' || d.mode === 'rotate')) {
        setSlots((s) => (slotsLegal(level, s) ? s : lastLegal.current));
      }
    }
  };

  // The selected bar (if it's on the board) gets rotation controls in place of the aim rows.
  const selectedBar = selected != null && slots[selected]?.onBoard ? selected : null;
  const rotate = (next: (s: Slot[]) => Slot[]) => {
    if (flying) return;
    keepPlaying();
    setSlots(next);
  };

  const onChip = (k: number) => {
    if (flying) return;
    primeAudio();
    keepPlaying();
    const r = tapChip(slots, selected, k, level);
    setSlots(r.slots);
    select(r.selected, r.slots);
  };

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 8 }]}>
      <Stack.Screen
        options={{
          // ⚙ settings and ••• the level menu on the left (no back arrow: ••• is the way back to the levels,
          // which also works when a level was opened straight from a link), level name in the middle,
          // previous/next level on the right.
          headerBackVisible: false,
          headerTitleAlign: 'center',
          headerLeft: () => (
            <View style={styles.nav}>
              <IconButton label={<Gear />} a11y="Settings" disabled={false} onPress={() => setSettings(true)} />
              <IconButton
                label="•••" a11y="Levels" disabled={false}
                onPress={() => { if (!flying) router.dismissTo('/'); }}
              />
            </View>
          ),
          headerTitle: () => (
            <View style={styles.titleBox}>
              <Text style={[styles.title, { color: c.ink }]} numberOfLines={1} adjustsFontSizeToFit>{level.name}</Text>
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
      <SettingsSheet visible={settings} onClose={() => setSettings(false)} onMusicTap={primeAudio} />
      <View style={styles.stage}>
        <Board
          level={level}
          pieces={boardPieces(slots)}
          numbers={boardNumbers(slots)}
          illegal={illegalBars(level, slots)}
          selected={boardIndex(slots, selected)}
          lever={lever}
          trails={trails}
          angle={angle}
          power={power}
          tries={tries}
          flight={flight}
          done={done}
          onTouch={onTouch}
        />
        {notice && !done && !flying && (
          <NoticeCard title="So close!" message={notice} onClose={() => setNotice(null)} />
        )}
        {bounces != null && !done && (
          <View style={[styles.counter, { backgroundColor: c.paper, borderColor: c.line }]} pointerEvents="none">
            <Text style={[styles.counterNum, { color: bounces > par ? c.red : c.ink }]}>{bounces}</Text>
            <Text style={[styles.counterLabel, { color: c.muted }]}>{bounces === 1 ? 'bounce' : 'bounces'}{'\n'}par {par}</Text>
          </View>
        )}
        {help && !flying && (
          <HelpCard
            hintBar={(() => { const h = hintSlots(level, slots); return h ? h.k + 1 : null; })()}
            onHint={hint} onSolve={fullSolution} onClose={() => setHelp(false)}
          />
        )}
        {done && !flying && (
          <WinCard
            text={winText({ assisted: solved ? 'solve' : helped ? 'hint' : null, tries, bounces: winShot.bounces, par, last })}
            onAgain={onReplay}
            onClose={keepPlaying}
            onGo={() => (last ? onReplay() : goTo(index + 1))}
          />
        )}
      </View>
      <Text style={[styles.goal, { color: c.ink }]} numberOfLines={2}>{goalText(level.pieces.length, level.par)}</Text>
      <View style={styles.controls}>
        {selectedBar != null ? (
          <RotateControls
            bar={selectedBar + 1}
            angle={shownAngle(slots[selectedBar].deg)}
            onAngle={(a) => rotate((s) => rotateToLegal(level, s, selectedBar, a))}
            onNudge={(by) => rotate((s) => rotateLegal(level, s, selectedBar, by))}
            onDone={() => setSelected(null)}
            onRemove={() => { if (!flying) { const r = removeBar(slots, selectedBar); setSlots(r.slots); setSelected(r.selected); } }}
            disabled={flying}
          />
        ) : (
          <AimControls
            angle={angle} power={power}
            onAngle={(v) => { keepPlaying(); setAngle(v); }}
            onPower={(v) => { keepPlaying(); setPower(v); }}
          />
        )}
        <View style={styles.bottom}>
          <View style={styles.tray}>
            <Tray slots={slots} selected={selected} onTap={onChip} disabled={flying} />
          </View>
          <Ghost label="Clear" onPress={clearTrails} />
        </View>
        <View style={styles.actions}>
          <View style={flying && styles.busy} pointerEvents={flying ? 'none' : 'auto'}>
            <Ghost label="Solve" onPress={openHelp} big />
          </View>
          {/* Launch; during a flight, Skip (jump to the end of the shot); after a win, Watch again. */}
          <Pressable
            onPress={flying ? skip : done ? watchAgain : launch}
            accessibilityRole="button"
            style={[styles.launch, { backgroundColor: c.red }]}
          >
            <Text style={styles.launchText}>{flying ? 'Skip ›' : done ? 'Watch again ▶︎' : 'Launch'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Round header button. `dim` shows a setting that's off (still pressable), `disabled` one that isn't available. */
function IconButton({ label, a11y, disabled, dim, onPress }: { label: string | ReactElement; a11y: string; disabled: boolean; dim?: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      style={[styles.icon, { borderColor: c.line, opacity: disabled ? 0.3 : dim ? 0.45 : 1 }]}
    >
      {typeof label === 'string' ? <Text style={[styles.iconText, { color: c.ink }]}>{label}</Text> : label}
    </Pressable>
  );
}

/** A settings gear drawn from views (the ⚙ character shows as a colour emoji on phones). */
function Gear() {
  const c = useColors();
  return (
    <View style={styles.gear}>
      {[0, 45, 90, 135].map((deg) => (
        <View key={deg} style={[styles.tooth, { backgroundColor: c.ink, transform: [{ rotate: `${deg}deg` }] }]} />
      ))}
      <View style={[styles.gearBody, { backgroundColor: c.ink }]} />
      <View style={[styles.gearHole, { backgroundColor: c.panel }]} />
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
  titleBox: { alignItems: 'center', maxWidth: 190 },
  title: { fontSize: 24, lineHeight: 26, letterSpacing: 0.2, fontFamily: FONTS.condensedBold },
  sub: { fontSize: 13, fontFamily: FONTS.body },
  nav: { flexDirection: 'row', gap: 8 },
  icon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  gear: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  tooth: { position: 'absolute', width: 5, height: 20, borderRadius: 1.5 },
  gearBody: { position: 'absolute', width: 15, height: 15, borderRadius: 7.5 },
  gearHole: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  iconText: { fontSize: 20, lineHeight: 22, fontFamily: FONTS.bodySemi },
  // Compact controls so the board gets as much of a phone screen as possible.
  stage: { flex: 1, paddingHorizontal: 6, paddingTop: 2 },
  hint: { marginHorizontal: 12, marginTop: 4, fontSize: 12, lineHeight: 16, fontFamily: FONTS.body },
  goal: { marginHorizontal: 12, marginTop: 6, fontSize: 16, lineHeight: 20, fontFamily: FONTS.bodySemi, textAlign: 'center' },
  counter: {
    position: 'absolute', top: 10, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5,
  },
  counterNum: { fontSize: 30, lineHeight: 32, fontFamily: FONTS.condensedBold, fontVariant: ['tabular-nums'] },
  counterLabel: { fontSize: 11, lineHeight: 13, fontFamily: FONTS.bodyMedium },
  controls: { paddingHorizontal: 12, paddingTop: 4, gap: 6 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tray: { flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  busy: { opacity: 0.5 },
  ghost: { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1.5, justifyContent: 'center' },
  ghostBig: { height: 44, paddingHorizontal: 20, borderRadius: 22 },
  ghostText: { fontSize: 14, fontFamily: FONTS.bodyMedium },
  ghostTextBig: { fontSize: 15 },
  launch: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  launchText: { color: '#fff', fontSize: 20, letterSpacing: 0.3, fontFamily: FONTS.condensedBold },
});
