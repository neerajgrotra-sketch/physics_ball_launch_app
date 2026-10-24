import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS, useColors } from '../../theme/colors';

/**
 * A near miss explained, as a card over the top of the board like the win card (so it can't be missed):
 * e.g. the ball landed in the glass but skipped a bar. OK, or any edit or launch, closes it.
 */
export function NoticeCard({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  const c = useColors();
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.card, { backgroundColor: c.paper, borderColor: c.pencil }]}>
      <Text style={[styles.title, { color: c.pencil }]}>{title}</Text>
      <Text style={[styles.message, { color: c.ink }]}>{message}</Text>
      <Pressable onPress={onClose} accessibilityRole="button" style={[styles.ok, { backgroundColor: c.pencil }]}>
        <Text style={styles.okText}>OK</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute', top: 10, left: 22, right: 22,
    paddingVertical: 12, paddingHorizontal: 16, borderWidth: 2, borderRadius: 10, alignItems: 'center',
    boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
  },
  title: { fontSize: 24, lineHeight: 26, fontFamily: FONTS.condensedBold, marginBottom: 4 },
  message: { fontSize: 16, lineHeight: 22, fontFamily: FONTS.bodyMedium, textAlign: 'center', marginBottom: 12 },
  ok: { height: 40, paddingHorizontal: 28, borderRadius: 20, justifyContent: 'center' },
  okText: { color: '#fff', fontSize: 15, fontFamily: FONTS.bodySemi },
});
