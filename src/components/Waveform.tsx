import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { envelope, loopFromTimes, wavePath } from '../core/waveform';
import type { TimedEvent } from '../core/scoreAudio';
import type { Loop } from '../platform/playerTypes';
import { Button, colors, fonts } from './ui';

const ZOOMS = [1, 2, 4, 8, 16, 32] as const;
const DOUBLE_TAP_MS = 320;
const DRAG_PX = 5;
const MARKER_RAIL = 36;
const MARKER_WIDTH = 40;

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
  onMoveMeasure,
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
  onMoveMeasure: (index: number, time: number) => void;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const [overviewWidth, setOverviewWidth] = useState(0);
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1);
  const [start, setStart] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [drag, setDrag] = useState<Loop | null>(null);
  const [moving, setMoving] = useState<{ index: number; time: number } | null>(null);
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
    const notes = annotations.events
      .filter((e) => e.midi !== undefined && e.end > viewStart && e.start < viewEnd)
      .map((e) => `M${px(e.start)} ${height - 6}h${Math.max(1, px(e.end) - px(e.start) - 2)}`)
      .join(' ');
    return notes;
  }, [annotations.events, viewStart, viewEnd, span, width, height]);
  const timeAtX = (px: number) =>
    Math.max(
      0,
      Math.min(
        duration,
        viewStart + (Math.max(0, Math.min(width, px)) / Math.max(1, width)) * span,
      ),
    );

  const visibleBars = annotations.bars.flatMap((time, index) => {
    const at = moving?.index === index ? moving.time : time;
    if (at < viewStart || at > viewEnd) return [];
    const px = x(at);
    const left = Math.max(0, Math.min(width - MARKER_WIDTH, px - MARKER_WIDTH / 2));
    return [{ index, time: at, px, left }];
  });
  const activeHandle = visibleBars.find((bar) => bar.index === moving?.index);
  let lastRight = -Infinity;
  const handles = visibleBars.filter((bar) => {
    if (
      activeHandle &&
      bar !== activeHandle &&
      Math.abs(bar.left - activeHandle.left) < MARKER_WIDTH + 2
    )
      return false;
    if (bar.left < lastRight + 2) return false;
    lastRight = bar.left + MARKER_WIDTH;
    return true;
  });
  const measureAt = (px: number, py: number) =>
    py <= MARKER_RAIL
      ? handles.find((bar) => px >= bar.left && px <= bar.left + MARKER_WIDTH)
      : undefined;
  const moveTime = (index: number, time: number) =>
    Math.max(
      index > 0 ? annotations.bars[index - 1]! + 0.05 : 0,
      Math.min(
        time,
        (annotations.bars[index + 1] ?? Infinity) - 0.05,
        Math.max(0, duration - 0.001),
      ),
    );
  // La banda superior mueve compases. Bajo ella, el arrastre sigue creando bucles.
  const gesture = useRef({
    x0: 0,
    dragging: false,
    timeAtX,
    marker: undefined as (typeof handles)[number] | undefined,
  });
  const pendingTap = useRef<{
    x: number;
    time: number;
    at: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const latest = useRef({
    timeAtX,
    measureAt,
    moveTime,
    onSeek,
    onSelect,
    onClearLoop,
    onMoveMeasure,
  });
  latest.current = { timeAtX, measureAt, moveTime, onSeek, onSelect, onClearLoop, onMoveMeasure };
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
          const { locationX, locationY } = e.nativeEvent;
          gesture.current = {
            x0: locationX,
            dragging: false,
            timeAtX: latest.current.timeAtX,
            marker: latest.current.measureAt(locationX, locationY),
          };
          if (gesture.current.marker && pendingTap.current) {
            clearTimeout(pendingTap.current.timer);
            pendingTap.current = null;
          }
          setSelecting(true);
        },
        onPanResponderMove: (_, g) => {
          const active = gesture.current;
          if (!active.dragging && Math.abs(g.dx) < DRAG_PX) return;
          active.dragging = true;
          if (active.marker) {
            const { index, px } = active.marker;
            setMoving({ index, time: latest.current.moveTime(index, active.timeAtX(px + g.dx)) });
            return;
          }
          const t0 = active.timeAtX(active.x0);
          const t1 = active.timeAtX(active.x0 + g.dx);
          setDrag({ a: Math.min(t0, t1), b: Math.max(t0, t1) });
        },
        onPanResponderRelease: (_, g) => {
          const { x0, timeAtX, dragging, marker } = gesture.current;
          const t0 = timeAtX(x0);
          setDrag(null);
          setMoving(null);
          setSelecting(false);
          if (marker) {
            if (dragging || Math.abs(g.dx) >= DRAG_PX) {
              const { index, px } = marker;
              latest.current.onMoveMeasure(
                index,
                latest.current.moveTime(index, timeAtX(px + g.dx)),
              );
            } else latest.current.onSeek(marker.time);
            return;
          }
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
          setMoving(null);
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
        accessibilityLabel="Forma de onda. Pulsa para saltar, arrastra un número para mover su compás o la onda para crear un bucle"
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
        style={{
          height,
          borderRadius: 10,
          backgroundColor: colors.wave,
          borderWidth: 1,
          borderColor: colors.line,
          overflow: 'hidden',
        }}
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
                fill={colors.accentSoft}
                opacity={drag ? 0.7 : 1}
              />
            ) : null}
            <Line
              x1={0}
              x2={width}
              y1={height / 2}
              y2={height / 2}
              stroke={colors.line}
              strokeWidth={1}
            />
            <Path d={path} fill={colors.waveDim} />
            <Path d={path} fill={colors.accent} clipPath="url(#played)" />
            {shown ? (
              <>
                <Line
                  x1={x(shown.a)}
                  x2={x(shown.a)}
                  y1={0}
                  y2={height}
                  stroke={colors.accent}
                  strokeWidth={2}
                />
                <Line
                  x1={x(shown.b)}
                  x2={x(shown.b)}
                  y1={0}
                  y2={height}
                  stroke={colors.accent}
                  strokeWidth={2}
                />
              </>
            ) : null}
            <Path d={scoreMarks} stroke={colors.accent} strokeWidth={4} />
            {markers
              .filter((m) => m.time >= viewStart && m.time <= viewEnd)
              .map((m) => (
                <Line
                  key={m.id}
                  x1={x(m.time)}
                  x2={x(m.time)}
                  y1={0}
                  y2={height}
                  stroke={colors.info}
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
            {visibleBars.map((bar) => (
              <Line
                key={bar.index}
                x1={bar.px}
                x2={bar.px}
                y1={0}
                y2={height}
                stroke={colors.accent}
                strokeWidth={2}
              />
            ))}
            {handles.map(({ index, left }) => (
              <React.Fragment key={index}>
                <Rect x={left} y={4} width={MARKER_WIDTH} height={28} rx={6} fill={colors.accent} />
                <SvgText
                  x={left + MARKER_WIDTH / 2}
                  y={22}
                  fill={colors.onAccent}
                  fontFamily={fonts.mono}
                  fontSize={13}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {index + 1}
                </SvgText>
              </React.Fragment>
            ))}
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
            fontFamily: fonts.mono,
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
            backgroundColor: colors.wave,
            borderWidth: 1,
            borderColor: colors.line,
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
                  fill={colors.accentSoft}
                />
              ) : null}
              <Path d={overviewPath} fill={colors.waveDim} />
              {zoom > 1 ? (
                <Rect
                  x={(viewStart / duration) * overviewWidth}
                  y={1}
                  width={Math.max(4, (span / duration) * overviewWidth)}
                  height={30}
                  rx={4}
                  fill="none"
                  stroke={colors.accent}
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
