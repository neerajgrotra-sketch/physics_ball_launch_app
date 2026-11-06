import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { REMINDER_TIMES, STREAK_TIME, timeLabel } from '../../game/reminders';
import { FONTS, useColors } from '../../theme/colors';
import { ensurePermission, hasPermission, inExpoGo, remindersSupported, sendTestReminder } from '../notifications/Reminders';
import { setReminderPrefs, useReminderPrefs } from '../notifications/reminderPrefs';

/**
 * Settings, Reminders (phones only; game/reminders.ts): the morning teaser for the day's puzzle and its time, and the evening streak
 * nudge. Turning either on asks for permission if it hasn't been given; if the phone says no, the switch stays off and says where to
 * turn notifications on.
 */
export function RemindersSettings({ bare = false }: { bare?: boolean }) {
  const c = useColors();
  const prefs = useReminderPrefs();
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { if (prefs.daily || prefs.streak) hasPermission().then((ok) => setBlocked(!ok)); }, [prefs.daily, prefs.streak]);
  if (!remindersSupported) return null;
  const turn = async (key: 'daily' | 'streak', on: boolean) => {
    if (on && !(await ensurePermission())) { setBlocked(true); return; }
    setBlocked(false);
    setReminderPrefs({ [key]: on, asked: true });
  };
  return (
    <View>
      {!bare && <Text style={[styles.section, { color: c.ink }]}>Reminders</Text>}
      <View style={[styles.row, { borderColor: c.line }]}>
        <View style={styles.labelBox}>
          <Text style={[styles.label, { color: c.ink }]}>Daily puzzle</Text>
          <Text style={[styles.note, { color: c.muted }]}>A teaser for the day's puzzle, at {timeLabel(prefs.time)}</Text>
        </View>
        <Switch value={prefs.daily} onValueChange={(on) => turn('daily', on)} trackColor={{ true: c.pencil, false: c.line }} accessibilityLabel="Daily puzzle reminder" />
      </View>
      {prefs.daily && (
        <View style={[styles.chips, { paddingVertical: 8 }]}>
          {REMINDER_TIMES.map((t) => {
            const on = prefs.time === t;
            return (
              <Pressable
                key={t} onPress={() => setReminderPrefs({ time: t })} accessibilityRole="button" accessibilityLabel={`Remind me at ${timeLabel(t)}`}
                style={[styles.chip, { borderColor: c.pencil, backgroundColor: on ? c.pencil : 'transparent' }]}
              >
                <Text style={[styles.chipText, { color: on ? c.paper : c.pencil }]}>{timeLabel(t)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={[styles.row, { borderColor: c.line }]}>
        <View style={styles.labelBox}>
          <Text style={[styles.label, { color: c.ink }]}>Streak</Text>
          <Text style={[styles.note, { color: c.muted }]}>
            At {timeLabel(STREAK_TIME)}, only if you have a streak going and today's puzzle isn't done (it replaces that day's teaser)
          </Text>
        </View>
        <Switch value={prefs.streak} onValueChange={(on) => turn('streak', on)} trackColor={{ true: c.pencil, false: c.line }} accessibilityLabel="Streak reminder" />
      </View>
      <Text style={[styles.note, { color: blocked ? c.red : c.muted, marginTop: 6 }]}>
        {blocked
          ? `Notifications are off for ${inExpoGo ? 'Expo Go' : 'Clink'}: turn them on in the iPhone's Settings, under ${inExpoGo ? 'Expo Go' : 'Clink'}, Notifications.`
          : 'At most one a day, and none once the day\'s puzzle is done.'}
        {inExpoGo && !blocked ? ' While testing in Expo Go they show as Expo Go.' : ''}
      </Text>
    </View>
  );
}

/** Settings, Testing: a sample reminder in 5 seconds. */
export function TestReminder() {
  const c = useColors();
  const [said, setSaid] = useState('');
  if (!remindersSupported) return null;
  return (
    <View>
      <Pressable
        onPress={async () => setSaid((await sendTestReminder()) ? 'Coming in 5 seconds. Lock the phone to see it on the lock screen.' : 'Notifications are off for this app in the iPhone\'s Settings.')}
        accessibilityRole="button" style={[styles.outline, { borderColor: c.pencil, marginTop: 10 }]}
      >
        <Text style={[styles.outlineText, { color: c.ink }]}>Send a test notification</Text>
      </Pressable>
      {said ? <Text style={[styles.note, { color: c.muted, marginTop: 4, textAlign: 'center' }]}>{said}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 20, fontFamily: FONTS.condensedBold, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1 },
  labelBox: { flex: 1, gap: 2 },
  label: { fontSize: 18, fontFamily: FONTS.bodySemi },
  note: { fontSize: 13, fontFamily: FONTS.body },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center' },
  chipText: { fontSize: 14, fontFamily: FONTS.bodySemi },
  outline: { height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontSize: 17, fontFamily: FONTS.condensedBold },
});
