import React from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle, Line, Ellipse } from 'react-native-svg';
import { figurePool } from '../core/music';
import {
  type ScoreNote,
  type Clef,
  midiSpelling,
  parsePitch,
  accidentalSign,
  staffStep,
  ledgerSteps,
} from '../core/notation';
import { Text as SvgText } from 'react-native-svg';
export { Heading } from './Heading';
export { colors, styles, fonts, space, radius, tabular, useTheme, moduleTone } from './theme';
import { colors, styles, fonts, radius } from './theme';

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

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  children,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  icon,
  small = false,
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  icon?: string;
  small?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const foreground =
    variant === 'primary'
      ? colors.onAccent
      : variant === 'danger'
        ? colors.error
        : variant === 'secondary'
          ? colors.ink
          : colors.accentText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          paddingVertical: small ? 8 : 12,
          paddingHorizontal: small ? 12 : 20,
          minHeight: small ? 38 : 48,
          borderRadius: radius.control,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.lineStrong,
          borderTopColor: variant === 'secondary' ? colors.sheen : colors.lineStrong,
          backgroundColor:
            variant === 'primary'
              ? colors.accent
              : variant === 'secondary'
                ? hovered
                  ? colors.accentSoft
                  : colors.raised
                : hovered
                  ? colors.accentSoft
                  : 'transparent',
          opacity:
            disabled || busy ? 0.45 : pressed ? 0.7 : variant === 'primary' && hovered ? 0.9 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : icon ? (
        <Icon name={icon} color={foreground} size={small ? 16 : 18} />
      ) : null}
      <Text
        style={{
          color: foreground,
          fontFamily: fonts.body,
          fontSize: small ? 14 : 15,
          fontWeight: '600',
        }}
      >
        {children}
      </Text>
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
    <View style={{ gap: 8 }}>
      <Text style={[styles.text, { fontSize: 14, fontWeight: '500' }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        secureTextEntry={secureTextEntry}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.field, multiline ? { minHeight: 110, textAlignVertical: 'top' } : {}]}
      />
    </View>
  );
}

/** Selector de una opción. Seleccionado en ámbar; el resto, botones de placa. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  minHeight = 40,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  minHeight?: number;
  label?: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
    >
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(o.value)}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
              minHeight,
              justifyContent: 'center',
              paddingVertical: 8,
              paddingHorizontal: 14,
              backgroundColor: selected
                ? colors.accent
                : hovered
                  ? colors.accentSoft
                  : colors.raised,
              borderWidth: 1,
              borderColor: selected ? colors.accent : colors.line,
              borderRadius: radius.chip,
            })}
          >
            <Text
              style={{
                color: selected ? colors.onAccent : colors.ink,
                fontFamily: fonts.body,
                fontWeight: selected ? '600' : '400',
                fontSize: 14,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Interruptor de palanca para conmutadores binarios. */
