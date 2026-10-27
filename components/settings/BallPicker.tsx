import { Canvas, Circle, Group, useCanvasRef } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BALL_RADIUS } from '../../physics';
import { SKINS } from '../../game/skins';
import { FONTS, useColors } from '../../theme/colors';
import { BallArt } from '../board/BallArt';
import { useBallSkin } from './BallSkin';

const COLS = 6;
/** How much bigger than on the board each ball is drawn here. */
const ZOOM = 2.3;

/**
 * "Your ball" in Settings: every skin (game/skins.ts) drawn exactly as on the board, in one Skia canvas (a canvas per ball would use
 * up the browser's WebGL contexts), with a tap target over each. The chosen one is ringed and named; the choice is saved at once.
 */
export function BallPicker() {
  const c = useColors();
  const { skin, setSkin } = useBallSkin();
  const [w, setW] = useState(0);
  const cell = w / COLS;
  const rows = Math.ceil(SKINS.length / COLS);
  const canvasRef = useCanvasRef();
  // Safari can draw a new Skia canvas before its surface is ready (see Board.tsx): ask for a few more frames once it's laid out.
  useEffect(() => {
    if (Platform.OS !== 'web' || !w) return;
    const timers = [50, 250, 750].map((ms) => setTimeout(() => canvasRef.current?.redraw(), ms));
    return () => timers.forEach(clearTimeout);
  }, [w, skin.id, canvasRef]);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.section, { color: c.ink }]}>Your ball</Text>
        <Text style={[styles.name, { color: c.pencil }]}>{skin.name}</Text>
      </View>
      <Text style={[styles.note, { color: c.muted }]}>Just a look: every ball bounces exactly the same.</Text>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: cell * rows || undefined }}>
        {w > 0 && (
          <>
            <Canvas ref={canvasRef} style={{ width: w, height: cell * rows }}>
              {SKINS.map((s, i) => {
                const cx = (i % COLS) * cell + cell / 2, cy = Math.floor(i / COLS) * cell + cell / 2;
                const t = [{ translateX: cx }, { translateY: cy }, { scale: ZOOM }];
                return (
                  <Group key={s.id}>
                    {s.id === skin.id && (
                      <Circle cx={cx} cy={cy} r={BALL_RADIUS * ZOOM + 6} color={c.pencil} style="stroke" strokeWidth={2.5} />
                    )}
                    <BallArt skin={s} c={c} at={t} spun={[...t, { rotate: s.pattern === 'none' ? 0 : -0.35 }]} />
                  </Group>
                );
              })}
            </Canvas>
            {SKINS.map((s, i) => (
              <Pressable
                key={s.id} onPress={() => setSkin(s.id)}
                accessibilityRole="button" accessibilityLabel={s.name} accessibilityState={{ selected: s.id === skin.id }}
                style={[styles.hit, { left: (i % COLS) * cell, top: Math.floor(i / COLS) * cell, width: cell, height: cell }]}
              />
            ))}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  section: { fontSize: 20, fontFamily: FONTS.condensedBold, marginTop: 4 },
  name: { fontSize: 17, fontFamily: FONTS.condensedBold },
  note: { fontSize: 13, fontFamily: FONTS.body },
  hit: { position: 'absolute' },
});
