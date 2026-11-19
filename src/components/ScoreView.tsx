import React, { memo, useCallback, useEffect, useMemo, useRef, type JSX } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import Svg, { Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Instrument } from '../core/instrument';
import {
  cursorPoint,
  hitTest,
  layoutScore,
  positionPoint,
  type Primitive,
  type ScoreLayout,
  type ScoreLine,
} from '../core/scoreLayout';
import type { EditCursor, MusicalPosition, Score, ScoreDisplay } from '../core/scoreTypes';
import { colors, fonts, useTheme } from './ui';
const FONT = Platform.OS === 'web' ? fonts.body : undefined;
/**
 * `scoreLayout` (lógica pura) marca algunos trazos con colores con nombre
 * propio. Aquí se traducen a los tokens del tema activo.
 */
const themed = (color: string | undefined) => {
  switch (color?.toUpperCase()) {
    case undefined:
      return colors.ink;
    case '#A9B4A8':
      return colors.staff;
    case '#A33131':
      return colors.error;
    case '#202E26':
      return colors.ink;
    case '#8A5A2E':
      return colors.muted;
    case '#FFFFFF':
      return colors.surface;
    default:
      return color!;
  }
};
function Shape({ shape: s }: { shape: Primitive }) {
  switch (s.kind) {
    case 'line':
      return (
        <Line
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={themed(s.color)}
          strokeWidth={s.width ?? 1}
        />
      );
    case 'text':
      return (
        <SvgText
          x={s.x}
          y={s.y}
          fontSize={s.size}
          fontFamily={FONT}
          textAnchor={s.anchor ?? 'middle'}
          fill={themed(s.color)}
        >
          {s.text}
        </SvgText>
      );
    case 'ellipse':
      return (
        <Ellipse
          cx={s.x}
          cy={s.y}
          rx={s.rx}
          ry={s.ry}
          fill={s.hollow ? colors.surface : colors.ink}
          stroke={colors.ink}
          strokeWidth={1.2}
        />
      );
    case 'rect':
      return <Rect x={s.x} y={s.y} width={s.width} height={s.height} fill={themed(s.color)} />;
    case 'path':
      return (
        <Path
          d={s.d}
          fill={s.fill ? colors.ink : 'none'}
          stroke={colors.ink}
          strokeWidth={s.width ?? 1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
  }
}
/** The notation and accessible targets never receive playback/editing cursors.
 * Stable layout identity lets React skip this entire subtree on every tick. */
const NotationLine = memo(function NotationLine({
  line,
  layout,
  onEvent,
  onMeasure,
  interactiveEvents,
  interactiveMeasures,
}: {
  line: ScoreLine;
  layout: ScoreLayout;
  onEvent: (cursor: EditCursor) => void;
  onMeasure: (measure: number) => void;
  interactiveEvents: boolean;
  interactiveMeasures: boolean;
}) {
  useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        top: line.y,
        width: layout.width,
        height: line.height,
      }}
    >
      <Svg
        width={layout.width}
        height={line.height}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {line.measures.map((m) => (
          <G key={m.measure}>
            {m.primitives.map((shape, i) => (
              <Shape key={i} shape={shape} />
            ))}
          </G>
        ))}
        {line.primitives.map((shape, i) => (
          <Shape key={i} shape={shape} />
        ))}
      </Svg>
      {line.measures.map((m) => (
        <React.Fragment key={m.measure}>
          {interactiveMeasures ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Compás ${m.measure + 1}${m.fill.status === 'short' || m.fill.status === 'empty' ? ', incompleto' : m.fill.status === 'over' ? ', duración excedida' : ''}`}
              onPress={() => onMeasure(m.measure)}
              style={{
                position: 'absolute',
                left: m.x,
                top: 0,
                width: m.width,
                height: line.height,
              }}
            />
          ) : null}
          {interactiveEvents
            ? (m.placeholder
                ? [
                    {
                      event: 0,
                      label: `Compás ${m.measure + 1}, empezar a escribir`,
                      string: undefined,
                      left: m.x,
                      right: m.x + m.width,
                    },
                  ]
                : [
                    ...m.events.map((e, i) => ({
                      event: e.event,
                      label: e.label,
                      string: e.heads[0]?.string,
                      left: i ? (m.events[i - 1]!.x + e.x) / 2 : m.x,
                      right: (e.x + (m.events[i + 1]?.x ?? e.endX)) / 2,
                    })),
                    {
                      event: m.events.length,
                      label: `Compás ${m.measure + 1}, añadir al final`,
                      string: undefined,
                      left: m.events.length
                        ? (m.events.at(-1)!.x + m.events.at(-1)!.endX) / 2
                        : m.x,
                      right: m.x + m.width,
                    },
                  ]
              ).map((e) => (
                <Pressable
                  key={e.event}
                  accessibilityRole="button"
                  accessibilityLabel={e.label}
                  onPress={(ev) => {
                    const y = ev.nativeEvent.locationY + (interactiveMeasures ? 24 : 0);
                    const hit = hitTest(layout, e.left + ev.nativeEvent.locationX, line.y + y);
                    onEvent({
                      measure: m.measure,
                      event: e.event,
                      string:
                        hit &&
                        (e.string !== undefined || (m.tabTop !== undefined && y >= m.tabTop - 7))
                          ? hit.string
                          : (e.string ?? -1),
                    });
                  }}
                  style={{
                    position: 'absolute',
                    left: e.left,
                    top: interactiveMeasures ? 24 : 0,
                    width: e.right - e.left,
                    height: m.bottom + 6 - (interactiveMeasures ? 24 : 0),
                  }}
                />
              ))
            : null}
        </React.Fragment>
      ))}
    </View>
  );
});
const Notation = memo(function Notation({
  layout,
  onEvent,
  onMeasure,
  interactiveEvents,
  interactiveMeasures,
}: {
  layout: ScoreLayout;
  onEvent: (cursor: EditCursor) => void;
  onMeasure: (measure: number) => void;
  interactiveEvents: boolean;
  interactiveMeasures: boolean;
}) {
  useTheme();
  return (
    <>
      {layout.lines.map((line) => (
        <NotationLine
          key={line.index}
          line={line}
          layout={layout}
          onEvent={onEvent}
          onMeasure={onMeasure}
          interactiveEvents={interactiveEvents}
          interactiveMeasures={interactiveMeasures}
        />
      ))}
    </>
  );
});
export function ScoreView({
  score,
  instrument,
  display,
  width,
  keyFifths,
  playhead,
  cursor,
  onCursorFrame,
  selectedMeasures,
  onPressEvent,
  onPressMeasure,
}: {
  score: Score;
  instrument: Instrument;
  display: ScoreDisplay;
  width: number;
  keyFifths?: number;
  playhead?: MusicalPosition | null;
  cursor?: EditCursor | null;
  onCursorFrame?: (top: number, height: number) => void;
  selectedMeasures?: { from: number; to: number } | null;
  onPressEvent?: (cursor: EditCursor) => void;
  onPressMeasure?: (measure: number) => void;
}): JSX.Element {
  const editable = !!cursor;
  const layout = useMemo(
    () => layoutScore(score, instrument, display, width, keyFifths, editable),
    [score, instrument, display, width, keyFifths, editable],
  );
  const handlers = useRef({ onPressEvent, onPressMeasure, cursor });
  handlers.current = { onPressEvent, onPressMeasure, cursor };
  const onEvent = useCallback(
    (c: EditCursor) =>
      handlers.current.onPressEvent?.({
        ...c,
        string: c.string < 0 ? (handlers.current.cursor?.string ?? 0) : c.string,
      }),
    [],
  );
  const onMeasure = useCallback((m: number) => handlers.current.onPressMeasure?.(m), []);
  const head = playhead ? positionPoint(layout, playhead) : null;
  const soundingMeasure =
    playhead &&
    layout.lines
      .find((l) => l.measures.some((m) => m.measure === playhead.measure))
      ?.measures.find((m) => m.measure === playhead.measure);
  const sounding =
    soundingMeasure &&
    soundingMeasure.events.find(
      (e) => e.heads.length > 0 && e.beat <= playhead!.beat && e.endBeat > playhead!.beat,
    );
  const edit = cursor ? cursorPoint(layout, cursor) : null;
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const scrollX = useRef(0);
  const x = edit?.x;
  const y = edit?.y;
  const editHeight = edit?.height;
  const measureIndex = cursor?.measure;
  const eventIndex = cursor?.event;
  useEffect(() => {
    if (x === undefined || y === undefined || editHeight === undefined || !onCursorFrame) return;
    onCursorFrame(y - 20, editHeight + 40);
    const left = scrollX.current;
    const next = x < left + 28 ? x - 28 : x > left + width - 28 ? x - width + 28 : left;
    if (next !== left) scroll.current?.scrollTo({ x: Math.max(0, next), animated: false });
  }, [x, y, editHeight, width, measureIndex, eventIndex, onCursorFrame]);
  const activeMeasure = measureIndex;
  return (
    <ScrollView
      ref={scroll}
      horizontal
      onScroll={(e) => {
        scrollX.current = e.nativeEvent.contentOffset.x;
      }}
      scrollEventThrottle={16}
      contentContainerStyle={{ width: layout.width, height: layout.height }}
    >
      <View style={{ width: layout.width, height: layout.height, backgroundColor: colors.surface }}>
        <Svg
          width={layout.width}
          height={layout.height}
          style={{ position: 'absolute' }}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {activeMeasure !== undefined || selectedMeasures
            ? layout.lines.flatMap((l) =>
                l.measures
                  .filter(
                    (m) =>
                      m.measure === activeMeasure ||
                      (selectedMeasures &&
                        m.measure >= Math.min(selectedMeasures.from, selectedMeasures.to) &&
                        m.measure <= Math.max(selectedMeasures.from, selectedMeasures.to)),
                  )
                  .map((m) => (
                    <Rect
                      key={m.measure}
                      x={m.x}
                      y={l.y + (m.measure === activeMeasure ? 1 : 24)}
                      width={m.width}
                      height={m.bottom - (m.measure === activeMeasure ? 0 : 18)}
                      rx={6}
                      fill={colors.accentSoft}
                      stroke={m.measure === activeMeasure ? colors.accent : undefined}
                      strokeWidth={m.measure === activeMeasure ? 1 : 0}
                    />
                  )),
              )
            : null}
        </Svg>
        <Notation
          layout={layout}
          onEvent={onEvent}
          onMeasure={onMeasure}
          interactiveEvents={!!onPressEvent}
          interactiveMeasures={!!onPressMeasure}
        />
        <Svg
          width={layout.width}
          height={layout.height}
          style={{ position: 'absolute' }}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {sounding && head ? (
            <Rect
              x={sounding.x - 10}
              y={head.y}
              width={20}
              height={head.height}
              rx={4}
              fill={colors.accent}
              fillOpacity={0.23}
              stroke={colors.accent}
            />
          ) : null}
          {edit ? (
            <G>
              <Path d={`M ${edit.x - 5} ${edit.y - 9} h 10 l -5 5 Z`} fill={colors.accent} />
              <Rect
                x={edit.x - 11}
                y={edit.y - 2}
                width={22}
                height={edit.height + 4}
                rx={3}
                fill="none"
                stroke={colors.accent}
                strokeWidth={2}
              />
            </G>
          ) : null}
          {head ? (
            <Line
              x1={head.x}
              x2={head.x}
              y1={head.y}
              y2={head.y + head.height}
              stroke={colors.ink}
              strokeWidth={2}
            />
          ) : null}
        </Svg>
      </View>
    </ScrollView>
  );
}
