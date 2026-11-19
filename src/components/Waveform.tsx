import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, Line, Path, Rect } from 'react-native-svg';
import type { Loop } from '../platform/playerTypes';
import { Button, colors } from './ui';

const ZOOMS = [1, 2, 4, 8, 16, 32] as const;
const DOUBLE_TAP_MS = 320;
const DRAG_PX = 5;
const MIN_LOOP = 0.2;

/** Envolvente simétrica de una ventana [from, to) en segundos: un valor 0–1 por columna. */
function envelope(peaks: number[], duration: number, from: number, to: number, columns: number) {
  const out = new Array<number>(columns).fill(0);
  if (!peaks.length || duration <= 0) return out;
  const perSecond = peaks.length / duration;
  for (let c = 0; c < columns; c++) {
    const a = from + ((to - from) * c) / columns;
    const b = from + ((to - from) * (c + 1)) / columns;
    const i0 = Math.max(0, Math.floor(a * perSecond));
    const i1 = Math.min(peaks.length, Math.max(i0 + 1, Math.ceil(b * perSecond)));
    let max = 0;
    for (let i = i0; i < i1; i++) if (peaks[i]! > max) max = peaks[i]!;
    // Curva suave para que los pasajes flojos se lean sin saturar los fuertes.
    out[c] = Math.pow(max, 0.8);
  }
  return out;
}

/** Un único trazo relleno (arriba y abajo en espejo): mucho más ligero que miles de rectángulos. */
function wavePath(levels: number[], height: number, columnWidth: number) {
  if (!levels.length) return '';
  const mid = height / 2;
  const amp = mid - 4;
  let top = `M0 ${mid}`;
  let bottom = '';
  levels.forEach((level, i) => {
    const x = (i + 0.5) * columnWidth;
    const h = Math.max(0.6, level * amp);
    top += ` L${x.toFixed(1)} ${(mid - h).toFixed(1)}`;
    bottom = ` L${x.toFixed(1)} ${(mid + h).toFixed(1)}` + bottom;
  });
  return `${top} L${(levels.length * columnWidth).toFixed(1)} ${mid}${bottom} Z`;
}

/**
 * Forma de onda navegable, al estilo de los reproductores de transcripción:
 * - Pulsar salta a ese punto. Arrastrar selecciona el bucle. Doble pulsación lo quita.
 * - Zoom con ventana que sigue a la reproducción; la franja inferior muestra toda la
 *   canción y permite moverse por ella.
 */
