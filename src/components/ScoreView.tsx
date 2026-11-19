import React, { memo, useCallback, useMemo, useRef, type JSX } from 'react';
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
import { colors } from './ui';
const FONT =
  Platform.OS === 'web' ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined;
function Shape({ shape: s }: { shape: Primitive }) {
  switch (s.kind) {
    case 'line':
      return (
        <Line
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={s.color ?? colors.ink}
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
          fill={s.color ?? colors.ink}
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
          fill={s.hollow ? colors.white : colors.ink}
          stroke={colors.ink}
          strokeWidth={1.2}
        />
      );
    case 'rect':
      return (
        <Rect x={s.x} y={s.y} width={s.width} height={s.height} fill={s.color ?? colors.ink} />
      );
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
            ? [
                ...m.events.map((e, i) => ({
                  event: e.event,
                  x: e.x,
                  label: e.label,
                  string: e.source.note?.string ?? 0,
                  left: i ? (m.events[i - 1]!.x + e.x) / 2 : m.contentX - 7,
                  right:
                    i + 1 < m.events.length ? (e.x + m.events[i + 1]!.x) / 2 : (e.x + e.endX) / 2,
                })),
                {
                  event: m.events.length,
                  x: m.endX,
                  label: `Compás ${m.measure + 1}, añadir al final`,
                  string: 0,
                  left: m.events.length
                    ? (m.events.at(-1)!.x + m.events.at(-1)!.endX) / 2
                    : m.contentX - 7,
                  right: m.x + m.width,
                },
              ].map((e) => (
                <Pressable
                  key={e.event}
                  accessibilityRole="button"
                  accessibilityLabel={e.label}
                  onPress={(ev) => {
                    const hit = hitTest(
                      layout,
                      e.left + ev.nativeEvent.locationX,
                      line.y + 28 + ev.nativeEvent.locationY,
                    );
                    onEvent({
                      measure: m.measure,
                      event: e.event,
                      string:
                        m.tabTop !== undefined &&
                        28 + ev.nativeEvent.locationY >= m.tabTop - 7 &&
                        hit
                          ? hit.string
                          : e.string,
                    });
                  }}
                  style={{
                    position: 'absolute',
                    left: e.left,
                    top: 28,
                    width: Math.max(1, e.right - e.left),
                    height: m.bottom - 20,
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
  selectedMeasures?: { from: number; to: number } | null;
  onPressEvent?: (cursor: EditCursor) => void;
  onPressMeasure?: (measure: number) => void;
}): JSX.Element {
  const layout = useMemo(
    () => layoutScore(score, instrument, display, width, keyFifths),
    [score, instrument, display, width, keyFifths],
  );
  const handlers = useRef({ onPressEvent, onPressMeasure });
  handlers.current = { onPressEvent, onPressMeasure };
  const onEvent = useCallback((c: EditCursor) => handlers.current.onPressEvent?.(c), []);
  const onMeasure = useCallback((m: number) => handlers.current.onPressMeasure?.(m), []);
  const head = playhead ? positionPoint(layout, playhead) : null;
  const edit = cursor ? cursorPoint(layout, cursor) : null;
  return (
    <ScrollView horizontal contentContainerStyle={{ width: layout.width, height: layout.height }}>
      <View style={{ width: layout.width, height: layout.height, backgroundColor: colors.white }}>
        <Svg
          width={layout.width}
          height={layout.height}
          style={{ position: 'absolute' }}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {selectedMeasures
            ? layout.lines.flatMap((l) =>
                l.measures
                  .filter(
                    (m) =>
                      m.measure >= Math.min(selectedMeasures.from, selectedMeasures.to) &&
                      m.measure <= Math.max(selectedMeasures.from, selectedMeasures.to),
                  )
                  .map((m) => (
                    <Rect
                      key={m.measure}
                      x={m.x}
                      y={l.y + 24}
                      width={m.width}
                      height={m.bottom - 18}
                      fill={colors.pale}
                    />
                  )),
              )
            : null}
          {edit ? (
            <Rect
              x={edit.x - 10}
              y={edit.y - 2}
              width={20}
              height={edit.height + 4}
              rx={3}
              fill={colors.pale}
            />
          ) : null}
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
          {edit ? (
            <Rect
              x={edit.x - 10}
              y={edit.y - 2}
              width={20}
              height={edit.height + 4}
              rx={3}
              fill="none"
              stroke={colors.green}
              strokeWidth={1.5}
            />
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
