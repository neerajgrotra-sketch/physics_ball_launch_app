import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CELEBRATION_MS } from '../../game/celebration';
import { DAILY_KEY, dailyFor, emptyDaily, parseDaily, streak, winDaily, type DailyResult, type DailyState } from '../../game/daily';
import { dayOf } from '../../game/wallet';
import { DAILIES, type DailyLevel } from '../../levels/daily';
import { useHintWallet } from '../hints/HintWallet';
import { shareMessage } from '../../game/share';
import { shareText } from '../share';

interface Daily {
  state: DailyState;
  /** Today's puzzle (the player's own date) and its number. */
  today: () => { day: string; number: number; level: DailyLevel };
  /** Records a win on `day`'s puzzle: the first one that day counts for the streak and gives hints (game/daily.ts winDaily). */
  won: (day: string, result: DailyResult) => void;
  /** Shares `day`'s result (the share sheet; on a browser without one, copies it). */
  share: (day: string, image?: string | null) => void;
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
      if (!hints) return;
      save(next);
      // Said once the win celebration is over, like a level's rewards.
      setTimeout(() => wallet.give(hints, reasons.join('\n')), CELEBRATION_MS + 600);
    },
    share: (day, image) => {
      const result = live.current.days[day];
      if (!result) return;
      const { number, index } = dailyFor(day, DAILIES.length);
      const level = DAILIES[index];
      shareText(shareMessage({ kind: 'daily', number, name: level.name, streak: streak(live.current, day) }, result, level.par ?? 0), wallet.announce, image);
    },
    reset: () => save(emptyDaily()),
  };
  return <DailyContext.Provider value={value}>{children}</DailyContext.Provider>;
}

export const useDaily = () => useContext(DailyContext);
