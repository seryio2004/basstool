import React from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle, Line, Rect, Ellipse } from 'react-native-svg';
import { figurePool, naturals } from '../core/music';
export { Heading } from './Heading';
export const colors = {
  ink: '#202E26',
  muted: '#657168',
  green: '#295E43',
  pale: '#E8EFE7',
  line: '#E2E7DF',
  bg: '#F8F9F6',
  white: '#FFFFFF',
  error: '#A33131',
};
export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  panel: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 24,
    gap: 18,
  },
  title: { color: colors.ink, fontSize: 29, fontWeight: '700', letterSpacing: -0.6 },
  h2: { color: colors.ink, fontSize: 19, fontWeight: '600', letterSpacing: -0.25 },
  h3: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  text: { color: colors.ink, fontSize: 14, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  field: {
    color: colors.ink,
    backgroundColor: colors.white,
    borderColor: '#C8D1C7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 44,
  },
  divider: { height: 1, backgroundColor: colors.line },
});
export function Label({
  children,
  muted = false,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: TextStyle;
}) {
  return <Text style={[muted ? styles.muted : styles.text, style]}>{children}</Text>;
}
export function Button({
  children,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  icon,
  small = false,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  icon?: string;
  small?: boolean;
  style?: ViewStyle;
}) {
  const foreground =
    variant === 'primary' ? '#fff' : variant === 'danger' ? colors.error : colors.green;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          paddingVertical: small ? 8 : 12,
          paddingHorizontal: small ? 12 : 18,
          minHeight: small ? 36 : 44,
          borderRadius: 8,
          backgroundColor:
            variant === 'primary'
              ? colors.green
              : variant === 'secondary'
                ? colors.pale
                : 'transparent',
          opacity: disabled || busy ? 0.45 : pressed ? 0.65 : hovered ? 0.84 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : icon ? (
        <Icon name={icon} color={foreground} size={16} />
      ) : null}
      <Text style={{ color: foreground, fontSize: 13, fontWeight: '600' }}>{children}</Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: 'email-address' | 'numeric' | 'default';
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={[styles.text, { fontSize: 13, fontWeight: '500' }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#727D73"
        secureTextEntry={secureTextEntry}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.field, multiline ? { minHeight: 110, textAlignVertical: 'top' } : {}]}
      />
    </View>
  );
}
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === o.value }}
          onPress={() => onChange(o.value)}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
            paddingVertical: 9,
            paddingHorizontal: 13,
            backgroundColor: value === o.value ? colors.green : hovered ? '#EDF1EA' : '#F1F3EE',
            borderRadius: 7,
          })}
        >
          <Text
            style={{
              color: value === o.value ? 'white' : colors.muted,
              fontWeight: value === o.value ? '600' : '400',
              fontSize: 13,
            }}
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Badge({
  children,
  color = colors.green,
  background = colors.pale,
}: {
  children: React.ReactNode;
  color?: string;
  background?: string;
}) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 5,
        backgroundColor: background,
      }}
    >
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20, gap: 10 }}>
      <Icon name="music" size={30} color="#8A998B" />
      <Text style={styles.h3}>{title}</Text>
      <Text style={[styles.muted, { textAlign: 'center', maxWidth: 420 }]}>{detail}</Text>
      {action}
    </View>
  );
}
export function Icon({
  name,
  size = 20,
  color = colors.muted,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const paths: Record<string, string> = {
    home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
    practice: 'M10 4v14M16 7v8M4 9v5M22 10v3',
    library: 'M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v15',
    progress: 'M3 3v18h18M7 16v-5m5 5V7m5 9v-5',
    settings: 'M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2',
    music: 'M9 18V5l11-2v13M9 9l11-2M9 18c0 3-6 4-6 1s6-4 6-1m11-2c0 3-6 4-6 1s6-4 6-1',
    arrow: 'M5 12h14m-5-5 5 5-5 5',
    back: 'M19 12H5m5-5-5 5 5 5',
    play: 'm8 4 12 8-12 8Z',
    pause: 'M8 5v14m8-14v14',
    plus: 'M12 5v14M5 12h14',
    check: 'm5 12 4 4L19 6',
    clock: 'M12 7v5l3 2',
    metronome: 'm8 3-5 18h18L16 3ZM12 17l5-10M8 17h8',
    tuner: 'M8 3v7a4 4 0 0 0 8 0V3m-4 11v7M5 6H3m18 0h-2',
    chord: 'M6 3v18M12 3v18M18 3v18M3 7h18M3 13h18M3 19h18',
    logout: 'M9 3H4v18h5m5-14 5 5-5 5M8 12h12',
    close: 'm6 6 12 12M18 6 6 18',
    ear: 'M8 17c0 5 6 5 6 0 0-3 6-4 6-9A8 8 0 0 0 4 8m4 1a4 4 0 0 1 8 0c0 3-4 3-4 6',
    calendar: 'M4 5h16v16H4ZM8 3v4m8-4v4M4 10h16',
    bell: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5Zm5 3h4',
    note: 'M10 18V4l9-1v5l-9 1m0 9c0 4-7 4-7 1s7-4 7-1',
    wave: 'M3 12h1m3-4v8m4-12v16m4-11v6m4-9v12m2-6h1',
    train: 'M5 3h14v13H5ZM5 9h14M8 21l2-5m6 5-2-5M8 19h8',
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
    >
      <Path d={paths[name] || paths.music} />
      {name === 'clock' ? <Circle cx="12" cy="12" r="9" /> : null}
      {name === 'settings' ? <Circle cx="12" cy="12" r="5" /> : null}
    </Svg>
  );
}
export function Staff({
  notes,
  active = -1,
  reveal = true,
}: {
  notes: number[];
  active?: number;
  reveal?: boolean;
}) {
  const width = Math.max(280, notes.length * 70 + 100);
  const step = (midi: number) => {
    const oct = Math.floor(midi / 12) - 4;
    const pc = midi % 12;
    const indexes: Record<number, number> = {
      0: 0,
      1: 0,
      2: 1,
      3: 1,
      4: 2,
      5: 3,
      6: 3,
      7: 4,
      8: 4,
      9: 5,
      10: 5,
      11: 6,
    };
    return oct * 7 + indexes[pc]!;
  };
  return (
    <View
      accessibilityLabel={
        reveal
          ? 'Pentagrama en clave de sol. Identifica las notas.'
          : 'Escucha e identifica las notas.'
      }
      style={{ alignItems: 'center', paddingVertical: 15 }}
    >
      <Svg width="100%" height={150} viewBox={`0 0 ${width} 150`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Line
            key={i}
            x1="10"
            y1={40 + i * 14}
            x2={width - 10}
            y2={40 + i * 14}
            stroke="#A9B4A8"
            strokeWidth={1}
          />
        ))}
        <Path
          d="M40 112C5 88 68 65 46 31 32 10 22 50 38 81c16 31 29 7 18-7-12-15-33 1-25 14m10-68 9 100c3 25-24 23-21 8"
          fill="none"
          stroke={colors.ink}
          strokeWidth={2.8}
        />
        {reveal &&
          notes.map((note, i) => {
            const x = 95 + (i * (width - 130)) / Math.max(1, notes.length - 1),
              y = 110 - step(note) * 7;
            const accidental = !naturals.some((n) => n % 12 === note % 12);
            return (
              <React.Fragment key={i}>
                {y >= 110 ? (
                  <Line x1={x - 17} x2={x + 17} y1={110} y2={110} stroke={colors.ink} />
                ) : null}
                {y <= 26 ? (
                  <Line x1={x - 17} x2={x + 17} y1={26} y2={26} stroke={colors.ink} />
                ) : null}
                {accidental ? (
                  <Path
                    d={`M${x - 24} ${y - 15}v26m7-29v26m-12-16 17-3m-17 12 17-3`}
                    stroke={colors.ink}
                    strokeWidth={1.5}
                  />
                ) : null}
                <Ellipse
                  cx={x}
                  cy={y}
                  rx="9"
                  ry="6.5"
                  rotation="-20"
                  origin={`${x},${y}`}
                  fill={active === i ? colors.green : colors.ink}
                />
                <Line
                  x1={x + 7}
                  x2={x + 7}
                  y1={y}
                  y2={y - 38}
                  stroke={active === i ? colors.green : colors.ink}
                  strokeWidth={2}
                />
              </React.Fragment>
            );
          })}
      </Svg>
    </View>
  );
}
export function RhythmFigure({
  id,
  color = colors.ink,
  size = 64,
}: {
  id: number;
  color?: string;
  size?: number;
}) {
  const figure = figurePool[id]!;
  const xs = figure.notes.map((v) => 13 + v * 62);
  return (
    <Svg width={size} height={size * 0.8} viewBox="0 0 86 70">
      {figure.tuplet ? (
        <Path
          d={
            figure.tuplet === 3
              ? 'M35 5q12-4 7 2l-4 3q10-1 4 6h-9'
              : figure.tuplet === 5
                ? 'M43 3H34v6q12-4 9 6H33'
                : 'M42 3q-12 0-9 12 12 6 11-4-4-7-11 0'
          }
          stroke={color}
          strokeWidth={1.5}
          fill="none"
        />
      ) : null}
      {xs.map((x, i) => (
        <React.Fragment key={i}>
          <Ellipse cx={x} cy="54" rx="5" ry="3.5" fill={color} rotation="-20" origin={`${x},54`} />
          <Line x1={x + 4} x2={x + 4} y1="54" y2="22" stroke={color} strokeWidth={2} />
        </React.Fragment>
      ))}
      {xs.length > 1 ? (
        <Line
          x1={xs[0]! + 4}
          x2={xs[xs.length - 1]! + 4}
          y1="22"
          y2="22"
          stroke={color}
          strokeWidth={4}
        />
      ) : null}
      {figure.beams === 2 ? (
        <Line
          x1={xs[0]! + 4}
          x2={xs[xs.length - 1]! + 4}
          y1="30"
          y2="30"
          stroke={color}
          strokeWidth={3}
        />
      ) : null}
      {id === 6 ? (
        <Line x1={xs[0]! + 4} x2={xs[1]! + 4} y1="30" y2="30" stroke={color} strokeWidth={3} />
      ) : null}
      {id === 7 ? (
        <Line x1={xs[1]! + 4} x2={xs[2]! + 4} y1="30" y2="30" stroke={color} strokeWidth={3} />
      ) : null}
      {id === 8 || id === 9 ? (
        <>
          <Path d={`M${xs[0]! + 4} 22q13 4 3 16`} stroke={color} fill="none" strokeWidth={2} />
          <Path
            d={id === 8 ? 'M7 28q8-8 6 4l-6 13m6-16-3 7' : 'M58 28q8-8 6 4l-6 13m6-16-3 7'}
            stroke={color}
            fill="none"
            strokeWidth={2}
          />
        </>
      ) : null}
    </Svg>
  );
}
