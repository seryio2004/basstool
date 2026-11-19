import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { ClipPath, Defs, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import {
  envelope,
  loopFromTimes,
  MAX_WAVE_ZOOM,
  moveLoopEdge,
  wavePath,
  waveWindow,
  zoomWave,
  type WaveWindow,
} from '../core/waveform';
import type { TimedEvent } from '../core/scoreAudio';
import type { Loop } from '../platform/playerTypes';
import { Button, Toggle, colors, fonts } from './ui';

const DOUBLE_TAP_MS = 320;
const DRAG_PX = 5;
const MARKER_RAIL = 44;
const TARGET = 44;
const ZOOM_STEPS = 100;

type Point = { x: number; y: number };
type Bar = { index: number; time: number; px: number; left: number };
type LoopEdge = { edge: 'a' | 'b'; loop: Loop; px: number };
type WaveGesture = {
  origin: Point;
  timeAtX: (px: number) => number;
  marker?: Bar;
  handle?: LoopEdge;
  moved: boolean;
  pan: boolean;
  window: WaveWindow;
  pinch?: { x: number; distance: number; window: WaveWindow };
};

function touchPair(points: Point[]) {
  const [a, b] = points;
  return a && b
    ? {
        x: (a.x + b.x) / 2,
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      }
    : null;
}

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
  editing,
  loop,
  markers,
  onSeek,
  onSelect,
  onClearLoop,
  onMoveMeasure,
  height = 120,
}: {
  annotations: { events: TimedEvent[]; bars: number[]; beats: number[] };
  peaks: number[];
  duration: number;
  position: number;
  playing: boolean;
  editing: boolean;
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
  const [viewport, setViewport] = useState<WaveWindow>({ zoom: 1, start: 0 });
  const [selecting, setSelecting] = useState(false);
  const [snap, setSnap] = useState(true);
  const [drag, setDrag] = useState<Loop | null>(null);
  const [moving, setMoving] = useState<{ index: number; time: number } | null>(null);
  const view = waveWindow(duration, viewport.zoom, viewport.start);
  const { zoom, start: viewStart } = view;
  const span = duration / zoom;
  const viewEnd = viewStart + span;
  const follow = useRef(true);
  const lastPosition = useRef(position);
  // A manual pan stays put. Starting playback or seeking resumes following.
  useEffect(() => {
    if (playing) follow.current = true;
  }, [playing]);
  useEffect(() => {
    const jumped = Math.abs(position - lastPosition.current) > 1;
    lastPosition.current = position;
    if (jumped) follow.current = true;
    if (zoom === 1 || !playing || selecting || !follow.current) return;
    if (position < viewStart || position > viewEnd - span * 0.05) {
      setViewport(waveWindow(duration, zoom, position - span * 0.1));
    }
  }, [position, playing, zoom, viewStart, viewEnd, span, duration, selecting]);

  const snapMarks = useMemo(
    () => [...annotations.bars, ...annotations.beats],
    [annotations.bars, annotations.beats],
  );
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
    const left = Math.max(0, Math.min(width - TARGET, px - TARGET / 2));
    return [{ index, time: at, px, left }];
  });
  const activeHandle = visibleBars.find((bar) => bar.index === moving?.index);
  let lastRight = -Infinity;
  const handles = visibleBars.filter((bar) => {
    if (activeHandle && bar !== activeHandle && Math.abs(bar.left - activeHandle.left) < TARGET + 2)
      return false;
    if (bar.left < lastRight + 2) return false;
    lastRight = bar.left + TARGET;
    return true;
  });
  const measureAt = (px: number, py: number) =>
    py < MARKER_RAIL ? handles.find((bar) => px >= bar.left && px <= bar.left + TARGET) : undefined;
  const moveTime = (index: number, time: number) =>
    Math.max(
      index > 0 ? annotations.bars[index - 1]! + 0.05 : 0,
      Math.min(
        time,
        (annotations.bars[index + 1] ?? Infinity) - 0.05,
        Math.max(0, duration - 0.001),
      ),
    );
  const edgeHandles = (['a', 'b'] as const).flatMap((edge) => {
    const current = drag ?? loop;
    if (!current || current[edge] < viewStart || current[edge] > viewEnd) return [];
    const px = x(current[edge]);
    const left = Math.max(0, Math.min(width - TARGET, px - TARGET / 2));
    // Separate the two hit targets vertically so even a short loop is adjustable.
    const top = edge === 'a' ? MARKER_RAIL : height - TARGET;
    return [{ edge, loop: current, px, left, top }];
  });
  const edgeAt = ({ x, y }: Point) =>
    edgeHandles.find(
      (handle) =>
        x >= handle.left && x <= handle.left + TARGET && y >= handle.top && y < handle.top + TARGET,
    );

  const gesture = useRef<WaveGesture | null>(null);
  const pendingTap = useRef<{
    x: number;
    time: number;
    at: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const cancelTap = () => {
    if (pendingTap.current) clearTimeout(pendingTap.current.timer);
    pendingTap.current = null;
  };
  useEffect(() => cancelTap, []);

  const begin = (point: Point, pan = false) => {
    gesture.current = {
      origin: point,
      timeAtX,
      marker: pan ? undefined : measureAt(point.x, point.y),
      handle: pan ? undefined : edgeAt(point),
      moved: false,
      pan,
      window: view,
    };
    setSelecting(true);
  };

  const move = (points: Point[]) => {
    const active = gesture.current;
    const point = points[0];
    if (!active || !point) return;
    const pair = touchPair(points);
    if (pair) {
      if (!active.pinch) {
        active.pinch = { ...pair, window: view };
        cancelTap();
        setDrag(null);
        setMoving(null);
      }
      const base = active.pinch;
      follow.current = false;
      setViewport(
        zoomWave(
          duration,
          base.window,
          (base.window.zoom * pair.distance) / base.distance,
          base.x / width,
          pair.x / width,
        ),
      );
      return;
    }
    if (active.pinch) return;
    const dx = point.x - active.origin.x;
    if (!active.moved && Math.abs(dx) < DRAG_PX) return;
    active.moved = true;
    cancelTap();
    if (active.pan) {
      follow.current = false;
      const { start, zoom } = active.window;
      setViewport(waveWindow(duration, zoom, start - (dx / width) * (duration / zoom)));
    } else if (active.marker) {
      const { index, px } = active.marker;
      setMoving({ index, time: moveTime(index, active.timeAtX(px + dx)) });
    } else if (active.handle) {
      setDrag(adjustEdge(active, dx));
    } else {
      const a = active.timeAtX(active.origin.x);
      const b = active.timeAtX(point.x);
      setDrag({ a: Math.min(a, b), b: Math.max(a, b) });
    }
  };

  function adjustEdge(active: WaveGesture, dx: number) {
    const { edge, loop, px } = active.handle!;
    return moveLoopEdge(
      loop,
      edge,
      active.timeAtX(px + dx),
      duration,
      snap ? snapMarks : [],
      Math.min(0.35, (12 / width) * span),
    );
  }

  const finish = (point?: Point) => {
    const active = gesture.current;
    gesture.current = null;
    setDrag(null);
    setMoving(null);
    setSelecting(false);
    if (!point || !active || active.pinch || active.pan) return;
    const { origin, timeAtX, marker, handle } = active;
    const dx = point.x - origin.x;
    const moved = active.moved || Math.abs(dx) >= DRAG_PX;
    if (moved) {
      cancelTap();
      if (marker) onMoveMeasure(marker.index, moveTime(marker.index, timeAtX(marker.px + dx)));
      else if (handle) onSelect(adjustEdge(active, dx));
      else {
        const selection = loopFromTimes(timeAtX(origin.x), timeAtX(point.x));
        if (selection) onSelect(selection);
      }
      return;
    }
    if (marker) {
      cancelTap();
      onSeek(marker.time);
      return;
    }
    const now = Date.now();
    const previous = pendingTap.current;
    if (previous) {
      cancelTap();
      if (now - previous.at < DOUBLE_TAP_MS && Math.abs(origin.x - previous.x) < 24) {
        onClearLoop();
        return;
      }
      onSeek(previous.time);
    }
    const time = timeAtX(origin.x);
    const timer = setTimeout(() => {
      pendingTap.current = null;
      latest.current.onSeek(time);
    }, DOUBLE_TAP_MS);
    pendingTap.current = { x: origin.x, time, at: now, timer };
  };

  const setZoomKeeping = (next: number, fraction?: number) => {
    const relative =
      position >= viewStart && position <= viewEnd && span > 0
        ? (position - viewStart) / span
        : 0.5;
    setViewport(zoomWave(duration, view, next, fraction ?? relative));
    if (fraction !== undefined) follow.current = false;
  };
  const wheelZoom = (factor: number, fraction: number) => {
    follow.current = false;
    setViewport((current) => zoomWave(duration, current, current.zoom * factor, fraction));
  };
  const panBy = (pixels: number) => {
    follow.current = false;
    setViewport((current) =>
      waveWindow(
        duration,
        current.zoom,
        current.start + (pixels / width) * (duration / current.zoom),
      ),
    );
  };

  const latest = useRef({
    begin,
    move,
    finish,
    setZoomKeeping,
    wheelZoom,
    panBy,
    zoom,
    editing,
    onSeek,
  });
  latest.current = { begin, move, finish, setZoomKeeping, wheelZoom, panBy, zoom, editing, onSeek };
  const waveRef = useRef<React.ComponentRef<typeof View>>(null);
  const responder = useMemo(() => {
    let offset: Point;
    const point = (touch: GestureResponderEvent['nativeEvent']): Point => ({
      x: touch.pageX - offset.x,
      y: touch.pageY - offset.y,
    });
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const { pageX, pageY, locationX, locationY } = e.nativeEvent;
        offset = { x: pageX - locationX, y: pageY - locationY };
        latest.current.begin(point(e.nativeEvent));
        latest.current.move(e.nativeEvent.touches.map(point));
      },
      onPanResponderStart: (e) => {
        if (e.nativeEvent.touches.length > 1) latest.current.move(e.nativeEvent.touches.map(point));
      },
      onPanResponderMove: (e) => latest.current.move(e.nativeEvent.touches.map(point)),
      onPanResponderRelease: (e) => latest.current.finish(point(e.nativeEvent)),
      onPanResponderTerminate: () => latest.current.finish(),
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = waveRef.current as unknown as HTMLElement | null;
    if (!node) return;
    const pointers = new Map<number, Point>();
    const locate = (event: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const point = locate(event);
      if (!pointers.size) {
        node.focus({ preventScroll: true });
        latest.current.begin(point, event.shiftKey);
      }
      pointers.set(event.pointerId, point);
      node.setPointerCapture(event.pointerId);
      if (pointers.size > 1) latest.current.move([...pointers.values()]);
    };
    const dragPointer = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, locate(event));
      latest.current.move([...pointers.values()]);
    };
    const up = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId) || pointers.size) return;
      latest.current.finish(locate(event));
    };
    const cancel = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.clear();
      latest.current.finish();
    };
    const wheel = (event: WheelEvent) => {
      const rect = node.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      if (event.ctrlKey) {
        event.preventDefault();
        const fraction = (event.clientX - rect.left) / rect.width;
        latest.current.wheelZoom(Math.exp((-event.deltaY * unit) / 240), fraction);
      } else if (latest.current.zoom > 1 && (event.deltaX || event.shiftKey)) {
        event.preventDefault();
        latest.current.panBy((event.deltaX || event.deltaY) * unit);
      }
    };
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (latest.current.editing && target !== node) ||
        (target !== node &&
          target?.closest('input, textarea, select, [contenteditable=true], [role=slider]'))
      )
        return;
      if (!['+', '=', '-', '−'].includes(event.key)) return;
      event.preventDefault();
      const factor = event.key === '+' || event.key === '=' ? 2 : 0.5;
      latest.current.setZoomKeeping(latest.current.zoom * factor);
    };
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', dragPointer);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', cancel);
    node.addEventListener('lostpointercapture', cancel);
    node.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key, true);
    return () => {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', dragPointer);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', cancel);
      node.removeEventListener('lostpointercapture', cancel);
      node.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key, true);
    };
  }, []);

  // The overview previews its window during a drag and seeks on a tap.
  const overviewAction = useRef((px: number, seek: boolean) => {});
  overviewAction.current = (px, seek) => {
    if (overviewWidth <= 0) return;
    const time = (Math.max(0, Math.min(overviewWidth, px)) / overviewWidth) * duration;
    follow.current = false;
    setViewport(waveWindow(duration, zoom, time - span / 2));
    if (seek) onSeek(time);
  };
  const overview = useMemo(() => {
    let x0 = 0;
    let moved = false;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        x0 = e.nativeEvent.locationX;
        moved = false;
        setSelecting(true);
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) >= DRAG_PX) moved = true;
        if (moved) overviewAction.current(x0 + g.dx, false);
      },
      onPanResponderRelease: (_, g) => {
        overviewAction.current(x0 + g.dx, !moved && Math.abs(g.dx) < DRAG_PX);
        setSelecting(false);
      },
      onPanResponderTerminate: () => setSelecting(false),
    });
  }, []);

  const shown = drag ?? loop;
  const played = Math.max(0, Math.min(width, x(position)));
  return (
    <View style={{ gap: 8 }}>
      <View
        ref={waveRef}
        tabIndex={0}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel="Forma de onda. Pulsa para saltar, arrastra para crear un bucle o ajustar sus extremos"
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
          ...(Platform.OS === 'web' ? { touchAction: 'none', userSelect: 'none' } : {}),
        }}
        {...(Platform.OS === 'web' ? {} : responder.panHandlers)}
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
            <Path d={path} fill={colors.wavePlayed} clipPath="url(#played)" />
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
            <Path d={scoreMarks} stroke={colors.muted} strokeWidth={4} />
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
            {annotations.beats
              .filter((time) => time >= viewStart && time <= viewEnd)
              .map((time) => (
                <Line
                  key={time}
                  x1={x(time)}
                  x2={x(time)}
                  y1={0}
                  y2={height}
                  stroke={colors.waveDim}
                  strokeWidth={1}
                  strokeDasharray="2 5"
                />
              ))}
            {visibleBars.map((bar) => (
              <Line
                key={bar.index}
                x1={bar.px}
                x2={bar.px}
                y1={0}
                y2={height}
                stroke={colors.muted}
                strokeWidth={1.5}
              />
            ))}
            {handles.map(({ index, left }) => (
              <React.Fragment key={index}>
                <Rect
                  x={left + 4}
                  y={4}
                  width={TARGET - 8}
                  height={28}
                  rx={6}
                  fill={colors.raised}
                />
                <SvgText
                  x={left + TARGET / 2}
                  y={22}
                  fill={colors.ink}
                  fontFamily={fonts.mono}
                  fontSize={13}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {index + 1}
                </SvgText>
              </React.Fragment>
            ))}
            {edgeHandles.map(({ edge, left, top }) => (
              <React.Fragment key={edge}>
                <Rect x={left + 6} y={top + 8} width={32} height={28} rx={6} fill={colors.accent} />
                <SvgText
                  x={left + TARGET / 2}
                  y={top + 27}
                  textAnchor="middle"
                  fill={colors.onAccent}
                  fontFamily={fonts.mono}
                  fontSize={14}
                  fontWeight="600"
                >
                  {edge.toUpperCase()}
                </SvgText>
              </React.Fragment>
            ))}
          </Svg>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Button
          variant="secondary"
          accessibilityLabel="Alejar la forma de onda"
          style={{ minWidth: 44, paddingHorizontal: 12 }}
          disabled={zoom <= 1}
          onPress={() => setZoomKeeping(zoom / 2)}
        >
          −
        </Button>
        <ZoomSlider zoom={zoom} onChange={setZoomKeeping} />
        <Button
          variant="secondary"
          accessibilityLabel="Acercar la forma de onda"
          style={{ minWidth: 44, paddingHorizontal: 12 }}
          disabled={zoom >= MAX_WAVE_ZOOM}
          onPress={() => setZoomKeeping(zoom * 2)}
        >
          +
        </Button>
      </View>
      <Toggle label="Imán a compases y pulsos" value={snap} onChange={setSnap} />
      {/* Vista general: toda la canción, la ventana visible y el bucle. */}
      <View
        style={{
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
  );
}

