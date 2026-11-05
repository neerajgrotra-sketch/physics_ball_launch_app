import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useDaily } from '../daily/DailyProvider';
import { useIntroDone } from '../splash/introState';
import { onReminderTap, rescheduleReminders } from './Reminders';
import { useReminderPrefs } from './reminderPrefs';

/**
 * Keeps the scheduled reminders (game/reminders.ts) in step with the daily record and the settings: replanned when either changes and
 * whenever the app comes back to the front (the day may have moved on). A tapped reminder opens its screen (today's daily) once the
 * intro has gone. Renders nothing. In the root layout, inside DailyProvider.
 */
export function RemindersHost() {
  const { state } = useDaily();
  const prefs = useReminderPrefs();
  const introDone = useIntroDone();
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { rescheduleReminders(state); }, [state, prefs]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') rescheduleReminders(state); });
    return () => sub.remove();
  }, [state]);
  useEffect(() => onReminderTap(setPending), []);
  useEffect(() => {
    if (!pending || !introDone) return;
    setPending(null);
    try { router.push(pending as '/daily'); } catch { /* not ready: the player is on the levels screen anyway */ }
  }, [pending, introDone]);
  return null;
}
