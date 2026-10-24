import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { FONTS, useColors } from '../../theme/colors';
import { useTips } from '../coach/Tips';
import { useSoundSettings } from '../feedback/SoundSettings';
import { VERSION_LABEL } from '../version';

/**
 * The ⚙ button's sheet. For now just music on/off and the version; the full settings screen (sound,
 * notifications, language, save progress, support, share, privacy, terms) is in BACKLOG.md.
 */
export function SettingsSheet({ visible, onClose, onMusicTap, onReplayTutorial }: {
  visible: boolean; onClose: () => void; onMusicTap?: () => void; onReplayTutorial?: () => void;
}) {
  const c = useColors();
  const { musicOn, toggleMusic } = useSoundSettings();
  const { tipsOn, setTipsOn } = useTips();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close settings">
        <Pressable style={[styles.sheet, { backgroundColor: c.paper, borderColor: c.line }]} onPress={() => {}}>
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
            <Text style={[styles.label, { color: c.ink }]}>Tips (ghost finger)</Text>
            <Switch
              value={tipsOn} onValueChange={setTipsOn}
              trackColor={{ true: c.pencil, false: c.line }} accessibilityLabel="Tips"
            />
          </View>
          {onReplayTutorial && (
            <Pressable onPress={onReplayTutorial} accessibilityRole="button" style={[styles.replay, { borderColor: c.pencil }]}>
              <Text style={[styles.replayText, { color: c.pencil }]}>Replay the tutorial</Text>
            </Pressable>
          )}
          <Text style={[styles.soon, { color: c.muted }]}>More settings are on the way.</Text>
          <Pressable onPress={onClose} accessibilityRole="button" style={[styles.done, { backgroundColor: c.pencil }]}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
          <Text style={[styles.version, { color: c.muted }]}>{VERSION_LABEL}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 28 },
  sheet: { borderRadius: 14, borderWidth: 1.5, padding: 20, gap: 14, maxWidth: 420, width: '100%', alignSelf: 'center' },
  title: { fontSize: 28, fontFamily: FONTS.condensedBold, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1 },
  label: { fontSize: 18, fontFamily: FONTS.bodySemi },
  replay: { height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  replayText: { fontSize: 17, fontFamily: FONTS.condensedBold },
  soon: { fontSize: 14, fontFamily: FONTS.body, textAlign: 'center' },
  done: { height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#fff', fontSize: 19, fontFamily: FONTS.condensedBold },
  version: { fontSize: 12, fontFamily: FONTS.body, textAlign: 'center' },
});
