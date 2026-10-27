import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AD_REWARD, PACKS } from '../../game/wallet';
import { FONTS, useColors } from '../../theme/colors';
import { useHintWallet } from './HintWallet';

/**
 * The hint shop: the balance, a free "watch an ad" offer, and three packs. Real payments need the App Store and Play Store builds
 * (in-app purchases through RevenueCat, see BACKLOG.md); until then a pack is a clearly marked test that just adds the hints, so the
 * whole flow can be tried.
 */
export function Shop({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const { hints, watchAd, give } = useHintWallet();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close the shop">
        <Pressable style={[styles.sheet, { backgroundColor: c.paper, borderColor: c.line }]} onPress={() => {}}>
          <ScrollView contentContainerStyle={styles.body}>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={styles.close}>
              <Text style={[styles.closeText, { color: c.muted }]}>✕</Text>
            </Pressable>
            <Text style={[styles.title, { color: c.ink }]}>Hints</Text>
            <View style={[styles.balance, { borderColor: c.pencil }]}>
              <Text style={[styles.balanceText, { color: c.pencil }]}>You have {hints} 💡</Text>
            </View>

            <Pressable
              onPress={() => { onClose(); watchAd(); }} accessibilityRole="button"
              style={[styles.card, styles.free, { borderColor: c.pencil }]}
            >
              <Text style={[styles.cardTitle, { color: c.ink }]}>+{AD_REWARD} 💡</Text>
              <View style={[styles.buy, { backgroundColor: c.pencil }]}>
                <Text style={styles.buyText}>▶︎ Watch an ad</Text>
              </View>
            </Pressable>

            {PACKS.map((p) => (
              <Pressable
                key={p.id} onPress={() => give(p.hints, `+${p.hints} 💡 (test purchase)`)} accessibilityRole="button"
                accessibilityLabel={`${p.hints} hints for ${p.price}`}
                style={[styles.card, { borderColor: p.tag ? c.red : c.line }]}
              >
                <View style={styles.cardLeft}>
                  {p.tag && <Text style={[styles.tag, { backgroundColor: c.red }]}>{p.tag}</Text>}
                  <Text style={[styles.cardTitle, { color: c.ink }]}>{p.hints} 💡</Text>
                </View>
                <View style={[styles.buy, { backgroundColor: c.red }]}>
                  <Text style={styles.buyText}>{p.price}</Text>
                </View>
              </Pressable>
            ))}

            <Text style={[styles.note, { color: c.muted }]}>
              Test shop: real payments come with the App Store and Play Store apps. For now a tap just adds the hints.
            </Text>
            <Text style={[styles.note, { color: c.muted }]}>
              Free hints too: a daily gift, +1 for each level's first three-star win, and +5 for finishing a world.
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 14, borderWidth: 1.5, maxWidth: 420, maxHeight: '88%', width: '100%', alignSelf: 'center', overflow: 'hidden' },
  body: { padding: 20, gap: 12 },
  close: { position: 'absolute', top: 12, right: 14, padding: 4, zIndex: 1 },
  closeText: { fontSize: 18, fontFamily: FONTS.bodySemi },
  title: { fontSize: 30, fontFamily: FONTS.condensedBold, textAlign: 'center' },
  balance: { alignSelf: 'center', borderWidth: 2, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4 },
  balanceText: { fontSize: 18, fontFamily: FONTS.condensedBold },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderRadius: 12, padding: 12 },
  free: { borderStyle: 'dashed' },
  cardLeft: { gap: 4, alignItems: 'flex-start' },
  tag: { color: '#fff', fontSize: 11, fontFamily: FONTS.bodySemi, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  cardTitle: { fontSize: 24, fontFamily: FONTS.condensedBold },
  buy: { height: 40, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  buyText: { color: '#fff', fontSize: 17, fontFamily: FONTS.condensedBold },
  note: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.body, textAlign: 'center' },
});
