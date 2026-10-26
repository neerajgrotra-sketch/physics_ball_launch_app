import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PROFILE_KEY, parseProfile } from '../../game/profile';
import { TOUR, withName } from '../../game/tour';
import { FONTS, useColors } from '../../theme/colors';
import { TourPicture } from './TourPicture';

/**
 * The guided tour (game/tour.ts): a full-screen run of short pages between the intro and the first level. Next / Back or a swipe moves
 * between them, Skip leaves at any time, and the last page hands over to the tutorial level ("Learn the ropes") or straight to the levels.
 */
export function Tour({ onStartTutorial, onSkip }: { onStartTutorial: () => void; onSkip: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const last = page === TOUR.length - 1;
  const p = TOUR[page];

  // First the tour asks what to call the player (unless Settings already has a name), and uses it from then on. The name is saved in
  // the "About you" profile (game/profile.ts), on this device only.
  const [name, setName] = useState('');
  const [asking, setAsking] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((raw) => {
      const saved = parseProfile(raw).name;
      setName(saved);
      setAsking(!saved);
    }).catch(() => setAsking(true));
  }, []);
  const keepName = async (given: string) => {
    const clean = given.trim().slice(0, 40);
    setName(clean);
    setAsking(false);
    if (!clean) return;
    const raw = await AsyncStorage.getItem(PROFILE_KEY).catch(() => null);
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ ...parseProfile(raw), name: clean })).catch(() => {});
  };
  const say = (text: string) => withName(text, name);

  // Each page fades and slides in from the side it came from.
  const shown = useRef(new Animated.Value(1)).current;
  const from = useRef(1);
  useEffect(() => {
    shown.setValue(0);
    Animated.timing(shown, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [page, shown]);
  const go = (to: number) => {
    if (to < 0 || to >= TOUR.length) return;
    from.current = to > page ? 1 : -1;
    setPage(to);
  };

  // A sideways swipe turns the page too.
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (_, g) => {
      if (g.dx < -40) setPage((n) => { from.current = 1; return Math.min(TOUR.length - 1, n + 1); });
      else if (g.dx > 40) setPage((n) => { from.current = -1; return Math.max(0, n - 1); });
    },
  })).current;

  const picW = Math.min(width - 40, 460);
  if (asking === null) return <View style={[styles.wrap, { backgroundColor: c.panel }]} />;
  if (asking) return <NameStep onDone={keepName} onSkip={onSkip} />;
  return (
    <View style={[styles.wrap, { backgroundColor: c.panel, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 14 }]} {...swipe.panHandlers}>
      <View style={styles.top}>
        <View style={styles.dots}>
          {TOUR.map((_, k) => (
            <View key={k} style={[styles.dot, { backgroundColor: k === page ? c.red : c.line, width: k === page ? 20 : 8 }]} />
          ))}
        </View>
        {!last && (
          <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={10}>
            <Text style={[styles.skip, { color: c.muted }]}>Skip</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[styles.page, {
            opacity: shown,
            transform: [{ translateX: shown.interpolate({ inputRange: [0, 1], outputRange: [24 * from.current, 0] }) }],
          }]}
        >
          <View style={[styles.picture, { borderColor: c.line, width: picW }]}>
            <TourPicture kind={p.picture} width={picW - 4} />
          </View>
          <Text style={[styles.kicker, { color: c.red }]}>{say(p.kicker).toUpperCase()}</Text>
          <Text style={[styles.title, { color: c.ink }]}>{say(p.title)}</Text>
          <Text style={[styles.body, { color: c.ink }]}>{say(p.body)}</Text>
          {p.points && (
            <View style={styles.points}>
              {p.points.map((pt) => (
                <View key={pt} style={styles.point}>
                  <View style={[styles.bullet, { backgroundColor: c.pencil }]} />
                  <Text style={[styles.pointText, { color: c.ink }]}>{pt}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {last ? (
        <View style={styles.finish}>
          <Pressable onPress={onStartTutorial} accessibilityRole="button" style={[styles.primary, { backgroundColor: c.red }]}>
            <Text style={styles.primaryText}>Start “Learn the ropes” ›</Text>
          </Pressable>
          <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.secondary, { color: c.muted }]}>Skip to the levels</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.nav}>
          <Pressable
            onPress={() => go(page - 1)} disabled={page === 0} accessibilityRole="button"
            style={[styles.back, { borderColor: c.line, opacity: page === 0 ? 0 : 1 }]}
          >
            <Text style={[styles.backText, { color: c.muted }]}>‹ Back</Text>
          </Pressable>
          <Pressable onPress={() => go(page + 1)} accessibilityRole="button" style={[styles.next, { backgroundColor: c.pencil }]}>
            <Text style={styles.primaryText}>{page === 0 ? 'Show me how ›' : 'Next ›'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** The tour's first step: "What should we call you?". The name is optional; Skip leaves the tour altogether, like Skip on any page. */
function NameStep({ onDone, onSkip }: { onDone: (name: string) => void; onSkip: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const ready = text.trim().length > 0;
  return (
    <View style={[styles.wrap, { backgroundColor: c.panel, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 14 }]}>
      <View style={[styles.top, { justifyContent: 'flex-end' }]}>
        <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={10}>
          <Text style={[styles.skip, { color: c.muted }]}>Skip</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.page}>
          <Text style={[styles.kicker, { color: c.red }]}>HELLO!</Text>
          <Text style={[styles.title, { color: c.ink }]}>What should we call you?</Text>
          <Text style={[styles.body, { color: c.muted }]}>Just a first name or a nickname. It stays on this phone.</Text>
          <TextInput
            value={text} onChangeText={(t) => setText(t.slice(0, 40))}
            placeholder="Your name" placeholderTextColor={c.muted} autoFocus autoCapitalize="words" autoCorrect={false}
            returnKeyType="next" onSubmitEditing={() => ready && onDone(text)}
            style={[styles.nameInput, { borderColor: c.pencil, color: c.ink, backgroundColor: c.paper }]}
            accessibilityLabel="Your name"
          />
        </View>
      </ScrollView>
      <View style={styles.finish}>
        <Pressable
          onPress={() => onDone(text)} disabled={!ready} accessibilityRole="button"
          style={[styles.primary, { backgroundColor: c.pencil, opacity: ready ? 1 : 0.4 }]}
        >
          <Text style={styles.primaryText}>{ready ? `Nice to meet you, ${text.trim().split(/\s+/)[0]} ›` : 'Continue ›'}</Text>
        </Pressable>
        <Pressable onPress={() => onDone('')} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.secondary, { color: c.muted }]}>Continue without a name</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nameInput: {
    alignSelf: 'stretch', maxWidth: 460, width: '100%', height: 56, borderWidth: 2, borderRadius: 14, paddingHorizontal: 16, marginTop: 14,
    fontSize: 22, fontFamily: FONTS.bodySemi, textAlign: 'center',
  },
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, paddingHorizontal: 20 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 36 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
  skip: { fontSize: 16, fontFamily: FONTS.bodySemi },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 10 },
  page: { alignItems: 'center', gap: 8 },
  picture: { borderWidth: 1.5, borderRadius: 14, overflow: 'hidden', alignItems: 'center', marginBottom: 10 },
  kicker: { fontSize: 13, letterSpacing: 1.5, fontFamily: FONTS.bodySemi },
  title: { fontSize: 34, lineHeight: 38, fontFamily: FONTS.condensedBold, textAlign: 'center' },
  body: { fontSize: 17, lineHeight: 24, fontFamily: FONTS.body, textAlign: 'center', maxWidth: 460 },
  points: { gap: 8, marginTop: 6, alignSelf: 'stretch', maxWidth: 460, width: '100%' },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bullet: { width: 8, height: 8, borderRadius: 4 },
  pointText: { flex: 1, fontSize: 16, lineHeight: 21, fontFamily: FONTS.bodyMedium },
  nav: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  back: { height: 50, paddingHorizontal: 18, borderRadius: 25, borderWidth: 1.5, justifyContent: 'center' },
  backText: { fontSize: 17, fontFamily: FONTS.bodySemi },
  next: { flex: 1, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  finish: { gap: 14, alignItems: 'center' },
  primary: { alignSelf: 'stretch', height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 20, fontFamily: FONTS.condensedBold },
  secondary: { fontSize: 16, fontFamily: FONTS.bodySemi },
});
