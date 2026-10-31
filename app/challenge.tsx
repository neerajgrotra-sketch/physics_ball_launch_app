import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTips } from '../components/coach/Tips';
import { useProgress } from '../components/progress/ProgressProvider';
import { TourScene } from '../components/tour/TourScene';
import { shotScene } from '../components/tour/scenes';
import { TUTORIAL_ID } from '../game/coach';
import { WEB_GUEST_KEY, challengeBounces, readChallenge, senderName } from '../game/challenge';
import { WORLD } from '../physics';
import { LEVELS } from '../levels';
import { FONTS, useColors } from '../theme/colors';
import { LevelGame } from './level/[id]';

/**
 * A friend's challenge, opened from a "Challenge a friend" link (/challenge?l=…&s=…&n=…, game/challenge.ts): first who sent it and
 * what to beat, with the sender's own winning shot playing on the real level (shotScene), then the level in the normal game
 * (challenge mode), whatever the player has unlocked. The sender's shot is re-run here to get its bounces, so a link can't claim a
 * score it didn't make. On the web a newcomer gets this one level: after it, the way on is the app (app/get.tsx), not the web game.
 */
export default function ChallengeScreen() {
  const params = useLocalSearchParams<{ l?: string; s?: string; n?: string }>();
  const c = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { best, frontier } = useProgress();
  const { tutorialDone } = useTips();
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(0);
  const found = useMemo(() => {
    const ch = readChallenge(params);
    if (!ch || ch.levelId === TUTORIAL_ID) return null;
    const bounces = challengeBounces(ch.level, ch.shot);
    return bounces == null ? null : { ...ch, bounces };
  }, [params.l, params.s, params.n]); // eslint-disable-line react-hooks/exhaustive-deps
  const who = found ? senderName(found.from, true) : '';
  const scene = useMemo(() => (found ? shotScene(found.level, found.shot, who) : null), [found, who]);

  // A browser that has never played (no wins, no tutorial) and arrives by a challenge is a guest: it gets the challenge, and the
  // levels screen then sends it to the app (app/index.tsx). A browser already playing the web game (the owner testing) is left alone.
  const web = Platform.OS === 'web';
  const newcomer = web && Object.keys(best).length === 0 && frontier === 0 && !tutorialDone;
  useEffect(() => {
    if (newcomer) AsyncStorage.setItem(WEB_GUEST_KEY, '1').catch(() => {});
  }, [newcomer]);

  if (!found || !scene) {
    return (
      <View style={[styles.wrap, { backgroundColor: c.panel }]}>
        <Stack.Screen options={{ title: 'Challenge' }} />
        <Text style={[styles.title, { color: c.ink }]}>This challenge link doesn’t work</Text>
        <Text style={[styles.body, { color: c.muted }]}>It may have been cut short when it was copied. Ask for it again.</Text>
        <Pressable onPress={() => router.replace(web ? '/get' : '/')} accessibilityRole="button" style={[styles.go, { backgroundColor: c.red }]}>
          <Text style={styles.goText}>{web ? 'Get Bank Shot' : 'Play Bank Shot'}</Text>
        </Pressable>
      </View>
    );
  }

  const index = LEVELS.indexOf(found.level);
  if (!started) {
    const sceneW = Math.min(width - 40, 360);
    return (
      <ScrollView style={{ backgroundColor: c.panel }} contentContainerStyle={styles.wrap}>
        <Stack.Screen options={{ title: 'Challenge' }} />
        <Text style={[styles.kicker, { color: c.red }]}>⚔️ A CHALLENGE FROM {who.toUpperCase()}</Text>
        <Text style={[styles.title, { color: c.ink }]}>{who} got “{found.level.name}” in {found.bounces} bounce{found.bounces === 1 ? '' : 's'}. Here’s the shot:</Text>
        <View style={[styles.scene, { borderColor: c.line, backgroundColor: c.paper }]}>
          <TourScene scene={scene} view={{ top: 0, height: WORLD.height }} width={sceneW} />
        </View>
        <Text style={[styles.big, { color: c.pencil }]}>Can you do it in fewer?</Text>
        <Text style={[styles.body, { color: c.muted }]}>
          Place your own bars and aim the cannon. The ball has to bounce off every bar and land in the glass, in fewer than {found.bounces} bounces.
        </Text>
        <Pressable onPress={() => setStarted(true)} accessibilityRole="button" style={[styles.go, { backgroundColor: c.red }]}>
          <Text style={styles.goText}>Take the challenge</Text>
        </Pressable>
        {web && <Text style={[styles.small, { color: c.muted }]}>Free, right here in your browser. No sign-up.</Text>}
      </ScrollView>
    );
  }
  // After the challenge: on the web, the app; in the app, the rest of the game.
  const next = web ? { label: '📲 Get the app', go: () => router.push('/get') } : { label: '🎮 Play all levels', go: () => router.replace('/') };
  return (
    <LevelGame
      key={round} level={found.level} index={index} guide={false} onReplay={() => setRound((r) => r + 1)}
      challenge={{ from: found.from, bounces: found.bounces, shot: found.shot, next }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  scene: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  kicker: { fontSize: 15, fontFamily: FONTS.condensedBold, letterSpacing: 2, textAlign: 'center' },
  title: { fontSize: 24, lineHeight: 29, fontFamily: FONTS.condensedBold, textAlign: 'center', maxWidth: 400 },
  big: { fontSize: 24, fontFamily: FONTS.condensedBold, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 21, fontFamily: FONTS.bodyMedium, textAlign: 'center', maxWidth: 360 },
  go: { marginTop: 4, height: 52, paddingHorizontal: 34, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  goText: { color: '#fff', fontSize: 21, fontFamily: FONTS.condensedBold },
  small: { fontSize: 13, fontFamily: FONTS.body, textAlign: 'center' },
});
