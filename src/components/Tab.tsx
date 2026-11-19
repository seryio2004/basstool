import React from 'react';
import { Platform, View } from 'react-native';
import Svg, { Line, Rect, Text } from 'react-native-svg';
import { type Instrument } from '../core/instrument';
import {
  type ScoreNote,
  type Nomenclature,
  midiSpelling,
  pitchName,
  tabPositions,
} from '../core/notation';
import { colors } from './ui';

/** En web, react-native-svg hereda la serif del navegador; en nativo usa la del sistema. */
const FONT =
  Platform.OS === 'web' ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined;

/** Highest string is the top line. Explicit positions preserve the chosen fingering. */
export function Tab({
  notes,
  instrument,
  active = -1,
  nomenclature = 'latin',
}: {
  notes: readonly ScoreNote[];
  instrument: Instrument;
  active?: number;
  nomenclature?: Nomenclature;
}) {
  const width = Math.max(280, notes.length * 70 + 80);
  const height = instrument.strings.length * 24 + 24;
  const positions = tabPositions(notes, instrument);
  const y = (string: number) => 24 + (instrument.strings.length - 1 - string) * 24;
  return (
    <View accessibilityLabel="Tablatura. Identifica las notas de izquierda a derecha.">
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {instrument.strings.map((midi, string) => (
          <React.Fragment key={string}>
            <Text x={4} y={y(string) + 5} fill={colors.ink} fontFamily={FONT} fontSize={13}>
              {pitchName(midiSpelling(midi), false, nomenclature)}
            </Text>
            <Line x1={40} x2={width - 10} y1={y(string)} y2={y(string)} stroke={colors.muted} />
          </React.Fragment>
        ))}
        {positions.map((position, i) => {
          const x = 70 + (i * (width - 110)) / Math.max(1, notes.length - 1);
          return (
            <React.Fragment key={i}>
              <Rect
                x={x - 12}
                y={y(position.string) - 10}
                width={24}
                height={20}
                fill={colors.white}
              />
              <Text
                x={x}
                y={y(position.string) + 6}
                textAnchor="middle"
                fontFamily={FONT}
                fontSize={18}
                fontWeight={active === i ? '700' : '400'}
                fill={active === i ? colors.green : colors.ink}
              >
                {position.fret}
              </Text>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
