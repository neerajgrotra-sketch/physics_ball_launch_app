import { Link, useRouter } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShotThumbnail } from '../components/levels/ShotThumbnail';
import { SettingsSheet } from '../components/settings/SettingsSheet';
import { useTips } from '../components/coach/Tips';
import { useProgress, useUnlocked } from '../components/progress/ProgressProvider';
import { TUTORIAL_ID } from '../game/coach';
import { VERSION_LABEL } from '../components/version';
import { totalScore } from '../game/score';
import { WORLDS, worldStartingAt } from '../game/worlds';
import { LEVELS } from '../levels';
import { FONTS, useColors } from '../theme/colors';

const COLUMNS = 2;
const GAP = 12;

// Level select: a grid of level cards, two across, each with its number and name. Levels the player has
// won, and the next one to play (highlighted), show a drawing of the level: launcher, glass and, once
// won, the player's last winning shot with a Replay button that reopens the level with that shot set up
// and plays it. Levels further on show a lock and can't be opened (LOCK_LEVELS), unless the Testing switch in Settings opens them all.
export default function LevelSelect() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tipsOn, tutorialDone, restartTutorial, tourSeen, restartTour } = useTips();
  // The guided tour (components/tour/TourGate, in the root layout) shows once, before anything else; Settings can show it again.
  const openTutorial = () => router.push({ pathname: '/level/[id]', params: { id: TUTORIAL_ID } });
  const { best, shots } = useProgress();
  const unlocked = useUnlocked();
  const total = totalScore(best);
  const [settings, setSettings] = useState(false);
  const tile = Math.floor((Math.min(width, 560) - 2 * 18 - (COLUMNS - 1) * GAP) / COLUMNS);
  // The next level to play: the first without a result (the tutorial has none once it's been done).
  const nextUp = LEVELS.findIndex((l) => !best[l.id] && !(l.id === TUTORIAL_ID && tutorialDone));

  // A brand-new player who has already seen the tour goes straight into the tutorial; one who hasn't gets the tour, which ends there.
  // (On a cold start only: this screen stays mounted underneath the level, so coming back to it doesn't send them in again.)
  useEffect(() => {
    if (tourSeen && tipsOn && !tutorialDone && Object.keys(best).length === 0) openTutorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen}>
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]}>
      <SettingsSheet
        visible={settings} onClose={() => setSettings(false)}
        onReplayTutorial={() => { setSettings(false); restartTutorial(); openTutorial(); }}
        onShowTour={() => { setSettings(false); restartTour(); }}
      />
      <View style={styles.header}>
        <Pressable onPress={() => setSettings(true)} accessibilityRole="button" accessibilityLabel="Settings" style={[styles.settings, { borderColor: c.line }]}>
          <Text style={[styles.settingsText, { color: c.ink }]}>Settings</Text>
        </Pressable>
        <Text style={[styles.heading, { color: c.ink }]}>Levels</Text>
        <Text style={[styles.total, { color: c.muted }]}>
          {total > 0 ? `Score ${total.toLocaleString()}` : 'Get each ball in with as few bounces as you can'}
        </Text>
      </View>
      <View style={styles.grid}>
        {LEVELS.map((level, index) => {
          const locked = index > unlocked;
          const b = best[level.id];
          const next = index === nextUp && !locked;
          const isTut = level.id === TUTORIAL_ID;
          // The tutorial, once done, is a finished level (it has no stars: its win is guided), not a locked one.
          const looksLocked = !b && !next && !(isTut && tutorialDone);
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
                <View style={[styles.thumb, styles.lockedThumb, { height: (tile - 16) * 0.85, borderColor: c.line }]}>
                  <Text style={[styles.bigNum, { color: c.muted }]}>{index + 1}</Text>
                  <Text style={styles.lockIcon}>🔒</Text>
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
                <Text style={[styles.best, styles.lockedNote, { color: c.muted }]}>Par {level.par}</Text>
              ) : isTut && !b ? (
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
                    {b ? `best ${b.bounces}, par ${level.par}` : `par ${level.par}`}
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
                <View style={styles.world}>
                  <Text style={[styles.worldName, { color: c.ink }]}>World {WORLDS.indexOf(world) + 1} · {world.name}</Text>
                  <Text style={[styles.worldBlurb, { color: c.muted }]}>{world.blurb}</Text>
                </View>
              )}
              <View>
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
  world: { width: '100%', marginTop: 8, gap: 1 },
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
  lockedThumb: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  bigNum: { fontSize: 46, fontFamily: FONTS.condensedBold },
  lockIcon: { position: 'absolute', bottom: 8, right: 10, fontSize: 18, opacity: 0.7 },
  lockedNote: { paddingHorizontal: 4, paddingBottom: 2 },
  stars: { fontSize: 17, letterSpacing: 1 },
  tutorialDone: { fontSize: 16, fontFamily: FONTS.condensedBold },
  version: { marginTop: 8, textAlign: 'center', fontSize: 12, fontFamily: FONTS.body },
});
