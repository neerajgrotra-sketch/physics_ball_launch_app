import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CELEBRATION_MS } from '../../game/celebration';
import { DAILY_KEY, applyFreezes, dailyFor, emptyDaily, mergeDaily, parseDaily, streak, winDaily, type DailyResult, type DailyState } from '../../game/daily';
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
  /** The stamp for `day` has been thumped onto the card (DailyCard), so it plays once. */
  markStamped: (day: string) => void;
  /** Testing only (settings, Reset progress): forget every daily result. */
  reset: () => void;
}

const DailyContext = createContext<Daily>({
  state: emptyDaily(), today: () => ({ day: '', number: 1, level: DAILIES[0] }), won: () => {}, share: () => {}, markStamped: () => {}, reset: () => {},
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
  // Nothing is saved until the saved record has loaded, and every save is merged into what's stored (mergeDaily), one at a time.
  // Before 0.66.5 a save made before the load finished (today's stamp, a win) wrote an empty record over the saved days.
  const loaded = useRef<Promise<void> | null>(null);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const save = (next: DailyState, reset = false) => {
    live.current = next;
    setState(next);
    writes.current = writes.current.then(async () => {
      const stored = reset ? emptyDaily() : parseDaily(await AsyncStorage.getItem(DAILY_KEY));
      const merged = reset ? next : mergeDaily(stored, next);
      await AsyncStorage.setItem(DAILY_KEY, JSON.stringify(merged));
    }).catch(() => {});
  };
  /** Runs `f` once the saved record is in (at once if it already is). */
  const afterLoad = (f: () => void) => { (loaded.current ?? Promise.resolve()).then(f); };
  // Streak freezes are spent once a missed day is over (game/daily.ts applyFreezes): on load, and as the clock passes midnight.
  const freeze = () => {
    const next = applyFreezes(live.current, dayOf(new Date()));
    if (next !== live.current) save(next);
  };
  useEffect(() => {
    // A record that can't be read stays unknown: the app carries on, and saves still merge into whatever is there.
    loaded.current = AsyncStorage.getItem(DAILY_KEY)
      .then((raw) => { live.current = mergeDaily(parseDaily(raw), live.current); setState(live.current); })
      .catch(() => {})
      .then(() => freeze());
    const t = setInterval(freeze, 60_000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const value: Daily = {
    state,
    today: () => todaysDaily(),
    won: (day, result) => afterLoad(() => {
      const { state: next, hints, reasons } = winDaily(live.current, day, result);
      if (next !== live.current) save(next);
      if (!hints) return;
      // Said once the win celebration is over, like a level's rewards.
      setTimeout(() => wallet.give(hints, reasons.join('\n')), CELEBRATION_MS + 600);
    }),
    // `shown`: the win on screen (the share card is about that shot, not the day's first win).
    share: (day, picture, shown) => {
      const result = shown ?? live.current.days[day];
      if (!result) return;
      const { number, index } = dailyFor(day, DAILIES.length);
      const level = DAILIES[index];
      const what = { kind: 'daily' as const, number, name: level.name, streak: streak(live.current, day) }, par = level.par ?? 0;
      shareText(shareMessage(what, result, par), wallet.announce, picture?.(shareCard(what, result, par)));
    },
    markStamped: (day) => afterLoad(() => { if (live.current.stamped !== day) save({ ...live.current, stamped: day }); }),
    reset: () => afterLoad(() => save(emptyDaily(), true)),
  };
  return <DailyContext.Provider value={value}>{children}</DailyContext.Provider>;
}

export const useDaily = () => useContext(DailyContext);
