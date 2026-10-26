import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { WinText } from '../../game/progress';
import { FONTS, useColors } from '../../theme/colors';

/**
 * The prototype's #win card. It sits at the top of the board so the winning path stays visible.
 * ✕ (or any edit to the board) closes it and goes back to playing (onClose).
 */
export function WinCard({ text, onAgain, onGo, onClose, onStar }: { text: WinText; onAgain: () => void; onGo: () => void; onClose: () => void; onStar?: (k: number) => void }) {
  const c = useColors();
  // Each earned star pops in, one after the other (with a note each); the unearned ones are simply there.
  const pops = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    pops.forEach((v, k) => {
      if (k >= (text.score != null ? text.stars : 0)) { v.setValue(1); return; }
      timers.push(setTimeout(() => {
        onStar?.(k);
        Animated.spring(v, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
      }, 150 + k * 230));
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.card, { backgroundColor: c.paper, borderColor: c.red }]}
    >
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Keep playing" hitSlop={10} style={styles.close}>
        <Text style={[styles.closeText, { color: c.muted }]}>✕</Text>
      </Pressable>
      <Text style={[styles.title, { color: c.red }]}>{text.title}</Text>
      {text.score != null && (
        <View style={styles.result} accessibilityLabel={`${text.stars} of 3 stars, ${text.score} points`}>
          <Text style={styles.stars}>
            {[0, 1, 2].map((k) => (
              <Animated.Text key={k} style={{ color: k < text.stars ? c.red : c.line, transform: [{ scale: pops[k].interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }], opacity: pops[k] }}>★</Animated.Text>
            ))}
          </Text>
          <Text style={[styles.score, { color: c.ink }]}>+{text.score}</Text>
        </View>
      )}
      <Text style={[styles.detail, text.next && styles.detailTight, { color: c.muted }]}>{text.detail}</Text>
      {text.next && <Text style={[styles.next, { color: c.pencil, backgroundColor: c.panel }]}>{text.next}</Text>}
      <View style={styles.btns}>
        <Pressable onPress={onAgain} accessibilityRole="button" style={[styles.ghost, { borderColor: c.line }]}>
          <Text style={[styles.ghostText, { color: c.muted }]}>{text.again}</Text>
        </Pressable>
        <Pressable onPress={onGo} accessibilityRole="button" style={[styles.go, { backgroundColor: c.red }]}>
          <Text style={styles.goText}>{text.go}</Text>
        </Pressable>
      </View>
      <Text style={[styles.more, { color: c.muted }]}>Move a bar or aim to keep playing</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  close: { position: 'absolute', top: 6, right: 10, padding: 4, zIndex: 1 },
  closeText: { fontSize: 18, fontFamily: FONTS.bodySemi },
  more: { marginTop: 8, fontSize: 12, fontFamily: FONTS.body },
  card: {
    position: 'absolute', top: 10, left: 22, right: 22,
    paddingVertical: 12, paddingHorizontal: 14, borderWidth: 2, borderRadius: 10, alignItems: 'center',
    boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
  },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  stars: { flexDirection: 'row', fontSize: 30, lineHeight: 34, letterSpacing: 2 },
  score: { fontSize: 22, fontFamily: FONTS.condensedBold },
  title: { fontSize: 28, lineHeight: 30, fontFamily: FONTS.condensedBold, marginBottom: 4, textAlign: 'center' },
  detail: { fontSize: 15, fontFamily: FONTS.body, marginBottom: 12 },
  detailTight: { marginBottom: 8 },
  next: {
    fontSize: 15, lineHeight: 20, fontFamily: FONTS.bodySemi, textAlign: 'center', marginBottom: 12,
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, overflow: 'hidden',
  },
  btns: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  ghost: { height: 38, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1.5, justifyContent: 'center' },
  ghostText: { fontSize: 14, fontFamily: FONTS.bodyMedium },
  go: { height: 40, paddingHorizontal: 18, borderRadius: 20, justifyContent: 'center' },
  goText: { color: '#fff', fontSize: 15, fontFamily: FONTS.bodySemi },
});
