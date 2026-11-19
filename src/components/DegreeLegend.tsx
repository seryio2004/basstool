import React from 'react';
import { Text, View } from 'react-native';
import { colors, radius, space, styles } from './theme';

export function degreeFill(degree: number, label?: string) {
  if (label?.startsWith('♭') || label?.startsWith('𝄫')) return colors.degreeFlat;
  if (label?.startsWith('♯') || label?.startsWith('𝄪')) return colors.degreeSharp;
  return colors.degrees[(degree - 1) % 7]!;
}

export function DegreeLegend({
  tones,
  colored,
}: {
  tones: readonly { name?: string; degree: string; step: number }[];
  colored: boolean;
}) {
  return (
    <View
      accessibilityLabel="Leyenda de grados"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}
    >
      {tones.map(({ name, degree, step }) => (
        <View
          key={degree}
          style={{
            borderRadius: radius.badge,
            paddingVertical: space.xs,
            paddingHorizontal: space.s,
            backgroundColor: colored ? degreeFill(step, degree) : colors.raised,
          }}
        >
          <Text style={[styles.muted, { color: colored ? colors.onDegree : colors.ink }]}>
            {name ? `${degree} · ${name}` : degree}
          </Text>
        </View>
      ))}
    </View>
  );
}
