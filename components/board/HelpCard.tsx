import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AimHint } from '../../game/help';
import { FONTS, useColors } from '../../theme/colors';

/**
 * What Solve opens: a hint (the next bar placed where the solution has it), the answer's launch angle, its launch power, or the full
 * solution, each behind a rewarded ad (components/ads). `hintBar` is the bar number the hint would place, or null when every bar is
 * already in place; `aim` says which of the angle and power hints are left (game/help.ts aimHints: not once the aim already matches).
 */
export function HelpCard({ hintBar, aim, onHint, onAim, onSolve, onClose }: {
  hintBar: number | null; aim: Record<AimHint, boolean>; onHint: () => void; onAim: (which: AimHint) => void; onSolve: () => void; onClose: () => void;
}) {
  const c = useColors();
  return (
    <View accessibilityRole="alert" style={[styles.card, { backgroundColor: c.paper, borderColor: c.pencil }]}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={styles.close}>
        <Text style={[styles.closeText, { color: c.muted }]}>✕</Text>
      </Pressable>
      <Text style={[styles.title, { color: c.pencil }]}>Stuck?</Text>
      {hintBar != null && (
        <Pressable onPress={onHint} accessibilityRole="button" style={[styles.btn, { backgroundColor: c.pencil }]}>
          <Text style={[styles.btnText, { color: '#fff' }]}>Hint: place Bar {hintBar}</Text>
          <Text style={[styles.ad, { color: '#fff' }]}>▶︎ Ad</Text>
        </Pressable>
      )}
      {(aim.angle || aim.power) && (
        <View style={styles.row}>
          {(['angle', 'power'] as const).filter((w) => aim[w]).map((w) => (
            <Pressable key={w} onPress={() => onAim(w)} accessibilityRole="button" style={[styles.btn, styles.half, styles.outline, { borderColor: c.pencil }]}>
              <Text style={[styles.btnText, { color: c.pencil }]}>{w === 'angle' ? 'Hint: angle' : 'Hint: power'}</Text>
              <Text style={[styles.ad, { color: c.pencil }]}>▶︎ Ad</Text>
            </Pressable>
          ))}
        </View>
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
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, paddingHorizontal: 8, gap: 6 },
  btnText: { fontSize: 18, fontFamily: FONTS.condensedBold },
  ad: { fontSize: 13, fontFamily: FONTS.bodySemi, opacity: 0.85 },
  note: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.body, textAlign: 'center' },
});
