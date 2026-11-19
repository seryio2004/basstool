import React, { memo, useCallback, useEffect, useMemo, useRef, type JSX } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import Svg, { Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Instrument } from '../core/instrument';
import {
  cursorPoint,
  hitTest,
  layoutScore,
  positionPoint,
  scoreDurationName,
  spellPitch,
  signatureAlter,
  type Primitive,
  type ScoreLayout,
  type ScoreLine,
} from '../core/scoreLayout';
import type {
  EditCursor,
  MusicalPosition,
  Score,
  ScoreDisplay,
  ScoreNote,
} from '../core/scoreTypes';
import { ScoreNoteTarget, type NoteGesture } from './ScoreNoteTarget';
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
  noteGesture,
}: {
  line: ScoreLine;
  layout: ScoreLayout;
  onEvent: (cursor: EditCursor) => void;
  onMeasure: (measure: number) => void;
  interactiveEvents: boolean;
  interactiveMeasures: boolean;
  noteGesture?: NoteGesture;
}) {
  useTheme();
  return (
    <View
      pointerEvents="box-none"
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
        pointerEvents="none"
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
                  tabIndex={noteGesture && Platform.OS === 'web' ? -1 : undefined}
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
          {noteGesture && !m.placeholder
            ? m.events.flatMap((e) =>
                e.heads.flatMap((head) => {
                  const label = `${head.name}, cuerda ${layout.strings - head.string}, traste ${head.fret}, ${scoreDurationName(e.source.duration)}`;
                  const target = (
                    surface: 'staff' | 'tab',
                    x: number,
                    y: number,
                    height: number,
                  ) => (
                    <ScoreNoteTarget
                      key={`${e.source.id}-${head.string}-${surface}`}
                      measure={m.measure}
                      event={e.event}
                      string={head.string}
                      surface={surface}
                      label={label}
                      left={x - 10}
                      top={y - height / 2}
                      width={20}
                      height={height}
                      gesture={noteGesture}
                    />
                  );
                  return [
                    m.staffBottom !== undefined ? target('staff', head.x, head.y, 10) : null,
                    head.tabY !== undefined ? target('tab', e.x, head.tabY, 14) : null,
                  ];
                }),
              )
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
  noteGesture,
}: {
  layout: ScoreLayout;
  onEvent: (cursor: EditCursor) => void;
  onMeasure: (measure: number) => void;
  interactiveEvents: boolean;
  interactiveMeasures: boolean;
  noteGesture?: NoteGesture;
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
          noteGesture={noteGesture}
        />
      ))}
    </>
  );
});
export type ScoreFrame = { top: number; height: number };

