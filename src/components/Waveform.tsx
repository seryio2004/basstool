import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, Line, Path, Rect } from 'react-native-svg';
import { envelope, loopFromTimes, wavePath } from '../core/waveform';
import type { TimedEvent } from '../core/scoreAudio';
import type { Loop } from '../platform/playerTypes';
import { Button, colors } from './ui';

const ZOOMS = [1, 2, 4, 8, 16, 32] as const;
const DOUBLE_TAP_MS = 320;
const DRAG_PX = 5;

/**
 * Forma de onda navegable, al estilo de los reproductores de transcripción:
 * - Pulsar salta a ese punto. Arrastrar selecciona el bucle. Doble pulsación lo quita.
 * - Zoom con ventana que sigue a la reproducción; la franja inferior muestra toda la
 *   canción y permite moverse por ella.
 */
export function Waveform({
  annotations,
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
  annotations: { events: TimedEvent[]; bars: number[] };
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
  const [overviewWidth, setOverviewWidth] = useState(0);
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1);
  const [start, setStart] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [drag, setDrag] = useState<Loop | null>(null);
  const span = duration / zoom;
  const viewStart = Math.max(0, Math.min(start, Math.max(0, duration - span)));
  const viewEnd = viewStart + span;

  // La ventana sigue a la reproducción cuando el cursor se sale de ella.
  useEffect(() => {
    if (zoom === 1 || !playing || selecting) return;
    if (position < viewStart || position > viewEnd - span * 0.05) setStart(position - span * 0.1);
  }, [position, playing, zoom, viewStart, viewEnd, span, selecting]);

  const levels = useMemo(
    () => (width > 0 ? envelope(peaks, duration, viewStart, viewEnd, Math.floor(width)) : []),
    [peaks, duration, viewStart, viewEnd, width],
  );
  const path = useMemo(
    () => wavePath(levels, height, width / Math.max(1, levels.length)),
    [levels, height, width],
  );
  const overviewLevels = useMemo(
    () => envelope(peaks, duration, 0, duration, Math.floor(overviewWidth)),
    [peaks, duration, overviewWidth],
  );
  const overviewPath = useMemo(
    () => wavePath(overviewLevels, 32, overviewWidth / Math.max(1, overviewLevels.length)),
    [overviewLevels, overviewWidth],
  );

  const x = (t: number) => (span > 0 ? ((t - viewStart) / span) * width : 0);
  const scoreMarks = useMemo(() => {
    const px = (t: number) => ((t - viewStart) / span) * width;
    const bars = annotations.bars
      .filter((t) => t >= viewStart && t <= viewEnd)
      .map((t) => `M${px(t)} 0v14`)
      .join(' ');
    const notes = annotations.events
      .filter((e) => e.midi !== undefined && e.end > viewStart && e.start < viewEnd)
      .map((e) => `M${px(e.start)} ${height - 6}h${Math.max(1, px(e.end) - px(e.start) - 2)}`)
      .join(' ');
    return { bars, notes };
  }, [annotations, viewStart, viewEnd, span, width, height]);
  const timeAtX = (px: number) =>
    Math.max(
      0,
      Math.min(
        duration,
        viewStart + (Math.max(0, Math.min(width, px)) / Math.max(1, width)) * span,
      ),
    );

  // Gestos: pulsar, arrastrar y doble pulsación, sobre la vista principal.
  const gesture = useRef({ x0: 0, dragging: false, timeAtX });
  const pendingTap = useRef<{
    x: number;
    time: number;
    at: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const latest = useRef({ timeAtX, onSeek, onSelect, onClearLoop });
  latest.current = { timeAtX, onSeek, onSelect, onClearLoop };
  useEffect(
    () => () => {
      if (pendingTap.current) clearTimeout(pendingTap.current.timer);
    },
    [],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          gesture.current = {
            x0: e.nativeEvent.locationX,
            dragging: false,
            timeAtX: latest.current.timeAtX,
          };
          setSelecting(true);
        },
        onPanResponderMove: (_, g) => {
          const active = gesture.current;
          if (!active.dragging && Math.abs(g.dx) < DRAG_PX) return;
          active.dragging = true;
          const t0 = active.timeAtX(active.x0);
          const t1 = active.timeAtX(active.x0 + g.dx);
          setDrag({ a: Math.min(t0, t1), b: Math.max(t0, t1) });
        },
        onPanResponderRelease: (_, g) => {
          const { x0, timeAtX, dragging } = gesture.current;
          const t0 = timeAtX(x0);
          setDrag(null);
          setSelecting(false);
          if (dragging || Math.abs(g.dx) >= DRAG_PX) {
            const selection = loopFromTimes(t0, timeAtX(x0 + g.dx));
            if (selection) latest.current.onSelect(selection);
            return;
          }

          const now = Date.now();
          const previous = pendingTap.current;
          if (previous) {
            clearTimeout(previous.timer);
            pendingTap.current = null;
            if (now - previous.at < DOUBLE_TAP_MS && Math.abs(x0 - previous.x) < 24) {
              latest.current.onClearLoop();
              return;
            }
            latest.current.onSeek(previous.time);
          }
          const timer = setTimeout(() => {
            pendingTap.current = null;
            latest.current.onSeek(t0);
          }, DOUBLE_TAP_MS);
          pendingTap.current = { x: x0, time: t0, at: now, timer };
        },
        onPanResponderTerminate: () => {
          setDrag(null);
          setSelecting(false);
        },
      }),
    [],
  );

  // Franja general: usa su propio ancho y el desplazamiento desde el punto inicial.
  const centerRef = useRef((px: number) => {});
  centerRef.current = (px: number) => {
    if (overviewWidth <= 0) return;
    setStart((px / overviewWidth) * duration - span / 2);
  };
  const overview = useMemo(() => {
    let x0 = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        x0 = e.nativeEvent.locationX;
        setSelecting(true);
        centerRef.current(x0);
      },
      onPanResponderMove: (_, g) => centerRef.current(x0 + g.dx),
      onPanResponderRelease: () => setSelecting(false),
      onPanResponderTerminate: () => setSelecting(false),
    });
  }, []);

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
            <Path d={scoreMarks.bars} stroke={colors.ink} strokeWidth={2} />
            <Path d={scoreMarks.notes} stroke={colors.green} strokeWidth={4} />
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
          style={{ minWidth: 44, paddingHorizontal: 12 }}
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
          style={{ minWidth: 44, paddingHorizontal: 12 }}
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
            height: 44,
            borderRadius: 6,
            backgroundColor: '#F3F1EA',
            overflow: 'hidden',
          }}
          onLayout={(e) => setOverviewWidth(e.nativeEvent.layout.width)}
          accessibilityLabel="Vista general de la canción"
          {...overview.panHandlers}
        >
          {overviewWidth > 0 && duration > 0 ? (
            <Svg
              width="100%"
              height={44}
              viewBox={`0 0 ${overviewWidth} 32`}
              preserveAspectRatio="none"
              pointerEvents="none"
            >
              {loop ? (
                <Rect
                  x={(loop.a / duration) * overviewWidth}
                  y={0}
                  width={Math.max(2, ((loop.b - loop.a) / duration) * overviewWidth)}
                  height={44}
                  fill={colors.pale}
                />
              ) : null}
              <Path d={overviewPath} fill="#B9C2B8" />
              {zoom > 1 ? (
                <Rect
                  x={(viewStart / duration) * overviewWidth}
                  y={1}
                  width={Math.max(4, (span / duration) * overviewWidth)}
                  height={30}
                  rx={4}
                  fill="none"
                  stroke={colors.green}
                  strokeWidth={2}
                />
              ) : null}
              <Line
                x1={(position / duration) * overviewWidth}
                x2={(position / duration) * overviewWidth}
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
