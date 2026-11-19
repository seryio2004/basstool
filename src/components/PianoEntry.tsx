import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Chips, colors, styles } from './ui';
import { range, type Instrument } from '../core/instrument';
import { plainName } from './Fretboard';
import type { Nomenclature } from '../core/notation';
export const pianoKeys = 'awsedftgyhuj';
const whites = [0, 2, 4, 5, 7, 9, 11];
export function PianoEntry({
  instrument,
  base,
  onBase,
  preference,
  onPreference,
  onPitch,
  nomenclature,
  keysOnly = false,
  minControlHeight,
}: {
  instrument: Instrument;
  base: number;
  onBase: (n: number) => void;
  preference: 'low' | 'high';
  onPreference: (p: 'low' | 'high') => void;
  onPitch: (n: number) => void;
  nomenclature: Nomenclature;
  keysOnly?: boolean;
  minControlHeight?: number;
}) {
  const { min, max } = range(instrument);
  function key(pc: number) {
    const dark = !whites.includes(pc),
      midi = base + pc;
    const disabled =
      midi < min ||
      midi > max ||
      !instrument.strings.some((open) => midi >= open && midi <= open + instrument.frets);
    const name = plainName(midi, nomenclature) + (base / 12 - 1);
    const left = dark ? whites.filter((w) => w < pc).length * 52 - 22 : whites.indexOf(pc) * 52;
    return (
      <Pressable
        key={pc}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={name}
        style={({ pressed }) => ({
          position: 'absolute',
          left,
          top: 0,
          width: dark ? 44 : 52,
          height: dark ? 52 : 96,
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 5,
          borderWidth: 1,
          borderColor: colors.lineStrong,
          borderRadius: 4,
          backgroundColor: pressed ? colors.accent : dark ? colors.keyBlack : colors.keyWhite,
        })}
        onPress={() => onPitch(midi)}
      >
        <Text
          style={{
            fontSize: 12,
            color: dark ? colors.keyWhite : colors.keyBlack,
            opacity: disabled ? 0.4 : 1,
          }}
        >
          {name}
        </Text>
      </Pressable>
    );
  }
  return (
    <View style={{ gap: 6 }}>
      {keysOnly ? null : (
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          <Button
            variant="secondary"
            disabled={base <= Math.floor(min / 12) * 12}
            onPress={() => onBase(base - 12)}
          >
            Octava −
          </Button>
          <Button variant="secondary" disabled={base + 12 > max} onPress={() => onBase(base + 12)}>
            Octava +
          </Button>
          <Chips
            minHeight={minControlHeight}
            value={preference}
            onChange={onPreference}
            options={[
              { value: 'low', label: 'Traste más bajo' },
              { value: 'high', label: 'Traste más alto' },
            ]}
          />
        </View>
      )}
      <ScrollView horizontal>
        <View style={{ width: 364, height: 96 }}>
          {whites.map(key)}
          {[1, 3, 6, 8, 10].map(key)}
        </View>
      </ScrollView>
    </View>
  );
}