export function Waveform({
  peaks,
  duration,
  position,
  playing,
  loop,
  markers,
  onSeek,
  onSelect,
  onClearLoop,
  height = 120,
}: {
  peaks: number[];
  duration: number;
  position: number;
  playing: boolean;
  loop: Loop | null;
  markers: { id: string; time: number }[];
  onSeek: (time: number) => void;
  onSelect: (loop: Loop) => void;
  onClearLoop: () => void;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1);
  const [start, setStart] = useState(0);
  const [drag, setDrag] = useState<Loop | null>(null);
  const span = duration / zoom;
  const viewStart = Math.max(0, Math.min(start, Math.max(0, duration - span)));
  const viewEnd = viewStart + span;

  // La ventana sigue a la reproducción cuando el cursor se sale de ella.
  useEffect(() => {
    if (zoom === 1 || !playing || drag) return;
    if (position < viewStart || position > viewEnd - span * 0.05) setStart(position - span * 0.1);
  }, [position, playing, zoom, viewStart, viewEnd, span, drag]);

  const levels = useMemo(
    () => (width > 0 ? envelope(peaks, duration, viewStart, viewEnd, Math.floor(width)) : []),
    [peaks, duration, viewStart, viewEnd, width],
  );
  const path = useMemo(
    () => wavePath(levels, height, width / Math.max(1, levels.length)),
    [levels, height, width],
  );
  const overviewLevels = useMemo(
    () => (width > 0 ? envelope(peaks, duration, 0, duration, Math.floor(width / 2)) : []),
    [peaks, duration, width],
  );
  const overviewPath = useMemo(
    () => wavePath(overviewLevels, 32, width / Math.max(1, overviewLevels.length)),
    [overviewLevels, width],
  );

  const x = (t: number) => ((t - viewStart) / span) * width;
  const timeAtX = (px: number) =>
    Math.max(0, Math.min(duration, viewStart + (Math.max(0, Math.min(width, px)) / width) * span));

  // Gestos: pulsar, arrastrar y doble pulsación, sobre la vista principal.
  const gesture = useRef({ x0: 0, t0: 0, dragging: false, lastTap: 0, lastX: -100 });
  const latest = useRef({ timeAtX, onSeek, onSelect, onClearLoop });
  latest.current = { timeAtX, onSeek, onSelect, onClearLoop };
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const px = e.nativeEvent.locationX;
          gesture.current.x0 = px;
          gesture.current.t0 = latest.current.timeAtX(px);
          gesture.current.dragging = false;
        },
        onPanResponderMove: (_, g) => {
          if (!gesture.current.dragging && Math.abs(g.dx) < DRAG_PX) return;
          gesture.current.dragging = true;
          const t1 = latest.current.timeAtX(gesture.current.x0 + g.dx);
          const t0 = gesture.current.t0;
          setDrag({ a: Math.min(t0, t1), b: Math.max(t0, t1) });
        },
        onPanResponderRelease: (_, g) => {
          const { t0 } = gesture.current;
          if (gesture.current.dragging) {
            const t1 = latest.current.timeAtX(gesture.current.x0 + g.dx);
            const a = Math.min(t0, t1),
              b = Math.max(t0, t1);
            setDrag(null);
            if (b - a >= MIN_LOOP) latest.current.onSelect({ a, b });
            return;
          }
          const now = Date.now();
          const isDouble =
            now - gesture.current.lastTap < DOUBLE_TAP_MS &&
            Math.abs(gesture.current.x0 - gesture.current.lastX) < 24;
          gesture.current.lastTap = isDouble ? 0 : now;
          gesture.current.lastX = gesture.current.x0;
          if (isDouble) latest.current.onClearLoop();
          else latest.current.onSeek(t0);
        },
        onPanResponderTerminate: () => setDrag(null),
      }),
    [],
  );
  // Franja general: pulsar o arrastrar mueve la ventana visible.
  const overview = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => centerAt(e.nativeEvent.locationX),
        onPanResponderMove: (e) => centerAt(e.nativeEvent.locationX),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const centerRef = useRef((px: number) => {});
  centerRef.current = (px: number) => {
    if (width <= 0) return;
    setStart((px / width) * duration - span / 2);
  };
  function centerAt(px: number) {
    centerRef.current(px);
  }

  const shown = drag ?? loop;
  const played = Math.max(0, Math.min(width, x(position)));
  const zoomIndex = ZOOMS.indexOf(zoom);
  const setZoomKeeping = (next: (typeof ZOOMS)[number]) => {
    // Mantiene el cursor de reproducción en el mismo punto relativo de la ventana.
    const rel = span > 0 ? (position - viewStart) / span : 0;
    const nextSpan = duration / next;
    setZoom(next);
    setStart(position - Math.max(0, Math.min(1, rel)) * nextSpan);
  };

  return (
    <View style={{ gap: 8 }}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel="Forma de onda. Pulsa para saltar, arrastra para crear un bucle, doble pulsación para quitarlo"
        accessibilityValue={{ text: `${Math.floor(position)} de ${Math.floor(duration)} segundos` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          onSeek(
            Math.min(
              duration,
              Math.max(0, position + (e.nativeEvent.actionName === 'increment' ? 5 : -5)),
            ),
          )
        }
        style={{ height, borderRadius: 10, backgroundColor: '#F3F1EA', overflow: 'hidden' }}
        {...responder.panHandlers}
      >
        {width > 0 ? (
          <Svg width={width} height={height} pointerEvents="none">
            <Defs>
              <ClipPath id="played">
                <Rect x={0} y={0} width={played} height={height} />
              </ClipPath>
            </Defs>
            {shown ? (
              <Rect
                x={x(shown.a)}
                y={0}
                width={Math.max(2, x(shown.b) - x(shown.a))}
                height={height}
                fill={drag ? '#D5E6D3' : colors.pale}
              />
            ) : null}
            <Line
              x1={0}
              x2={width}
              y1={height / 2}
              y2={height / 2}
              stroke="#D9D3C4"
              strokeWidth={1}
            />
            <Path d={path} fill="#9AA79B" />
            <Path d={path} fill={colors.green} clipPath="url(#played)" />
            {shown ? (
              <>
                <Line
                  x1={x(shown.a)}
                  x2={x(shown.a)}
                  y1={0}
                  y2={height}
                  stroke={colors.green}
                  strokeWidth={2}
                />
                <Line
                  x1={x(shown.b)}
                  x2={x(shown.b)}
                  y1={0}
                  y2={height}
                  stroke={colors.green}
                  strokeWidth={2}
                />
              </>
            ) : null}
            {markers
              .filter((m) => m.time >= viewStart && m.time <= viewEnd)
              .map((m) => (
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
            {position >= viewStart && position <= viewEnd ? (
              <Line
                x1={played}
                x2={played}
                y1={0}
                y2={height}
                stroke={colors.ink}
                strokeWidth={2}
              />
            ) : null}
          </Svg>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Button
          small
          variant="secondary"
          disabled={zoomIndex <= 0}
          onPress={() => setZoomKeeping(ZOOMS[Math.max(0, zoomIndex - 1)]!)}
        >
          −
        </Button>
        <Text
          style={{
            minWidth: 40,
            textAlign: 'center',
            color: colors.ink,
            fontWeight: '600',
            fontVariant: ['tabular-nums'],
          }}
        >
          {zoom}×
        </Text>
        <Button
          small
          variant="secondary"
          disabled={zoomIndex >= ZOOMS.length - 1}
          onPress={() => setZoomKeeping(ZOOMS[Math.min(ZOOMS.length - 1, zoomIndex + 1)]!)}
        >
          +
        </Button>
        {/* Vista general: toda la canción, la ventana visible y el bucle. */}
        <View
          style={{
            flex: 1,
            height: 32,
            borderRadius: 6,
            backgroundColor: '#F3F1EA',
            overflow: 'hidden',
          }}
          accessibilityLabel="Vista general de la canción"
          {...overview.panHandlers}
        >
          {width > 0 ? (
            <Svg
              width="100%"
              height={32}
              viewBox={`0 0 ${width} 32`}
              preserveAspectRatio="none"
              pointerEvents="none"
            >
              {loop ? (
                <Rect
                  x={(loop.a / duration) * width}
                  y={0}
                  width={Math.max(2, ((loop.b - loop.a) / duration) * width)}
                  height={32}
                  fill={colors.pale}
                />
              ) : null}
              <Path d={overviewPath} fill="#B9C2B8" />
              {zoom > 1 ? (
                <Rect
                  x={(viewStart / duration) * width}
                  y={1}
                  width={Math.max(4, (span / duration) * width)}
                  height={30}
                  rx={4}
                  fill="none"
                  stroke={colors.green}
                  strokeWidth={2}
                />
              ) : null}
              <Line
                x1={(position / duration) * width}
                x2={(position / duration) * width}
                y1={0}
                y2={32}
                stroke={colors.ink}
                strokeWidth={1.5}
              />
            </Svg>
          ) : null}
        </View>
      </View>
    </View>
  );
}
