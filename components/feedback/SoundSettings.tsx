import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const MUSIC_KEY = 'bank-shot/music';
export const EFFECTS_KEY = 'bank-shot/effects';
const HAPTICS_KEY = 'bank-shot/haptics';

interface SoundSettings {
  /** Whether level music plays. Remembered on the device; on unless the player turned it off. */
  musicOn: boolean;
  toggleMusic: () => void;
  /** Sound effects: the launch, bounces, the glass, the win. */
  effectsOn: boolean;
  toggleEffects: () => void;
  /** Vibration on bounces and wins (phones only). */
  hapticsOn: boolean;
  toggleHaptics: () => void;
}

/**
 * The effect and vibration switches as plain values, read by useFeedback at the moment it plays (it runs on screens outside this
 * provider too, like the intro). The provider keeps them current.
 */
/** Read by the sound code as each effect plays. `asmr`: ASMR mode (components/settings/Theme.tsx) swaps the effects for calm notes. */
export const feedbackPrefs = { effects: true, haptics: true, asmr: false };
/** Told when Sound effects is switched (or loaded) on or off: the phone's sound code frees or makes its effect players. */
export const effectsListeners = new Set<(on: boolean) => void>();

const SoundSettingsContext = createContext<SoundSettings>({
  musicOn: true, toggleMusic: () => {}, effectsOn: true, toggleEffects: () => {}, hapticsOn: true, toggleHaptics: () => {},
});

/** One remembered on/off switch, on unless the player turned it off. */
function useSwitch(key: string, onChange?: (on: boolean) => void): [boolean, () => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(key).then((v) => { if (v === 'off') { setOn(false); onChange?.(false); } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const toggle = useCallback(() => {
    setOn((was) => {
      AsyncStorage.setItem(key, was ? 'off' : 'on').catch(() => {});
      onChange?.(!was);
      return !was;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [on, toggle];
}

export function SoundSettingsProvider({ children }: { children: ReactNode }) {
  const [musicOn, toggleMusic] = useSwitch(MUSIC_KEY);
  const [effectsOn, toggleEffects] = useSwitch(EFFECTS_KEY, (on) => { feedbackPrefs.effects = on; effectsListeners.forEach((f) => f(on)); });
  const [hapticsOn, toggleHaptics] = useSwitch(HAPTICS_KEY, (on) => { feedbackPrefs.haptics = on; });
  return (
    <SoundSettingsContext.Provider value={{ musicOn, toggleMusic, effectsOn, toggleEffects, hapticsOn, toggleHaptics }}>
      {children}
    </SoundSettingsContext.Provider>
  );
}

export function useSoundSettings(): SoundSettings {
  return useContext(SoundSettingsContext);
}
