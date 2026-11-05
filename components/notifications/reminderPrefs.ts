import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { DEFAULT_PREFS, REMINDERS_KEY, parsePrefs, type ReminderPrefs } from '../../game/reminders';

// The reminder settings (Settings, Reminders; the daily card's one-time ask), remembered on the device. Off until the player says yes.
let prefs: ReminderPrefs = DEFAULT_PREFS;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function loadReminderPrefs(): Promise<void> {
  loading ??= AsyncStorage.getItem(REMINDERS_KEY).then((raw) => { prefs = parsePrefs(raw); listeners.forEach((f) => f()); }).catch(() => {});
  return loading;
}

export const reminderPrefs = () => prefs;

export function setReminderPrefs(change: Partial<ReminderPrefs>) {
  prefs = { ...prefs, ...change };
  listeners.forEach((f) => f());
  AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(prefs)).catch(() => {});
}

/** The settings, re-rendering when they change (and once the saved ones are read). */
export function useReminderPrefs(): ReminderPrefs {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    listeners.add(f);
    loadReminderPrefs().then(f);
    return () => { listeners.delete(f); };
  }, []);
  return prefs;
}
