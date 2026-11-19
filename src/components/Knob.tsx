import React, { useRef } from 'react';
import { PanResponder, Platform, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { colors, fonts } from './theme';

const SWEEP = 270; // grados de recorrido, de -135° a +135°

const polar = (r: number, deg: number, c: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
};

/**
 * Mando giratorio de ampli. Se ajusta arrastrando en vertical, con la rueda del
 * ratón o con las flechas del teclado; los lectores de pantalla lo tratan como
 * control ajustable. Debajo muestra el valor con cifras tabulares.
 */
export function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
  size = 120,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  size?: number;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const start = useRef(value);
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current = latest.current.value;
      },
      onPanResponderMove: (_, g) => {
        // 200 px de arrastre recorren todo el mando.
        const delta = ((g.dx - g.dy) / 200) * (max - min);
        const next = clamp(start.current + delta);
        if (next !== latest.current.value) latest.current.onChange(next);
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const c = size / 2;
  const ratio = (value - min) / (max - min);
  const angle = -SWEEP / 2 + ratio * SWEEP;
  const ticks = Array.from({ length: 11 }, (_, i) => -SWEEP / 2 + (i * SWEEP) / 10);
  const arcEnd = polar(c - 6, angle, c);
  const arcStart = polar(c - 6, -SWEEP / 2, c);
  const large = ratio * SWEEP > 180 ? 1 : 0;
  const pointer = polar(c * 0.52, angle, c);
  const pointerBase = polar(c * 0.22, angle, c);

  const web: object =
    Platform.OS === 'web'
      ? {
          onWheel: (e: { deltaY: number; preventDefault: () => void }) => {
            e.preventDefault?.();
            onChange(clamp(value + (e.deltaY < 0 ? step : -step)));
          },
          onKeyDown: (e: { key: string; preventDefault: () => void }) => {
            const big = step * 10;
            const next =
              e.key === 'ArrowUp' || e.key === 'ArrowRight'
                ? value + step
                : e.key === 'ArrowDown' || e.key === 'ArrowLeft'
                  ? value - step
                  : e.key === 'PageUp'
                    ? value + big
                    : e.key === 'PageDown'
                      ? value - big
                      : e.key === 'Home'
                        ? min
                        : e.key === 'End'
                          ? max
                          : null;
            if (next === null) return;
            e.preventDefault();
            onChange(clamp(next));
          },
        }
      : {};

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View
        {...responder.panHandlers}
        {...web}
        focusable
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: format(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? step : -step)))
        }
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          Platform.OS === 'web' ? ({ cursor: 'ns-resize', touchAction: 'none' } as object) : null,
        ]}
      >
        <Svg width={size} height={size} accessibilityElementsHidden>
          <G>
            {ticks.map((t, i) => {
              const a = polar(c - 1, t, c),
                b = polar(c - (i % 5 === 0 ? 9 : 5), t, c);
              return (
                <Line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={colors.faint}
                  strokeWidth={i % 5 === 0 ? 2 : 1}
                />
              );
            })}
            <Path
              d={`M${arcStart.x} ${arcStart.y}A${c - 6} ${c - 6} 0 ${large} 1 ${arcEnd.x} ${arcEnd.y}`}
              stroke={colors.accent}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
            />
            <Circle
              cx={c}
              cy={c}
              r={c * 0.68}
              fill={colors.raised}
              stroke={colors.lineStrong}
              strokeWidth={1}
            />
            <Circle cx={c} cy={c} r={c * 0.58} fill={colors.surface} stroke={colors.sheen} />
            <Line
              x1={pointerBase.x}
              y1={pointerBase.y}
              x2={pointer.x}
              y2={pointer.y}
              stroke={colors.accent}
              strokeWidth={4}
              strokeLinecap="round"
            />
          </G>
        </Svg>
      </View>
      <Text
        style={{
          color: colors.muted,
          fontFamily: fonts.body,
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
