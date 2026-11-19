import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import type { Chord } from '../core/chordTrain';
import { figurePool } from '../core/music';
import { pitchName, type Nomenclature } from '../core/notation';
import { harmonicColors as c } from '../theme/harmonic';
import { Button, Label, RhythmFigure, colors, styles } from './ui';

const beatsPerBar = 4;
const barsPerPage = 4;
const beatsPerPage = beatsPerBar * barsPerPage;
const roleNames = { tonic: 'Tónica', subdominant: 'Subdominante', dominant: 'Dominante' };
const easeOut = Easing.bezier(0.23, 1, 0.32, 1);

export function chordLabel(chord: Chord, nomenclature: Nomenclature) {
  const suffix = chord.symbol
    .slice(chord.tonic.length)
    .replace('mMaj7', 'm(maj7)')
    .replace('b5', '♭5');
  return pitchName(chord.tonic + '4', false, nomenclature) + suffix;
}

function useHarmonicMotion() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setEnabled(!preference.matches);
      preference.addEventListener('change', update);
      update();
      return () => preference.removeEventListener('change', update);
    }
    let mounted = true;
    const update = (reduced: boolean) => {
      if (mounted) setEnabled(!reduced);
    };
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(update)
      .catch(() => {});
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return enabled;
}

export function HarmonicWagons({
  active,
  chords,
  nomenclature,
  onChangeBeat,
  pattern,
  playing,
  wide,
}: {
  active: number;
  chords: Chord[] | null;
  nomenclature: Nomenclature;
  onChangeBeat: (index: number) => void;
  pattern: number[];
  playing: boolean;
  wide: boolean;
}) {
  const [page, setPage] = useState(0);
  const animate = useHarmonicMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    opacity.setValue(1);
    if (!animate || active < 0) return;
    opacity.setValue(0.35);
    const motion = Animated.timing(opacity, {
      toValue: 1,
      duration: 140,
      easing: easeOut,
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    motion.start();
    return () => motion.stop();
  }, [active, animate, opacity]);

  if (!chords)
    return <Label muted>Introduce un cifrado válido en Configuración para ver los acordes.</Label>;

  const pages = Math.ceil(chords.length / beatsPerPage);
  const visiblePage = playing
    ? Math.floor(Math.max(0, active) / beatsPerPage)
    : Math.min(page, pages - 1);
  const firstBeat = visiblePage * beatsPerPage;
  const bars = Array.from({ length: barsPerPage }, (_, index) => firstBeat + index * beatsPerBar);
  const current = active >= 0 ? chords[active] : undefined;

  return (
    <View style={{ gap: 10 }}>
      {pages > 1 ? (
        <View style={[styles.between, { flexWrap: 'wrap', minHeight: 44 }]}>
          <Label style={{ color: c.ink }}>
            {current
              ? `Compás ${Math.floor(active / beatsPerBar) + 1} de ${chords.length / beatsPerBar} · Pulso ${(active % beatsPerBar) + 1}`
              : `Compases ${firstBeat / beatsPerBar + 1}–${firstBeat / beatsPerBar + barsPerPage} de ${chords.length / beatsPerBar}`}
          </Label>
          {!playing ? (
            <View style={[styles.row, { gap: 4 }]}>
              <Button
                variant="ghost"
                disabled={visiblePage === 0}
                onPress={() => setPage(visiblePage - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                disabled={visiblePage === pages - 1}
                onPress={() => setPage(visiblePage + 1)}
              >
                Siguiente
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: '2%', rowGap: 8 }}>
        {bars.map((start) => {
          const bar = chords.slice(start, start + beatsPerBar);
          const chord = bar[0]!;
          const single = bar.every(({ symbol }) => symbol === chord.symbol);
          const role = chord.role;
          const tint = role ? c[role] : { background: colors.white, ink: c.ink };
          return (
            <View
              key={start}
              style={{
                width: wide ? '49%' : '100%',
                minWidth: 0,
                backgroundColor: tint.background,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: c.border,
                padding: 8,
                gap: 4,
              }}
            >
              <View style={[styles.between, { flexWrap: 'wrap', gap: 4, paddingHorizontal: 4 }]}>
                <Text style={{ color: tint.ink, fontSize: single ? 24 : 14, fontWeight: '700' }}>
                  {single ? chordLabel(chord, nomenclature) : `Compás ${start / beatsPerBar + 1}`}
                </Text>
                {role ? <Label style={{ color: tint.ink }}>{roleNames[role]}</Label> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {bar.map((beatChord, beat) => {
                  const index = start + beat;
                  const id = pattern[index]!;
                  const label = chordLabel(beatChord, nomenclature);
                  const selected = index === active;
                  const action = selected ? '. Pulso activo' : playing ? '' : '. Cambiar figura';
                  return (
                    <Pressable
                      key={beat}
                      accessibilityRole="button"
                      accessibilityLabel={`Pulso ${index + 1}, ${label}, ${figurePool[id]!.name}${action}`}
                      accessibilityState={{ selected, disabled: playing }}
                      disabled={playing}
                      onPress={() => onChangeBeat(index)}
                      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
                        flex: 1,
                        minWidth: 0,
                        minHeight: 46,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: selected || hovered ? tint.ink : 'transparent',
                        backgroundColor: pressed ? tint.background : colors.white,
                        alignItems: 'center',
                        justifyContent: 'center',
                      })}
                    >
                      {selected ? (
                        <Animated.View
                          pointerEvents="none"
                          style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            left: 0,
                            borderRadius: 6,
                            backgroundColor:
                              tint.background === colors.white ? c.stage : tint.background,
                            opacity,
                          }}
                        />
                      ) : null}
                      {!single ? (
                        <Text
                          style={{
                            color: tint.ink,
                            fontSize: 12,
                            fontWeight: '700',
                            textAlign: 'center',
                          }}
                        >
                          {label}
                        </Text>
                      ) : null}
                      <RhythmFigure id={id} color={tint.ink} size={36} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
