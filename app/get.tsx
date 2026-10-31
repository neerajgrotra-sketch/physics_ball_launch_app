import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { APP_STORE_URL, PLAY_STORE_URL } from '../game/challenge';
import { LEVELS } from '../levels';
import { FONTS, useColors } from '../theme/colors';

/**
 * Get the app: where a web visitor who came through a challenge goes once they've played it (and if they try the levels screen).
 * The full game, the daily puzzle and challenges are in the iPhone and Android apps; until they're listed (game/challenge.ts
 * APP_STORE_URL, PLAY_STORE_URL) the buttons say "coming soon". "Back to the challenge" returns to the level they came from.
 */
export default function GetApp() {
  const c = useColors();
  const router = useRouter();
  const store = (label: string, url: string | null) => (
    <Pressable
      key={label} disabled={!url} onPress={() => url && Linking.openURL(url)} accessibilityRole="button"
      style={[styles.store, { backgroundColor: url ? c.ink : 'transparent', borderColor: c.ink, opacity: url ? 1 : 0.55 }]}
    >
      <Text style={[styles.storeText, { color: url ? c.paper : c.ink }]}>{label}</Text>
      {!url && <Text style={[styles.soon, { color: c.muted }]}>coming soon</Text>}
    </Pressable>
  );
  return (
    <View style={[styles.wrap, { backgroundColor: c.panel }]}>
      <Image source={require('../assets/splash-icon.png')} style={styles.icon} />
      <Text style={[styles.title, { color: c.ink }]}>Get Bank Shot</Text>
      <Text style={[styles.body, { color: c.ink }]}>That was one level. The app has all {LEVELS.length} across five worlds, a new puzzle every day, and challenges for your friends.</Text>
      <Text style={[styles.free, { color: c.pencil }]}>Free on iPhone and Android.</Text>
      {store('App Store', APP_STORE_URL)}
      {store('▶ Google Play', PLAY_STORE_URL)}
      {router.canGoBack() && (
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.back, { color: c.muted }]}>‹ Back to the challenge</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  icon: { width: 110, height: 110 },
  title: { fontSize: 36, fontFamily: FONTS.condensedBold },
  body: { fontSize: 16, lineHeight: 23, fontFamily: FONTS.bodyMedium, textAlign: 'center', maxWidth: 360 },
  free: { fontSize: 17, fontFamily: FONTS.bodySemi },
  store: { width: 240, height: 54, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  storeText: { fontSize: 20, fontFamily: FONTS.condensedBold },
  soon: { fontSize: 12, fontFamily: FONTS.body, marginTop: -2 },
  back: { marginTop: 8, fontSize: 15, fontFamily: FONTS.bodySemi },
});
