import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { addDays, dailyFor, type DailyState } from '../../game/daily';
import { planReminders, teaser, type PuzzleInfo } from '../../game/reminders';
import { dayOf } from '../../game/wallet';
import { DAILIES } from '../../levels/daily';
import { reminderPrefs } from './reminderPrefs';

// The phone side of the reminders (game/reminders.ts plans them): permission, scheduling on the phone (local notifications, no server)
// and the test button. Web: Reminders.web.ts (a page can't schedule these).

export const remindersSupported = true;
/** In Expo Go reminders show under Expo Go's name and icon; the game's own build shows its own. */
export const inExpoGo = Constants.executionEnvironment === 'storeClient';

// Shown even while the game is open (the test button; a reminder that lands while playing).
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Whether the game may notify, asking the player once if it hasn't yet (iOS only asks once; after that it's the phone's Settings). */
export async function ensurePermission(): Promise<boolean> {
  try {
    const now = await Notifications.getPermissionsAsync();
    if (now.granted) return true;
    if (!now.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Whether the game may notify, without asking. */
export async function hasPermission(): Promise<boolean> {
  try { return (await Notifications.getPermissionsAsync()).granted; } catch { return false; }
}

const puzzleOn = (day: string): PuzzleInfo => {
  const { number, index } = dailyFor(day, DAILIES.length);
  const level = DAILIES[index];
  return { number, name: level.name, hint: level.hint, tier: level.tier };
};

/** A day (YYYY-MM-DD, local) at `minutes` after midnight, as a local Date. */
const at = (day: string, minutes: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
};

let running: Promise<void> = Promise.resolve();

/** Replaces every scheduled reminder with the plan for now (on app start and return, a daily win, a settings change). */
export function rescheduleReminders(state: DailyState) {
  running = running.then(async () => {
    const prefs = reminderPrefs();
    const want = prefs.daily || prefs.streak;
    if (want && !(await hasPermission())) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!want) return;
    const now = new Date(), today = dayOf(now);
    const plan = planReminders(state, today, now.getHours() * 60 + now.getMinutes(), prefs, puzzleOn);
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body, sound: true, data: { url: '/daily', kind: r.kind } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at(r.day, r.minutes) },
      });
    }
  }).catch(() => {});
}

/** Settings, Testing: a sample reminder in a few seconds (asks for permission first if needed). Says whether it could. */
export async function sendTestReminder(): Promise<boolean> {
  if (!(await ensurePermission())) return false;
  const { title, body } = teaser(puzzleOn(addDays(dayOf(new Date()), 1)));
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, data: { url: '/daily', kind: 'test' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
  });
  return true;
}

/** Calls `open` with the screen a tapped reminder points to, including the one that opened the app. Returns the unsubscribe. */
export function onReminderTap(open: (url: string) => void): () => void {
  const go = (r: Notifications.NotificationResponse | null) => {
    const url = r?.notification.request.content.data?.url;
    if (typeof url === 'string') open(url);
  };
  Notifications.getLastNotificationResponseAsync().then((r) => { go(r); Notifications.clearLastNotificationResponseAsync().catch(() => {}); }).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(go);
  return () => sub.remove();
}
