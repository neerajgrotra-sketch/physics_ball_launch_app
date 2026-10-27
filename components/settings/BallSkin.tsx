import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SKIN, SKIN_KEY, parseSkin, type BallSkin } from '../../game/skins';

// The ball skin the player picked in Settings (game/skins.ts), remembered on the device. Everything that draws the ball reads it here.

interface BallSkinState {
  skin: BallSkin;
  setSkin: (id: string) => void;
}

const BallSkinContext = createContext<BallSkinState>({ skin: DEFAULT_SKIN, setSkin: () => {} });

export function BallSkinProvider({ children }: { children: ReactNode }) {
  const [skin, setSkinState] = useState<BallSkin>(DEFAULT_SKIN);

  useEffect(() => {
    AsyncStorage.getItem(SKIN_KEY).then((v) => setSkinState(parseSkin(v))).catch(() => {});
  }, []);

  const setSkin = useCallback((id: string) => {
    const next = parseSkin(id);
    setSkinState(next);
    AsyncStorage.setItem(SKIN_KEY, next.id).catch(() => {});
  }, []);

  return <BallSkinContext.Provider value={{ skin, setSkin }}>{children}</BallSkinContext.Provider>;
}

export function useBallSkin(): BallSkinState {
  return useContext(BallSkinContext);
}
