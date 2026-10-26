import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS, useColors } from '../../theme/colors';

/**
 * What Solve opens: a hint (the answer's next step: each bar in turn, then the launch angle, then the launch power; game/help.ts) or
 * the full solution, each behind a rewarded ad (components/ads). `hint` is the Hint button's label, or null when every step already
 * matches the answer and only the full solution is left.
 */
export function HelpCard({ hint, onHint, onSolve, onClose }: {
  hint: string | null; onHint: () => void; onSolve: () => void; onClose: () => void;
}) {
  const c = useColors();
  return (
    <View accessibilityRole="alert" style={[styles.card, { backgroundColor: c.paper, borderColor: c.pencil }]}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={styles.close}>
        <Text style={[styles.closeText, { color: c.muted }]}>✕</Text>
      </Pressable>
      <Text style={[styles.title, { color: c.pencil }]}>Stuck?</Text>
      {hint != null && (
        <Pressable onPress={onHint} accessibilityRole="button" style={[styles.btn, { backgroundColor: c.pencil }]}>
          <Text style={[styles.btnText, { color: '#fff' }]}>{hint}</Text>
          <Text style={[styles.ad, { color: '#fff' }]}>▶︎ Ad</Text>
        </Pressable>
      )}
      <Pressable onPress={onSolve} accessibilityRole="button" style={[styles.btn, styles.outline, { borderColor: c.red }]}>
        <Text style={[styles.btnText, { color: c.red }]}>Show the full solution</Text>
        <Text style={[styles.ad, { color: c.red }]}>▶︎ Ad</Text>
      </Pressable>
      <Text style={[styles.note, { color: c.muted }]}>
        Each plays a short ad. A level won with help opens the next one but earns no stars or score.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute', top: 10, left: 22, right: 22, gap: 10,
    paddingVertical: 14, paddingHorizontal: 16, borderWidth: 2, borderRadius: 10, alignItems: 'stretch',
    boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
  },
  close: { position: 'absolute', top: 6, right: 10, padding: 4, zIndex: 1 },
  closeText: { fontSize: 18, fontFamily: FONTS.bodySemi },
  title: { fontSize: 26, lineHeight: 28, fontFamily: FONTS.condensedBold, textAlign: 'center' },
  btn: { height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  outline: { borderWidth: 2 },
  btnText: { fontSize: 18, fontFamily: FONTS.condensedBold },
  ad: { fontSize: 13, fontFamily: FONTS.bodySemi, opacity: 0.85 },
  note: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.body, textAlign: 'center' },
});
