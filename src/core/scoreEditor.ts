import {
  MAX_SCORE_MEASURES,
  addMeasure,
  deleteEvent,
  fraction,
  isMeasurePlaceholder,
  measureFill,
  commit,
  createHistory,
  emptyScore,
  ensureMeasures,
  measureMeter,
  type Edit,
  type History,
} from './score';
import type { BaseValue, Duration, EditCursor, Score, TimeMap } from './scoreTypes';
import { emptyTimeMap, generateMeasures } from './timeMap';

export const ENTRY_BASES: readonly BaseValue[] = [1, 2, 4, 8, 16];

export function stepEntryDuration(duration: Duration, direction: 'longer' | 'shorter'): Duration {
  const index = ENTRY_BASES.indexOf(duration.base);
  const base =
    index < 0
      ? direction === 'longer'
        ? 16
        : undefined
      : ENTRY_BASES[index + (direction === 'longer' ? -1 : 1)];
  return base === undefined ? duration : { ...duration, base };
}

/** A complete bar advances only when writing at its end. */
export function advanceAfterEntry(edit: Edit): Edit {
  const { score, cursor } = edit;
  if (
    score.measures[cursor.measure]!.events.length !== cursor.event ||
    measureFill(score, cursor.measure).status !== 'full'
  )
    return edit;
  const measure = cursor.measure + 1;
  if (measure >= MAX_SCORE_MEASURES) return edit;
  if (score.measures[measure]) {
    const { status } = entryMeasureFill(score, measure);
    if (status === 'full' || status === 'over') return edit;
  }
  return {
    ...edit,
    score: measure < score.measures.length ? score : addMeasure(score, cursor.measure),
    cursor: { ...cursor, measure, event: 0 },
  };
}

export function entryMeasureFill(score: Score, index: number) {
  const fill = measureFill(score, index);
  return fill.status !== 'over' && isMeasurePlaceholder(score.measures[index]!)
    ? { ...fill, actual: fraction(0, 1), status: 'empty' as const }
    : fill;
}

export function eraseEntry(score: Score, cursor: EditCursor, backward: boolean): Edit {
  const measure = score.measures[cursor.measure]!;
  const previousMeasure = cursor.event === 0 && cursor.measure > 0 && isMeasurePlaceholder(measure);
  const index = backward && previousMeasure ? cursor.measure - 1 : cursor.measure;
  const target = score.measures[index]!;
  const event = backward
    ? previousMeasure
      ? target.events.length - 1
      : cursor.event - 1
    : cursor.event;
  if (!target.events[event] || isMeasurePlaceholder(target)) return { score, cursor };
  return deleteEvent(score, { ...cursor, measure: index, event });
}

export type ScoreEditorState = { history: History<Edit>; timeMap: TimeMap };

export function createScoreEditor(
  score = emptyScore(),
  timeMap = emptyTimeMap(),
): ScoreEditorState {
  const cursor = { measure: 0, event: 0, string: 1 };
  const mappedScore = ensureMeasures(score, Math.min(timeMap.measures.length, MAX_SCORE_MEASURES));
  return { history: createHistory({ score: mappedScore, cursor }), timeMap };
}

export function editScore(
  state: ScoreEditorState,
  edit: (score: Score, cursor: EditCursor) => Edit,
): ScoreEditorState {
  const { score, cursor } = state.history.present;
  const next = edit(score, cursor);
  if (next.score === score && next.notice)
    return { ...state, history: { ...state.history, present: next } };
  if (next.score === score && next.cursor === cursor) return state;
  return { ...state, history: commit(state.history, next) };
}

export function selectScoreCursor(state: ScoreEditorState, cursor: EditCursor): ScoreEditorState {
  const { history } = state;
  return {
    ...state,
    history: { ...history, present: { ...history.present, cursor, notice: undefined } },
  };
}

function ensureMappedMeasures(history: History<Edit>, timeMap: TimeMap): History<Edit> {
  const { present } = history;
  const score = ensureMeasures(
    present.score,
    Math.min(timeMap.measures.length, MAX_SCORE_MEASURES),
  );
  return score === present.score ? history : { ...history, present: { ...present, score } };
}

export function restoreScore(
  state: ScoreEditorState,
  travel: (history: History<Edit>) => History<Edit>,
): ScoreEditorState {
  const history = travel(state.history);
  if (history === state.history) return state;
  return { ...state, history: ensureMappedMeasures(history, state.timeMap) };
}

export function updateScoreTimeMap(state: ScoreEditorState, timeMap: TimeMap): ScoreEditorState {
  if (timeMap === state.timeMap || timeMap.measures.length > MAX_SCORE_MEASURES) return state;
  return { timeMap, history: ensureMappedMeasures(state.history, timeMap) };
}

export function fillScoreMeasures(
  state: ScoreEditorState,
  start: number,
  bpm: number,
  duration: number,
): ScoreEditorState {
  // Coincide con el primer marcador que sustituye generateMeasures.
  const index = state.timeMap.measures.filter((time) => time < start - 0.05).length;
  const beats = measureMeter(state.history.present.score, index).beats;
  if (start >= duration || (60 / bpm) * beats < 0.05) return state;
  return updateScoreTimeMap(
    state,
    generateMeasures(state.timeMap, { start, bpm, beatsPerMeasure: beats, until: duration }),
  );
}
