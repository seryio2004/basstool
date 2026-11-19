import {
  MAX_SCORE_MEASURES,
  commit,
  createHistory,
  emptyScore,
  ensureMeasures,
  measureMeter,
  type Edit,
  type History,
} from './score';
import type { EditCursor, Score, TimeMap } from './scoreTypes';
import { emptyTimeMap, generateMeasures } from './timeMap';

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
  if (next.score === score && next.cursor === cursor) return state;
  return { ...state, history: commit(state.history, next) };
}

export function selectScoreCursor(state: ScoreEditorState, cursor: EditCursor): ScoreEditorState {
  const { history } = state;
  return { ...state, history: { ...history, present: { ...history.present, cursor } } };
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
