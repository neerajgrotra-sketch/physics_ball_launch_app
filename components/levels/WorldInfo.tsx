import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Polygon, Rect } from 'react-native-svg';
import { LEVELS } from '../../levels';
import { type FeatureKind, type World, WORLDS, levelContents } from '../../game/worlds';
import { useProgress } from '../progress/ProgressProvider';
import { FONTS, useColors } from '../../theme/colors';
import { ShotThumbnail } from './ShotThumbnail';

/**
 * A world's info card, opened by the ⓘ on its header in the level list: the big idea, each new thing drawn the way it looks
 * on the board, a pro tip, the world's levels with the stars won so far, and a peek at its final level.
 */
export function WorldInfo({ world, onClose }: { world: World | null; onClose: () => void }) {
  const c = useColors();
  const { best, shots } = useProgress();
  const { width } = useWindowDimensions();
  if (!world) return null;
  const n = WORLDS.indexOf(world) + 1;
  const levels = world.ids.map((id) => LEVELS.find((l) => l.id === id)!);
  const scored = levels.filter((l) => l.id !== '00-tutorial');
  const stars = scored.reduce((sum, l) => sum + (best[l.id]?.stars ?? 0), 0);
  const boss = levels[levels.length - 1];
  const bossNo = LEVELS.indexOf(boss) + 1;
  const bossW = Math.min(420, width - 44) - 36 - 2;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close world info">
        <Pressable style={[styles.sheet, { backgroundColor: c.paper, borderColor: c.line }]} onPress={() => {}}>
          <ScrollView contentContainerStyle={styles.body}>
            <View style={[styles.banner, { backgroundColor: c.pencil }]}>
              <Text style={[styles.kicker, { color: c.paper }]}>WORLD {n}</Text>
              <Text style={[styles.title, { color: c.paper }]}>{world.name}</Text>
              <Text style={[styles.tagline, { color: c.paper }]}>{world.tagline}</Text>
            </View>
            <Text style={[styles.pitch, { color: c.ink }]}>{world.pitch}</Text>

            <Text style={[styles.section, { color: c.muted }]}>WHAT YOU'LL MEET</Text>
            {world.features.map((f) => (
              <View key={f.name} style={[styles.feature, { borderColor: c.line }]}>
                <FeatureIcon kind={f.kind} />
                <View style={styles.featureText}>
                  <Text style={[styles.featureName, { color: c.ink }]}>{f.name}</Text>
                  <Text style={[styles.featureBody, { color: c.muted }]}>{f.text}</Text>
                </View>
              </View>
            ))}

            <View style={[styles.tip, { borderColor: c.red }]}>
              <Text style={[styles.tipLabel, { color: c.red }]}>PRO TIP</Text>
              <Text style={[styles.tipBody, { color: c.ink }]}>{world.tip}</Text>
            </View>

            <Text style={[styles.section, { color: c.muted }]}>
              {levels.length} LEVELS · {stars} OF {scored.length * 3} ★
            </Text>
            <View style={styles.levels}>
              {levels.map((l) => {
                const b = best[l.id];
                return (
                  <View key={l.id} style={[styles.chip, { borderColor: b ? c.pencil : c.line, backgroundColor: b ? c.pencil : 'transparent' }]}>
                    <Text style={[styles.chipNum, { color: b ? c.paper : c.ink }]}>{LEVELS.indexOf(l) + 1}</Text>
                    <Text style={[styles.chipStars, { color: b ? c.paper : c.line }]}>
                      {l.id === '00-tutorial' ? '✓' : '★'.repeat(b?.stars ?? 0) + '☆'.repeat(3 - (b?.stars ?? 0))}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Text style={[styles.section, { color: c.muted }]}>THE FINAL TEST</Text>
            <View style={[styles.boss, { borderColor: c.line }]}>
              <ShotThumbnail level={boss} shot={shots[boss.id]} width={bossW} height={bossW * 0.95} />
              <View style={[styles.bossLabel, { backgroundColor: c.ink }]}>
                <Text style={[styles.bossText, { color: c.paper }]}>Level {bossNo} · {boss.name}</Text>
              </View>
            </View>
            <Text style={[styles.bossMeta, { color: c.muted }]}>{levelContents(boss)} · par {boss.par}</Text>

            <Pressable onPress={onClose} accessibilityRole="button" style={[styles.go, { backgroundColor: c.red }]}>
              <Text style={styles.goText}>{stars > 0 ? 'Keep going' : "Let's play"}</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** A small drawing of a world's new thing, in the board's own colours. */
function FeatureIcon({ kind }: { kind: FeatureKind }) {
  const c = useColors();
  const spikes = (x0: number, x1: number, y: number, up: boolean) => {
    const pts: string[] = [];
    for (let x = x0; x < x1; x += 8) pts.push(`${x},${y} ${x + 4},${y + (up ? -6 : 6)} ${x + 8},${y}`);
    return pts.map((p, i) => <Polygon key={i} points={p} fill={c.red} />);
  };
  return (
    <Svg width={64} height={44} viewBox="0 0 64 44">
      <Rect x={0} y={0} width={64} height={44} rx={8} fill={c.paper} stroke={c.line} strokeWidth={1} />
      {kind === 'bar' && (
        <>
          <Line x1={12} y1={32} x2={52} y2={14} stroke={c.pencil} strokeWidth={6} strokeLinecap="round" />
          <Circle cx={20} cy={14} r={5} fill={c.steel} stroke={c.ink} strokeWidth={1.5} />
        </>
      )}
      {kind === 'glass' && (
        <>
          <Rect x={23} y={12} width={18} height={24} fill={c.red} opacity={0.12} />
          <Line x1={23} y1={12} x2={23} y2={36} stroke={c.red} strokeWidth={3} />
          <Line x1={41} y1={12} x2={41} y2={36} stroke={c.red} strokeWidth={3} />
          <Line x1={19} y1={36} x2={45} y2={36} stroke={c.red} strokeWidth={3} />
          <Circle cx={32} cy={29} r={5.5} fill={c.steel} stroke={c.ink} strokeWidth={1.5} />
        </>
      )}
      {kind === 'block' && <Rect x={14} y={10} width={36} height={24} fill={c.steel} stroke={c.ink} strokeWidth={2.5} />}
      {kind === 'spikedblock' && (
        <>
          {spikes(14, 50, 12, true)}
          <Rect x={14} y={12} width={36} height={22} fill={c.steel} stroke={c.ink} strokeWidth={2.5} />
        </>
      )}
      {kind === 'hazard' && (
        <>
          {spikes(12, 52, 16, true)}
          {spikes(12, 52, 28, false)}
          <Rect x={12} y={16} width={40} height={12} fill={c.red} />
        </>
      )}
      {kind === 'pad' && (
        <>
          <Line x1={24} y1={8} x2={30} y2={18} stroke={c.ink} strokeWidth={1.5} strokeDasharray="3 3" />
          <Line x1={34} y1={18} x2={42} y2={6} stroke="#ffb020" strokeWidth={2} />
          <Rect x={12} y={22} width={40} height={10} fill="#ffb020" stroke={c.ink} strokeWidth={2} />
        </>
      )}
      {kind === 'springbar' && (
        <>
          <Line x1={12} y1={30} x2={52} y2={18} stroke="#ffb020" strokeWidth={7} strokeLinecap="round" />
          <Circle cx={30} cy={11} r={4.5} fill={c.steel} stroke={c.ink} strokeWidth={1.5} />
        </>
      )}
      {kind === 'portal' && (
        <>
          <Circle cx={20} cy={22} r={10} fill="#14202e" stroke="#2f9bff" strokeWidth={3.5} />
          <Circle cx={46} cy={22} r={10} fill="#14202e" stroke="#ff7a1a" strokeWidth={3.5} />
          <Circle cx={46} cy={22} r={4} fill={c.steel} />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 22 },
  sheet: { borderRadius: 16, borderWidth: 1.5, maxWidth: 420, maxHeight: '90%', width: '100%', alignSelf: 'center', overflow: 'hidden' },
  body: { paddingBottom: 18, gap: 12 },
  banner: { paddingHorizontal: 18, paddingVertical: 16, gap: 2 },
  kicker: { fontSize: 13, fontFamily: FONTS.condensedBold, letterSpacing: 2, opacity: 0.85 },
  title: { fontSize: 36, fontFamily: FONTS.condensedBold, lineHeight: 40 },
  tagline: { fontSize: 17, fontFamily: FONTS.bodySemi },
  pitch: { fontSize: 15, fontFamily: FONTS.bodyMedium, paddingHorizontal: 18, lineHeight: 21 },
  section: { fontSize: 12, fontFamily: FONTS.condensedBold, letterSpacing: 1.5, paddingHorizontal: 18, marginTop: 4 },
  feature: { flexDirection: 'row', gap: 12, alignItems: 'center', marginHorizontal: 18, paddingBottom: 10, borderBottomWidth: 1 },
  featureText: { flex: 1, gap: 2 },
  featureName: { fontSize: 16, fontFamily: FONTS.bodySemi },
  featureBody: { fontSize: 14, fontFamily: FONTS.body, lineHeight: 19 },
  tip: { marginHorizontal: 18, borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 4, gap: 2 },
  tipLabel: { fontSize: 12, fontFamily: FONTS.condensedBold, letterSpacing: 1.5 },
  tipBody: { fontSize: 15, fontFamily: FONTS.bodyMedium, lineHeight: 20 },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 18 },
  chip: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', minWidth: 52 },
  chipNum: { fontSize: 17, fontFamily: FONTS.condensedBold },
  chipStars: { fontSize: 11, letterSpacing: 1 },
  boss: { marginHorizontal: 18, borderWidth: 1, borderRadius: 10, overflow: 'hidden', alignItems: 'center' },
  bossLabel: { position: 'absolute', top: 8, left: 8, borderRadius: 12, paddingHorizontal: 10, height: 24, justifyContent: 'center' },
  bossText: { fontSize: 14, fontFamily: FONTS.condensedBold },
  bossMeta: { fontSize: 13, fontFamily: FONTS.bodyMedium, paddingHorizontal: 18, marginTop: -6 },
  go: { marginHorizontal: 18, marginTop: 6, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  goText: { color: '#fff', fontSize: 19, fontFamily: FONTS.condensedBold },
});
