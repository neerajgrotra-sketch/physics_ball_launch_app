import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Board, type TouchPhase, type Trail } from '../../components/board/Board';
import { usePlayback } from '../../components/board/usePlayback';
import { HelpCard } from '../../components/board/HelpCard';
import { NoticeCard } from '../../components/board/NoticeCard';
import { useRewardedAd } from '../../components/ads/RewardedAds';
import { SettingsSheet } from '../../components/settings/SettingsSheet';
import { GhostFinger, type Demo } from '../../components/coach/GhostFinger';
import { useTips } from '../../components/coach/Tips';
import {
  IDLE_MS, TUTORIAL_ID, TUTORIAL_IDLE_MS, coachText, firstBarStep, stepKey, tutorialPlan, tutorialText, type CoachStep,
} from '../../game/coach';
import { LEVER, leverLine, leverTipInside } from '../../game/pieces';
import { aimDemo, ghostFor, snapAim, snapBar, tutorialState } from '../../game/tutorial';
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
import { WORLD, buildWorld, simulate } from '../../physics';
import { FONTS, useColors } from '../../theme/colors';

const MAX_TRAILS = 4;
type ViewRef = ComponentRef<typeof View>;

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
  // Start over / Try it yourself on the tutorial level gives the plain level; opening it again (from its card,
  // or "Replay the tutorial") gives the guide.
  const [unguided, setUnguided] = useState(false);
  useEffect(() => setUnguided(false), [id]);
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
  return (
    <LevelGame
      key={`${id}:${round}:${shot ? 'replay' : ''}`} index={index} shot={shot} guide={!unguided}
      onReplay={(guide) => { setUnguided(guide !== true); setRound((r) => r + 1); }}
    />
  );
}

