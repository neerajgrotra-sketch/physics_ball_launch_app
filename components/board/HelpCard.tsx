import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AD_REWARD } from '../../game/wallet';
import { FONTS, useColors } from '../../theme/colors';

/**
 * What Solve opens: a hint (the answer's next step: each bar in turn, then the launch angle, then the launch power; game/help.ts) or
 * the full solution, each paid from the player's hints (game/wallet.ts), with the balance and each cost shown. `hint` is the Hint
 * button (label and cost), or null when every step already matches. When there aren't enough hints for what's offered, the card
 * also offers an ad for a few more and the shop; an option that can't be afforded opens the shop.
 */
export function HelpCard({ hint, solutionCost, hints, note, onHint, onSolve, onAd, onShop, onClose }: {
  hint: { label: string; cost: number } | null; solutionCost: number; hints: number;
  /** What help costs in stars on this level, shown under the buttons. */
  note: string;
  onHint: () => void; onSolve: () => void; onAd: () => void; onShop: () => void; onClose: () => void;
}) {
  const c = useColors();
  const short = hints < (hint?.cost ?? solutionCost);
  const canHint = hint != null && hints >= hint.cost;
  const canSolve = hints >= solutionCost;
  return (
    <View accessibilityRole="alert" style={[styles.card, { backgroundColor: c.paper, borderColor: c.pencil }]}>
      <Pressable onPress={onShop} accessibilityRole="button" accessibilityLabel={`You have ${hints} hints. Open the shop`} style={[styles.balance, { borderColor: c.pencil }]}>
        <Text style={[styles.balanceText, { color: c.pencil }]}>💡 {hints}</Text>
      </Pressable>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={styles.close}>
        <Text style={[styles.closeText, { color: c.muted }]}>✕</Text>
      </Pressable>
      <Text style={[styles.title, { color: c.pencil }]}>Stuck?</Text>
      {hint != null && (
        <Pressable
          onPress={canHint ? onHint : onShop} accessibilityRole="button"
          style={[styles.btn, { backgroundColor: c.pencil, opacity: canHint ? 1 : 0.45 }]}
        >
          <Text style={[styles.btnText, { color: '#fff' }]}>{hint.label}</Text>
          <Text style={[styles.cost, { color: '#fff' }]}>💡{hint.cost}</Text>
        </Pressable>
      )}
      <Pressable
        onPress={canSolve ? onSolve : onShop} accessibilityRole="button"
        style={[styles.btn, styles.outline, { borderColor: c.red, opacity: canSolve ? 1 : 0.45 }]}
      >
        <Text style={[styles.btnText, { color: c.red }]}>Show the full solution</Text>
        <Text style={[styles.cost, { color: c.red }]}>💡{solutionCost}</Text>
      </Pressable>
      {short ? (
        <View style={styles.row}>
          <Pressable onPress={onAd} accessibilityRole="button" style={[styles.btn, styles.half, styles.outline, { borderColor: c.pencil }]}>
            <Text style={[styles.smallText, { color: c.pencil }]}>▶︎ Ad: +{AD_REWARD} 💡</Text>
          </Pressable>
          <Pressable onPress={onShop} accessibilityRole="button" style={[styles.btn, styles.half, styles.outline, { borderColor: c.pencil }]}>
            <Text style={[styles.smallText, { color: c.pencil }]}>Get more hints</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onShop} accessibilityRole="button" hitSlop={6}>
          <Text style={[styles.link, { color: c.pencil }]}>Get more hints</Text>
        </Pressable>
      )}
      <Text style={[styles.note, { color: c.muted }]}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute', top: 10, left: 22, right: 22, gap: 10,
    paddingVertical: 14, paddingHorizontal: 16, borderWidth: 2, borderRadius: 10, alignItems: 'stretch',
    boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
  },
  balance: { position: 'absolute', top: 10, left: 12, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 2, zIndex: 1 },
  balanceText: { fontSize: 15, fontFamily: FONTS.condensedBold },
  close: { position: 'absolute', top: 6, right: 10, padding: 4, zIndex: 1 },
  closeText: { fontSize: 18, fontFamily: FONTS.bodySemi },
  title: { fontSize: 26, lineHeight: 28, fontFamily: FONTS.condensedBold, textAlign: 'center' },
  btn: { height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  outline: { borderWidth: 2 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, height: 42, paddingHorizontal: 8 },
  btnText: { fontSize: 18, fontFamily: FONTS.condensedBold },
  smallText: { fontSize: 16, fontFamily: FONTS.condensedBold },
  cost: { fontSize: 14, fontFamily: FONTS.bodySemi, opacity: 0.9 },
  link: { fontSize: 15, fontFamily: FONTS.bodySemi, textAlign: 'center', textDecorationLine: 'underline' },
  note: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.body, textAlign: 'center' },
});
