import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AD_REWARD, WALLET_KEY, claimDaily, claimStars, claimWorld, dayOf, grant, newWallet, parseWallet, spend, type Wallet,
} from '../../game/wallet';
import { useRewardedAd } from '../ads/RewardedAds';
import { FadeToast } from '../board/FadeToast';
import { Shop } from './Shop';

// The player's hints (game/wallet.ts), saved on the device, and the shop that sells more. Solve's card spends them; wins and the daily
// gift add to them. A short message fades in over the screen whenever hints are given.

interface HintWalletState {
  hints: number;
  /** Takes n hints; false (and nothing taken) when there aren't enough. */
  spend: (n: number) => boolean;
  /** Watches a rewarded ad for AD_REWARD hints. Resolves true if they were given. */
  watchAd: () => Promise<boolean>;
  /** Adds n hints with a message saying why ("+3 💡 from the shop"). */
  give: (n: number, why: string) => void;
  /** A level's first three-star win; a world's last level won. Each gives its reward once and returns how many it gave. */
  rewardStars: (levelId: string) => number;
  rewardWorld: (world: string) => number;
  openShop: () => void;
  /** A message about hints, faded in over the screen. */
  announce: (text: string) => void;
  /** Back to a new player's wallet (Settings → Reset progress). */
  reset: () => void;
}

const HintWalletContext = createContext<HintWalletState>({
  hints: 0, spend: () => false, watchAd: async () => false, give: () => {}, rewardStars: () => 0, rewardWorld: () => 0, openShop: () => {}, announce: () => {}, reset: () => {},
});

/** `ready`: the intro has gone, so the daily gift's message can be seen. */
export function HintWalletProvider({ ready, children }: { ready: boolean; children: ReactNode }) {
  const ads = useRewardedAd();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const live = useRef<Wallet>(newWallet());
  const [shop, setShop] = useState(false);
  const [toast, setToast] = useState({ n: 0, text: '' });

  const save = useCallback((w: Wallet) => {
    live.current = w;
    setWallet(w);
    AsyncStorage.setItem(WALLET_KEY, JSON.stringify(w)).catch(() => {});
  }, []);
  const say = useCallback((text: string) => setToast((t) => ({ n: t.n + 1, text })), []);

  useEffect(() => {
    AsyncStorage.getItem(WALLET_KEY).then((raw) => {
      const w = parseWallet(raw);
      live.current = w;
      setWallet(w);
      if (raw == null) AsyncStorage.setItem(WALLET_KEY, JSON.stringify(w)).catch(() => {});
    }).catch(() => setWallet(newWallet()));
  }, []);

  // Once a day, after the intro: the daily gift.
  useEffect(() => {
    if (!ready || !wallet) return;
    const { wallet: next, given } = claimDaily(live.current, dayOf(new Date()));
    if (next !== live.current) save(next);
    if (given) say(`Daily gift: +${given} 💡`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, wallet === null]);

  const value: HintWalletState = {
    hints: wallet?.hints ?? 0,
    spend: (n) => {
      const next = spend(live.current, n);
      if (!next) return false;
      save(next);
      return true;
    },
    watchAd: async () => {
      if (!(await ads.show('hint'))) return false;
      save(grant(live.current, AD_REWARD));
      say(`+${AD_REWARD} 💡`);
      return true;
    },
    give: (n, why) => {
      save(grant(live.current, n));
      say(why);
    },
    rewardStars: (levelId) => {
      const { wallet: next, given } = claimStars(live.current, levelId);
      if (given) save(next);
      return given;
    },
    rewardWorld: (world) => {
      const { wallet: next, given } = claimWorld(live.current, world);
      if (given) save(next);
      return given;
    },
    openShop: () => setShop(true),
    announce: say,
    reset: () => save(newWallet()),
  };

  return (
    <HintWalletContext.Provider value={value}>
      {children}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FadeToast trigger={toast.n} text={toast.text} tone="pencil" />
      </View>
      <Shop visible={shop} onClose={() => setShop(false)} />
    </HintWalletContext.Provider>
  );
}

export function useHintWallet(): HintWalletState {
  return useContext(HintWalletContext);
}