// Laid out like the prototype: board, hint, aim controls, tray, then Solve and Launch.
// Each launch runs simulate() once and plays the path back.
function LevelGame({ index, shot, guide, onReplay }: { index: number; shot?: Shot; guide: boolean; onReplay: (guide?: boolean) => void }) {
  const level = LEVELS[index];
  const last = index === LEVELS.length - 1;
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { unlocked, best, won } = useProgress();
  const tips = useTips();
  /**
   * The guided tutorial: whenever the tutorial level is opened (the first time automatically, and again
   * from its card or "Replay the tutorial"), unless tips are off or it's opened to replay a saved shot.
   */
  const [tutorial, setTutorial] = useState(() => level.id === TUTORIAL_ID && tips.tipsOn && guide && !shot);
  /** The last win was the guided one (no stars or score), for the win card's wording. */
  const [guided, setGuided] = useState(false);

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

  // The ghost finger (game/coach.ts). In the tutorial it leads the player through the level's stored solution,
  // step by step, after a short pause on each; elsewhere it only shows the first bar to place, after a longer
  // idle. Any touch hides it and restarts the clock; it can be stopped for good (the caption's button,
  // or Tips in settings).
  const [coach, setCoach] = useState<{ demos: Demo[]; text: string; key: string } | null>(null);
  const [idleKey, setIdleKey] = useState(0);
  const touching = useRef(false); // a finger is down on the board
  const angleTrackRef = useRef<ViewRef>(null), powerTrackRef = useRef<ViewRef>(null);
  const rootRef = useRef<ViewRef>(null), trayRef = useRef<ViewRef>(null), stageRef = useRef<ViewRef>(null), launchRef = useRef<ViewRef>(null);
  const chips = useRef<LayoutRectangle[]>([]);
  const latest = useRef({ slots, selected, lever, angle, power });
  latest.current = { slots, selected, lever, angle, power };
  // (The idle clock restarts at most every 300 ms: a slider drag calls this for every step, and each one redraws the level.)
  const lastPoke = useRef(0);
  const poke = () => {
    setCoach(null);
    const now = Date.now();
    if (now - lastPoke.current > 300) { lastPoke.current = now; setIdleKey((k) => k + 1); }
  };
  const lastLegal = useRef<Slot[]>([]);

  // The trail and the win only land once playback reaches the end of the path, as in the prototype.
  // Bounces tap and tink as the ball reaches them; the end of the shot chimes or thumps.
  // `shot` is the bar setup fired: the win keeps it for Watch again, and a near miss uses its bar
  // numbers to say which bar the ball skipped.
  // The bounce counter ticks up as the ball reaches each scored bounce, and shows the full count at the end.
  // The tutorial level never scores (it's practice, and its answer is handed to you), however it's played.
  const practice = level.id === TUTORIAL_ID;
  const fire = (shot: Slot[], a: number, p: number, assisted = helped || practice) => {
    const placed = boardPieces(shot), numbers = boardNumbers(shot);
    setGuided(tutorial);
    const res = simulate(buildWorld(level, placed), a, p);
    const tryNo = tries + 1;
    setTries(tryNo);
    setBounces(0);
    const finished = () => {
      setBounces(res.bounces);
      setTrails((ts) => [...ts, { path: res.path, ok: res.success, end: res.end }].slice(-MAX_TRAILS));
      // A destroyed ball needs no card: the board shows the burst and the sound plays.
      setNotice(res.end === 'skipped' ? skipNotice(level.pieces.length, numbers, res.touched) : null);
      if (res.end === 'dead') feedback.died();
      if (res.success) {
        feedback.landed();
        setWinShot({ angle: a, power: p, slots: shot, bounces: res.bounces });
        setDone(true);
        if (tutorial) { tips.finishTutorial(); setTutorial(false); }
        // The winning shot is kept for the level card's drawing and Replay, but only unassisted wins (and the
        // tutorial's guided one, which has no score) save it.
        const saved = { pieces: placed.map(({ x, y, deg, len }) => ({ x, y, deg, len })), angle: a, power: p };
        if (practice) won(index, undefined, saved);
        else if (assisted) won(index);
        else won(index, bestOf({ bounces: res.bounces, par, tries: tryNo }), saved);
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

  // The step the player is on right now. A hint is only ever shown for this step: if what's on screen is for
  // another (the player got past it some other way, e.g. with a slider instead of the dotted line), it goes.
  const currentKey = tutorial
    ? stepKey(tutorialPlan(tutorialState(level, slots, selected, angle, power)).step)
    : stepKey(firstBarStep(slots.map((x) => x.onBoard)));
  useEffect(() => {
    if (coach && coach.key !== currentKey) setCoach(null);
  }, [coach, currentKey]);

  useEffect(() => {
    if (flying || done || help || notice || settings || !tips.tipsOn) return;
    if (!tutorial && best[level.id]) return; // the first-bar hint is for levels not yet won
    const timer = setTimeout(async () => {
      if (touching.current) return;
      const L = latest.current;
      let step: CoachStep | null, text: string;
      if (tutorial) {
        const plan = tutorialPlan(tutorialState(level, L.slots, L.selected, L.angle, L.power));
        step = plan.step;
        text = tutorialText(plan, level.solution);
      } else {
        step = firstBarStep(L.slots.map((x) => x.onBoard));
        text = step ? coachText(step) : '';
      }
      const root = rootRef.current;
      if (!step || !root) return;
      const st = step, key = stepKey(st);
      // Where a view is on screen, relative to the level's root view.
      const measure = (ref: ViewRef | null) => new Promise<{ x: number; y: number; w: number; h: number } | null>((res) => {
        if (!ref || !root) { res(null); return; }
        root.measureInWindow((rx, ry) => ref.measureInWindow((x, y, w, h) => res({ x: x - rx, y: y - ry, w, h })));
      });
      const show = (demos: Demo[]) => setCoach({ demos, text, key });

      if (st.kind === 'place') {
        const chip = chips.current[st.bar], tray = await measure(trayRef.current);
        if (chip && tray) show([{ x: tray.x + chip.x + chip.width / 2, y: tray.y + chip.y + chip.height / 2, mode: 'tap' }]);
        return;
      }
      if (st.kind === 'launch') {
        const m = await measure(launchRef.current);
        if (m) show([{ x: m.x + m.w / 2, y: m.y + m.h / 2, mode: 'tap' }]);
        return;
      }
      const stage = await measure(stageRef.current);
      if (!stage) return;
      // The board is drawn centred in the stage (inside its padding), scaled to fit.
      const iw = stage.w - 12, ih = stage.h - 2, k = Math.min(iw / WORLD.width, ih / WORLD.height);
      const left = stage.x + 6 + (iw - WORLD.width * k) / 2, top = stage.y + 2 + (ih - WORLD.height * k) / 2;
      const px = (wx: number) => left + wx * k, py = (wy: number) => top + wy * k;
      // A slider's thumb centre runs 12 in from each end of its track.
      const sliderDemo = async (ref: ViewRef | null, now: number, target: number, max: number): Promise<Demo | null> => {
        const m = await measure(ref);
        if (!m) return null;
        const at = (v: number) => m.x + 12 + (v / max) * (m.w - 24);
        return { x: at(now), y: m.y + m.h / 2, dx: at(target) - at(now), dy: 0, mode: 'drag' };
      };
      const lineDemo = (which: 'angle' | 'power'): Demo => {
        const d = aimDemo(level, L.angle, L.power, which);
        return { x: px(d.from.x), y: py(d.from.y), dx: d.dx * k, dy: d.dy * k, mode: 'drag' };
      };
      const sol = level.solution;
      if (st.kind === 'angle' || st.kind === 'power') {
        // Two ways to do it, shown in turn: drag the dotted line, or slide the slider.
        const slide = st.kind === 'angle'
          ? await sliderDemo(angleTrackRef.current, L.angle, sol?.angle ?? L.angle, 90)
          : await sliderDemo(powerTrackRef.current, L.power, sol?.power ?? L.power, 100);
        show(st.kind === 'angle' ? [lineDemo('angle'), ...(slide ? [slide] : [])] : [...(slide ? [slide] : []), lineDemo('power')]);
        return;
      }
      const bar = L.slots[st.bar], g = ghostFor(level, st.bar);
      if (st.kind === 'select') {
        show([{ x: px(bar.x), y: py(bar.y), mode: 'tap' }]);
      } else if (st.kind === 'move') {
        show([{ x: px(bar.x), y: py(bar.y), dx: g ? (g.x - bar.x) * k : 70, dy: g ? (g.y - bar.y) * k : -50, mode: 'drag' }]);
      } else {
        // twist: from the lever's tip to where it will be once the bar is turned to its outline.
        const [, , tx, ty] = leverLine(bar, L.lever);
        const sgn = L.lever === 2 ? 1 : -1, reach = bar.len / 2 + LEVER;
        const ga = ((g ? g.deg : bar.deg) * Math.PI) / 180;
        const gx = bar.x + sgn * Math.cos(ga) * reach, gy = bar.y + sgn * Math.sin(ga) * reach;
        show([{ x: px(tx), y: py(ty), dx: (gx - tx) * k, dy: (gy - ty) * k, mode: 'drag' }]);
      }
    }, tutorial ? TUTORIAL_IDLE_MS : IDLE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idleKey, flying, done, help, notice, settings, tutorial, tips.tipsOn, currentKey]);

  const replayTutorial = () => {
    tips.restartTutorial();
    setSettings(false);
    if (level.id === TUTORIAL_ID) onReplay(true);
    else router.setParams({ id: TUTORIAL_ID });
  };

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
    poke();
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
    // The tutorial level is practice: Solve just solves it, with no ad and no hint-or-solution card.
    if (practice) { solve(); return; }
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
    poke();
    setNotice(null); // any edit also closes a near-miss card
    setHelp(false);
    if (!done || flying) return;
    setDone(false);
    setSolved(false);
  };

  const clearTrails = () => {
    if (!flying) setTrails([]);
  };

  const setAim = (a: number, p: number) => {
    setAngle(a);
    setPower(p);
  };
  // In the tutorial the aim snaps onto the answer when it's let go close to it (not while dragging: a slider
  // that has its value changed under the finger runs away).
  const snapDone = (which: 'angle' | 'power', v: number) => {
    if (!tutorial) return;
    const t = snapAim(level, which === 'angle' ? v : angle, which === 'power' ? v : power);
    if (which === 'angle') setAngle(t.angle); else setPower(t.power);
  };
  const aimTo = (p: { x: number; y: number }) => {
    const a = aimAt(p);
    setAim(a.angle, a.power);
  };

  // One finger on the board: rotate the selected piece by its end handle, move a piece, or aim from the
  // launcher. A tap during a flight skips to the end of the shot (the whole path is drawn and the
  // result counts), and does nothing else. There's no aiming once the level is won.
  // A bar dragged somewhere it isn't allowed (game/placement) shows red, and snaps back to the last
  // allowed spot when the finger lifts.
  const onTouch = (phase: TouchPhase, p: { x: number; y: number }) => {
    touching.current = phase !== 'up';
    if (phase === 'up') poke();
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
        setAim(a.angle, a.power);
      }
      else setSlots((s) => {
        const next = dragTo(s, d, p);
        if (slotsLegal(level, next)) lastLegal.current = next;
        return next;
      });
    } else {
      const d = drag.current;
      drag.current = null;
      if (tutorial && (d?.mode === 'aim' || d?.mode === 'swing')) {
        const t = snapAim(level, angle, power);
        setAim(t.angle, t.power);
      }
      if (d && (d.mode === 'move' || d.mode === 'rotate')) {
        // In the tutorial a bar dropped (or turned) close to its outline snaps onto it, if that's allowed.
        const snapped = tutorial ? snapBar(level, slots, d.k, d.mode === 'move' ? 'pos' : 'deg') : slots;
        const final = slotsLegal(level, snapped) ? snapped : slotsLegal(level, slots) ? slots : lastLegal.current;
        setSlots(final);
        // If the move left the lever's tip hanging off the board, put the lever on the bar's other end.
        const bar = final[d.k];
        if (bar?.onBoard && !leverTipInside(bar, lever)) setLever(leverEnd(bar));
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

  // The tutorial's dashed outline: where the bar being lined up belongs.
  const plan = tutorial ? tutorialPlan(tutorialState(level, slots, selected, angle, power)) : null;
  const ghosts = plan && (plan.step.kind === 'move' || plan.step.kind === 'select' || plan.step.kind === 'twist')
    ? [ghostFor(level, plan.step.bar)].filter((g): g is NonNullable<typeof g> => g != null)
    : [];

  // Once the bars are lined up the tutorial moves on to aiming, whose sliders only show with no bar selected.
  const planKind = plan?.step.kind;
  useEffect(() => {
    if ((planKind === 'angle' || planKind === 'power' || planKind === 'launch') && selected != null) setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKind]);

  return (
    <View ref={rootRef} style={styles.wrap}>
    {/* Any touch anywhere on the level hides the coach and restarts its idle clock (without taking the touch). */}
    <View
      style={[styles.wrap, { paddingBottom: insets.bottom + 8 }]}
      // (Deferred: changing the screen in the middle of a touch's negotiation confuses the sliders' drags.)
      onStartShouldSetResponderCapture={() => { if (coach) setTimeout(poke, 0); return false; }}
    >
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
      <SettingsSheet visible={settings} onClose={() => setSettings(false)} onMusicTap={primeAudio} onReplayTutorial={replayTutorial} />
      <View ref={stageRef} style={styles.stage}>
        <Board
          level={level}
          pieces={boardPieces(slots)}
          numbers={boardNumbers(slots)}
          illegal={illegalBars(level, slots)}
          selected={boardIndex(slots, selected)}
          lever={lever}
          ghosts={ghosts}
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
            text={winText({ assisted: solved ? 'solve' : helped ? 'hint' : guided || practice ? 'tutorial' : null, tries, bounces: winShot.bounces, par, last })}
            onAgain={() => onReplay(false)}
            onClose={keepPlaying}
            onGo={() => (last ? onReplay(false) : goTo(index + 1))}
          />
        )}
      </View>
      <Text style={[styles.goal, { color: c.ink }]} numberOfLines={2}>{goalText(level.pieces.length, level.par)}</Text>
      <View style={styles.controls}>
        {selectedBar != null ? (
          <RotateControls
            bar={selectedBar + 1}
            angle={shownAngle(slots[selectedBar].deg)}
            onAngle={(a) => {
              // false when the bar can't turn that far (it would clip something): the slider pulls back and shakes.
              const ok = rotateToLegal(level, slots, selectedBar, a) !== slots;
              rotate((s) => rotateToLegal(level, s, selectedBar, a));
              return ok;
            }}
            onNudge={(by) => rotate((s) => rotateLegal(level, s, selectedBar, by))}
            onDone={() => setSelected(null)}
            onRemove={() => { if (!flying) { const r = removeBar(slots, selectedBar); setSlots(r.slots); setSelected(r.selected); } }}
            disabled={flying}
          />
        ) : (
          // Touching the angle or power controls while a shot is playing skips it, like a tap on the board.
          <View onStartShouldSetResponderCapture={() => { if (flying) skip(); return false; }}>
          <AimControls
            angle={angle} power={power}
            onAngle={(v) => { if (flying) skip(); keepPlaying(); setAngle(v); }}
            onPower={(v) => { if (flying) skip(); keepPlaying(); setPower(v); }}
            onAngleDone={(v) => snapDone('angle', v)}
            onPowerDone={(v) => snapDone('power', v)}
            angleTrackRef={angleTrackRef}
            powerTrackRef={powerTrackRef}
          />
          </View>
        )}
        <View style={styles.bottom}>
          <View ref={trayRef} style={styles.tray}>
            <Tray slots={slots} selected={selected} onTap={onChip} disabled={flying} onChipLayout={(k, l) => { chips.current[k] = l; }} />
          </View>
          <Ghost label="Clear" onPress={clearTrails} />
        </View>
        <View style={styles.actions}>
          <View style={flying && styles.busy} pointerEvents={flying ? 'none' : 'auto'}>
            <Ghost label="Solve" onPress={openHelp} big />
          </View>
          {/* Launch; during a flight, Skip (jump to the end of the shot); after a win, Watch again. */}
          <Pressable
            ref={launchRef}
            onPress={flying ? skip : done ? watchAgain : launch}
            accessibilityRole="button"
            style={[styles.launch, { backgroundColor: c.red }]}
          >
            <Text style={styles.launchText}>{flying ? 'Skip ›' : done ? 'Watch again ▶︎' : 'Launch'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
      {coach && coach.key === currentKey && !flying && !done && !help && (
        <GhostFinger
          demos={coach.demos} text={coach.text}
          stopLabel={tutorial ? 'Skip tutorial' : 'Stop tips'}
          onStop={() => {
            if (tutorial) { tips.finishTutorial(); setTutorial(false); } else tips.setTipsOn(false);
            setCoach(null);
          }}
        />
      )}
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
