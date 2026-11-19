import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Heading, Icon, Label, colors, styles } from '../components/ui';
import { tunings } from '../core/instrument';
import { useStore } from '../data/Store';
import { Tool } from './Tools';

const items: { id: Tool; title: string; detail: string; icon: string }[] = [
  { id: 'tuner', title: 'Afinador', detail: 'Nota, cuerda y desviación en cents.', icon: 'tuner' },
  { id: 'metronome', title: 'Metrónomo', detail: 'Tempo, compás y acento.', icon: 'metronome' },
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
              width: width >= 900 ? '31.8%' : '100%',
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
            <Icon name={t.icon} size={30} color={colors.green} />
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
