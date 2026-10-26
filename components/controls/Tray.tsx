import Svg, { Path } from 'react-native-svg';
import { Pressable, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import type { Slot } from '../../game/pieces';
import { FONTS, useColors } from '../../theme/colors';

interface Props {
  slots: Slot[];
  selected: number | null;
  onTap: (k: number) => void;
  /** The cannon chip: switch the sliders back to the aim. `aiming` is when no bar is selected. */
  onAim?: () => void;
  aiming?: boolean;
  disabled?: boolean;
  /** Where chip k sits within the tray (for the idle coach's finger). */
  onChipLayout?: (k: number, layout: LayoutRectangle) => void;
}

/**
 * One chip per bar, named Bar 1, Bar 2, Bar 3 (the board shows the same numbers). Outlined in the tray,
 * faded and dashed on the board, filled when selected. The line icon shows the bar's length.
 */
export function Tray({ slots, selected, onTap, onAim, aiming, disabled, onChipLayout }: Props) {
  const c = useColors();
  if (!slots.length) {
    return <Text style={[styles.none, { color: c.muted }]}>No pieces on this level</Text>;
  }
  const compact = slots.length > 3; // 4 or more bars: just the number, so they all fit on one row
  return (
    <View style={styles.tray}>
      {onAim && (
        <Pressable
          onPress={onAim}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Aim the cannon"
          style={[styles.gun, { borderColor: c.pencil }, aiming && { backgroundColor: c.pencil }]}
        >
          <Cannon color={aiming ? c.panel : c.pencil} />
        </Pressable>
      )}
      {slots.map((s, k) => {
        const sel = selected === k && s.onBoard;
        const label = `Bar ${k + 1}`;
        const spring = (s.restitution ?? 0) > 1;
        const fg = sel ? c.panel : spring ? '#e08a00' : c.pencil;
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
              { borderColor: spring ? '#e08a00' : c.pencil },
              s.onBoard && !sel && styles.on,
              sel && { backgroundColor: spring ? '#e08a00' : c.pencil },
            ]}
          >
            {spring ? (
              <Bolt color={fg} />
            ) : (
              <View style={[styles.iconBox, compact && styles.iconBoxCompact]}>
                <View style={[styles.icon, { width: ((s.len / 90) * 34 * ICON_SCALE) * (compact ? 0.33 : 1), backgroundColor: fg }]} />
              </View>
            )}
            <Text style={[styles.text, compact && styles.textCompact, { color: fg }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The cannon on its chip: a barrel on a tapered base. */
function Cannon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M3 17 L13 17 L11 11 L5 11 Z" fill={color} />
      <Path d="M8 11 L14 4" stroke={color} strokeWidth={3.4} strokeLinecap="round" />
    </Svg>
  );
}

/** The energy bolt on a spring bar's chip. */
function Bolt({ color }: { color: string }) {
  return (
    <Svg width={11} height={16} viewBox="0 0 11 16">
      <Path d="M6.8 0 L0.6 9 H4.6 L3.4 16 L10.4 6.4 H6.2 Z" fill={color} />
    </Svg>
  );
}

// The prototype's chip icon is a 40-unit-wide SVG drawn at 34px.
const ICON_SCALE = 34 / 40;

const styles = StyleSheet.create({
  tray: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gun: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  none: { fontSize: 13, fontFamily: FONTS.body, alignSelf: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 10,
    borderRadius: 17, borderWidth: 1.5,
  },
  chipCompact: { paddingHorizontal: 5, gap: 2 },
  iconBoxCompact: { width: 12, paddingLeft: 0 },
  on: { opacity: 0.55, borderStyle: 'dashed' },
  iconBox: { width: 34, height: 10, justifyContent: 'center', paddingLeft: 3 * ICON_SCALE },
  icon: { height: 3.5, borderRadius: 2 },
  text: { fontSize: 14, fontFamily: FONTS.bodySemi },
  textCompact: { fontSize: 13 },
});
