import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AD_REWARD, PACKS } from '../../game/wallet';
import { FONTS, useColors } from '../../theme/colors';
import { useHintWallet } from './HintWallet';

/**
 * The hint shop: the balance, a free "watch an ad" offer, and three packs. Real payments need the App Store and Play Store builds
 * (in-app purchases through RevenueCat, see BACKLOG.md); until then tapping a pack only says purchases aren't active yet, and gives
 * nothing.
 */
export function Shop({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const { hints, watchAd } = useHintWallet();
  // "Purchases aren't active yet", shown in the shop (a message over the game would sit behind it) for a few seconds after a pack tap.
  const [notActive, setNotActive] = useState(0);
  useEffect(() => {
    if (!notActive) return;
    const t = setTimeout(() => setNotActive(0), 3500);
    return () => clearTimeout(t);
  }, [notActive]);
  useEffect(() => { if (!visible) setNotActive(0); }, [visible]);
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
            {notActive > 0 && (
              <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.notice, { borderColor: c.red }]}>
                <Text style={[styles.noticeTitle, { color: c.red }]}>Purchases not activated yet</Text>
                <Text style={[styles.noticeText, { color: c.ink }]}>Buying hints comes with the App Store and Play Store apps. Watch an ad for free hints for now.</Text>
              </View>
            )}

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
                key={p.id} onPress={() => setNotActive((n) => n + 1)} accessibilityRole="button"
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
  notice: { borderWidth: 2, borderRadius: 12, padding: 12, gap: 4 },
  noticeTitle: { fontSize: 18, fontFamily: FONTS.condensedBold, textAlign: 'center' },
  noticeText: { fontSize: 14, lineHeight: 19, fontFamily: FONTS.body, textAlign: 'center' },
  note: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.body, textAlign: 'center' },
});