export function Toggle({
  label,
  value,
  onChange,
  detail,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  detail?: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      aria-checked={value}
      onPress={() => onChange(!value)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48 }}
    >
      <View
        style={{
          width: 50,
          height: 28,
          borderRadius: 14,
          padding: 3,
          justifyContent: 'center',
          backgroundColor: value ? colors.accent : colors.sunken,
          borderWidth: 1,
          borderColor: value ? colors.accent : colors.lineStrong,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            alignSelf: value ? 'flex-end' : 'flex-start',
            backgroundColor: value ? colors.onAccent : colors.muted,
          }}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.text}>{label}</Text>
        {detail ? <Text style={styles.muted}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Acciones secundarias plegadas tras «Más». Se despliegan en el flujo, sin capas. */
export function MoreMenu({
  label = 'Más',
  children,
  align = 'flex-start',
}: {
  label?: string;
  children: React.ReactNode;
  align?: 'flex-start' | 'flex-end' | 'center';
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <View style={{ gap: 10, alignItems: align }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={() => setOpen(!open)}
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          minHeight: 44,
          paddingHorizontal: 14,
          borderRadius: radius.control,
          backgroundColor: hovered || open ? colors.accentSoft : 'transparent',
        })}
      >
        <Icon name="more" size={18} color={colors.accentText} />
        <Text
          style={{
            color: colors.accentText,
            fontFamily: fonts.body,
            fontSize: 15,
            fontWeight: '600',
          }}
        >
          {label}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accentText} />
      </Pressable>
      {open ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            padding: 10,
            borderRadius: radius.control,
            backgroundColor: colors.raised,
            borderWidth: 1,
            borderColor: colors.line,
            borderTopColor: colors.sheen,
            alignSelf: 'stretch',
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

export function Badge({
  children,
  color = colors.accentText,
  background = colors.accentSoft,
}: {
  children: React.ReactNode;
  color?: string;
  background?: string;
}) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.badge,
        backgroundColor: background,
      }}
    >
      <Text style={{ color, fontFamily: fonts.body, fontSize: 12, fontWeight: '600' }}>
        {children}
      </Text>
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
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20, gap: 12 }}>
      <Icon name="music" size={32} color={colors.faint} />
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
    minus: 'M5 12h14',
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
    more: '',
    'chevron-down': 'm6 9 6 6 6-6',
    'chevron-up': 'm6 15 6-6 6 6',
    upload: 'M12 16V4m-5 5 5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
    sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
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
      {name === 'more' ? (
        <>
          <Circle cx="5" cy="12" r="1.4" fill={color} />
          <Circle cx="12" cy="12" r="1.4" fill={color} />
          <Circle cx="19" cy="12" r="1.4" fill={color} />
        </>
      ) : (
        <Path d={paths[name] || paths.music} />
      )}
      {name === 'clock' || name === 'settings' ? (
        <Circle cx="12" cy="12" r={name === 'clock' ? 9 : 5} />
      ) : null}
      {name === 'sun' ? <Circle cx="12" cy="12" r="4" /> : null}
    </Svg>
  );
}
export function Staff({
  notes,
  active = -1,
  reveal = true,
  clef = 'treble',
  octaveShift = 0,
}: {
  notes: readonly (number | ScoreNote)[];
  active?: number;
  reveal?: boolean;
  clef?: Clef;
  /** El bajo se escribe una octava por encima de lo que suena: usar 1 con MIDI real. */
  octaveShift?: number;
}) {
  const width = Math.max(280, notes.length * 70 + 100);
  const pitches = notes.map((note) =>
    typeof note === 'number' ? midiSpelling(note) : note.spelling,
  );
  const steps = pitches.map((pitch) => staffStep(pitch, clef, octaveShift));
  const top = Math.max(40, 45 + Math.max(0, ...steps.map((step) => step - 8)) * 7);
  const bottom = top + 56;
  const height = bottom + Math.max(50, 25 - Math.min(0, ...steps) * 7);
  return (
    <View
      accessibilityLabel={
        reveal
          ? `Pentagrama en clave de ${clef === 'bass' ? 'fa' : 'sol'}. Identifica las notas.`
          : 'Escucha e identifica las notas.'
      }
      style={{ alignItems: 'center', paddingVertical: 15 }}
    >
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Line
            key={i}
            x1={10}
            y1={top + i * 14}
            x2={width - 10}
            y2={top + i * 14}
            stroke={colors.staff}
          />
        ))}
        {clef === 'bass' ? (
          <>
            <Path
              d={`M23 ${top + 18}c-2-19 30-22 27-1-2 16-17 25-26 30 13-11 19-22 17-31-2-9-12-9-15-2`}
              fill={colors.ink}
            />
            <Circle cx={25} cy={top + 15} r={4} fill={colors.ink} />
            <Circle cx={58} cy={top + 7} r={2.5} fill={colors.ink} />
            <Circle cx={58} cy={top + 21} r={2.5} fill={colors.ink} />
          </>
        ) : (
          <Path
            d="M40 112C5 88 68 65 46 31 32 10 22 50 38 81c16 31 29 7 18-7-12-15-33 1-25 14m10-68 9 100c3 25-24 23-21 8"
            transform={`translate(0 ${top - 40})`}
            fill="none"
            stroke={colors.ink}
            strokeWidth={2.8}
          />
        )}
        {reveal &&
          pitches.map((pitch, i) => {
            const x = 95 + (i * (width - 130)) / Math.max(1, notes.length - 1);
            const y = bottom - steps[i]! * 7;
            const alter = parsePitch(pitch).alter;
            const color = active === i ? colors.accent : colors.ink;
            return (
              <React.Fragment key={i}>
                {ledgerSteps(steps[i]!).map((line) => (
                  <Line
                    key={line}
                    x1={x - 17}
                    x2={x + 17}
                    y1={bottom - line * 7}
                    y2={bottom - line * 7}
                    stroke={colors.ink}
                  />
                ))}
                {alter !== 0 ? (
                  <SvgText x={x - 27} y={y + 6} fontSize={23} fill={colors.ink}>
                    {accidentalSign(alter)}
                  </SvgText>
                ) : null}
                <Ellipse
                  cx={x}
                  cy={y}
                  rx={9}
                  ry={6.5}
                  rotation={-20}
                  origin={`${x},${y}`}
                  fill={color}
                />
                <Line x1={x + 7} x2={x + 7} y1={y} y2={y - 38} stroke={color} strokeWidth={2} />
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
