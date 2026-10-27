import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AUTO_THEME, FONTS, THEMES, useColors, type Palette } from '../../theme/colors';
import { useThemeChoice } from './Theme';

/**
 * "Board theme" in Settings: Auto (the phone's light or dark setting) and each theme in theme/colors.ts, each shown as a tiny board
 * in its own colours (grid, a bar, a gold spring, the glass and the ball) so the player sees what they're picking. Saved at once.
 */
export function ThemePicker() {
  const c = useColors();
  const [choice, setChoice] = useThemeChoice();
  const options = [{ id: AUTO_THEME, name: 'Auto' }, ...THEMES.map(({ id, name }) => ({ id, name }))];
  return (
    <View style={styles.wrap}>
      <Text style={[styles.section, { color: c.ink }]}>Board theme</Text>
      <View style={styles.grid}>
        {options.map((o) => {
          const on = o.id === choice;
          return (
            <Pressable
              key={o.id} onPress={() => setChoice(o.id)} accessibilityRole="button" accessibilityLabel={o.name} accessibilityState={{ selected: on }}
              style={styles.tile}
            >
              <View style={[styles.frame, { borderColor: on ? c.pencil : c.line, borderWidth: on ? 3 : 1.5 }]}>
                {o.id === AUTO_THEME ? (
                  <View style={styles.split}>
                    <Mini p={THEMES[0].palette} />
                    <Mini p={THEMES[1].palette} />
                  </View>
                ) : (
                  <Mini p={THEMES.find((t) => t.id === o.id)!.palette} />
                )}
              </View>
              <Text style={[styles.name, { color: on ? c.pencil : c.ink }]} numberOfLines={1}>{o.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.note, { color: c.muted }]}>Auto follows your phone's light or dark setting.</Text>
    </View>
  );
}

/** A tiny board in a palette: graph lines, a floor, a bar, a spring, the glass and the ball. */
function Mini({ p }: { p: Palette }) {
  return (
    <View style={[styles.mini, { backgroundColor: p.paper }]}>
      {[1, 2, 3, 4, 5].map((i) => <View key={`v${i}`} style={[styles.vline, { left: `${i * 16.6}%`, backgroundColor: p.grid }]} />)}
      {[1, 2, 3].map((i) => <View key={`h${i}`} style={[styles.hline, { top: `${i * 25}%`, backgroundColor: p.grid }]} />)}
      <View style={[styles.floor, { backgroundColor: p.ink }]} />
      <View style={[styles.bar, { backgroundColor: p.pencil }]} />
      <View style={styles.pad} />
      <View style={[styles.glassL, { backgroundColor: p.red }]} />
      <View style={[styles.glassR, { backgroundColor: p.red }]} />
      <View style={[styles.ball, { backgroundColor: p.steel, borderColor: p.ink }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  section: { fontSize: 20, fontFamily: FONTS.condensedBold, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '30%', flexGrow: 1, maxWidth: '32%', gap: 4, alignItems: 'center' },
  frame: { alignSelf: 'stretch', aspectRatio: 1.25, borderRadius: 10, overflow: 'hidden' },
  split: { flex: 1, flexDirection: 'row' },
  mini: { flex: 1, overflow: 'hidden' },
  vline: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  hline: { position: 'absolute', left: 0, right: 0, height: 1 },
  floor: { position: 'absolute', left: 0, right: 0, bottom: '14%', height: 2 },
  bar: { position: 'absolute', left: '18%', top: '30%', width: '34%', height: 4, borderRadius: 2, transform: [{ rotate: '-18deg' }] },
  pad: { position: 'absolute', left: '8%', bottom: '16%', width: '18%', height: 4, backgroundColor: '#ffb020' },
  glassL: { position: 'absolute', right: '30%', bottom: '14%', width: 2, height: '22%' },
  glassR: { position: 'absolute', right: '12%', bottom: '14%', width: 2, height: '22%' },
  ball: { position: 'absolute', right: '17%', bottom: '17%', width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
  name: { fontSize: 14, fontFamily: FONTS.bodySemi },
  note: { fontSize: 13, fontFamily: FONTS.body },
});