export function ScoreView({
  score,
  instrument,
  display,
  width,
  keyFifths,
  playhead,
  cursor,
  onCursorFrame,
  followCursorSystem = false,
  selectedMeasures,
  onPressEvent,
  onPressMeasure,
  noteGesture,
  selectedNote,
  previewNote,
  dragging,
  onPressBackground,
}: {
  score: Score;
  instrument: Instrument;
  display: ScoreDisplay;
  width: number;
  keyFifths?: number;
  playhead?: MusicalPosition | null;
  cursor?: EditCursor | null;
  onCursorFrame?: (cursor: ScoreFrame, system?: ScoreFrame) => void;
  followCursorSystem?: boolean;
  selectedMeasures?: { from: number; to: number } | null;
  onPressEvent?: (cursor: EditCursor) => void;
  onPressMeasure?: (measure: number) => void;
  noteGesture?: NoteGesture;
  selectedNote?: EditCursor;
  previewNote?: ScoreNote;
  dragging?: boolean;
  onPressBackground?: () => void;
}): JSX.Element {
  const editable = !!cursor;
  const layout = useMemo(
    () => layoutScore(score, instrument, display, width, keyFifths, editable),
    [score, instrument, display, width, keyFifths, editable],
  );
  const handlers = useRef({ onPressEvent, onPressMeasure, cursor, noteGesture });
  handlers.current = { onPressEvent, onPressMeasure, cursor, noteGesture };
  const gestures = useMemo<NoteGesture>(
    () => ({
      select: (c) => handlers.current.noteGesture?.select(c),
      start: (c) => handlers.current.noteGesture?.start(c),
      preview: (c, surface, delta) => handlers.current.noteGesture?.preview(c, surface, delta),
      finish: (c, commit) => handlers.current.noteGesture?.finish(c, commit),
      fret: (c, step) => handlers.current.noteGesture?.fret(c, step) ?? false,
    }),
    [],
  );
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
  const cursorLine = useMemo(
    () =>
      followCursorSystem && measureIndex !== undefined
        ? layout.lines.find((line) =>
            line.measures.some((measure) => measure.measure === measureIndex),
          )
        : undefined,
    [followCursorSystem, layout, measureIndex],
  );
  useEffect(() => {
    if (
      dragging ||
      x === undefined ||
      y === undefined ||
      editHeight === undefined ||
      !onCursorFrame
    )
      return;
    onCursorFrame(
      { top: y - 20, height: editHeight + 40 },
      cursorLine && { top: cursorLine.y, height: cursorLine.height },
    );
    const left = scrollX.current;
    const next = x < left + 28 ? x - 28 : x > left + width - 28 ? x - width + 28 : left;
    if (next !== left) scroll.current?.scrollTo({ x: Math.max(0, next), animated: false });
  }, [x, y, editHeight, width, measureIndex, eventIndex, cursorLine, onCursorFrame, dragging]);
  const activeMeasure = measureIndex;
  const selectedLine =
    selectedNote &&
    layout.lines.find((line) => line.measures.some((m) => m.measure === selectedNote.measure));
  const noteBar =
    selectedLine && selectedLine.measures.find((m) => m.measure === selectedNote?.measure);
  const noteEvent = noteBar && noteBar.events[selectedNote!.event];
  const noteHead = noteEvent?.heads.find((h) => h.string === selectedNote?.string);
  const nextPitch =
    previewNote &&
    spellPitch(
      instrument.strings[previewNote.string]! + previewNote.fret,
      keyFifths ?? score.keyFifths,
    );
  const staffX = noteHead?.x ?? 0;
  const staffY =
    selectedLine && noteHead
      ? selectedLine.y + noteHead.y - (nextPitch ? (nextPitch.step - noteHead.step) * 5 : 0)
      : 0;
  const tabY =
    selectedLine && noteHead?.tabY !== undefined
      ? selectedLine.y +
        noteHead.tabY -
        (previewNote ? (previewNote.string - noteHead.string) * 14 : 0)
      : undefined;
  const alteration =
    nextPitch && nextPitch.alter !== signatureAlter(nextPitch.letter, keyFifths ?? score.keyFifths)
      ? nextPitch.alter < 0
        ? '♭'
        : nextPitch.alter > 0
          ? '♯'
          : '♮'
      : undefined;
  return (
    <ScrollView
      ref={scroll}
      horizontal
      scrollEnabled={!dragging || Platform.OS === 'web'}
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
        {onPressBackground ? (
          <Pressable
            accessible={false}
            tabIndex={-1}
            onPress={onPressBackground}
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          />
        ) : null}
        <Notation
          layout={layout}
          onEvent={onEvent}
          onMeasure={onMeasure}
          interactiveEvents={!!onPressEvent}
          interactiveMeasures={!!onPressMeasure}
          noteGesture={noteGesture ? gestures : undefined}
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
          {edit && !noteHead ? (
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
          {noteHead && noteEvent && noteBar ? (
            <G>
              {noteBar.staffBottom !== undefined ? (
                <G>
                  <Rect
                    x={staffX - 9}
                    y={staffY - 7}
                    width={18}
                    height={14}
                    rx={5}
                    fill={colors.accentSoft}
                    fillOpacity={0.25}
                    stroke={colors.accent}
                  />
                  {noteEvent.source.technique === 'dead' ? (
                    <Path
                      d={`M ${staffX - 4} ${staffY - 4} l 8 8 m 0 -8 l -8 8`}
                      stroke={colors.accentText}
                      strokeWidth={2}
                    />
                  ) : (
                    <Ellipse
                      cx={staffX}
                      cy={staffY}
                      rx={6}
                      ry={4}
                      fill={noteEvent.source.duration.base > 2 ? colors.accentText : 'none'}
                      stroke={colors.accentText}
                      strokeWidth={1.4}
                    />
                  )}
                  {alteration ? (
                    <SvgText
                      x={staffX - 12}
                      y={staffY + 4}
                      fontSize={16}
                      textAnchor="middle"
                      fill={colors.accentText}
                    >
                      {alteration}
                    </SvgText>
                  ) : null}
                </G>
              ) : null}
              {tabY !== undefined ? (
                <G>
                  <Rect
                    x={noteEvent.x - 10}
                    y={tabY - 7}
                    width={20}
                    height={14}
                    rx={4}
                    fill={colors.accentSoft}
                    stroke={colors.accent}
                  />
                  <SvgText
                    x={noteEvent.x}
                    y={tabY + 4}
                    fontSize={13}
                    fontFamily={FONT}
                    textAnchor="middle"
                    fill={colors.accentText}
                  >
                    {noteEvent.source.technique === 'dead' && !previewNote
                      ? 'x'
                      : (previewNote?.fret ?? noteHead.fret)}
                  </SvgText>
                </G>
              ) : null}
            </G>
          ) : null}
        </Svg>
      </View>
    </ScrollView>
  );
}
