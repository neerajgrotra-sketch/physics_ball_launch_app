import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { GENDERS, PROFILE_KEY, emptyProfile, parseAge, parseProfile, type Profile } from '../../game/profile';
import { FONTS, useColors } from '../../theme/colors';
import { useTips } from '../coach/Tips';
import { useSoundSettings } from '../feedback/SoundSettings';
import { useProgress } from '../progress/ProgressProvider';
import { VERSION_LABEL } from '../version';
import { BallPicker } from './BallPicker';
import { GunPicker } from './GunPicker';
import { ThemePicker } from './ThemePicker';
import { useBallSkin } from './BallSkin';
import { useDaily } from '../daily/DailyProvider';
import { useHintWallet } from '../hints/HintWallet';

/**
 * The ⚙ sheet: music, tips, the tutorial, the ball's look (BallPicker), the gun's (GunPicker), the board theme (ThemePicker), "About you" (optional details kept on this device, game/profile.ts) and a Testing section
 * (open every level, or start over from level 1). The full settings screen is in BACKLOG.md.
 */
export function SettingsSheet({ visible, onClose, onMusicTap, onReplayTutorial, onShowTour }: {
  visible: boolean; onClose: () => void; onMusicTap?: () => void; onReplayTutorial?: () => void; onShowTour?: () => void;
}) {
  const c = useColors();
  const { musicOn, toggleMusic, effectsOn, toggleEffects, hapticsOn, toggleHaptics } = useSoundSettings();
  const { tipsOn, setTipsOn, restartTutorial, restartTour } = useTips();
  const { bounceMarks, setBounceMarks } = useBallSkin();
  const { unlockAll, setUnlockAll, resetProgress } = useProgress();
  const wallet = useHintWallet();
  const daily = useDaily();
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { if (!visible) setConfirmReset(false); }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close settings">
        <Pressable style={[styles.sheet, { backgroundColor: c.paper, borderColor: c.line }]} onPress={() => {}}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, { color: c.ink }]}>Settings</Text>
            <View style={[styles.row, { borderColor: c.line }]}>
              <Text style={[styles.label, { color: c.ink }]}>Music</Text>
              <Switch
                value={musicOn}
                onValueChange={() => { onMusicTap?.(); toggleMusic(); }}
                trackColor={{ true: c.pencil, false: c.line }}
                accessibilityLabel="Music"
              />
            </View>
            <View style={[styles.row, { borderColor: c.line }]}>
              <Text style={[styles.label, { color: c.ink }]}>Sound effects</Text>
              <Switch
                value={effectsOn} onValueChange={() => { onMusicTap?.(); toggleEffects(); }}
                trackColor={{ true: c.pencil, false: c.line }} accessibilityLabel="Sound effects"
              />
            </View>
            {Platform.OS !== 'web' && (
              // A web page can't vibrate an iPhone, so the switch only shows in the app.
              <View style={[styles.row, { borderColor: c.line }]}>
                <Text style={[styles.label, { color: c.ink }]}>Vibration</Text>
                <Switch
                  value={hapticsOn} onValueChange={toggleHaptics}
                  trackColor={{ true: c.pencil, false: c.line }} accessibilityLabel="Vibration"
                />
              </View>
            )}
            <View style={[styles.row, { borderColor: c.line }]}>
              <View style={styles.labelBox}>
                <Text style={[styles.label, { color: c.ink }]}>Show bounce numbers</Text>
                <Text style={[styles.note, { color: c.muted }]}>Numbers each bounce on the board, so you can see how the count adds up</Text>
              </View>
              <Switch
                value={bounceMarks} onValueChange={setBounceMarks}
                trackColor={{ true: c.pencil, false: c.line }} accessibilityLabel="Show bounce numbers"
              />
            </View>
            <View style={[styles.row, { borderColor: c.line }]}>
              <Text style={[styles.label, { color: c.ink }]}>Tips (ghost finger)</Text>
              <Switch
                value={tipsOn} onValueChange={setTipsOn}
                trackColor={{ true: c.pencil, false: c.line }} accessibilityLabel="Tips"
              />
            </View>
            {onReplayTutorial && (
              <Pressable onPress={onReplayTutorial} accessibilityRole="button" style={[styles.outline, { borderColor: c.pencil }]}>
                <Text style={[styles.outlineText, { color: c.pencil }]}>Replay the tutorial</Text>
              </Pressable>
            )}

            {onShowTour && (
              <Pressable onPress={onShowTour} accessibilityRole="button" style={[styles.outline, { borderColor: c.pencil }]}>
                <Text style={[styles.outlineText, { color: c.pencil }]}>How to play (the tour)</Text>
              </Pressable>
            )}

            <View style={[styles.row, { borderColor: c.line }]}>
              <View style={styles.labelBox}>
                <Text style={[styles.label, { color: c.ink }]}>Hints: {wallet.hints} 💡</Text>
                <Text style={[styles.note, { color: c.muted }]}>For Solve's hints and solutions.</Text>
              </View>
              <Pressable onPress={() => { onClose(); setTimeout(wallet.openShop, 350); }} accessibilityRole="button" style={[styles.small, { borderColor: c.pencil }]}>
                <Text style={[styles.smallText, { color: c.pencil }]}>Get more</Text>
              </Pressable>
            </View>

            <BallPicker />
            <GunPicker />

            <ThemePicker />

            <AboutYou />

            <Text style={[styles.section, { color: c.ink }]}>Testing</Text>
            <View style={[styles.row, { borderColor: c.line }]}>
              <View style={styles.labelBox}>
                <Text style={[styles.label, { color: c.ink }]}>Unlock all levels</Text>
                <Text style={[styles.note, { color: c.muted }]}>For testing: open every level without winning the one before.</Text>
              </View>
              <Switch
                value={unlockAll} onValueChange={setUnlockAll}
                trackColor={{ true: c.pencil, false: c.line }} accessibilityLabel="Unlock all levels"
              />
            </View>
            <Pressable
              onPress={() => {
                if (!confirmReset) { setConfirmReset(true); return; }
                resetProgress();
                wallet.reset();
                daily.reset();
                restartTutorial();
                restartTour();
                setConfirmReset(false);
              }}
              accessibilityRole="button"
              style={[styles.outline, { borderColor: c.red }]}
            >
              <Text style={[styles.outlineText, { color: c.red }]}>{confirmReset ? 'Tap again to wipe all progress' : 'Reset progress (start fresh)'}</Text>
            </Pressable>

            <Pressable onPress={onClose} accessibilityRole="button" style={[styles.done, { backgroundColor: c.pencil }]}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
            <Text style={[styles.version, { color: c.muted }]}>{VERSION_LABEL}</Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** "About you": name, age, gender and country, all optional, saved on this device as they are typed. */
