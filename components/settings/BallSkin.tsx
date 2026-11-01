import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_GUN, GUN_KEY, parseGun, type GunSkin } from '../../game/guns';
import { DEFAULT_SKIN, SKIN_KEY, parseSkin, type BallSkin } from '../../game/skins';
import { MARKS_KEY } from '../../game/marks';
import { DEFAULT_TRAILS, TRAILS_KEY, parseTrails } from '../../game/trails';

// The ball skin (game/skins.ts) and gun skin (game/guns.ts) the player picked in Settings, remembered on the device. Everything that
// draws the ball or the gun reads them here.

interface BallSkinState {
  skin: BallSkin;
  setSkin: (id: string) => void;
  gun: GunSkin;
  setGun: (id: string) => void;
  /** "Show bounce numbers" (Settings): numbered markers at each scored bounce of a shot (game/marks.ts). On unless turned off. */
  bounceMarks: boolean;
  setBounceMarks: (on: boolean) => void;
  /** "Trails kept" (Settings): how many past launches stay on the board as ghost trails (game/trails.ts). */
  trailCount: number;
  setTrailCount: (n: number) => void;
}

const BallSkinContext = createContext<BallSkinState>({ skin: DEFAULT_SKIN, setSkin: () => {}, gun: DEFAULT_GUN, setGun: () => {}, bounceMarks: true, setBounceMarks: () => {}, trailCount: DEFAULT_TRAILS, setTrailCount: () => {} });

export function BallSkinProvider({ children }: { children: ReactNode }) {
  const [skin, setSkinState] = useState<BallSkin>(DEFAULT_SKIN);
  const [gun, setGunState] = useState<GunSkin>(DEFAULT_GUN);
  const [bounceMarks, setMarksState] = useState(true);
  const [trailCount, setTrailState] = useState(DEFAULT_TRAILS);

  useEffect(() => {
    AsyncStorage.getItem(SKIN_KEY).then((v) => setSkinState(parseSkin(v))).catch(() => {});
    AsyncStorage.getItem(GUN_KEY).then((v) => setGunState(parseGun(v))).catch(() => {});
    AsyncStorage.getItem(MARKS_KEY).then((v) => setMarksState(v !== '0')).catch(() => {});
    AsyncStorage.getItem(TRAILS_KEY).then((v) => setTrailState(parseTrails(v))).catch(() => {});
  }, []);

  const setSkin = useCallback((id: string) => {
    const next = parseSkin(id);
    setSkinState(next);
    AsyncStorage.setItem(SKIN_KEY, next.id).catch(() => {});
  }, []);

  const setGun = useCallback((id: string) => {
    const next = parseGun(id);
    setGunState(next);
    AsyncStorage.setItem(GUN_KEY, next.id).catch(() => {});
  }, []);

  const setBounceMarks = useCallback((on: boolean) => {
    setMarksState(on);
    AsyncStorage.setItem(MARKS_KEY, on ? '1' : '0').catch(() => {});
  }, []);

  const setTrailCount = useCallback((n: number) => {
    const next = parseTrails(String(n));
    setTrailState(next);
    AsyncStorage.setItem(TRAILS_KEY, String(next)).catch(() => {});
  }, []);

  return <BallSkinContext.Provider value={{ skin, setSkin, gun, setGun, bounceMarks, setBounceMarks, trailCount, setTrailCount }}>{children}</BallSkinContext.Provider>;
}

export function useBallSkin(): BallSkinState {
  return useContext(BallSkinContext);
}
