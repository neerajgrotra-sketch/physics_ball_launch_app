import Slider from '@react-native-community/slider';
import { useEffect, useRef } from 'react';
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

interface RotateProps {
  /** The bar's number, as on its tray chip. */
  bar: number;
  /** Shown rotation, 0–179° counter-clockwise from flat (game/pieces shownAngle). */
  angle: number;
  onAngle: (shown: number) => void;
  onNudge: (by: 1 | -1) => void;
  onDone: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

/**
 * Shown in place of the aim rows while a bar is selected, at the same height so the board doesn't jump:
 * which bar, Done and Remove, then a rotation slider with −/+ 1° nudges (hold to keep turning).
 */
export function RotateControls({ bar, angle, onAngle, onNudge, onDone, onRemove, disabled }: RotateProps) {
  const c = useColors();
  return (
    <View style={[styles.rows, disabled && styles.disabled]} pointerEvents={disabled ? 'none' : 'auto'}>
      <View style={styles.row}>
        <Text style={[styles.title, { color: c.pencil }]}>Bar {bar}</Text>
        <View style={styles.spacer} />
        <Pill label="Remove" onPress={onRemove} color={c.red} border={c.line} />
        <Pill label="Done" onPress={onDone} color={c.ink} border={c.line} />
      </View>
      <Row
        label="Rotate" value={angle} readout={`${angle}°`}
        min={0} max={179} step={1}
        onChange={(v) => onAngle(Math.round(v))} onNudge={onNudge}
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
      <Nudge text="−" onStep={() => onNudge(-1)} a11y={`Decrease ${name}`} />
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
      <Nudge text="+" onStep={() => onNudge(1)} a11y={`Increase ${name}`} />
      <Text style={[styles.readout, { color: c.ink }]}>{readout}</Text>
    </View>
  );
}

/**
 * One step on tap; hold to keep stepping (about 15 steps a second). A tap uses onPress, which fires
 * reliably for quick taps on web (onPressIn didn't); a hold starts repeating via onLongPress.
 */
function Nudge({ text, onStep, a11y }: { text: string; onStep: () => void; a11y: string }) {
  const c = useColors();
  const step = useRef(onStep);
  step.current = onStep;
  const repeat = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stop = () => {
    clearInterval(repeat.current);
    repeat.current = undefined;
  };
  useEffect(() => stop, []);
  return (
    <Pressable
      onPress={() => step.current()}
      delayLongPress={350}
      onLongPress={() => {
        step.current();
        repeat.current = setInterval(() => step.current(), 65);
      }}
      onPressOut={stop}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={({ pressed }) => [styles.nudge, { borderColor: c.line, opacity: pressed ? 0.5 : 1 }]}
    >
      <Text style={[styles.nudgeText, { color: c.ink }]}>{text}</Text>
    </Pressable>
  );
}

function Pill({ label, onPress, color, border }: { label: string; onPress: () => void; color: string; border: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={4} style={[styles.pill, { borderColor: border }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rows: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { width: 52, fontSize: 15, fontFamily: FONTS.condensed },
  nudge: { width: 30, height: 28, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  nudgeText: { fontSize: 16, fontFamily: FONTS.bodySemi },
  slider: { flex: 1, height: 28 },
  readout: { width: 58, textAlign: 'right', fontSize: 18, fontFamily: FONTS.condensed, fontVariant: ['tabular-nums'] },
  title: { fontSize: 17, fontFamily: FONTS.condensedBold },
  spacer: { flex: 1 },
  pill: { height: 28, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center' },
  pillText: { fontSize: 14, fontFamily: FONTS.bodySemi },
  disabled: { opacity: 0.5 },
});