function ZoomSlider({ zoom, onChange }: { zoom: number; onChange: (zoom: number) => void }) {
  const progress = Math.round((ZOOM_STEPS * Math.log(zoom)) / Math.log(MAX_WAVE_ZOOM));
  const label = `${Number(zoom.toFixed(1))}×`;
  const change = (value: number) =>
    onChange(MAX_WAVE_ZOOM ** (Math.max(0, Math.min(ZOOM_STEPS, value)) / ZOOM_STEPS));
  const latest = useRef(change);
  latest.current = change;
  const width = useRef(0);
  const responder = useMemo(() => {
    let origin = 0;
    const set = (px: number) => latest.current((ZOOM_STEPS * px) / width.current);
    return PanResponder.create({
      onStartShouldSetPanResponder: () => width.current > 0,
      onPanResponderGrant: (e) => {
        origin = e.nativeEvent.locationX;
        set(origin);
      },
      onPanResponderMove: (_, g) => set(origin + g.dx),
    });
  }, []);
  return (
    <>
      <View style={{ flex: 1, minWidth: 0, height: 44, justifyContent: 'center' }}>
        {Platform.OS === 'web' ? (
          <input
            type="range"
            aria-label="Zoom de la forma de onda"
            aria-valuetext={label}
            min={0}
            max={ZOOM_STEPS}
            value={progress}
            onChange={(e) => change(e.currentTarget.valueAsNumber)}
            style={{ width: '100%', height: 44, margin: 0, accentColor: colors.accentText }}
          />
        ) : (
          <View
            {...responder.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Zoom de la forma de onda"
            accessibilityValue={{ min: 0, max: ZOOM_STEPS, now: progress, text: label }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) =>
              change(progress + (e.nativeEvent.actionName === 'increment' ? 5 : -5))
            }
            onLayout={(e) => {
              width.current = e.nativeEvent.layout.width;
            }}
            style={{ height: 44, justifyContent: 'center' }}
          >
            <View
              pointerEvents="none"
              style={{ height: 6, borderRadius: 3, backgroundColor: colors.lineStrong }}
            >
              <View
                style={{
                  position: 'absolute',
                  left: `${progress}%`,
                  marginLeft: -8,
                  top: -5,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: colors.accent,
                }}
              />
            </View>
          </View>
        )}
      </View>
      <Text
        style={{ minWidth: 48, textAlign: 'center', color: colors.ink, fontFamily: fonts.mono }}
      >
        {label}
      </Text>
    </>
  );
}
