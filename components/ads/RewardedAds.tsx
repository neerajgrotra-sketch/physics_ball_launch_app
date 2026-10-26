import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS, useColors } from '../../theme/colors';

// Rewarded ads: the player chooses to watch one to unlock help (a bar hint, the launch angle, the launch power, or the full solution). Everything
// that shows an ad goes through useRewardedAd().show(placement), so swapping this placeholder for a real
// ad network (Google AdMob, via react-native-google-mobile-ads in a development/store build; it can't run
// in Expo Go or on the web) only changes this file.
//
// The placeholder: a full-screen "ad" with a countdown. Watching to the end earns the reward; closing it
// early doesn't. When a real ad fails to load (offline, no ad available), the help is given anyway after
// the same short wait, so a stuck player is never blocked.

/** Where an ad is shown. Each placement gets its own ad unit when real ads are wired up. */
export type Placement = 'hint' | 'angle' | 'power' | 'solve';

const PLACEHOLDER_SECONDS = 5;

interface Ads {
  /** Shows a rewarded ad. Resolves true if the player earned the reward, false if they closed it early. */
  show: (placement: Placement) => Promise<boolean>;
}

const AdsContext = createContext<Ads>({ show: async () => true });

const TITLES: Record<Placement, string> = {
  hint: 'Your hint is next', angle: 'The launch angle is next', power: 'The launch power is next', solve: 'The full solution is next',
};
const CLAIM: Record<Placement, string> = { hint: 'Show my hint', angle: 'Show the angle', power: 'Show the power', solve: 'Show the solution' };

export function RewardedAdsProvider({ children }: { children: ReactNode }) {
  const [showing, setShowing] = useState<Placement | null>(null);
  const resolve = useRef<((earned: boolean) => void) | null>(null);

  const show = useCallback((placement: Placement) => new Promise<boolean>((res) => {
    resolve.current?.(false);
    resolve.current = res;
    setShowing(placement);
  }), []);

  const close = (earned: boolean) => {
    resolve.current?.(earned);
    resolve.current = null;
    setShowing(null);
  };

  return (
    <AdsContext.Provider value={{ show }}>
      {children}
      {showing && <PlaceholderAd placement={showing} onClose={close} />}
    </AdsContext.Provider>
  );
}

export function useRewardedAd(): Ads {
  return useContext(AdsContext);
}

function PlaceholderAd({ placement, onClose }: { placement: Placement; onClose: (earned: boolean) => void }) {
  const c = useColors();
  const [left, setLeft] = useState(PLACEHOLDER_SECONDS);
  useEffect(() => {
    const timer = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  const done = left === 0;
  return (
    <Modal transparent animationType="fade" onRequestClose={() => onClose(done)}>
      <View style={[styles.screen, { backgroundColor: '#111' }]}>
        <View style={styles.top}>
          <Text style={styles.badge}>AD</Text>
          <Pressable
            onPress={() => onClose(done)} accessibilityRole="button"
            accessibilityLabel={done ? 'Close ad and get reward' : 'Close ad without reward'}
            style={styles.closeBtn} hitSlop={10}
          >
            <Text style={styles.close}>{done ? '✕' : `${left}`}</Text>
          </Pressable>
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>Ad placeholder</Text>
          <Text style={styles.note}>A real video ad plays here in the App Store and Play Store builds.</Text>
        </View>
        <View style={styles.bottom}>
          <Text style={styles.next}>{done ? `${TITLES[placement]}. Tap below.` : `${TITLES[placement]} in ${left}…`}</Text>
          <Pressable
            onPress={() => done && onClose(true)} disabled={!done} accessibilityRole="button"
            style={[styles.claim, { backgroundColor: done ? c.red : '#444' }]}
          >
            <Text style={styles.claimText}>{done ? CLAIM[placement] : 'Watching…'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, paddingTop: 54, paddingBottom: 40, justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { color: '#111', backgroundColor: '#f2c94c', fontFamily: FONTS.bodySemi, fontSize: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#888', alignItems: 'center', justifyContent: 'center' },
  close: { color: '#ddd', fontSize: 16, fontFamily: FONTS.bodySemi },
  body: { alignItems: 'center', gap: 10 },
  title: { color: '#fff', fontSize: 34, fontFamily: FONTS.condensedBold },
  note: { color: '#aaa', fontSize: 15, fontFamily: FONTS.body, textAlign: 'center', maxWidth: 300 },
  bottom: { alignItems: 'center', gap: 14 },
  next: { color: '#ddd', fontSize: 15, fontFamily: FONTS.bodyMedium },
  claim: { height: 52, alignSelf: 'stretch', borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  claimText: { color: '#fff', fontSize: 20, fontFamily: FONTS.condensedBold },
});
