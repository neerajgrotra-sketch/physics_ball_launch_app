import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WinText } from '../../game/progress';
import { FONTS, useColors } from '../../theme/colors';

/** The prototype's #win card. It sits at the top of the board so the winning path stays visible. */
export function WinCard({ text, onAgain, onGo }: { text: WinText; onAgain: () => void; onGo: () => void }) {
  const c = useColors();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.card, { backgroundColor: c.paper, borderColor: c.red }]}
    >
      <Text style={[styles.title, { color: c.red }]}>{text.title}</Text>
      <Text style={[styles.detail, { color: c.muted }]}>{text.detail}</Text>
      <View style={styles.btns}>
        <Pressable onPress={onAgain} accessibilityRole="button" style={[styles.ghost, { borderColor: c.line }]}>
          <Text style={[styles.ghostText, { color: c.muted }]}>{text.again}</Text>
        </Pressable>
        <Pressable onPress={onGo} accessibilityRole="button" style={[styles.go, { backgroundColor: c.red }]}>
          <Text style={styles.goText}>{text.go}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute', top: 10, left: 22, right: 22,
    paddingVertical: 12, paddingHorizontal: 14, borderWidth: 2, borderRadius: 10, alignItems: 'center',
    boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
  },
  title: { fontSize: 22, lineHeight: 24, fontFamily: FONTS.condensedBold, marginBottom: 4, textAlign: 'center' },
  detail: { fontSize: 15, fontFamily: FONTS.body, marginBottom: 12 },
  btns: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  ghost: { height: 38, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1.5, justifyContent: 'center' },
  ghostText: { fontSize: 14, fontFamily: FONTS.bodyMedium },
  go: { height: 40, paddingHorizontal: 18, borderRadius: 20, justifyContent: 'center' },
  goText: { color: '#fff', fontSize: 15, fontFamily: FONTS.bodySemi },
});
