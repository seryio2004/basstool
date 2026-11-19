import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Text as SvgText } from 'react-native-svg';
import {
  chordLineBeats,
  chordLineMeasure,
  ticksPerBeat,
  type ChordLineRhythm,
} from '../core/chordLine';
import type { Chord } from '../core/chordTrain';
import { figurePool } from '../core/music';
import { pitchName, type Nomenclature } from '../core/notation';
import { harmonicColors as c } from '../theme/harmonic';
import { Button, Label, RhythmFigure, colors, styles } from './ui';

const beatsPerBar = chordLineBeats;
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

function WagonPulse({
  measure,
  beat,
  color,
}: {
  measure: ReturnType<typeof chordLineMeasure>;
  beat: number;
  color: string;
}) {
  const start = beat * ticksPerBeat;
  const end = start + ticksPerBeat;
  const slots = measure.events.filter(
    ({ tick, duration }) => tick < end && tick + duration > start,
  );
  const xFor = (tick: number) => 6 + ((tick - start) * 54) / ticksPerBeat;
  return (
    <Svg width="100%" height={30} viewBox="0 0 66 34" accessible={false}>
      {measure.triplet ? (
        <SvgText x={33} y={9} textAnchor="middle" fontSize={10} fill={color}>
          3
        </SvgText>
      ) : null}
      {slots.map(({ tick, duration, kind }) => {
        const x = xFor(tick);
        if (kind === 'rest') {
          return (
            <Path
              key={tick}
              d={`M${xFor(Math.max(tick, start))} 16 l4 4 -3 4 3 4`}
              stroke={color}
              strokeWidth={1.5}
              fill="none"
            />
          );
        }
        if (tick < start) {
          return (
            <Line
              key={tick}
              x1={4}
              x2={xFor(Math.min(end, tick + duration)) - 2}
              y1={24}
              y2={24}
              stroke={color}
              strokeWidth={1.5}
            />
          );
        }
        return (
          <React.Fragment key={tick}>
            {kind === 'dead' ? (
              <Path d={`M${x - 3} 21 l6 6 m0 -6 l-6 6`} stroke={color} strokeWidth={1.5} />
            ) : (
              <Ellipse
                cx={x}
                cy={24}
                rx={4}
                ry={2.7}
                fill={duration === 24 ? 'none' : color}
                stroke={color}
                strokeWidth={1.4}
              />
            )}
            <Line x1={x + 3} x2={x + 3} y1={24} y2={11} stroke={color} strokeWidth={1.7} />
            {duration < 12 ? (
              <Path
                d={`M${x + 3} 11 q7 2 6 7${duration === 3 ? ' m-6 -3 q7 2 6 7' : ''}`}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
              />
            ) : null}
            {duration === 18 ? <Circle cx={x + 7} cy={24} r={1.4} fill={color} /> : null}
            {tick + duration > end ? (
              <Path
                d={`M${x + 3} 28 Q${(x + 63) / 2} 34 63 28`}
                fill="none"
                stroke={color}
                strokeWidth={1.3}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export function HarmonicWagons({
  active,
  chords,
  nomenclature,
  onChangeBeat,
  pattern,
  wagons,
  playing,
  wide,
}: {
  active: number;
  chords: Chord[] | null;
  nomenclature: Nomenclature;
  onChangeBeat: (index: number) => void;
  pattern: number[];
  wagons?: ChordLineRhythm[];
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
          const id = wagons?.[start / beatsPerBar];
          const measure = id ? chordLineMeasure(id) : undefined;
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
              {measure ? (
                <Label style={{ color: tint.ink, paddingHorizontal: 4 }}>{measure.label}</Label>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {bar.map((beatChord, beat) => {
                  const index = start + beat;
                  const id = pattern[index]!;
                  const label = chordLabel(beatChord, nomenclature);
                  const selected = index === active;
                  const action = selected ? '. Pulso activo' : playing ? '' : '. Cambiar figura';
                  const cell: ViewStyle = {
                    flex: 1,
                    minWidth: 0,
                    minHeight: 46,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: selected ? tint.ink : 'transparent',
                    backgroundColor: colors.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                  };
                  const content = (
                    <>
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
                      {measure ? (
                        <WagonPulse measure={measure} beat={beat} color={tint.ink} />
                      ) : (
                        <RhythmFigure id={id} color={tint.ink} size={36} />
                      )}
                    </>
                  );
                  if (measure) {
                    const startTick = beat * ticksPerBeat;
                    const events = measure.events
                      .filter(
                        ({ tick, duration }) =>
                          tick + duration > startTick && tick < startTick + ticksPerBeat,
                      )
                      .map(({ tick, kind }) => {
                        if (kind === 'rest') return 'silencio';
                        if (tick < startTick) return 'nota sostenida';
                        const sub = tick - startTick;
                        const onset = sub ? `en +${sub}/12 de pulso` : 'al pulso';
                        return `${kind === 'dead' ? 'nota muerta' : 'nota'} ${onset}`;
                      });
                    return (
                      <View
                        key={beat}
                        accessible
                        style={cell}
                        accessibilityLabel={`Pulso ${index + 1}, ${label}, ${events.join(', ')}${selected ? '. Pulso activo' : ''}`}
                      >
                        {content}
                      </View>
                    );
                  }
                  return (
                    <Pressable
                      key={beat}
                      accessibilityRole="button"
                      accessibilityLabel={`Pulso ${index + 1}, ${label}, ${figurePool[id]!.name}${action}`}
                      accessibilityState={{ selected, disabled: playing }}
                      disabled={playing}
                      onPress={() => onChangeBeat(index)}
                      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                        cell,
                        {
                          borderColor: selected || hovered ? tint.ink : 'transparent',
                          backgroundColor: pressed ? tint.background : colors.white,
                        },
                      ]}
                    >
                      {content}
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
