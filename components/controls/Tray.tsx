import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Slot } from '../../game/pieces';
import { FONTS, useColors } from '../../theme/colors';

interface Props {
  slots: Slot[];
  selected: number | null;
  onTap: (k: number) => void;
  disabled?: boolean;
}

/** One chip per piece, as in the prototype: "Bar 90" in the tray, "Placed" on the board, "Remove" when selected. */
export function Tray({ slots, selected, onTap, disabled }: Props) {
  const c = useColors();
  if (!slots.length) {
    return <Text style={[styles.none, { color: c.muted }]}>No pieces on this level</Text>;
  }
  return (
    <View style={styles.tray}>
      {slots.map((s, k) => {
        const sel = selected === k && s.onBoard;
        const label = s.onBoard ? (sel ? 'Remove' : 'Placed') : `Bar ${s.len}`;
        const fg = sel ? c.panel : c.pencil;
        return (
          <Pressable
            key={k}
            onPress={() => onTap(k)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={s.onBoard ? (sel ? `Remove bar ${s.len}` : `Select bar ${s.len}`) : `Place bar ${s.len}`}
            style={[
              styles.chip,
              { borderColor: c.pencil },
              s.onBoard && !sel && styles.on,
              sel && { backgroundColor: c.pencil },
            ]}
          >
            <View style={styles.iconBox}>
              <View style={[styles.icon, { width: (s.len / 90) * 34 * ICON_SCALE, backgroundColor: fg }]} />
            </View>
            <Text style={[styles.text, { color: fg }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// The prototype's chip icon is a 40-unit-wide SVG drawn at 34px.
const ICON_SCALE = 34 / 40;

const styles = StyleSheet.create({
  tray: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  none: { fontSize: 13, fontFamily: FONTS.body, alignSelf: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12,
    borderRadius: 19, borderWidth: 1.5,
  },
  on: { opacity: 0.55, borderStyle: 'dashed' },
  iconBox: { width: 34, height: 10, justifyContent: 'center', paddingLeft: 3 * ICON_SCALE },
  icon: { height: 3.5, borderRadius: 2 },
  text: { fontSize: 14, fontFamily: FONTS.bodySemi },
});
