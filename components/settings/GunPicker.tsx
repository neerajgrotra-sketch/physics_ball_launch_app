import { Canvas, Group, RoundedRect, Skia, useCanvasRef } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LAUNCHER, WORLD } from '../../physics';
import { GUNS } from '../../game/guns';
import { FONTS, useColors } from '../../theme/colors';
import { BallArt } from '../board/BallArt';
import { GunArt } from '../board/GunArt';
import { useBallSkin } from './BallSkin';

const COLS = 3;
/** The part of the board each cell shows, around the gun, in world units: wide enough for the cue drawn back. */
const VIEW = { w: 130, h: 80 };

/**
 * "Your gun" in Settings: every gun (game/guns.ts) drawn as on the board, aimed up and loaded with the player's ball, in one Skia
 * canvas (a canvas per gun would use up the browser's WebGL contexts), with a tap target over each. The chosen one is framed and
 * named; the choice is saved at once.
 */
export function GunPicker() {
  const c = useColors();
  const { skin, gun, setGun } = useBallSkin();
  const [w, setW] = useState(0);
  const cellW = w / COLS, cellH = (cellW * VIEW.h) / VIEW.w;
  const rows = Math.ceil(GUNS.length / COLS);
  const canvasRef = useCanvasRef();
  useEffect(() => {
    if (Platform.OS !== 'web' || !w) return;
    const timers = [50, 250, 750].map((ms) => setTimeout(() => canvasRef.current?.redraw(), ms));
    return () => timers.forEach(clearTimeout);
  }, [w, gun.id, canvasRef]);

  const k = cellW / VIEW.w;
  // The window's top-left in world units: the gun a little left of centre (the cue reaches back), the floor along the bottom.
  const x0 = LAUNCHER.x - VIEW.w * 0.5, y0 = WORLD.ground + 4 - VIEW.h;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.section, { color: c.ink }]}>Your gun</Text>
        <Text style={[styles.name, { color: c.pencil }]}>{gun.name}</Text>
      </View>
      <Text style={[styles.note, { color: c.muted }]}>Just a look: every gun fires exactly the same shot.</Text>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: cellH * rows || undefined }}>
        {w > 0 && (
          <>
            <Canvas ref={canvasRef} style={{ width: w, height: cellH * rows }}>
              {GUNS.map((g, i) => {
                const cx = (i % COLS) * cellW, cy = Math.floor(i / COLS) * cellH;
                const chosen = g.id === gun.id;
                return (
                  <Group key={g.id}>
                    <RoundedRect x={cx + 3} y={cy + 3} width={cellW - 6} height={cellH - 6} r={10} color={c.paper} />
                    <Group clip={Skia.RRectXY(Skia.XYWHRect(cx + 3, cy + 3, cellW - 6, cellH - 6), 10, 10)}>
                      <Group transform={[{ translateX: cx }, { translateY: cy }, { scale: k }, { translateX: -x0 }, { translateY: -y0 }]}>
                        <GunArt gun={g} angle={28} power={60} c={c} />
                        <BallArt skin={skin} c={c} at={[{ translateX: LAUNCHER.x }, { translateY: LAUNCHER.y }]} spun={[{ translateX: LAUNCHER.x }, { translateY: LAUNCHER.y }]} />
                      </Group>
                    </Group>
                    <RoundedRect
                      x={cx + 3} y={cy + 3} width={cellW - 6} height={cellH - 6} r={10}
                      color={chosen ? c.pencil : c.line} style="stroke" strokeWidth={chosen ? 3 : 1}
                    />
                  </Group>
                );
              })}
            </Canvas>
            {GUNS.map((g, i) => (
              <Pressable
                key={g.id} onPress={() => setGun(g.id)}
                accessibilityRole="button" accessibilityLabel={g.name} accessibilityState={{ selected: g.id === gun.id }}
                style={[styles.hit, { left: (i % COLS) * cellW, top: Math.floor(i / COLS) * cellH, width: cellW, height: cellH }]}
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
