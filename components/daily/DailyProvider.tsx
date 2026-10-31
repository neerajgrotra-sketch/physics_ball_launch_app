import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CELEBRATION_MS } from '../../game/celebration';
import { DAILY_KEY, dailyFor, emptyDaily, parseDaily, streak, winDaily, type DailyResult, type DailyState } from '../../game/daily';
import { dayOf } from '../../game/wallet';
import { DAILIES, type DailyLevel } from '../../levels/daily';
import { useHintWallet } from '../hints/HintWallet';
import { shareCard, shareMessage } from '../../game/share';
import type { ShareCard } from '../board/shareCard';
import { shareText } from '../share';

interface Daily {
  state: DailyState;
  /** Today's puzzle (the player's own date) and its number. */
  today: () => { day: string; number: number; level: DailyLevel };
  /** Records a win on `day`'s puzzle: the first one that day counts for the streak and gives hints (game/daily.ts winDaily). */
  won: (day: string, result: DailyResult) => void;
  /** Shares `day`'s result (the share sheet; on a browser without one, copies it). */
  share: (day: string, picture?: ((card: ShareCard) => string | null) | null, result?: DailyResult) => void;
  /** Testing only (settings, Reset progress): forget every daily result. */
  reset: () => void;
}

const DailyContext = createContext<Daily>({
  state: emptyDaily(), today: () => ({ day: '', number: 1, level: DAILIES[0] }), won: () => {}, share: () => {}, reset: () => {},
});

export function todaysDaily(now = new Date()) {
  const day = dayOf(now);
  const { number, index } = dailyFor(day, DAILIES.length);
  return { day, number, level: DAILIES[index] };
}

/** The daily puzzle's saved results (AsyncStorage), the streak's hint rewards and sharing. Inside HintWalletProvider. */
export function DailyProvider({ children }: { children: ReactNode }) {
  const wallet = useHintWallet();
  const [state, setState] = useState<DailyState>(emptyDaily());
  const live = useRef(state);
  useEffect(() => {
    AsyncStorage.getItem(DAILY_KEY).then((raw) => { live.current = parseDaily(raw); setState(live.current); }).catch(() => {});
  }, []);
  const save = (next: DailyState) => {
    live.current = next;
    setState(next);
    AsyncStorage.setItem(DAILY_KEY, JSON.stringify(next)).catch(() => {});
  };
  const value: Daily = {
    state,
    today: () => todaysDaily(),
    won: (day, result) => {
      const { state: next, hints, reasons } = winDaily(live.current, day, result);
      if (next !== live.current) save(next);
      if (!hints) return;
      // Said once the win celebration is over, like a level's rewards.
      setTimeout(() => wallet.give(hints, reasons.join('\n')), CELEBRATION_MS + 600);
    },
    // `shown`: the win on screen (the share card is about that shot, not the day's first win).
    share: (day, picture, shown) => {
      const result = shown ?? live.current.days[day];
      if (!result) return;
      const { number, index } = dailyFor(day, DAILIES.length);
      const level = DAILIES[index];
      const what = { kind: 'daily' as const, number, name: level.name, streak: streak(live.current, day) }, par = level.par ?? 0;
      shareText(shareMessage(what, result, par), wallet.announce, picture?.(shareCard(what, result, par)));
    },
    reset: () => save(emptyDaily()),
  };
  return <DailyContext.Provider value={value}>{children}</DailyContext.Provider>;
}

export const useDaily = () => useContext(DailyContext);
