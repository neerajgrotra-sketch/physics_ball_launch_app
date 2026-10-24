import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const MUSIC_KEY = 'bank-shot/music';

interface SoundSettings {
  /** Whether level music plays. Remembered on the device; on unless the player turned it off. */
  musicOn: boolean;
  toggleMusic: () => void;
}

const SoundSettingsContext = createContext<SoundSettings>({ musicOn: true, toggleMusic: () => {} });

export function SoundSettingsProvider({ children }: { children: ReactNode }) {
  const [musicOn, setMusicOn] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(MUSIC_KEY).then((v) => { if (v === 'off') setMusicOn(false); }).catch(() => {});
  }, []);

  const toggleMusic = useCallback(() => {
    setMusicOn((on) => {
      AsyncStorage.setItem(MUSIC_KEY, on ? 'off' : 'on').catch(() => {});
      return !on;
    });
  }, []);

  return <SoundSettingsContext.Provider value={{ musicOn, toggleMusic }}>{children}</SoundSettingsContext.Provider>;
}

export function useSoundSettings(): SoundSettings {
  return useContext(SoundSettingsContext);
}
