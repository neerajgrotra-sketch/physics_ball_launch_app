import Svg, { Circle as SvgCircle, Line as SvgLine, Polygon } from 'react-native-svg';
import { gunShapes } from '../../game/guns';
import { skinFill } from '../../game/skins';
import { BALL_RADIUS, LAUNCHER, WORLD } from '../../physics';
import { RemindersSettings, TestReminder } from './RemindersSettings';
import { remindersSupported } from '../notifications/Reminders';
import { useReminderPrefs } from '../notifications/reminderPrefs';
import { timeLabel } from '../../game/reminders';
import { AudioLog } from './AudioLog';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { useEffect, useState, type ReactNode } from 'react';
import { LayoutAnimation, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, UIManager, View } from 'react-native';
import { GENDERS, PROFILE_KEY, emptyProfile, parseAge, parseProfile, type Profile } from '../../game/profile';
import { AUTO_THEME, FONTS, THEMES, useColors } from '../../theme/colors';
import { useTips } from '../coach/Tips';
import { useSoundSettings } from '../feedback/SoundSettings';
import { MUSIC_LEVEL_MAX, setMusicLevel, setMusicPick, trackTitle, tracksFor, useMusicLevel, useMusicPick } from '../feedback/music';
import { useProgress } from '../progress/ProgressProvider';
import { VERSION_LABEL } from '../version';
import { BallPicker } from './BallPicker';
import { GunPicker } from './GunPicker';
import { ThemePicker } from './ThemePicker';
import { TRAIL_CHOICES } from '../../game/trails';
import { useAsmr, useThemeChoice } from './Theme';
import { setShowTouches, useShowTouches } from './ShowTouches';
import { useBallSkin } from './BallSkin';
import { useDaily } from '../daily/DailyProvider';
import { useHintWallet } from '../hints/HintWallet';

// Android needs this for LayoutAnimation (the groups' slide open and shut); iOS and the web have it already.
if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

/**
 * The ⚙ sheet, in collapsible groups (`Group`, one open at a time, each with a summary line): Sound & music, Play Mode (Sketchpad or ASMR, each with a switch, one always on; the board
 * theme under Sketchpad), Ball Themes (BallPicker), Launcher Themes (GunPicker), each badge drawing the player's own pick, Play helpers, Reminders (phones), Hints, About you (game/profile.ts), and apart
 * below a divider, Testing (unlock all, show touches, reset, test notification, audio log).
 */
