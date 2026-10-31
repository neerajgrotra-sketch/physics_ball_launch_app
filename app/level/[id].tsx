import { useIsFocused, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef, type ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Board, type TouchPhase, type Trail } from '../../components/board/Board';
import { usePlayback } from '../../components/board/usePlayback';
import { HelpCard } from '../../components/board/HelpCard';
import { FadeToast } from '../../components/board/FadeToast';
import { aimHintNotice, solvedNudge, hintLabel, nextHint, stepsLeft } from '../../game/help';
import { STAR_REWARD, WORLD_REWARD, solutionCost } from '../../game/wallet';
import { WORLDS } from '../../game/worlds';
import { NoticeCard } from '../../components/board/NoticeCard';
import { useHintWallet } from '../../components/hints/HintWallet';
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
import { useProgress, useUnlocked } from '../../components/progress/ProgressProvider';
import { worthKeeping, type Draft, type DraftShot } from '../../game/drafts';
import { aimBy, swingTo } from '../../game/aim';
import {
  boardIndex, boardNumbers, boardPieces, dragTo, emptySlots, illegalBars, pressAt, removeBar, rotateLegal, rotateToLegal,
  OPEN_DRAG, TRASH_GRAB, trashObstacles, atSolution, hintSlots, leverEnd, shotPieces, shotSlots, shownAngle, slotsLegal, solutionSlots, tapChip, type Drag, type End, type Slot,
} from '../../game/pieces';
import { CARD_PAUSE_MS, CELEBRATION_MS, burstFor, cardPlace } from '../../game/celebration';
import { counterSpot } from '../../game/counter';
import { emptyHistory, record, undo as undoHistory, type History } from '../../game/history';
import { skipNotice, winText } from '../../game/progress';
import { AFTER_SOLUTION, afterHint, bestOf, cappedBounces, goalEvery, goalText, helpNote, starsFor } from '../../game/score';
import { SITE_URL, challengeGoal, challengeMessage, challengeUrl, challengeWinText, senderName, type ChallengeShot } from '../../game/challenge';
import { PROFILE_KEY, parseProfile } from '../../game/profile';
import { bounceMarks, type Mark } from '../../game/marks';
import { useBallSkin } from '../../components/settings/BallSkin';
import type { Shot } from '../../game/shots';
import { LEVELS } from '../../levels';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { WORLD, buildWorld, glassBox, simulate, type Hit, type Level, type Vec } from '../../physics';
import type { DailyResult } from '../../game/daily';
import { shareCard, shareMessage } from '../../game/share';
import type { ShareCard } from '../../components/board/shareCard';
import { shareText } from '../../components/share';
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
  const { shots } = useProgress();
  const unlocked = useUnlocked();
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
      key={`${id}:${round}:${shot ? 'replay' : ''}`} level={LEVELS[index]} index={index} shot={shot} guide={!unguided}
      onReplay={(guide) => { setUnguided(guide !== true); setRound((r) => r + 1); }}
    />
  );
}

/**
 * The daily puzzle (app/daily.tsx) plays in the same game: no level list position, progress or level rewards; a win is recorded
 * for its day instead (components/daily), and the win card's right button shares the result.
 */
export interface DailyMode { number: number; tier: string; onWin: (result: DailyResult) => void; onShare: (picture: ((card: ShareCard) => string | null) | null) => void }

/**
 * A friend's challenge (app/challenge.tsx, from a "Challenge a friend" link): one level to beat the sender's bounces in, outside the
 * player's own progress (no locks, no level result, no rewards, like the daily). `shot` is the sender's winning shot, to watch.
 */
export interface ChallengeMode {
  from: string; bounces: number; shot: ChallengeShot;
  /** Where the win card points next: the app (on the web) or the rest of the game (in the app). */
  next: { label: string; go: () => void };
}

/** The bars on the board and the aim, as a string: what a shot's bounce markers belong to. */
const setupKey = (pieces: { x: number; y: number; deg: number }[], angle: number, power: number) =>
  `${pieces.map((p) => `${p.x},${p.y},${p.deg}`).join(';')}|${angle.toFixed(1)}|${power.toFixed(1)}`;

/** Where a challenge link points: this site on the web (so a preview links to itself), the public site from the app. */
const siteUrl = () => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : SITE_URL);

