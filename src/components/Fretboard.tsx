import React, { useRef } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { Instrument } from '../core/instrument';
import type { Nomenclature } from '../core/notation';
import { colors } from './ui';

/**
 * Mástil del bajo en vista de intérprete: cuerda más aguda arriba, como en la
 * tablatura. Trastes de ancho constante para que todas las casillas se puedan
 * pulsar con el dedo (mínimo 44 pt). Con `leftHanded` el clavijero queda a la
 * derecha.
 */

export type FretMark = {
  string: number;
  fret: number;
  label: string;
  root?: boolean;
  /** Texto para lectores de pantalla, p. ej. «Do, grado 1». */
  description?: string;
};

const OPEN_W = 50;
const FRET_W = 58;
const STRING_GAP = 44;
const PAD_TOP = 14;
const PAD_BOTTOM = 30;
const DOT_R = 16;
const SINGLE_INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_INLAYS = [12, 24];
/** En web, react-native-svg hereda la serif del navegador; en nativo usa la del sistema. */
const FONT =
  Platform.OS === 'web' ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined;

const flatNames: Record<Nomenclature, string[]> = {
  latin: ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Si♭', 'Si'],
  english: ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'],
};
/** Nombre neutro de una altura (con bemoles), para cuerdas al aire y casillas sin marca. */
export const plainName = (midi: number, nomenclature: Nomenclature) =>
  flatNames[nomenclature][((midi % 12) + 12) % 12]!;

