import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DailyCard } from '../components/daily/DailyCard';
import { ShotThumbnail } from '../components/levels/ShotThumbnail';
import { WorldInfo } from '../components/levels/WorldInfo';
import { SettingsSheet } from '../components/settings/SettingsSheet';
import { useTips } from '../components/coach/Tips';
import { useProgress, useUnlocked } from '../components/progress/ProgressProvider';
import { TUTORIAL_ID } from '../game/coach';
import { VERSION_LABEL } from '../components/version';
import { totalScore } from '../game/score';
import { cardStates } from '../game/progress';
import { WEB_GUEST_KEY } from '../game/challenge';
import { WORLDS, levelContents, worldStartingAt, type World } from '../game/worlds';
import { LEVELS } from '../levels';
import { FONTS, useColors } from '../theme/colors';

const COLUMNS = 2;
const GAP = 12;

// Level select: a grid of level cards, two across, each with its number and name. Levels the player has
// won, and the next one to play (highlighted), show a drawing of the level: launcher, glass and, once
// won, the player's last winning shot with a Replay button that reopens the level with that shot set up
// and plays it. Levels further on show a faded drawing of the level (a taste of what's coming), a lock and what's on it,
// and can't be opened (LOCK_LEVELS), unless the Testing switch in Settings opens them all.
export default function LevelSelect() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tipsOn, tutorialDone, restartTutorial, tourSeen, restartTour } = useTips();
  // The guided tour (components/tour/TourGate, in the root layout) shows once, before anything else; Settings can show it again.
  const openTutorial = () => router.push({ pathname: '/level/[id]', params: { id: TUTORIAL_ID } });
  const { best, shots, frontier, help } = useProgress();
  const unlocked = useUnlocked();
  const total = totalScore(best);
  const [settings, setSettings] = useState(false);
  const [info, setInfo] = useState<World | null>(null);
  // A browser that came in through a challenge (app/challenge.tsx) gets that one level on the web; the levels are in the app, so it's
  // sent to the app page. "?full=1" lifts it (testing the web game in a browser that first opened a challenge).
  const { full } = useLocalSearchParams<{ full?: string }>();
  const [guest, setGuest] = useState<boolean | null>(Platform.OS === 'web' ? null : false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (full === '1') { AsyncStorage.removeItem(WEB_GUEST_KEY).catch(() => {}); setGuest(false); return; }
    AsyncStorage.getItem(WEB_GUEST_KEY).then((v) => setGuest(v === '1')).catch(() => setGuest(false));
  }, [full]);
  const tile = Math.floor((Math.min(width, 560) - 2 * 18 - (COLUMNS - 1) * GAP) / COLUMNS);
  // Each card's look comes from the real unlocks (game/progress.ts cardStates), not from saved stars alone: a win with a hint or
  // Solve saves no stars but does unlock the next level, and the list used to show that level locked (while › opened it).
  const states = cardStates(LEVELS.map((l) => l.id), (id) => !!best[id], Math.max(frontier, tutorialDone ? Math.min(1, LEVELS.length - 1) : 0), unlocked, tutorialDone);
  const nextUp = states.indexOf('next');

  // Open on the level to play next, not the top of the list: once the grid and that card have been laid out, scroll so the card sits
  // about a third of the way down the screen (the daily card stays one swipe up). Again whenever the next level changes, e.g. after a
  // win, since this screen stays mounted under the level.
  const { height } = useWindowDimensions();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const gridY = useRef<number | null>(null);
  const cardY = useRef<Record<number, number>>({});
  const scrolledFor = useRef<number | null>(null);
  const scrollToNext = () => {
    const y = cardY.current[nextUp];
    if (gridY.current == null || y == null || scrolledFor.current === nextUp || nextUp <= 1) return;
    const first = scrolledFor.current == null;
    scrolledFor.current = nextUp;
    scroller.current?.scrollTo({ y: Math.max(0, gridY.current + y - height / 3), animated: !first });
  };
  useEffect(scrollToNext);

  // A brand-new player who has already seen the tour goes straight into the tutorial; one who hasn't gets the tour, which ends there.
  // (On a cold start only: this screen stays mounted underneath the level, so coming back to it doesn't send them in again.)
  useEffect(() => {
    if (tourSeen && tipsOn && !tutorialDone && Object.keys(best).length === 0) openTutorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (guest !== false) return guest ? <Redirect href="/get" /> : null;
  return (
    <View style={styles.screen}>
    <ScrollView ref={scroller} contentContainerStyle={[styles.page, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]}>
      <SettingsSheet
        visible={settings} onClose={() => setSettings(false)}
        onReplayTutorial={() => { setSettings(false); restartTutorial(); openTutorial(); }}
        onShowTour={() => { setSettings(false); restartTour(); }}
      />
      <WorldInfo world={info} onClose={() => setInfo(null)} />
      <View style={styles.header}>
        <Pressable onPress={() => setSettings(true)} accessibilityRole="button" accessibilityLabel="Settings" style={[styles.settings, { borderColor: c.line }]}>
          <Text style={[styles.settingsText, { color: c.ink }]}>Settings</Text>
        </Pressable>
        <Text style={[styles.heading, { color: c.ink }]}>Levels</Text>
        <Text style={[styles.total, { color: c.muted }]}>
          {total > 0 ? `Score ${total.toLocaleString()}` : 'Get each ball in with as few bounces as you can'}
        </Text>
      </View>
      <DailyCard width={tile * COLUMNS + GAP * (COLUMNS - 1)} />
      <View style={styles.grid} onLayout={(e) => { gridY.current = e.nativeEvent.layout.y; scrollToNext(); }}>
        {LEVELS.map((level, index) => {
          const locked = index > unlocked;
          const b = best[level.id];
          const next = index === nextUp && !locked;
          const isTut = level.id === TUTORIAL_ID;
          // The tutorial, once done, is a finished level (it has no stars: its win is guided), not a locked one.
          const looksLocked = states[index] === 'locked';
          const helped = states[index] === 'helped';
          const label = `Level ${index + 1}, ${level.name}${locked ? ', locked' : b ? `, ${b.stars} of 3 stars` : ''}`;
          const body = (
            <Pressable
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ disabled: locked }}
              // Flattened: Link asChild passes this through a Slot, which rejects style arrays on web.
              style={StyleSheet.flatten([
                styles.tile,
                { width: tile, backgroundColor: next ? c.pencil : c.paper, borderColor: next || b ? c.pencil : c.line },
                looksLocked && styles.locked,
              ])}
            >
              {looksLocked ? (
                <View style={[styles.thumb, styles.lockedThumb, { borderColor: c.line, backgroundColor: c.paper }]}>
                  <View style={styles.faded}>
                    <ShotThumbnail level={level} width={tile - 16} height={(tile - 16) * 0.85} />
                  </View>
                  <View style={[styles.badge, { backgroundColor: c.muted }]}>
                    <Text style={[styles.badgeText, { color: c.paper }]}>{index + 1}</Text>
                  </View>
                  <View style={[styles.lockBadge, { backgroundColor: c.paper, borderColor: c.line }]}>
                    <Text style={styles.lockIcon}>🔒</Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.thumb, { borderColor: c.line, backgroundColor: c.paper }]}>
                  <ShotThumbnail level={level} shot={shots[level.id]} width={tile - 16} height={(tile - 16) * 0.85} />
                  <View style={[styles.badge, { backgroundColor: next ? c.pencil : c.ink }]}>
                    <Text style={[styles.badgeText, { color: c.paper }]}>{index + 1}</Text>
                  </View>
                </View>
              )}
              <Text style={[styles.name, { color: next ? c.paper : c.ink }]} numberOfLines={1}>{level.name}</Text>
              {looksLocked ? (
                <Text style={[styles.best, styles.lockedNote, { color: c.muted }]} numberOfLines={2}>{levelContents(level)} · par {level.par}</Text>
              ) : helped ? (
                <View style={styles.meta}>
                  <Text style={[styles.best, { color: c.muted }]}>Won with help</Text>
                  <Text style={[styles.best, { color: c.muted }]}>par {level.par}</Text>
                </View>
              ) : isTut && !b && tutorialDone ? (
                <View style={styles.meta}>
                  <Text style={[styles.tutorialDone, { color: c.pencil }]}>Tutorial ✓</Text>
                  <Text style={[styles.best, { color: next ? c.paper : c.muted }]}>par {level.par}</Text>
                </View>
              ) : (
                <View style={styles.meta}>
                  <Text style={styles.stars}>
                    {[0, 1, 2].map((k) => (
                      <Text key={k} style={b && k < b.stars ? { color: next ? c.paper : c.red } : { color: next ? c.paper : c.line, opacity: next ? 0.45 : 1 }}>★</Text>
                    ))}
                  </Text>
                  <Text style={[styles.best, { color: next ? c.paper : c.muted }]}>
                    {b ? `${help[level.id] ? '💡 ' : ''}best ${b.bounces}, par ${level.par}` : `par ${level.par}`}
                  </Text>
                </View>
              )}
            </Pressable>
          );
          // Replay sits over the card's drawing but outside its link (a button inside a link would
          // trigger both on the web): it opens the level with this winning shot set up and plays it.
          const replay = shots[level.id] && !locked && (
            <Pressable
              onPress={() => router.push({ pathname: '/level/[id]', params: { id: level.id, replay: '1' } })}
              accessibilityRole="button" accessibilityLabel={`Replay your winning shot on level ${index + 1}`}
              hitSlop={6} style={[styles.replay, { top: (tile - 16) * 0.85 - 30, backgroundColor: c.red }]}
            >
              <Text style={styles.replayText}>Replay ▶︎</Text>
            </Pressable>
          );
          const world = worldStartingAt(level.id);
          return (
            <Fragment key={level.id}>
              {world && (
                <Pressable
                  onPress={() => setInfo(world)} accessibilityRole="button" accessibilityLabel={`About world ${WORLDS.indexOf(world) + 1}, ${world.name}`}
                  style={styles.world}
                >
                  <View style={styles.worldText}>
                    <Text style={[styles.worldName, { color: c.ink }]}>World {WORLDS.indexOf(world) + 1} · {world.name}</Text>
                    <Text style={[styles.worldBlurb, { color: c.muted }]}>{world.blurb}</Text>
                  </View>
                  <View style={[styles.info, { borderColor: c.pencil }]}>
                    <Text style={[styles.infoText, { color: c.pencil }]}>i</Text>
                  </View>
                </Pressable>
              )}
              <View onLayout={(e) => { cardY.current[index] = e.nativeEvent.layout.y; if (next) scrollToNext(); }}>
                {locked ? body : <Link href={{ pathname: '/level/[id]', params: { id: level.id } }} asChild>{body}</Link>}
                {replay}
              </View>
            </Fragment>
          );
        })}
      </View>
      <Text style={[styles.version, { color: c.muted }]}>{VERSION_LABEL}</Text>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { padding: 18, gap: 18 },
  header: { alignItems: 'center', gap: 2 },
  settings: { position: 'absolute', right: 0, top: 4, height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center', zIndex: 1 },
  settingsText: { fontSize: 14, fontFamily: FONTS.bodySemi },
  heading: { fontSize: 34, fontFamily: FONTS.condensedBold },
  total: { fontSize: 15, fontFamily: FONTS.bodyMedium, textAlign: 'center' },
  world: { width: '100%', marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  worldText: { flex: 1, gap: 1 },
  info: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  infoText: { fontSize: 18, fontFamily: FONTS.condensedBold, fontStyle: 'italic' },
  worldName: { fontSize: 22, fontFamily: FONTS.condensedBold },
  worldBlurb: { fontSize: 14, fontFamily: FONTS.bodyMedium },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { borderRadius: 16, borderWidth: 2, padding: 6, gap: 6 },
  thumb: { borderRadius: 10, borderWidth: 1, overflow: 'hidden', alignItems: 'center' },
  badge: { position: 'absolute', top: 6, left: 6, minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  replay: { position: 'absolute', right: 14, height: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: 'center' },
  replayText: { color: '#fff', fontSize: 14, fontFamily: FONTS.condensedBold },
  badgeText: { fontSize: 17, fontFamily: FONTS.condensedBold },
  name: { fontSize: 17, fontFamily: FONTS.bodySemi, paddingHorizontal: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 2 },
  best: { fontSize: 13, fontFamily: FONTS.bodyMedium },
  locked: { borderStyle: 'dashed' },
  lockedThumb: { borderStyle: 'dashed' },
  faded: { opacity: 0.45 },
  lockBadge: { position: 'absolute', alignSelf: 'center', top: '50%', marginTop: -20, width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  lockIcon: { fontSize: 18 },
  lockedNote: { paddingHorizontal: 4, paddingBottom: 2 },
  stars: { fontSize: 17, letterSpacing: 1 },
  tutorialDone: { fontSize: 16, fontFamily: FONTS.condensedBold },
  version: { marginTop: 8, textAlign: 'center', fontSize: 12, fontFamily: FONTS.body },
});
