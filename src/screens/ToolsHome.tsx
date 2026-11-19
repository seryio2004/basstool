import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Heading, Icon, Label, colors, styles } from '../components/ui';
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
    { width } = useWindowDimensions();
  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 8 }}>
        <Heading level={1} style={styles.title}>
          Herramientas
        </Heading>
        <Label muted>Bajo configurado: {tunings[profile.tuning].name}.</Label>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {items.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={`${t.title}. ${t.detail}`}
            onPress={() => openTool(t.id)}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
              width: width >= 900 ? '49%' : '100%',
              minHeight: 96,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              padding: 22,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: hovered ? colors.pale : colors.white,
            })}
          >
            {t.icon === 'fretboard' ? (
              <FretboardIcon size={30} color={colors.green} />
            ) : (
              <Icon name={t.icon} size={30} color={colors.green} />
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.h3}>{t.title}</Text>
              <Label muted>{t.detail}</Label>
            </View>
            <Icon name="arrow" size={18} />
          </Pressable>
        ))}
      </View>
    </View>
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