export function Fretboard({
  instrument,
  marks,
  nomenclature,
  leftHanded = false,
  active,
  activeString,
  compact = false,
  firstVisibleFret,
  onPress,
}: {
  instrument: Instrument;
  marks: FretMark[];
  nomenclature: Nomenclature;
  leftHanded?: boolean;
  active?: { string: number; fret: number } | null;
  activeString?: number;
  compact?: boolean;
  firstVisibleFret?: number;
  onPress?: (string: number, fret: number, midi: number) => void;
}) {
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const viewportWidth = useRef(0);
  const openWidth = compact ? 44 : OPEN_W;
  const fretWidth = compact ? 44 : FRET_W;
  const strings = instrument.strings.length;
  const width = openWidth + instrument.frets * fretWidth + 12;
  const height = compact
    ? strings * STRING_GAP + 20
    : PAD_TOP + (strings - 1) * STRING_GAP + PAD_BOTTOM + 16;
  const boardTop = compact ? 22 : PAD_TOP + 8;
  const boardBottom = boardTop + (strings - 1) * STRING_GAP;
  const mirror = (x: number) => (leftHanded ? width - x : x);
  const yOf = (string: number) => boardTop + (strings - 1 - string) * STRING_GAP;
  /** Centro horizontal de la casilla: al aire a la izquierda del clavijero. */
  const xOf = (fret: number) =>
    mirror(fret === 0 ? openWidth / 2 : openWidth + (fret - 0.5) * fretWidth);
  const fretX = (fret: number) => mirror(openWidth + fret * fretWidth);
  const markAt = new Map(marks.map((m) => [`${m.string}:${m.fret}`, m]));
  // Las marcas van entre cuerdas, nunca encima: hueco central y, las dobles, en los huecos exteriores.
  const gapY = (gap: number) => boardTop + (gap + 0.5) * STRING_GAP;
  const singleY = gapY(Math.floor((strings - 2) / 2));
  const doubleY = strings > 2 ? [gapY(0), gapY(strings - 2)] : [singleY - 8, singleY + 8];

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator
      contentContainerStyle={{ paddingBottom: 4 }}
      onLayout={(event) => {
        viewportWidth.current = event.nativeEvent.layout.width;
      }}
      onContentSizeChange={() => {
        if (firstVisibleFret === undefined) {
          if (leftHanded) scroll.current?.scrollToEnd({ animated: false });
          return;
        }
        const fromNut = firstVisibleFret === 0 ? 0 : openWidth + (firstVisibleFret - 1) * fretWidth;
        const x = leftHanded ? width - fromNut - viewportWidth.current : fromNut;
        scroll.current?.scrollTo({ x: Math.max(0, x), animated: false });
      }}
    >
      <View style={{ width, height }}>
        <Svg
          width={width}
          height={height}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Rect
            x={leftHanded ? 6 : openWidth}
            y={boardTop - 10}
            width={width - openWidth - 6}
            height={boardBottom - boardTop + 20}
            rx={6}
            fill="#F3F1EA"
          />
          {activeString !== undefined && activeString >= 0 && activeString < strings ? (
            <Rect
              x={0}
              y={yOf(activeString) - 20}
              width={width}
              height={40}
              rx={6}
              fill={colors.pale}
            />
          ) : null}
          {SINGLE_INLAYS.filter((f) => f <= instrument.frets).map((f) => (
            <Circle key={f} cx={xOf(f)} cy={singleY} r={5} fill="#D9D3C4" />
          ))}
          {DOUBLE_INLAYS.filter((f) => f <= instrument.frets).map((f) => (
            <G key={f}>
              <Circle cx={xOf(f)} cy={doubleY[0]} r={5} fill="#D9D3C4" />
              <Circle cx={xOf(f)} cy={doubleY[1]} r={5} fill="#D9D3C4" />
            </G>
          ))}
          {Array.from({ length: instrument.frets + 1 }, (_, f) => (
            <Line
              key={f}
              x1={fretX(f)}
              x2={fretX(f)}
              y1={boardTop - 10}
              y2={boardBottom + 10}
              stroke={f === 0 ? colors.ink : '#B9C2B8'}
              strokeWidth={f === 0 ? 5 : 1.5}
            />
          ))}
          {instrument.strings.map((_, s) => (
            <Line
              key={s}
              x1={leftHanded ? 6 : openWidth}
              x2={leftHanded ? width - openWidth : width - 6}
              y1={yOf(s)}
              y2={yOf(s)}
              stroke="#6F7A70"
              // Las cuerdas graves son más gruesas, como en el instrumento.
              strokeWidth={1.2 + ((strings - 1 - s) / Math.max(1, strings - 1)) * 1.8}
            />
          ))}
          {Array.from({ length: instrument.frets }, (_, i) => i + 1)
            .filter(
              (f) => [1, 3, 5, 7, 9, 12, 15, 17, 19, 21, 24].includes(f) || (compact && f === 13),
            )
            .map((f) => (
              <SvgText
                key={f}
                x={xOf(f)}
                y={boardBottom + (compact ? 36 : 30)}
                fontSize={11}
                fontFamily={FONT}
                fill={colors.muted}
                textAnchor="middle"
              >
                {f}
              </SvgText>
            ))}
          {instrument.strings.map((open, s) =>
            markAt.has(`${s}:0`) ? null : (
              <SvgText
                key={s}
                x={xOf(0)}
                y={yOf(s) + 4}
                fontSize={12}
                fontFamily={FONT}
                fontWeight="600"
                fill={colors.muted}
                textAnchor="middle"
              >
                {plainName(open, nomenclature)}
              </SvgText>
            ),
          )}
          {marks.map((m) => {
            const isActive = active?.string === m.string && active.fret === m.fret;
            return (
              <G key={`${m.string}:${m.fret}`}>
                {isActive ? (
                  <Circle
                    cx={xOf(m.fret)}
                    cy={yOf(m.string)}
                    r={DOT_R + 4}
                    fill="none"
                    stroke={colors.green}
                    strokeWidth={2}
                  />
                ) : null}
                <Circle
                  cx={xOf(m.fret)}
                  cy={yOf(m.string)}
                  r={DOT_R}
                  fill={m.root ? colors.green : '#E1ECDF'}
                  stroke={colors.green}
                  strokeWidth={m.root ? 0 : 1.5}
                />
                {m.label ? (
                  <SvgText
                    x={xOf(m.fret)}
                    y={yOf(m.string) + 4}
                    fontSize={m.label.length > 2 ? 10.5 : 12}
                    fontFamily={FONT}
                    fontWeight="600"
                    fill={m.root ? colors.white : colors.green}
                    textAnchor="middle"
                  >
                    {m.label}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
          {active && !markAt.has(`${active.string}:${active.fret}`) ? (
            <Circle
              cx={xOf(active.fret)}
              cy={yOf(active.string)}
              r={DOT_R - 2}
              fill="none"
              stroke={colors.green}
              strokeWidth={2}
            />
          ) : null}
        </Svg>
        {/* Zonas táctiles reales encima del dibujo: accesibles y del mismo tamaño en todas las plataformas. */}
        {instrument.strings.map((open, s) =>
          Array.from({ length: instrument.frets + 1 }, (_, f) => {
            const mark = markAt.get(`${s}:${f}`);
            const name = plainName(open + f, nomenclature);
            const where = `cuerda ${plainName(open, nomenclature)}, ${f === 0 ? 'al aire' : `traste ${f}`}`;
            const cellW = f === 0 ? openWidth : fretWidth;
            return (
              <Pressable
                key={`${s}:${f}`}
                onPress={onPress ? () => onPress(s, f, open + f) : undefined}
                disabled={!onPress}
                accessible={!!mark || compact}
                focusable={!!mark || (compact && s === activeString)}
                accessibilityRole="button"
                accessibilityLabel={
                  mark ? `${mark.description ?? mark.label}, ${where}` : `${name}, ${where}`
                }
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
                  position: 'absolute',
                  left: xOf(f) - cellW / 2,
                  top: yOf(s) - STRING_GAP / 2,
                  width: cellW,
                  height: STRING_GAP,
                  borderRadius: 8,
                  backgroundColor: hovered ? 'rgba(41, 94, 67, 0.08)' : 'transparent',
                })}
              />
            );
          }),
        )}
      </View>
    </ScrollView>
  );
}
