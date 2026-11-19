import React, { useId } from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import type { BassScale, Profile } from '../core/profile';
import { tunings } from '../core/instrument';
import { useTheme } from './ui';

type Props = Pick<Profile, 'tuning' | 'scale' | 'leftHanded'>;
type RenderKey = `bass-${4 | 5 | 6}st-${BassScale}in-${'rh' | 'lh'}`;
const renders: Partial<Record<RenderKey, ImageSourcePropType>> = {};

const width = 780;
const height = 220;
const center = 108;
const bridgeX = 119;
const body =
  'M250 87C270 81 273 64 301 56C333 47 335 20 302 26C272 29 260 49 230 47C202 45 190 25 154 25C109 24 72 39 55 65C41 86 41 123 54 147C71 180 102 192 142 193C183 195 207 174 226 161C250 145 282 163 292 148C304 128 267 128 254 119Z';
const inlays = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];

export function BassPreview({ tuning, scale, leftHanded }: Props) {
  const { colors } = useTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { strings, frets } = tunings[tuning];
  const count = strings.length as 4 | 5 | 6;
  const render = renders[`bass-${count}st-${scale}in-${leftHanded ? 'lh' : 'rh'}`];
  const label = `Bajo de ${count} cuerdas, escala de ${scale} pulgadas, para ${leftHanded ? 'zurdos' : 'diestros'}`;
  const style = { width: '100%', aspectRatio: width / height } as const;
  if (render) {
    return (
      <Image
        accessible
        accessibilityLabel={label}
        source={render}
        style={style}
        resizeMode="contain"
      />
    );
  }

  const nutX = bridgeX + scale * 16;
  const fretX = (fret: number) => bridgeX + (nutX - bridgeX) * 2 ** (-fret / 12);
  const lastFretX = fretX(frets) - 4;
  const nutHalf = (count - 1) * 2.6 + 4;
  const neckHalf = (count - 1) * 3.8 + 5;
  const neckHalfAt = (x: number) =>
    nutHalf + ((nutX - x) / (nutX - lastFretX)) * (neckHalf - nutHalf);
  const head = `M${nutX - 2} ${center - nutHalf}q13 -23 32 -24h31q17 0 17 16v22q0 15 -17 15h-32q-19 0 -31 -${31 - nutHalf}Z`;
  const stringPaths = strings.map((_, i) => {
    const offset = i - (count - 1) / 2;
    const upper = i < Math.ceil(count / 2);
    const tunerIndex = upper ? i : count - 1 - i;
    return {
      nutY: center + offset * 5.2,
      bridgeY: center + offset * 9,
      postX: nutX + 23 + tunerIndex * 15,
      postY: center + (upper ? -20 : 20),
      keyY: center + (upper ? -41 : 40),
    };
  });
  return (
    <View style={style}>
      <Svg
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        viewBox={`0 0 ${width} ${height}`}
        height="100%"
        width="100%"
      >
        <Defs>
          <LinearGradient id={`${id}-lacquer`} x1="0%" y1="0%" x2="44%" y2="100%">
            <Stop offset="0%" stopColor={colors.accentSoft} />
            <Stop offset="38%" stopColor={colors.accent} />
            <Stop offset="78%" stopColor={colors.accentText} />
            <Stop offset="100%" stopColor={colors.wood} />
          </LinearGradient>
          <LinearGradient id={`${id}-metal`} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={colors.ink} />
            <Stop offset="48%" stopColor={colors.string} />
            <Stop offset="100%" stopColor={colors.faint} />
          </LinearGradient>
        </Defs>
        {/* Se dibuja desde el puente hacia la pala. En diestros, la pala queda a la izquierda. */}
        <G transform={leftHanded ? undefined : `translate(${width} 0) scale(-1 1)`}>
          <Ellipse cx={171} cy={201} rx={122} ry={7} fill={colors.ink} opacity={0.09} />
          <Path d={body} fill={colors.wood} transform="translate(2 8)" />
          <Path
            d={body}
            fill={`url(#${id}-lacquer)`}
            stroke={colors.accentText}
            strokeWidth={1.4}
          />
          <Path
            d="M54 82C62 54 95 31 145 31C177 31 195 48 221 53"
            fill="none"
            stroke={colors.ink}
            strokeWidth={2.8}
            strokeLinecap="round"
            opacity={0.36}
          />
          <Path
            d="M111 123C133 156 177 168 208 149L251 125V99C223 96 210 74 186 74C146 69 120 88 111 123Z"
            fill={colors.keyWhite}
            stroke={colors.fret}
            strokeWidth={1.4}
          />
          <Path d={head} fill={colors.wood} transform="translate(1 4)" />
          <Path d={head} fill={`url(#${id}-lacquer)`} stroke={colors.accentText} />
          <Path
            d={`M${lastFretX} ${center - neckHalf}L${nutX} ${center - nutHalf}
          V${center + nutHalf}L${lastFretX} ${center + neckHalf}Z`}
            fill={colors.wood}
            stroke={colors.fret}
          />
          {Array.from({ length: frets }, (_, i) => {
            const x = fretX(i + 1);
            const half = neckHalfAt(x);
            return (
              <Line
                key={i}
                x1={x}
                x2={x}
                y1={center - half}
                y2={center + half}
                stroke={colors.fret}
                strokeWidth={1.25}
              />
            );
          })}
          {inlays
            .filter((fret) => fret <= frets)
            .flatMap((fret) =>
              (fret % 12 === 0 ? [-8, 8] : [0]).map((offset) => (
                <Circle
                  key={`${fret}-${offset}`}
                  cx={(fretX(fret) + fretX(fret - 1)) / 2}
                  cy={center + offset}
                  r={2}
                  fill={colors.inlay}
                />
              )),
            )}
          <Line
            x1={nutX}
            x2={nutX}
            y1={center - nutHalf}
            y2={center + nutHalf}
            stroke={colors.keyWhite}
            strokeWidth={3.6}
          />
          {[155, 198].map((x) => (
            <Rect
              key={x}
              x={x}
              y={center - 29}
              width={17}
              height={58}
              rx={3}
              fill={colors.keyBlack}
              stroke={colors.fret}
            />
          ))}
          <Rect
            x={bridgeX - 11}
            y={center - 32}
            width={19}
            height={64}
            rx={3}
            fill={`url(#${id}-metal)`}
            stroke={colors.fret}
          />
          {[112, 136, 160].map((x) => (
            <Circle
              key={x}
              cx={x}
              cy={159 + (x === 136 ? 7 : 0)}
              r={6}
              fill={`url(#${id}-metal)`}
              stroke={colors.fret}
            />
          ))}
          {stringPaths.map(({ nutY, bridgeY, postX, postY, keyY }, i) => (
            <G key={i}>
              <Line
                x1={postX}
                x2={postX}
                y1={postY}
                y2={keyY}
                stroke={colors.string}
                strokeWidth={3}
              />
              <Rect
                x={postX - 5}
                y={keyY - 3.5}
                width={10}
                height={7}
                rx={2}
                fill={`url(#${id}-metal)`}
                stroke={colors.fret}
              />
              <Circle cx={postX} cy={postY} r={3.8} fill={colors.ink} stroke={colors.fret} />
              {[163.5, 206.5].map((x) => (
                <Circle
                  key={x}
                  cx={x}
                  cy={bridgeY + ((x - bridgeX) / (nutX - bridgeX)) * (nutY - bridgeY)}
                  r={2}
                  fill={colors.fret}
                />
              ))}
              <Path
                d={`M${bridgeX} ${bridgeY}L${nutX} ${nutY}L${postX} ${postY}`}
                fill="none"
                stroke={colors.string}
                strokeWidth={1.7 - i * 0.17}
              />
            </G>
          ))}
        </G>
      </Svg>
    </View>
  );
}
