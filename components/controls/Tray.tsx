import { Pressable, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import type { Slot } from '../../game/pieces';
import { FONTS, useColors } from '../../theme/colors';

interface Props {
  slots: Slot[];
  selected: number | null;
  onTap: (k: number) => void;
  disabled?: boolean;
  /** Where chip k sits within the tray (for the idle coach's finger). */
  onChipLayout?: (k: number, layout: LayoutRectangle) => void;
}

/**
 * One chip per bar, named Bar 1, Bar 2, Bar 3 (the board shows the same numbers). Outlined in the tray,
 * faded and dashed on the board, filled when selected. The line icon shows the bar's length.
 */
export function Tray({ slots, selected, onTap, disabled, onChipLayout }: Props) {
  const c = useColors();
  if (!slots.length) {
    return <Text style={[styles.none, { color: c.muted }]}>No pieces on this level</Text>;
  }
  const compact = slots.length > 3; // 4 or more bars: just the number, so they all fit on one row
  return (
    <View style={styles.tray}>
      {slots.map((s, k) => {
        const sel = selected === k && s.onBoard;
        const label = compact ? `${k + 1}` : `Bar ${k + 1}`;
        const fg = sel ? c.panel : c.pencil;
        return (
          <Pressable
            key={k}
            onPress={() => onTap(k)}
            onLayout={(e) => onChipLayout?.(k, e.nativeEvent.layout)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={s.onBoard ? (sel ? `Deselect bar ${k + 1}` : `Select bar ${k + 1}`) : `Place bar ${k + 1}`}
            style={[
              styles.chip,
              compact && styles.chipCompact,
              { borderColor: c.pencil },
              s.onBoard && !sel && styles.on,
              sel && { backgroundColor: c.pencil },
            ]}
          >
            <View style={[styles.iconBox, compact && styles.iconBoxCompact]}>
              <View style={[styles.icon, { width: ((s.len / 90) * 34 * ICON_SCALE) * (compact ? 0.5 : 1), backgroundColor: fg }]} />
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
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 10,
    borderRadius: 17, borderWidth: 1.5,
  },
  chipCompact: { paddingHorizontal: 7, gap: 3 },
  iconBoxCompact: { width: 20 },
  on: { opacity: 0.55, borderStyle: 'dashed' },
  iconBox: { width: 34, height: 10, justifyContent: 'center', paddingLeft: 3 * ICON_SCALE },
  icon: { height: 3.5, borderRadius: 2 },
  text: { fontSize: 14, fontFamily: FONTS.bodySemi },
});