export function SettingsSheet({ visible, onClose, onMusicTap, onReplayTutorial, onShowTour }: {
  visible: boolean; onClose: () => void; onMusicTap?: () => void; onReplayTutorial?: () => void; onShowTour?: () => void;
}) {
  const c = useColors();
  const { musicOn, toggleMusic, effectsOn, toggleEffects, hapticsOn, toggleHaptics } = useSoundSettings();
  const { tipsOn, setTipsOn, restartTutorial, restartTour } = useTips();
  const showTouches = useShowTouches();
  const { bounceMarks, setBounceMarks, trailCount, setTrailCount } = useBallSkin();
  const [asmr, setAsmr] = useAsmr();
  const { unlockAll, setUnlockAll, resetProgress } = useProgress();
  const wallet = useHintWallet();
  const daily = useDaily();
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { if (!visible) setConfirmReset(false); }, [visible]);
  // One group open at a time, all closed each time the sheet opens. A group's insides are only built while it's open (the ball and gun
  // pickers' canvases came up blank when built with the sheet on iPhone, 0.71.2, and the long sheet was hard to find things in).
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { if (!visible) setOpen(null); }, [visible]);
  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => (o === id ? null : id));
  };
  const { skin, gun } = useBallSkin();
  const [themeChoice] = useThemeChoice();
  const themeName = themeChoice === AUTO_THEME ? 'Auto' : THEMES.find((t) => t.id === themeChoice)?.name ?? 'Auto';
  const musicPick = useMusicPick(asmr);
  const trackLabel = musicPick ? trackTitle(tracksFor(asmr).find((t) => t.id === musicPick) ?? tracksFor(asmr)[0]) : 'Mix';
  const reminders = useReminderPrefs();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      {/* The backdrop is a layer behind the sheet, not round it: a Pressable round the sheet's ScrollView fought it for the
          finger on iPhone, so the sheet only scrolled now and then (it came back for a while after a tap on a control). */}
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close settings" />
        <View style={[styles.sheet, { backgroundColor: c.paper, borderColor: c.line }]}>
          {/* Always in reach, however far the list is scrolled (players found no way out of the tall sheet). */}
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={[styles.close, { backgroundColor: c.paper, borderColor: c.line }]}>
            <Text style={[styles.closeText, { color: c.ink }]}>✕</Text>
          </Pressable>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, { color: c.ink }]}>Settings</Text>

            <Group id="sound" icon="🎵" title="Sound & music" open={open} onToggle={toggle}
              summary={`${musicOn ? `Music on · ${trackLabel}` : 'Music off'} · effects ${effectsOn ? 'on' : 'off'}`}>
              <View style={styles.line}>
                <Text style={[styles.label, { color: c.ink }]}>Background music</Text>
                <Switch
                  value={musicOn}
                  onValueChange={() => { onMusicTap?.(); toggleMusic(); }}
                  trackColor={{ true: c.pencil, false: c.line }}
                  accessibilityLabel="Background music"
                />
              </View>
              <MusicVolume disabled={!musicOn} />
              <MusicPicker disabled={!musicOn} />
              <View style={[styles.line, styles.divided, { borderColor: c.line }]}>
                <Text style={[styles.label, { color: c.ink }]}>Sound effects</Text>
                <Switch
                  value={effectsOn} onValueChange={() => { onMusicTap?.(); toggleEffects(); }}
                  trackColor={{ true: c.pencil, false: c.line }} accessibilityLabel="Sound effects"
                />
              </View>
              {Platform.OS !== 'web' && (
                // A web page can't vibrate an iPhone, so the switch only shows in the app.
                <View style={[styles.line, styles.divided, { borderColor: c.line }]}>
                  <Text style={[styles.label, { color: c.ink }]}>Vibration</Text>
                  <Switch
                    value={hapticsOn} onValueChange={toggleHaptics}
                    trackColor={{ true: c.pencil, false: c.line }} accessibilityLabel="Vibration"
                  />
                </View>
              )}
            </Group>

            {/* Play Mode: the game's two moods, each with its own switch, always exactly one on (turning one on turns the other off, and
                turning the one that's on off switches to the other). The board theme belongs to Sketchpad: ASMR has its own neon look. */}
            <Group id="mode" icon={asmr ? '✨' : '✏️'} title="Play Mode" open={open} onToggle={toggle}
              summary={asmr ? 'ASMR ✨' : `Sketchpad · ${themeName} board`}>
              <ModeRow
                icon="✏️" name="Sketchpad" on={!asmr}
                blurb="Graph paper and pencil, crisp metal bounces, the fuse-and-burst win and the upbeat music"
                onChange={(on) => { onMusicTap?.(); setAsmr(!on); }}
              />
              {!asmr && (
                <View style={[styles.nested, { borderColor: c.line }]}>
                  <Text style={[styles.sub, { color: c.ink }]}>Board theme</Text>
                  <ThemePicker bare />
                </View>
              )}
              <View style={[styles.divided, { borderColor: c.line }]}>
                <ModeRow
                  icon="✨" name="ASMR" on={asmr}
                  blurb="Neon glow, comet trails, a calm chime on every bounce, the light bloom and ambient music"
                  onChange={(on) => { onMusicTap?.(); setAsmr(on); }}
                />
              </View>
              {asmr && <Text style={[styles.note, { color: c.muted }]}>ASMR has its own neon look, so the board themes are in Sketchpad.</Text>}
            </Group>

            <Group id="ball" icon={<BallIcon />} title="Ball Themes" open={open} onToggle={toggle} summary={skin.name}>
              <BallPicker bare />
            </Group>

            <Group id="gun" icon={<LauncherIcon />} title="Launcher Themes" open={open} onToggle={toggle} summary={gun.name}>
              <GunPicker bare />
            </Group>

            <Group id="help" icon="🧭" title="Play helpers" open={open} onToggle={toggle}
              summary={`Numbers ${bounceMarks ? 'on' : 'off'} · ${trailCount} trail${trailCount === 1 ? '' : 's'} · tips ${tipsOn ? 'on' : 'off'}`}>
              <View style={styles.line}>
                <View style={styles.labelBox}>
                  <Text style={[styles.label, { color: c.ink }]}>Show bounce numbers</Text>
                  <Text style={[styles.note, { color: c.muted }]}>Numbers each bounce on the board, so you can see how the count adds up</Text>
                </View>
                <Switch
                  value={bounceMarks} onValueChange={setBounceMarks}
                  trackColor={{ true: c.pencil, false: c.line }} accessibilityLabel="Show bounce numbers"
                />
              </View>
              <View style={[styles.divided, { borderColor: c.line, gap: 8 }]}>
                <View style={styles.labelBox}>
                  <Text style={[styles.label, { color: c.ink }]}>Trails kept</Text>
                  <Text style={[styles.note, { color: c.muted }]}>How many of your last shots stay on the board, oldest faintest</Text>
                </View>
                <View style={styles.chips}>
                  {TRAIL_CHOICES.map((n) => {
                    const on = trailCount === n;
                    return (
                      <Pressable
                        key={n} onPress={() => setTrailCount(n)} accessibilityRole="button" accessibilityState={{ selected: on }}
                        accessibilityLabel={`Keep ${n} trail${n === 1 ? '' : 's'}`}
                        style={[styles.chip, styles.trailChip, { borderColor: c.pencil }, on && { backgroundColor: c.pencil }]}
                      >
                        <Text style={[styles.chipText, { color: on ? c.paper : c.pencil }]}>{n}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={[styles.line, styles.divided, { borderColor: c.line }]}>
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
            </Group>

            {remindersSupported && (
              <Group id="remind" icon="🔔" title="Reminders" open={open} onToggle={toggle}
                summary={reminders.daily || reminders.streak
                  ? [reminders.daily && `Daily at ${timeLabel(reminders.time)}`, reminders.streak && 'streak'].filter(Boolean).join(' · ')
                  : 'Off'}>
                <RemindersSettings bare />
              </Group>
            )}

            <Group id="hints" icon="💡" title="Hints" open={open} onToggle={toggle} summary={`${wallet.hints} left`}>
              <View style={styles.line}>
                <View style={styles.labelBox}>
                  <Text style={[styles.label, { color: c.ink }]}>Hints: {wallet.hints} 💡</Text>
                  <Text style={[styles.note, { color: c.muted }]}>For Solve's hints and solutions.</Text>
                </View>
                <Pressable onPress={() => { onClose(); setTimeout(wallet.openShop, 350); }} accessibilityRole="button" style={[styles.small, { borderColor: c.pencil }]}>
                  <Text style={[styles.smallText, { color: c.pencil }]}>Get more</Text>
                </Pressable>
              </View>
            </Group>

            <Group id="you" icon="👤" title="About you" open={open} onToggle={toggle} summary="Optional, stays on this phone">
              <AboutYou />
            </Group>

            {/* Testing stays apart from the player's settings, below a divider. */}
            <View style={styles.testDivider}>
              <View style={[styles.rule, { backgroundColor: c.line }]} />
              <Text style={[styles.testLabel, { color: c.muted }]}>FOR TESTING</Text>
              <View style={[styles.rule, { backgroundColor: c.line }]} />
            </View>
            <Group id="test" icon="🧪" title="Testing" open={open} onToggle={toggle} dashed
              summary={unlockAll ? 'All levels unlocked' : 'Unlock, reset, logs'}>
              <View style={styles.line}>
                <View style={styles.labelBox}>
                  <Text style={[styles.label, { color: c.ink }]}>Unlock all levels</Text>
                  <Text style={[styles.note, { color: c.muted }]}>Open every level without winning the one before.</Text>
                </View>
                <Switch
                  value={unlockAll} onValueChange={setUnlockAll}
                  trackColor={{ true: c.pencil, false: c.line }} accessibilityLabel="Unlock all levels"
                />
              </View>
              <View style={[styles.line, styles.divided, { borderColor: c.line }]}>
                <View style={styles.labelBox}>
                  <Text style={[styles.label, { color: c.ink }]}>Show touches</Text>
                  <Text style={[styles.note, { color: c.muted }]}>A fingertip follows your finger, so screen recordings show what you did</Text>
                </View>
                <Switch
                  value={showTouches} onValueChange={setShowTouches}
                  trackColor={{ true: c.pencil, false: c.line }} accessibilityLabel="Show touches"
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
              <TestReminder />
              <AudioLog />
            </Group>

            <Pressable onPress={onClose} accessibilityRole="button" style={[styles.done, { backgroundColor: c.pencil }]}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
            <Text style={[styles.version, { color: c.muted }]}>{VERSION_LABEL}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * One collapsible group of the sheet: a card with an icon, a title and a one-line summary of what's set inside, so the player can read
 * their settings without opening anything. Its insides are built only while it's open. `dashed`: the testing group, kept apart.
 */
function Group({ id, icon, title, summary, open, onToggle, dashed, children }: {
  id: string; icon: string | ReactNode; title: string; summary: string; open: string | null; onToggle: (id: string) => void; dashed?: boolean; children: ReactNode;
}) {
  const c = useColors();
  const isOpen = open === id;
  return (
    <View style={[styles.group, { borderColor: isOpen ? c.pencil : c.line, borderStyle: dashed ? 'dashed' : 'solid' }]}>
      <Pressable
        onPress={() => onToggle(id)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} accessibilityLabel={`${title}: ${summary}`}
        style={styles.groupHead}
      >
        {typeof icon === 'string' ? (
          <View style={[styles.badge, { backgroundColor: isOpen ? c.pencil : c.line }]}>
            <Text style={styles.badgeText}>{icon}</Text>
          </View>
        ) : (
          // A drawn icon (the player's own launcher or ball) sits on paper, ringed like the emoji badges.
          <View style={[styles.badge, { backgroundColor: c.paper, borderWidth: 2, borderColor: isOpen ? c.pencil : c.line, overflow: 'hidden' }]}>{icon}</View>
        )}
        <View style={styles.labelBox}>
          <Text style={[styles.groupTitle, { color: c.ink }]}>{title}</Text>
          <Text style={[styles.note, { color: c.muted }]} numberOfLines={1}>{summary}</Text>
        </View>
        <Text style={[styles.chevron, { color: isOpen ? c.pencil : c.muted, transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }]}>›</Text>
      </Pressable>
      {isOpen && <View style={[styles.groupBody, { borderColor: c.line }]}>{children}</View>}
    </View>
  );
}

/** One play mode in the Play Mode group: its badge, name and what it changes, and its switch (lit while it's the mode). */
function ModeRow({ icon, name, blurb, on, onChange }: { icon: string; name: string; blurb: string; on: boolean; onChange: (on: boolean) => void }) {
  const c = useColors();
  return (
    <View style={styles.line}>
      <View style={[styles.modeBadge, { backgroundColor: on ? c.pencil : c.line }]}>
        <Text style={styles.badgeText}>{icon}</Text>
      </View>
      <View style={styles.labelBox}>
        <Text style={[styles.label, { color: c.ink }]}>{name}</Text>
        <Text style={[styles.note, { color: c.muted }]}>{blurb}</Text>
      </View>
      <Switch value={on} onValueChange={onChange} trackColor={{ true: c.pencil, false: c.line }} accessibilityLabel={`${name} mode`} />
    </View>
  );
}

/** The player's own launcher (game/guns.ts, the same shapes as on the board and the level cards) with their ball in it: the badge of
 * "Launcher Themes", so it always shows what's picked. */
function LauncherIcon() {
  const c = useColors();
  const { skin, gun } = useBallSkin();
  // A window round the launcher in world units: the dome on the floor, the barrel up to the right.
  const x = LAUNCHER.x - 30, y = WORLD.ground - 52;
  return (
    <Svg width={30} height={30} viewBox={`${x} ${y} 60 60`}>
      {gunShapes(gun, 40, 50, c).map((sh, i) => (
        sh.kind === 'poly' ? (
          <Polygon key={i} points={sh.points.map((q) => q.join(',')).join(' ')} fill={sh.fill} stroke={sh.stroke} strokeWidth={sh.width} opacity={sh.alpha} />
        ) : sh.kind === 'line' ? (
          <SvgLine key={i} x1={sh.from[0]} y1={sh.from[1]} x2={sh.to[0]} y2={sh.to[1]} stroke={sh.color} strokeWidth={sh.width} strokeLinecap="round" opacity={sh.alpha} />
        ) : (
          <SvgCircle key={i} cx={sh.at[0]} cy={sh.at[1]} r={sh.r} fill={sh.fill ?? 'none'} stroke={sh.stroke} strokeWidth={sh.width} opacity={sh.alpha} />
        )
      ))}
      <SvgCircle cx={LAUNCHER.x} cy={LAUNCHER.y} r={BALL_RADIUS} fill={skinFill(skin, c.steel)} stroke={c.ink} strokeWidth={1.5} />
    </Svg>
  );
}

/** The player's own ball, with a glint: the badge of "Ball Themes". */
function BallIcon() {
  const c = useColors();
  const { skin } = useBallSkin();
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <SvgCircle cx={13} cy={13} r={10} fill={skinFill(skin, c.steel)} stroke={c.ink} strokeWidth={1.5} />
      <SvgCircle cx={9.5} cy={9.5} r={2.6} fill="#ffffff" opacity={0.7} />
    </Svg>
  );
}

/** "About you": name, age, gender and country, all optional, saved on this device as they are typed. */
function AboutYou() {
  const c = useColors();
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
      {(
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

/**
 * The background music's volume (music.ts setMusicLevel): 0 to 150% of the game's level, 100% by default. It follows the finger at
 * once and is saved when the finger lifts. Greyed while the music is off.
 */
function MusicVolume({ disabled }: { disabled: boolean }) {
  const c = useColors();
  const level = useMusicLevel();
  // Web sliders measure their place once; a touch first sends the resize they listen for (as AimControls does), since this one
  // lives in a sheet that slides in.
  const remeasure = () => { if (Platform.OS === 'web' && typeof window !== 'undefined') window.dispatchEvent(new Event('resize')); return false; };
  return (
    <View style={[styles.volumeRow, disabled && { opacity: 0.4 }]} pointerEvents={disabled ? 'none' : 'auto'}>
      <Text style={[styles.volumeLabel, { color: c.muted }]}>Volume</Text>
      <View style={styles.volumeTrack} onStartShouldSetResponderCapture={remeasure}>
        <Slider
          style={styles.volumeSlider}
          value={level}
          minimumValue={0}
          maximumValue={MUSIC_LEVEL_MAX}
          step={0.05}
          onValueChange={(v) => setMusicLevel(v, false)}
          onSlidingComplete={(v) => setMusicLevel(v)}
          minimumTrackTintColor={c.pencil}
          maximumTrackTintColor={c.line}
          thumbTintColor={c.pencil}
          accessibilityLabel="Background music volume"
        />
      </View>
      <Text style={[styles.volumeValue, { color: c.ink }]}>{Math.round(level * 100)}%</Text>
    </View>
  );
}

/**
 * Which track plays (music.ts setMusicPick), for the mode the player is in: "Mix" (the next track at each new level, the default) or
 * one by name. ASMR mode has its own tracks and its own pick. In a level the music switches at once, so the player hears the pick.
 */
function MusicPicker({ disabled }: { disabled: boolean }) {
  const c = useColors();
  const [asmr] = useAsmr();
  const pick = useMusicPick(asmr);
  const choices: { id: string | null; label: string }[] = [{ id: null, label: 'Mix' }, ...tracksFor(asmr).map((t) => ({ id: t.id, label: trackTitle(t) }))];
  return (
    <View style={[styles.pickBox, disabled && { opacity: 0.4 }]} pointerEvents={disabled ? 'none' : 'auto'}>
      <Text style={[styles.volumeLabel, { color: c.muted }]}>Track</Text>
      <View style={styles.chips}>
        {choices.map(({ id, label }) => {
          const on = pick === id;
          return (
            <Pressable
              key={label} onPress={() => setMusicPick(asmr, id)} accessibilityRole="button" accessibilityState={{ selected: on }}
              accessibilityLabel={id ? `Play ${label}` : 'Mix: the next track at each new level'}
              style={[styles.chip, { borderColor: c.pencil }, on && { backgroundColor: c.pencil }]}
            >
              <Text style={[styles.chipText, { color: on ? c.paper : c.pencil }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.note, { color: c.muted }]}>
        {pick ? 'Plays every time' : 'A new track at each new level'}{asmr ? ' (ASMR mode has its own tracks)' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Shorter than the screen, so there's backdrop to tap above and below it too.
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 64 },
  sheet: { borderRadius: 14, borderWidth: 1.5, maxWidth: 420, maxHeight: '100%', width: '100%', alignSelf: 'center', overflow: 'hidden' },
  close: { position: 'absolute', top: 10, right: 10, zIndex: 2, width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 18, fontFamily: FONTS.bodySemi, marginTop: -1 },
  body: { padding: 20, gap: 14 },
  title: { fontSize: 28, fontFamily: FONTS.condensedBold, textAlign: 'center' },
  section: { fontSize: 20, fontFamily: FONTS.condensedBold, marginTop: 4 },
  pickBox: { gap: 8, paddingBottom: 8 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 6, marginTop: -4 },
  volumeLabel: { fontSize: 15, fontFamily: FONTS.bodySemi, width: 62 },
  volumeTrack: { flex: 1 },
  volumeSlider: { width: '100%', height: 36 },
  volumeValue: { fontSize: 15, fontFamily: FONTS.bodySemi, width: 48, textAlign: 'right' },
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
  stack: { flexDirection: 'column', alignItems: 'stretch' },
  trailChip: { minWidth: 44, height: 36, borderRadius: 18, paddingHorizontal: 0, alignItems: 'center' },
  chipText: { fontSize: 14, fontFamily: FONTS.bodySemi },
  group: { borderWidth: 1.5, borderRadius: 14, overflow: 'hidden' },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  groupBody: { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  groupTitle: { fontSize: 19, fontFamily: FONTS.condensedBold },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 18 },
  chevron: { fontSize: 28, fontFamily: FONTS.bodySemi, width: 18, textAlign: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  divided: { borderTopWidth: 1, paddingTop: 12 },
  sub: { fontSize: 17, fontFamily: FONTS.condensedBold },
  nested: { borderLeftWidth: 2, paddingLeft: 8, marginLeft: 2, gap: 8 },
  modeBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  testDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  rule: { flex: 1, height: 1 },
  testLabel: { fontSize: 11, letterSpacing: 1.5, fontFamily: FONTS.bodySemi },
  done: { height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#fff', fontSize: 19, fontFamily: FONTS.condensedBold },
  version: { fontSize: 12, fontFamily: FONTS.body, textAlign: 'center' },
});
