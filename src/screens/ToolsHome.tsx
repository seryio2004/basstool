import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Button, Heading, Icon, Label, colors, styles } from '../components/ui';
import { tunings } from '../core/instrument';
import { useStore } from '../data/Store';
import { Tool } from './Tools';

const items: { id: Tool; title: string; detail: string; icon: string }[] = [
  { id: 'tuner', title: 'Afinador', detail: 'Nota, cuerda y desviación en cents.', icon: 'tuner' },
  { id: 'metronome', title: 'Metrónomo', detail: 'Tempo, compás y acento.', icon: 'metronome' },
  {
    id: 'fretboard',
    title: 'Mástil',
    detail: 'Escalas y arpegios en tu afinación, con notas o grados.',
    icon: 'fretboard',
  },
  {
    id: 'chords',
    title: 'Progresiones',
    detail: 'Grados y acordes por tonalidad para tocar encima.',
    icon: 'chord',
  },
];

export function ToolsHome({ openTool }: { openTool: (tool: Tool) => void }) {
  const { profile } = useStore(),
    { width } = useWindowDimensions(),
    wide = width >= 1000;
  const [tuner, ...rest] = items;
  return (
    <View style={{ gap: 32 }}>
      <View style={{ gap: 8 }}>
        <Heading level={1} style={styles.title}>
          Herramientas
        </Heading>
        <Label muted>Bajo configurado: {tunings[profile.tuning].name}.</Label>
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'stretch' }}>
        {/* Acción principal: el afinador, en su propia placa con el dial. */}
        <View
          style={[
            styles.panel,
            { flex: wide ? 1 : undefined, alignItems: 'center', paddingVertical: 32, gap: 18 },
          ]}
        >
          <VuDial />
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Heading level={2} style={styles.h2}>
              {tuner!.title}
            </Heading>
            <Label muted style={{ textAlign: 'center' }}>
              {tuner!.detail}
            </Label>
          </View>
          <Button icon="tuner" onPress={() => openTool(tuner!.id)}>
            Afinar el bajo
          </Button>
        </View>
        {/* El resto, como un rack: una placa con filas. */}
        <View style={[styles.panel, { flex: wide ? 1.3 : undefined, padding: 8, gap: 0 }]}>
          {rest.map((t, i) => (
            <React.Fragment key={t.id}>
              {i > 0 ? <View style={[styles.divider, { marginHorizontal: 18 }]} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.title}. ${t.detail}`}
                onPress={() => openTool(t.id)}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
                  minHeight: 88,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                  paddingHorizontal: 18,
                  paddingVertical: 16,
                  borderRadius: 10,
                  backgroundColor: hovered ? colors.raised : 'transparent',
                })}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.accentSoft,
                  }}
                >
                  {t.icon === 'fretboard' ? (
                    <FretboardIcon size={26} color={colors.accentText} />
                  ) : (
                    <Icon name={t.icon} size={26} color={colors.accentText} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.h3}>{t.title}</Text>
                  <Label muted>{t.detail}</Label>
                </View>
                <Icon name="arrow" size={18} color={colors.faint} />
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Dial de VU en reposo: la misma pieza que en el afinador, sin aguja viva. */
function VuDial() {
  const ticks = Array.from({ length: 11 }, (_, i) => -50 + i * 10);
  const point = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return { x: 100 + r * Math.cos(a), y: 100 + r * Math.sin(a) };
  };
  const tip = point(-14, 74);
  return (
    <Svg width={200} height={92} viewBox="0 10 200 92" accessibilityElementsHidden>
      {ticks.map((t) => {
        const a = point(t, 86),
          b = point(t, t === 0 ? 72 : 78);
        return (
          <Path
            key={t}
            d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
            stroke={t === 0 ? colors.accent : colors.faint}
            strokeWidth={t === 0 ? 2.5 : 1.5}
            strokeLinecap="round"
          />
        );
      })}
      <Path
        d={`M100 100L${tip.x} ${tip.y}`}
        stroke={colors.ink}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={100} cy={100} r={6} fill={colors.accent} />
    </Svg>
  );
}

/** Icono de mástil con el mismo trazo que los iconos de `ui.tsx`. */
function FretboardIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.65}
      strokeLinecap="round"
      accessibilityElementsHidden
    >
      <Path d="M3.5 7.5h17a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-17Z" />
      <Path d="M3.5 7.5v9" strokeWidth={2.6} />
      <Path d="M3.5 10.5h18.5M3.5 13.5h18.5" strokeWidth={1.1} />
      <Circle cx="10.5" cy="12" r="1.3" fill={color} stroke="none" />
      <Circle cx="16.5" cy="12" r="1.3" fill={color} stroke="none" />
    </Svg>
  );
}
