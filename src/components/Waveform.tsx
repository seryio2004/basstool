import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import type { Loop } from '../platform/playerTypes';
import { colors } from './ui';

const BAR = 3;
const GAP = 1.5;

/**
 * Forma de onda navegable. Tocar salta a ese punto; con lector de pantalla se
 * ajusta de 5 en 5 segundos. Lo ya reproducido va en verde, el bucle se
 * sombrea y las marcas son líneas verticales.
 */
export function Waveform({
  peaks,
  duration,
  position,
  loop,
  markers,
  onSeek,
  height = 104,
}: {
  peaks: number[];
  duration: number;
  position: number;
  loop: Loop | null;
  markers: { id: string; time: number }[];
  onSeek: (time: number) => void;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const bars = Math.max(1, Math.floor(width / (BAR + GAP)));
  // Reduce la envolvente al número de barras que caben, conservando los picos.
  const levels = useMemo(() => {
    if (!peaks.length) return [];
    return Array.from({ length: bars }, (_, i) => {
      const from = Math.floor((i / bars) * peaks.length);
      const to = Math.max(from + 1, Math.floor(((i + 1) / bars) * peaks.length));
      let max = 0;
      for (let j = from; j < to && j < peaks.length; j++) max = Math.max(max, peaks[j]!);
      return max;
    });
  }, [peaks, bars]);
  const x = (time: number) => (duration > 0 ? (time / duration) * width : 0);
  const played = x(position);
  const seekBy = (delta: number) => onSeek(Math.min(duration, Math.max(0, position + delta)));

  return (
    <Pressable
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onPress={(e) => {
        if (width > 0) onSeek((e.nativeEvent.locationX / width) * duration);
      }}
      accessibilityRole="adjustable"
      accessibilityLabel="Posición en la canción"
      accessibilityValue={{ text: `${Math.floor(position)} de ${Math.floor(duration)} segundos` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => seekBy(e.nativeEvent.actionName === 'increment' ? 5 : -5)}
      style={{ height, borderRadius: 10, backgroundColor: '#F3F1EA', overflow: 'hidden' }}
    >
      {width > 0 ? (
        <Svg width={width} height={height} pointerEvents="none">
          {loop ? (
            <Rect
              x={x(loop.a)}
              y={0}
              width={Math.max(2, x(loop.b) - x(loop.a))}
              height={height}
              fill={colors.pale}
            />
          ) : null}
          {levels.map((level, i) => {
            const h = Math.max(2, level * (height - 16));
            const left = i * (BAR + GAP);
            return (
              <Rect
                key={i}
                x={left}
                y={(height - h) / 2}
                width={BAR}
                height={h}
                rx={1.5}
                fill={left + BAR <= played ? colors.green : '#B9C2B8'}
              />
            );
          })}
          {loop ? (
            <>
              <Line
                x1={x(loop.a)}
                x2={x(loop.a)}
                y1={0}
                y2={height}
                stroke={colors.green}
                strokeWidth={2}
              />
              <Line
                x1={x(loop.b)}
                x2={x(loop.b)}
                y1={0}
                y2={height}
                stroke={colors.green}
                strokeWidth={2}
              />
            </>
          ) : null}
          {markers.map((m) => (
            <Line
              key={m.id}
              x1={x(m.time)}
              x2={x(m.time)}
              y1={0}
              y2={height}
              stroke="#8A5A2E"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          ))}
          <Line x1={played} x2={played} y1={0} y2={height} stroke={colors.ink} strokeWidth={2} />
        </Svg>
      ) : (
        <View />
      )}
    </Pressable>
  );
}
