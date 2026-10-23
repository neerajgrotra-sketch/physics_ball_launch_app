import Slider from '@react-native-community/slider';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ANGLE_MAX, ANGLE_MIN, POWER_MAX, POWER_MIN, nudgeAngle, nudgePower, toGrid,
} from '../../game/aim';
import { ANGLE_STEP, POWER_STEP } from '../../physics';
import { FONTS, useColors } from '../../theme/colors';

interface Props {
  angle: number;
  power: number;
  onAngle: (v: number) => void;
  onPower: (v: number) => void;
}

/** Angle and power sliders with −/+ nudge buttons, laid out like the prototype's .row grid. */
export function AimControls({ angle, power, onAngle, onPower }: Props) {
  return (
    <View style={styles.rows}>
      <Row
        label="Angle" value={angle} readout={`${angle.toFixed(1)}°`}
        min={ANGLE_MIN} max={ANGLE_MAX} step={ANGLE_STEP}
        onChange={onAngle} onNudge={(d) => onAngle(nudgeAngle(angle, d))}
      />
      <Row
        label="Power" value={power} readout={power.toFixed(1)}
        min={POWER_MIN} max={POWER_MAX} step={POWER_STEP}
        onChange={onPower} onNudge={(d) => onPower(nudgePower(power, d))}
      />
    </View>
  );
}

interface RowProps {
  label: string;
  value: number;
  readout: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onNudge: (dir: 1 | -1) => void;
}

function Row({ label, value, readout, min, max, step, onChange, onNudge }: RowProps) {
  const c = useColors();
  const name = label.toLowerCase();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <Nudge text="−" onPress={() => onNudge(-1)} a11y={`Decrease ${name}`} />
      <Slider
        style={styles.slider}
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onValueChange={(v) => onChange(toGrid(v))}
        minimumTrackTintColor={c.pencil}
        maximumTrackTintColor={c.line}
        thumbTintColor={c.pencil}
        accessibilityLabel={label}
      />
      <Nudge text="+" onPress={() => onNudge(1)} a11y={`Increase ${name}`} />
      <Text style={[styles.readout, { color: c.ink }]}>{readout}</Text>
    </View>
  );
}

function Nudge({ text, onPress, a11y }: { text: string; onPress: () => void; a11y: string }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={({ pressed }) => [styles.nudge, { borderColor: c.line, opacity: pressed ? 0.5 : 1 }]}
    >
      <Text style={[styles.nudgeText, { color: c.ink }]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rows: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { width: 52, fontSize: 15, fontFamily: FONTS.condensed },
  nudge: { width: 30, height: 30, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  nudgeText: { fontSize: 16, fontFamily: FONTS.bodySemi },
  slider: { flex: 1, height: 30 },
  readout: { width: 58, textAlign: 'right', fontSize: 18, fontFamily: FONTS.condensed, fontVariant: ['tabular-nums'] },
});