// Laid out like the prototype: board, hint, aim controls, tray, then Solve and Launch.
// Each launch runs simulate() once and plays the path back.
export function LevelGame({ level, index, daily, challenge, shot, guide, onReplay }: {
  level: Level; index: number; daily?: DailyMode; challenge?: ChallengeMode; shot?: Shot; guide: boolean; onReplay: (guide?: boolean) => void;
}) {
  const last = index === LEVELS.length - 1;
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { best, shots, won, draftFor, saveDraft, help: helpRecord, markHelp } = useProgress();
  const unlocked = useUnlocked();
  const tips = useTips();
  /**
   * The guided tutorial: whenever the tutorial level is opened (the first time automatically, and again
   * from its card or "Replay the tutorial"), unless tips are off or it's opened to replay a saved shot.
   */
  const [tutorial, setTutorial] = useState(() => level.id === TUTORIAL_ID && tips.tipsOn && guide && !shot);
  /** The last win was the guided one (no stars or score), for the win card's wording. */
  const [guided, setGuided] = useState(false);

  // A level left part-way is picked up where it was (game/drafts.ts): bars, aim, tries, and the trails of its last launches,
  // re-simulated. Not the tutorial (its guide starts from the empty board) or a replayed saved shot.
  const draftKey = daily ? `daily-${daily.number}` : challenge ? `challenge-${level.id}` : level.id;
  // A level won before drafts existed (0.44.0) has none: it opens on its saved winning shot instead.
  const [draft] = useState<Draft | undefined>(() => {
    if (shot || level.id === TUTORIAL_ID) return undefined;
    const saved = draftFor(draftKey), won = daily || challenge ? undefined : shots[level.id];
    if (saved || !won) return saved;
    const placed = shotSlots(level, won);
    return {
      bars: placed.map((sl) => (sl.onBoard ? { x: sl.x, y: sl.y, deg: sl.deg } : null)), angle: won.angle, power: won.power, tries: 0, helped: false,
      launches: [{ pieces: shotPieces(level, won), angle: won.angle, power: won.power }],
    };
  });
  /** The bars and aim behind each trail on the board, so the draft can save them (looked up by the trail's path). */
  const trailShots = useRef(new WeakMap<Vec[], DraftShot>());
  const [slots, setSlots] = useState<Slot[]>(() => {
    if (shot) return shotSlots(level, shot);
    const fresh = emptySlots(level);
    return draft ? fresh.map((sl, k) => (draft.bars[k] ? { ...sl, ...draft.bars[k]!, onBoard: true } : sl)) : fresh;
  });
  const [selected, setSelected] = useState<number | null>(null);
  /** Which end of the selected bar has the rotate lever; picked when a bar is selected, moved by tapping the other end. */
  const [lever, setLever] = useState<End>(2);
  const select = (k: number | null, s: Slot[] = slots) => {
    if (k !== selected && k != null && s[k]?.onBoard) setLever(leverEnd(s[k]));
    setSelected(k);
  };
  /** The last shot's bounce markers and how many have appeared so far; drawn when "Show bounce numbers" is on (Settings). */
  const [marks, setMarks] = useState<Mark[]>([]);
  const [shownMarks, setShownMarks] = useState(0);
  // The markers belong to the bars and aim that fired the shot: moving a bar or the aim hides them (they no longer describe the
  // board), and Undo back to that exact setup shows them again.
  const [marksFor, setMarksFor] = useState('');
  const { bounceMarks: showMarks } = useBallSkin();
  const [trails, setTrails] = useState<Trail[]>(() => (draft?.launches ?? []).map((l) => {
    const res = simulate(buildWorld(level, l.pieces), l.angle, l.power);
    trailShots.current.set(res.path, l);
    return { path: res.path, ok: res.success, end: res.end, jumps: res.jumps };
  }));
  const [angle, setAngle] = useState(shot?.angle ?? draft?.angle ?? 52);
  const [power, setPower] = useState(shot?.power ?? draft?.power ?? 45);
  // Undo: every change to the bars or the aim is remembered (a drag or held slider counts as one step), see game/history.
  const history = useRef<History<{ slots: Slot[]; angle: number; power: number }>>(emptyHistory());
  const lastSetup = useRef({ slots, angle, power });
  const undoing = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  useEffect(() => {
    const was = lastSetup.current;
    if (slots === was.slots && angle === was.angle && power === was.power) return;
    if (!undoing.current) {
      history.current = record(history.current, was, Date.now());
      setCanUndo(history.current.past.length > 0);
    }
    undoing.current = false;
    lastSetup.current = { slots, angle, power };
  }, [slots, angle, power]);
  const [tries, setTries] = useState(draft?.tries ?? 0);
  const [done, setDone] = useState(false);
  /** The Solve button took the winning shot, which changes the win card's wording. */
  const [solved, setSolved] = useState(false);
  /** A hint or Solve was used this round: wins earn no stars or score until Start over. */
  const [helped, setHelped] = useState(draft?.helped ?? false);
  /** Bumped when Solve is tapped with the answer already on the board: the button shakes and solvedNudge's line fades in over the board. */
  const [solvedTaps, setSolvedTaps] = useState(0);
  /** The Solve button's help card (hint or full solution) is open. */
  const [help, setHelp] = useState(false);
  /** Scored bounces of the shot in flight (ticking up live) or the last shot; null before the first. */
  const [bounces, setBounces] = useState<number | null>(null);
  /** The winning shot exactly as fired (bars, angle, power), so Replay can play it again. */
  const [winShot, setWinShot] = useState<{ angle: number; power: number; slots: Slot[]; bounces: number }>({ angle: 0, power: 0, slots: [], bounces: 0 });
  // Save the level as it stands whenever it changes, so leaving and coming back resumes it, won or not (a won level reopens on
  // its winning board, ready to try for fewer bounces). Only Start over drops it. The tutorial is never saved.
  useEffect(() => {
    if (level.id === TUTORIAL_ID) return;
    const d: Draft = {
      bars: slots.map((sl) => (sl.onBoard ? { x: sl.x, y: sl.y, deg: sl.deg } : null)),
      angle, power, tries, helped,
      launches: trails.map((t) => trailShots.current.get(t.path)).filter((l): l is DraftShot => !!l),
    };
    // A won level keeps even an empty draft, or it would reopen on its winning shot after Start over.
    saveDraft(draftKey, worthKeeping(d, { angle: 52, power: 45 }) || (!daily && !challenge && shots[level.id]) ? d : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, angle, power, tries, helped, trails]);
  const startOver = (guide?: boolean) => {
    saveDraft(draftKey, !daily && !challenge && shots[level.id] ? { bars: level.pieces.map(() => null), angle: 52, power: 45, tries: 0, helped: false, launches: [] } : null);
    onReplay(guide);
  };
  const wallet = useHintWallet();
  const par = level.par ?? level.pieces.length;
  /** Shown in place of the hint after a shot that needs explaining. */
  const [notice, setNotice] = useState<string | { title: string; text: string } | null>(null);
  const { flight, flying, play, skip } = usePlayback();
  const feedback = useFeedback();
  const { musicOn } = useSoundSettings();
  const [settings, setSettings] = useState(false);
  // Only the screen on top plays music: a level left underneath another (the tour opening the tutorial over a level, say) stops its
  // track, so two never play at once, and picks it up again when it is back on top.
  const focused = useIsFocused();
  const music = useLevelMusic(level.id, musicOn && focused, flying); // music dips while the ball flies
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
  // `shot` is the bar setup fired: the win keeps it for Replay, and a near miss uses its bar
  // numbers to say which bar the ball skipped.
  // The bounce counter ticks up as the ball reaches each scored bounce, and shows the full count at the end.
  // The tutorial level never scores (it's practice, and its answer is handed to you), however it's played.
  const practice = level.id === TUTORIAL_ID;
  // Help used on this level, kept for good (game/score.ts): a win still scores, capped at ★★ after one hint and ★ after more or the
  // full solution, and Start over doesn't lift it, so rebuilding a shown answer can't earn ★★★. The daily keeps its own rule
  // (a helped daily win earns no stars) and the tutorial never scores.
  const capsHelp = !daily && !challenge && !practice;
  // The player's first name, for the challenges they send (game/profile.ts, the name the tour asked for).
  const [myName, setMyName] = useState('');
  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((raw) => setMyName((parseProfile(raw).name.split(/\s+/)[0] ?? '').slice(0, 20))).catch(() => {});
  }, []);
  const levelHelp = capsHelp ? helpRecord[level.id] ?? 0 : 0;
  // A board saved before help was kept per level (0.45.0) may already carry help: carry it over as one hint.
  useEffect(() => { if (capsHelp && draft?.helped && !levelHelp) markHelp(level.id, 1); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // The win celebration (game/celebration): a spark runs the winning shot and the glass bursts; the win card waits for the burst.
  const celeT = useSharedValue(1);
  const [cele, setCele] = useState<{ path: Vec[]; jumps: number[]; confetti: number; rings: number } | null>(null);
  const [cardReady, setCardReady] = useState(true);
  const celeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stopCelebration = () => {
    celeTimers.current.forEach(clearTimeout);
    celeTimers.current = [];
    celeT.value = 1;
    setCele(null);
    setCardReady(true);
  };
  const celebrate = (res: { path: Vec[]; jumps: number[]; bounces: number }, stars: number, assisted: boolean) => {
    stopCelebration();
    const burst = burstFor(stars, assisted);
    setCele({ path: res.path, jumps: res.jumps, ...burst });
    setCardReady(false);
    celeT.value = 0;
    celeT.value = withTiming(1, { duration: CELEBRATION_MS, easing: Easing.linear });
    celeTimers.current = [
      setTimeout(() => feedback.burst(), CELEBRATION_MS * 0.6),
      // The card only comes once the whole celebration has played out (players found it cut the burst short).
      setTimeout(() => { setCele(null); setCardReady(true); }, CELEBRATION_MS + CARD_PAUSE_MS),
    ];
  };
  useEffect(() => () => celeTimers.current.forEach(clearTimeout), []);
  // The live bounce counter takes the top corner that covers the least of the level (game/counter).
  const spot = counterSpot(level);
  // Spring pads energise the ball: `charge` is how lit up it is (1 right after a kick, easing to a steady glow, off at the
  // end of the shot); `kick` runs 0 → 1 for the burst ring and the pad's flash, at the pad hit (kickX, kickY).
  const charge = useSharedValue(0);
  const kick = useSharedValue(1);
  const kickX = useSharedValue(0);
  const kickY = useSharedValue(0);
  const launched = () => {
    charge.value = 0;
    kick.value = 1;
    feedback.launched();
  };
  // A portal: a ring flashes where the ball comes out (warp runs 0 → 1 at warpX, warpY).
  const warp = useSharedValue(1);
  const warpX = useSharedValue(0);
  const warpY = useSharedValue(0);
  const warpAt = (res: { path: Vec[] }, i: number) => {
    const at = res.path[Math.min(i, res.path.length - 1)];
    warpX.value = at[0];
    warpY.value = at[1];
    warp.value = 0;
    warp.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    feedback.warped();
  };
  // Everything the ball meets on its way, in order: bounces and trips through a portal. Each fires as playback reaches it.
  /** `setup`: the bars and aim the shot was fired from (setupKey), which its bounce markers belong to. */
  const playShot = (res: { path: Vec[]; hits: Hit[]; jumps: number[] }, done: () => void, count = true, setup = '') => {
    // Bounce markers (game/marks.ts): each scored bounce's number appears where it happens; a skip or the end shows them all.
    const all = bounceMarks(res);
    setMarks(all);
    setMarksFor(setup);
    setShownMarks(0);
    const finish = () => { setShownMarks(all.length); done(); };
    const events = [...res.hits.map((h) => ({ i: h.i, h })), ...res.jumps.map((i) => ({ i, h: undefined as Hit | undefined }))]
      .sort((x, y) => x.i - y.i);
    play(res.path, finish, events.map((e) => e.i), (k) => {
      const e = events[k];
      if (!e.h) { warpAt(res, e.i); return; }
      hitAt(res, e.h);
      if (e.h.counts) setShownMarks((n) => n + 1);
      if (count && e.h.counts) setBounces((n) => (n ?? 0) + 1);
    }, res.jumps);
  };
  const hitAt = (res: { path: Vec[] }, h: Hit) => {
    feedback.hit(h);
    if (h.kind !== 'pad' && !h.spring) return;
    const at = res.path[Math.min(h.i, res.path.length - 1)];
    kickX.value = at[0];
    kickY.value = at[1];
    kick.value = 0;
    kick.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
    charge.value = 1;
    charge.value = withTiming(0.55, { duration: 1400, easing: Easing.out(Easing.quad) });
  };
  /** `viaSolve`: the Solve button's own shot (the full solution). */
  const fire = (shot: Slot[], a: number, p: number, viaSolve = false) => {
    // No stars at all: the tutorial, and a daily won with help. A level won with help scores, capped by its help.
    const assisted = practice || ((!!daily || !!challenge) && (helped || viaSolve));
    const helpNow = capsHelp && viaSolve ? AFTER_SOLUTION : levelHelp;
    const placed = boardPieces(shot), numbers = boardNumbers(shot);
    setGuided(tutorial);
    const res = simulate(buildWorld(level, placed), a, p);
    const tryNo = tries + 1;
    setTries(tryNo);
    setBounces(0);
    const finished = () => {
      charge.value = withTiming(0, { duration: 500 });
      setBounces(res.bounces);
      trailShots.current.set(res.path, { pieces: placed, angle: a, power: p });
      setTrails((ts) => [...ts, { path: res.path, ok: res.success, end: res.end, jumps: res.jumps }].slice(-MAX_TRAILS));
      // A destroyed ball needs no card: the board shows the burst and the sound plays.
      setNotice(res.end === 'skipped' ? skipNotice(level.pieces.length, numbers, res.touched, { pads: { total: (level.pads ?? []).length, touched: res.padsTouched }, portals: { total: (level.portals ?? []).length, used: res.portalsUsed } }) : null);
      if (res.end === 'dead') feedback.died();
      if (res.success) {
        feedback.landed();
        const stars = assisted ? 0 : starsFor(cappedBounces(res.bounces, par, helpNow), par);
        celebrate(res, stars, assisted);
        setWinShot({ angle: a, power: p, slots: shot, bounces: res.bounces });
        setDone(true);
        if (tutorial) { tips.finishTutorial(); setTutorial(false); }
        // Every win keeps its shot for the level card's drawing and Replay; a level's result is scored with its help cap.
        const saved = { pieces: placed.map(({ x, y, deg, len }) => ({ x, y, deg, len })), angle: a, power: p };
        if (daily) daily.onWin({ bounces: res.bounces, stars, tries: tryNo, helped: assisted });
        else if (challenge) { /* a friend's challenge: outside the player's own progress */ }
        else if (practice) won(index, undefined, saved);
        else won(index, bestOf({ bounces: res.bounces, par, tries: tryNo }, helpNow), saved);
        // Hint rewards, said once the celebration is over: a level's first three-star win, and a world's last level won.
        if (!practice && !daily && !challenge) {
          const notes: string[] = [];
          if (!assisted && stars === 3 && wallet.rewardStars(level.id)) notes.push(`+${STAR_REWARD} 💡 for three stars`);
          const world = WORLDS.find((w) => w.ids[w.ids.length - 1] === level.id);
          if (world && wallet.rewardWorld(world.name)) notes.push(`+${WORLD_REWARD} 💡: ${world.name} world complete!`);
          if (notes.length) setTimeout(() => wallet.announce(notes.join('\n')), CELEBRATION_MS + 600);
        }
      }
    };
    launched();
    playShot(res, finished, true, setupKey(placed, a, p));
  };

  // Opened with a saved shot (Replay on the level card): play it once, like the Replay button. It isn't a try
  // and isn't scored; the bars and aim are left set up, so the player carries on from there.
  useEffect(() => {
    if (!shot) return;
    const timer = setTimeout(() => {
      const res = simulate(buildWorld(level, shotPieces(level, shot)), shot.angle, shot.power);
      setBounces(0);
      launched();
      playShot(res, () => {
        setBounces(res.bounces);
        setTrails([{ path: res.path, ok: res.success, end: res.end, jumps: res.jumps }]);
        if (res.success) feedback.landed();
      }, true, setupKey(shotPieces(level, shot), shot.angle, shot.power));
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
    else if (daily) router.push({ pathname: '/level/[id]', params: { id: TUTORIAL_ID } });
    else router.setParams({ id: TUTORIAL_ID });
  };

  // Share a level's win (game/share.ts): the message, with a picture of the board as it is, every trail of the round on it.
  const snapshot = useRef<((card: ShareCard) => string | null) | null>(null);
  const shareWin = () => {
    const assisted = practice || guided || (!!daily && (solved || helped));
    const r = { bounces: winShot.bounces, stars: assisted ? 0 : starsFor(cappedBounces(winShot.bounces, par, levelHelp), par), tries, helped: assisted || levelHelp > 0 };
    const what = { kind: 'level' as const, number: index + 1, name: level.name };
    shareText(shareMessage(what, r, par), wallet.announce, snapshot.current?.(shareCard(what, r, par)));
  };

  const goTo = (i: number) => {
    if (!flying) router.setParams({ id: LEVELS[i].id });
  };

  // Challenge a friend (game/challenge.ts): a link to this level with this winning shot in it; the friend plays it in the browser and
  // tries to beat its bounces. From a challenge, the same button sends one back with the player's own shot.
  const sendChallenge = () => {
    const pieces = boardPieces(winShot.slots).map(({ x, y, deg }) => ({ x, y, deg }));
    const url = challengeUrl({ levelId: level.id, from: myName, shot: { pieces, angle: winShot.angle, power: winShot.power } }, siteUrl());
    shareText(challengeMessage({ levelNo: index + 1, levelName: level.name, bounces: winShot.bounces, par, url }), wallet.announce);
  };
  // In a challenge, after the friend's win: play the sender's shot (their bars and aim set up), not a try and not scored.
  const watchTheirs = () => {
    if (!challenge || flying) return;
    primeAudio();
    const theirs = shotSlots(level, challenge.shot);
    setSlots(theirs);
    setSelected(null);
    setAngle(challenge.shot.angle);
    setPower(challenge.shot.power);
    setNotice(null);
    const res = simulate(buildWorld(level, boardPieces(theirs)), challenge.shot.angle, challenge.shot.power);
    launched();
    playShot(res, () => {
      setTrails((ts) => [...ts, { path: res.path, ok: res.success, end: res.end, jumps: res.jumps }].slice(-MAX_TRAILS));
      if (res.success) feedback.landed();
    }, false, setupKey(boardPieces(theirs), challenge.shot.angle, challenge.shot.power));
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
    launched();
    playShot(res, () => { if (res.success) feedback.landed(); }, false, setupKey(boardPieces(shot), a, p));
  };

  // Put the bars and the aim back the way they were before the last change. During a shot, it first skips to the shot's end.
  const undoMove = () => {
    if (flying) skip();
    const step = undoHistory(history.current);
    if (!step) return;
    history.current = step.history;
    setCanUndo(step.history.past.length > 0);
    undoing.current = true;
    keepPlaying();
    setSlots(step.state.slots);
    setAngle(step.state.angle);
    setPower(step.state.power);
    if (selected != null && !step.state.slots[selected]?.onBoard) setSelected(null);
    setNotice(null);
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
    // The bar being adjusted stays selected through the shot, so its rotation slider is still under the finger afterwards
    // (the aim sliders come back with Done, or by touching the dotted aim line).
    fire(slots, angle, power);
  };

  // Solve opens the help card: a hint or the full solution, each after a rewarded ad (components/ads).
  const openHelp = () => {
    const skipped = flying;
    if (flying) skip();
    if (!level.solution) return;
    primeAudio();
    keepPlaying();
    setSelected(null);
    // The tutorial level is practice: Solve just solves it, with no ad and no hint-or-solution card.
    if (practice) { solve(skipped); return; }
    // Every bar, the angle and the power already match the answer: there's nothing left to give, so no card and no ad. The button
    // shakes red and a line says so instead.
    if (!nextHint(level, barHint(), angle, power)) { setSolvedTaps((n) => n + 1); return; }
    setHelp(true);
  };
  // The answer's next step, a hint at a time (game/help.ts): each bar in turn, then the launch angle, then the launch power.
  const barHint = () => { const h = hintSlots(level, slots); return h ? h.k : null; };
  // Each hint costs 1 from the player's hints, the full solution one less than hinting every missing step (game/wallet.ts).
  const fullCost = () => solutionCost(stepsLeft(level, level.pieces.filter((_, i) => !atSolution(level, slots, i)).length, angle, power));
  const hint = () => {
    const next = nextHint(level, barHint(), angle, power);
    if (!next) return;
    if (!wallet.spend(1)) { wallet.openShop(); return; }
    setHelp(false);
    setHelped(true);
    if (capsHelp) markHelp(level.id, afterHint(levelHelp));
    if (next.kind === 'bar') {
      const h = hintSlots(level, slots);
      if (!h) return;
      setSlots(h.slots);
      select(h.k, h.slots);
      return;
    }
    // The aim sliders come back (no bar selected) so the value is seen to change; the board says what was set.
    setSelected(null);
    if (next.kind === 'angle') setAngle(next.value); else setPower(next.value);
    setNotice({ title: 'Your hint', text: aimHintNotice(next) ?? '' });
  };
  const fullSolution = () => {
    if (!wallet.spend(fullCost())) { wallet.openShop(); return; }
    setHelp(false);
    solve();
  };

  // Places the stored solution's pieces (unused ones go back to the tray), sets angle and power, launches.
  /** `skipped`: the caller has just skipped the shot in flight, so this render's `flying` is out of date. */
  const solve = (skipped = false) => {
    const s = level.solution;
    if ((flying && !skipped) || !s) return;
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
    if (capsHelp) markHelp(level.id, AFTER_SOLUTION);
    fire(next, s.angle, s.power, true);
  };

  // After a win, any edit (board touch, bar chip, slider, rotation) or the card's ✕ goes back to normal play:
  // the card closes and Launch launches again. Bars, trails and tries stay; the level stays won.
  const keepPlaying = () => {
    poke();
    setNotice(null); // any edit also closes a near-miss card
    setHelp(false);
    if (!done || flying) return;
    stopCelebration();
    setDone(false);
    setSolved(false);
  };

  // During a shot, touching a control first skips to the shot's end (like Skip ›), then the control does what it does: a bar chip
  // selects its bar, the cannon chip goes back to aiming, Solve opens its card, and so on. The rotation and aim controls skip as the
  // finger lands, without taking the touch, so the same touch then turns the bar or moves the slider.
  const skipOnTouch = () => {
    if (flying) skip();
    return false;
  };
  const clearTrails = () => {
    if (flying) skip();
    setTrails([]);
    setMarks([]);
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

  // One finger on the board: rotate the selected piece by its end handle, move a piece, or aim (from the gun, the
  // dotted line, or, before any bar is placed, a swipe on empty board: the aim moves with the finger, no jump).
  // A tap during a flight skips to the end of the shot (the whole path is drawn and the
  // result counts), and does nothing else. There's no aiming once the level is won.
  // A bar dragged somewhere it isn't allowed (game/placement) shows red, and snaps back to the last
  // allowed spot when the finger lifts.
  // Dragging a bar down past the floor takes it off the board: a red strip shows where, and letting go there removes it.
  const armedRef = useRef(false);
  const [dropZone, setDropZone] = useState<'off' | 'hint' | 'armed'>('off');
  const handleTouch = (phase: TouchPhase, p: { x: number; y: number }) => {
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
      // The remove badge keeps off the level's walls, spikes, glass and the other bars (the board draws it from the same list).
      const others = boardPieces(slots.filter((x, k) => k !== selected));
      const r = pressAt(slots, selected, p, true, { angle, power }, lever, trashObstacles(level, others));
      drag.current = r.drag;
      lastLegal.current = slots;
      select(r.selected);
      if (r.lever) setLever(r.lever);
    } else if (phase === 'move') {
      const d = drag.current;
      if (!d) return;
      if (d.mode === 'open' || d.mode === 'pan') {
        // A drag from the gun (or a swipe on a board with no bars yet): once it's clearly a drag, the aim moves along with the finger
        // from where it was, never jumping to it (more power
        // away from the gun, less towards it, round it turns). Step by step from the last point, so after hitting a limit the
        // finger coming back responds at once.
        if (d.mode === 'open' && Math.hypot(p.x - d.x, p.y - d.y) < OPEN_DRAG) return;
        const from = d.mode === 'pan' ? d : { angle, power };
        const a = aimBy(from.angle, from.power, p.x - d.x, p.y - d.y);
        // A slow finger's tiny steps can round to no change (0.1 steps): keep the old point until they add up to one. (A bigger
        // move with no change is pushing past a limit: that one moves the point, so coming back responds at once.)
        if (d.mode === 'pan' && a.angle === d.angle && a.power === d.power && Math.hypot(p.x - d.x, p.y - d.y) < 3) return;
        drag.current = { mode: 'pan', x: p.x, y: p.y, ...a };
        setAim(a.angle, a.power);
      }
      else if (d.mode === 'swing') {
        const a = swingTo(p, d.grab);
        setAim(a.angle, a.power);
      }
      else if (d.mode === 'move' && p.y > WORLD.ground + 14) {
        // out past the floor: the bar stays where it was last allowed, and letting go removes it
        if (!armedRef.current) { armedRef.current = true; setDropZone('armed'); }
      }
      else {
        if (d.mode === 'move' && (armedRef.current || dropZone === 'off')) { armedRef.current = false; setDropZone('hint'); }
        setSlots((s) => {
          const next = dragTo(s, d, p);
          if (slotsLegal(level, next)) lastLegal.current = next;
          return next;
        });
      }
    } else {
      const d = drag.current;
      drag.current = null;
      const wasArmed = armedRef.current;
      armedRef.current = false;
      setDropZone('off');
      if (d?.mode === 'trash') {
        // The remove badge: only if the finger lifted still on it (sliding off cancels). Undo puts the bar back.
        if (Math.hypot(p.x - d.x, p.y - d.y) < TRASH_GRAB + 8) {
          setSlots((s) => removeBar(s, d.k).slots);
          setSelected(null);
        }
        return;
      }
      if (d?.mode === 'move' && wasArmed) {
        setSlots((s) => removeBar(s, d.k).slots);
        setSelected(null);
        return;
      }
      if (tutorial && (d?.mode === 'swing' || d?.mode === 'pan')) {
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

  // Finger movements are handled at most once per screen frame, using the latest position: a phone sends them up to 120 times a
  // second, and when each redraw takes longer than that they queued up and the bar or the gun trailed further and further behind the
  // finger. Down and up go straight through (a pending movement first, so nothing is lost).
  const handleTouchRef = useRef(handleTouch);
  handleTouchRef.current = handleTouch;
  const pendingMove = useRef<{ x: number; y: number } | null>(null);
  const moveFrame = useRef<number | null>(null);
  const flushMove = () => {
    if (moveFrame.current != null) cancelAnimationFrame(moveFrame.current);
    moveFrame.current = null;
    const q = pendingMove.current;
    pendingMove.current = null;
    if (q) handleTouchRef.current('move', q);
  };
  const onTouch = (phase: TouchPhase, p: { x: number; y: number }) => {
    if (phase === 'move') {
      pendingMove.current = p;
      if (moveFrame.current == null) moveFrame.current = requestAnimationFrame(flushMove);
      return;
    }
    flushMove();
    handleTouchRef.current(phase, p);
  };
  useEffect(() => () => { if (moveFrame.current != null) cancelAnimationFrame(moveFrame.current); }, []);

  // The selected bar (if it's on the board) gets rotation controls in place of the aim rows.
  const selectedBar = selected != null && slots[selected]?.onBoard ? selected : null;
  const rotate = (next: (s: Slot[]) => Slot[]) => {
    if (flying) skip();
    keepPlaying();
    setSlots(next);
  };

  const onChip = (k: number) => {
    if (flying) skip();
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
              <Text style={[styles.sub, { color: c.muted }]}>{daily ? `Daily #${daily.number} · ${daily.tier}` : challenge ? `Challenge from ${senderName(challenge.from)}` : `Level ${index + 1} of ${LEVELS.length}`}</Text>
            </View>
          ),
          headerRight: () => daily || challenge ? <View style={styles.nav} /> : (
            <View style={styles.nav}>
              <IconButton label="‹" a11y="Previous level" disabled={index === 0} onPress={() => goTo(index - 1)} />
              <IconButton label="›" a11y="Next level" disabled={index >= unlocked} onPress={() => goTo(index + 1)} />
            </View>
          ),
        }}
      />
      <SettingsSheet visible={settings} onClose={() => setSettings(false)} onMusicTap={primeAudio} onReplayTutorial={replayTutorial} />
      <View ref={stageRef} style={styles.stage}>
        <FadeToast trigger={solvedTaps} text={solvedNudge(done)} />
        <Board
          level={level}
          pieces={boardPieces(slots)}
          marks={showMarks && marksFor === setupKey(boardPieces(slots), angle, power) ? marks.slice(0, shownMarks) : []}
          numbers={boardNumbers(slots)}
          illegal={illegalBars(level, slots)}
          selected={boardIndex(slots, selected)}
          lever={lever}
          ghosts={ghosts}
          trails={trails}
          angle={angle}
          power={power}
          tries={tries}
          hud={false}
          flight={flight}
          charge={charge}
          dropZone={dropZone}
          celebrate={cele ? { t: celeT, ...cele } : null}
          warp={{ t: warp, x: warpX, y: warpY }}
          kick={{ t: kick, x: kickX, y: kickY }}
          done={done}
          onTouch={onTouch}
          snapshot={snapshot}
        />
        {notice && !done && !flying && (
          <NoticeCard
            title={typeof notice === 'string' ? 'So close!' : notice.title} message={typeof notice === 'string' ? notice : notice.text}
            onClose={() => setNotice(null)}
          />
        )}
        {/* The scorecard, split across the top so it never blocks a strip of the board: this shot's bounces against par in the
            corner counterSpot picks, and the tries so far (the other number a result is ranked by) in the opposite corner. */}
        {bounces != null && !done && (
          <View style={[styles.counterRow, { justifyContent: spot === 'left' ? 'flex-start' : spot === 'right' ? 'flex-end' : 'center' }]} pointerEvents="none">
            <View style={[styles.counter, { backgroundColor: c.paper, borderColor: c.line }]}>
              <Text style={[styles.counterNum, { color: bounces > par ? c.red : c.ink }]}>{bounces}</Text>
              <Text style={[styles.counterLabel, { color: c.muted }]}>{bounces === 1 ? 'bounce' : 'bounces'}{'\n'}par {par}</Text>
            </View>
          </View>
        )}
        {tries > 0 && !done && (
          <View style={[styles.counterRow, { justifyContent: spot === 'right' ? 'flex-start' : 'flex-end' }]} pointerEvents="none">
            <View style={[styles.counter, { backgroundColor: c.paper, borderColor: c.pencil }]}>
              <Text style={[styles.counterNum, { color: c.pencil }]}>{tries}</Text>
              <Text style={[styles.counterLabel, { color: c.pencil }]}>{tries === 1 ? 'try' : 'tries'}{'\n'}so far</Text>
            </View>
          </View>
        )}
        {help && !flying && (
          <HelpCard
            hint={(() => { const h = nextHint(level, barHint(), angle, power); return h ? { label: hintLabel(h), cost: 1 } : null; })()}
            solutionCost={fullCost()} hints={wallet.hints}
            note={capsHelp ? helpNote(levelHelp) : challenge ? 'A challenge won with help still counts, but your friend will know.' : 'A daily puzzle won with help still counts for your streak, but earns no stars.'}
            onHint={hint} onSolve={fullSolution} onAd={() => { wallet.watchAd(); }} onShop={wallet.openShop} onClose={() => setHelp(false)}
          />
        )}
        {done && !flying && cardReady && (
          <WinCard
            place={cardPlace(glassBox(level.glass).rim, WORLD.height)}
            onStar={(k) => feedback.star(k)}
            text={challenge
              ? { ...challengeWinText(winShot.bounces, challenge.bounces, challenge.from, helped || solved), stars: 0, score: null, next: null, again: 'Try again', go: '⚔️ Challenge back' }
              : { ...winText({ assisted: solved ? 'solve' : daily && helped ? 'hint' : guided || practice ? 'tutorial' : null, tries, bounces: winShot.bounces, par, last, help: levelHelp }), ...(daily ? { go: 'Share' } : {}) }}
            onAgain={() => startOver(false)}
            onClose={keepPlaying}
            onGo={() => (daily ? daily.onShare(snapshot.current) : challenge ? sendChallenge() : last ? startOver(false) : goTo(index + 1))}
            onShare={daily || challenge ? undefined : shareWin}
            extras={challenge
              ? [{ label: `👀 Watch ${senderName(challenge.from)}’s shot`, onPress: watchTheirs }, { label: challenge.next.label, onPress: challenge.next.go }]
              : daily || practice ? [] : [{ label: '⚔️ Challenge a friend', onPress: sendChallenge }]}
          />
        )}
      </View>
      <Text style={[styles.goal, { color: c.ink }]} numberOfLines={2}>
        {challenge
          ? challengeGoal(challenge.from, challenge.bounces, goalEvery(level.pieces.length, (level.pads ?? []).length, (level.portals ?? []).length))
          : goalText(level.pieces.length, level.par, (level.pads ?? []).length, (level.portals ?? []).length)}
      </Text>
      <View style={styles.controls}>
        {selectedBar != null ? (
          <View onStartShouldSetResponderCapture={skipOnTouch}>
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
            disabled={flying}
          />
          </View>
        ) : (
          // Touching the angle or power controls while a shot is playing skips it, like a tap on the board.
          <View onStartShouldSetResponderCapture={skipOnTouch}>
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
            <Tray slots={slots} selected={selected} onTap={onChip} onAim={() => { if (flying) skip(); setSelected(null); }} aiming={selectedBar == null} onChipLayout={(k, l) => { chips.current[k] = l; }} />
          </View>
        </View>
        <View style={styles.actions}>
          {/* During a shot, Solve, Clear and Undo (like the bar and cannon chips) only skip to its end, like Skip ›. */}
          <Ghost label="Solve" badge={practice ? undefined : `💡${wallet.hints}`} onPress={openHelp} big shake={solvedTaps} />
          <Ghost label="Clear" onPress={clearTrails} big />
          <UndoButton enabled={flying || (canUndo && !done)} onPress={undoMove} />
          {/* Launch; during a flight, Skip (jump to the end of the shot); after a win, Replay. */}
          <Pressable
            ref={launchRef}
            onPress={flying ? skip : done ? watchAgain : launch}
            accessibilityRole="button"
            style={[styles.launch, { backgroundColor: c.red }]}
          >
            <Text style={styles.launchText}>{flying ? 'Skip ›' : done ? 'Replay ▶︎' : 'Launch'}</Text>
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

/** The undo button just before Launch: a curved arrow, faded when there is nothing to undo. */
function UndoButton({ enabled, onPress }: { enabled: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel="Undo the last change"
      accessibilityState={{ disabled: !enabled }}
      style={[styles.undo, { borderColor: c.line, opacity: enabled ? 1 : 0.35 }]}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path d="M9 5.5 L4 10.5 L9 15.5" stroke={c.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d="M4.5 10.5 H14 A5 5 0 0 1 14 20.5 H8" stroke={c.ink} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      </Svg>
    </Pressable>
  );
}

/**
 * A quiet outlined button. Each change of `shake` (after the first) shakes it side to side and lights it red for a moment. `badge` is a
 * small count after the label (Solve shows the player's hints, 💡12).
 */
function Ghost({ label, badge, onPress, big, shake = 0, disabled }: { label: string; badge?: string; onPress: () => void; big?: boolean; shake?: number; disabled?: boolean }) {
  const c = useColors();
  const x = useSharedValue(0);
  const [red, setRed] = useState(false);
  useEffect(() => {
    if (!shake) return;
    const step = (to: number) => withTiming(to, { duration: 55 });
    x.value = withSequence(step(-9), step(9), step(-7), step(7), step(-4), step(4), step(0));
    setRed(true);
    const t = setTimeout(() => setRed(false), 900);
    return () => clearTimeout(t);
  }, [shake, x]);
  const moved = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Animated.View style={moved}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={badge ? `${label}, ${badge.replace('💡', '')} hints left` : label}
        style={[styles.ghost, big && styles.ghostBig, badge != null && styles.ghostBadged, { borderColor: red ? c.red : c.line }]}
      >
        <Text style={[styles.ghostText, big && styles.ghostTextBig, { color: red ? c.red : c.muted }]}>{label}</Text>
        {badge != null && <Text style={[styles.badge, { color: red ? c.red : c.pencil }]}>{badge}</Text>}
      </Pressable>
    </Animated.View>
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
  counterRow: { position: 'absolute', top: 10, left: 14, right: 14, flexDirection: 'row' },
  counter: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5,
  },
  counterNum: { fontSize: 30, lineHeight: 32, fontFamily: FONTS.condensedBold, fontVariant: ['tabular-nums'] },
  counterLabel: { fontSize: 11, lineHeight: 13, fontFamily: FONTS.bodyMedium },
  controls: { paddingHorizontal: 12, paddingTop: 4, gap: 6 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tray: { flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  undo: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ghost: { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1.5, justifyContent: 'center' },
  ghostBig: { height: 44, paddingHorizontal: 20, borderRadius: 22 },
  ghostBadged: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14 },
  badge: { fontSize: 14, fontFamily: FONTS.condensedBold },
  ghostText: { fontSize: 14, fontFamily: FONTS.bodyMedium },
  ghostTextBig: { fontSize: 15 },
  launch: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  launchText: { color: '#fff', fontSize: 20, letterSpacing: 0.3, fontFamily: FONTS.condensedBold },
});
