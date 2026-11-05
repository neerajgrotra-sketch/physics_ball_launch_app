import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { clearAudioLog, useAudioLog } from '../feedback/audioLog';
import { FONTS, useColors } from '../../theme/colors';

/** Settings, Testing: the audio timeline (components/feedback/audioLog.ts), hidden until opened. Screenshot it after a stutter. */
export function AudioLog() {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const log = useAudioLog();
  return (
    <View>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" style={[styles.button, { borderColor: c.pencil }]}>
        <Text style={[styles.buttonText, { color: c.ink }]}>{open ? 'Hide audio log' : 'Show audio log'}</Text>
      </Pressable>
      {open && (
        <View style={[styles.box, { borderColor: c.line }]}>
          <Pressable onPress={clearAudioLog} accessibilityRole="button" style={styles.clear}>
            <Text style={[styles.buttonText, { color: c.red }]}>Clear log</Text>
          </Pressable>
          <Text style={[styles.text, { color: c.ink }]} selectable>{log.length ? log.join('\n') : 'Nothing yet.'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  buttonText: { fontFamily: FONTS.condensedBold, fontSize: 15 },
  clear: { alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 4 },
  box: { borderWidth: 1, borderRadius: 8, padding: 8, marginTop: 8 },
  text: { fontFamily: 'Courier', fontSize: 10, lineHeight: 13 },
});
