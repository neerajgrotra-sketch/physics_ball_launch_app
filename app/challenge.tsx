import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { TourScene } from '../components/tour/TourScene';
import { TUTORIAL_ID } from '../game/coach';
import { challengeBounces, readChallenge, senderName } from '../game/challenge';
import { LEVELS } from '../levels';
import { FONTS, useColors } from '../theme/colors';
import { LevelGame } from './level/[id]';

/**
 * A friend's challenge, opened from a "Challenge a friend" link (/challenge?l=…&s=…&n=…, game/challenge.ts): first a card saying who
 * sent it and what to beat, then the level in the normal game (challenge mode), whatever the player has unlocked. The sender's shot
 * is re-run here to get its bounces, so a link can't claim a score it didn't make. Start over gives a clean slate, like a level.
 */
export default function ChallengeScreen() {
  const params = useLocalSearchParams<{ l?: string; s?: string; n?: string }>();
  const c = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(0);
  const found = useMemo(() => {
    const ch = readChallenge(params);
    if (!ch || ch.levelId === TUTORIAL_ID) return null;
    const bounces = challengeBounces(ch.level, ch.shot);
    return bounces == null ? null : { ...ch, bounces };
  }, [params.l, params.s, params.n]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!found) {
    return (
      <View style={[styles.wrap, { backgroundColor: c.panel }]}>
        <Stack.Screen options={{ title: 'Challenge' }} />
        <Text style={[styles.title, { color: c.ink }]}>This challenge link doesn’t work</Text>
        <Text style={[styles.body, { color: c.muted }]}>It may have been cut short when it was copied. Ask for it again, or play the levels.</Text>
        <Pressable onPress={() => router.replace('/')} accessibilityRole="button" style={[styles.go, { backgroundColor: c.red }]}>
          <Text style={styles.goText}>Play Bank Shot</Text>
        </Pressable>
      </View>
    );
  }

  const index = LEVELS.indexOf(found.level);
  const who = senderName(found.from, true);
  // First what the game is, for a friend who has never seen it: who sent it and what to beat, the tour's live "goal" scene (a shot
  // that misses a bar, a nudge of power, then the shot that goes in off every bar: components/tour), and three lines of how to play.
  if (!started) {
    const sceneW = Math.min(width - 48, 380);
    return (
      <ScrollView style={{ backgroundColor: c.panel }} contentContainerStyle={styles.wrap}>
        <Stack.Screen options={{ title: 'Challenge' }} />
        <Text style={[styles.kicker, { color: c.red }]}>⚔️ A CHALLENGE FROM {who.toUpperCase()}</Text>
        <Text style={[styles.title, { color: c.ink }]}>{who} got level {index + 1}, “{found.level.name}”, in {found.bounces} bounce{found.bounces === 1 ? '' : 's'}.</Text>
        <Text style={[styles.big, { color: c.pencil }]}>Can you do it in fewer?</Text>
        <View style={[styles.scene, { borderColor: c.line, backgroundColor: c.paper }]}>
          <TourScene kind="goal" width={sceneW} />
        </View>
        <Text style={[styles.what, { color: c.ink }]}>Bank Shot is a bounce puzzle.</Text>
        <View style={styles.steps}>
          {[
            ['📐', 'Place the bars anywhere and aim the cannon.'],
            ['🏀', 'Bounce the ball off every bar and into the glass.'],
            ['🏆', `Fewer bounces wins. Beat ${found.bounces} to beat ${found.from || 'your friend'}.`],
          ].map(([icon, text]) => (
            <View key={icon} style={styles.step}>
              <Text style={styles.icon}>{icon}</Text>
              <Text style={[styles.stepText, { color: c.ink }]}>{text}</Text>
            </View>
          ))}
        </View>
        <Pressable onPress={() => setStarted(true)} accessibilityRole="button" style={[styles.go, { backgroundColor: c.red }]}>
          <Text style={styles.goText}>Take the challenge</Text>
        </Pressable>
        <Text style={[styles.small, { color: c.muted }]}>Free, right here in your browser. No download, no sign-up.</Text>
      </ScrollView>
    );
  }
  return (
    <LevelGame
      key={round} level={found.level} index={index} guide={false} onReplay={() => setRound((r) => r + 1)}
      challenge={{ from: found.from, bounces: found.bounces, shot: found.shot }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  scene: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginVertical: 4 },
  what: { fontSize: 19, fontFamily: FONTS.condensedBold, textAlign: 'center' },
  steps: { gap: 8, width: '100%', maxWidth: 360, alignSelf: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 20, width: 28, textAlign: 'center' },
  stepText: { flex: 1, fontSize: 15, lineHeight: 20, fontFamily: FONTS.bodyMedium },
  small: { fontSize: 13, fontFamily: FONTS.body, textAlign: 'center' },
  kicker: { fontSize: 15, fontFamily: FONTS.condensedBold, letterSpacing: 2 },
  title: { fontSize: 26, lineHeight: 31, fontFamily: FONTS.condensedBold, textAlign: 'center', maxWidth: 420 },
  big: { fontSize: 22, fontFamily: FONTS.bodySemi, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 21, fontFamily: FONTS.bodyMedium, textAlign: 'center', maxWidth: 380 },
  go: { marginTop: 10, height: 52, paddingHorizontal: 34, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  goText: { color: '#fff', fontSize: 21, fontFamily: FONTS.condensedBold },
});