function AboutYou() {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [p, setP] = useState<Profile>(emptyProfile());
  const [ageText, setAgeText] = useState('');
  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((raw) => {
      const saved = parseProfile(raw);
      setP(saved);
      setAgeText(saved.age != null ? String(saved.age) : '');
    }).catch(() => {});
  }, []);
  const save = (next: Profile) => {
    setP(next);
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next)).catch(() => {});
  };
  const field = { borderColor: c.line, color: c.ink };
  return (
    <View style={styles.about}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" style={styles.aboutHead}>
        <Text style={[styles.section, { color: c.ink }]}>About you</Text>
        <Text style={[styles.label, { color: c.muted }]}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && (
        <View style={styles.aboutBody}>
          <Text style={[styles.note, { color: c.muted }]}>Optional. Stays on this phone; nothing is sent anywhere.</Text>
          <TextInput
            value={p.name} onChangeText={(t) => save({ ...p, name: t.slice(0, 40) })} placeholder="Name" placeholderTextColor={c.muted}
            style={[styles.input, field]} autoCapitalize="words" accessibilityLabel="Name"
          />
          <TextInput
            value={ageText}
            onChangeText={(t) => { setAgeText(t); save({ ...p, age: parseAge(t) }); }}
            placeholder="Age" placeholderTextColor={c.muted} keyboardType="number-pad" maxLength={3}
            style={[styles.input, field]} accessibilityLabel="Age"
          />
          <View style={styles.chips}>
            {GENDERS.map((g) => {
              const on = p.gender === g;
              return (
                <Pressable
                  key={g} onPress={() => save({ ...p, gender: on ? null : g })} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={[styles.chip, { borderColor: c.pencil }, on && { backgroundColor: c.pencil }]}
                >
                  <Text style={[styles.chipText, { color: on ? c.paper : c.pencil }]}>{g}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={p.country} onChangeText={(t) => save({ ...p, country: t.slice(0, 40) })} placeholder="Country" placeholderTextColor={c.muted}
            style={[styles.input, field]} autoCapitalize="words" accessibilityLabel="Country"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 28 },
  sheet: { borderRadius: 14, borderWidth: 1.5, maxWidth: 420, maxHeight: '88%', width: '100%', alignSelf: 'center', overflow: 'hidden' },
  body: { padding: 20, gap: 14 },
  title: { fontSize: 28, fontFamily: FONTS.condensedBold, textAlign: 'center' },
  section: { fontSize: 20, fontFamily: FONTS.condensedBold, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1 },
  labelBox: { flex: 1, gap: 2 },
  label: { fontSize: 18, fontFamily: FONTS.bodySemi },
  note: { fontSize: 13, fontFamily: FONTS.body },
  small: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 2, justifyContent: 'center' },
  smallText: { fontSize: 15, fontFamily: FONTS.condensedBold },
  outline: { height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontSize: 17, fontFamily: FONTS.condensedBold },
  about: { gap: 8 },
  aboutHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aboutBody: { gap: 10 },
  input: { height: 42, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 16, fontFamily: FONTS.body },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center' },
  chipText: { fontSize: 14, fontFamily: FONTS.bodySemi },
  done: { height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#fff', fontSize: 19, fontFamily: FONTS.condensedBold },
  version: { fontSize: 12, fontFamily: FONTS.body, textAlign: 'center' },
});
