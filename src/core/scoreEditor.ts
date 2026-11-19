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
  eventNotes,
  measureMeter,
  replaceNotePosition,
  resizeNoteEvent,
  type Edit,
  type History,
} from './score';
import { positionsOf, range, type Instrument } from './instrument';
import type { BaseValue, Duration, EditCursor, Score, ScoreNote, TimeMap } from './scoreTypes';
import { emptyTimeMap } from './timeMap';

export const ENTRY_BASES: readonly BaseValue[] = [1, 2, 4, 8, 16];

const notesAt = (score: Score, cursor: EditCursor) =>
  eventNotes(score.measures[cursor.measure]?.events[cursor.event]);

export function noteAtCursor(score: Score, cursor: EditCursor): ScoreNote | undefined {
  return notesAt(score, cursor).find((note) => note.string === cursor.string);
}

/** Left/right skip rests. Up/down stay within the current chord. */
export function moveNoteSelection(
  score: Score,
  cursor: EditCursor,
  direction: 'left' | 'right' | 'up' | 'down',
): EditCursor | undefined {
  if (direction === 'up' || direction === 'down') {
    const notes = notesAt(score, cursor);
    const note =
      direction === 'up'
        ? notes.find((item) => item.string > cursor.string)
        : notes.findLast((item) => item.string < cursor.string);
    return note && { ...cursor, string: note.string };
  }
  const step = direction === 'left' ? -1 : 1;
  let event = cursor.event + (noteAtCursor(score, cursor) ? step : Math.min(0, step));
  for (let measure = cursor.measure; score.measures[measure]; measure += step) {
    const events = score.measures[measure]!.events;
    for (; event >= 0 && event < events.length; event += step) {
      const notes = eventNotes(events[event]);
      const note = notes.find((item) => item.string === cursor.string) ?? notes[0];
      if (note) return { measure, event, string: note.string };
    }
    event = step > 0 ? 0 : (score.measures[measure - 1]?.events.length ?? 0) - 1;
  }
}

export const setNoteDuration = resizeNoteEvent;

export function notePositionAvailable(
  score: Score,
  cursor: EditCursor,
  note: ScoreNote,
  instrument: Instrument,
): boolean {
  return (
    !!noteAtCursor(score, cursor) &&
    Number.isInteger(note.string) &&
    instrument.strings[note.string] !== undefined &&
    Number.isInteger(note.fret) &&
    note.fret >= 0 &&
    note.fret <= instrument.frets &&
    !notesAt(score, cursor).some(
      (item) => item.string !== cursor.string && item.string === note.string,
    )
  );
}

export function setNotePosition(
  score: Score,
  cursor: EditCursor,
  note: ScoreNote,
  instrument: Instrument,
): Edit {
  return notePositionAvailable(score, cursor, note, instrument)
    ? replaceNotePosition(score, cursor, note)
    : { score, cursor };
}

export function moveNoteToString(
  score: Score,
  cursor: EditCursor,
  instrument: Instrument,
  string: number,
): ScoreNote | undefined {
  const note = noteAtCursor(score, cursor);
  const open = instrument.strings[string];
  const previousOpen = instrument.strings[cursor.string];
  if (!note || open === undefined || previousOpen === undefined) return;
  const equivalent = previousOpen + note.fret - open;
  const next = {
    string,
    fret: equivalent >= 0 && equivalent <= instrument.frets ? equivalent : note.fret,
  };
  return notePositionAvailable(score, cursor, next, instrument) ? next : undefined;
}

export function transposedPosition(
  score: Score,
  cursor: EditCursor,
  instrument: Instrument,
  semitones: number,
  sameString: boolean,
): ScoreNote | undefined {
  const note = noteAtCursor(score, cursor);
  const open = instrument.strings[cursor.string];
  if (!note || open === undefined || !Number.isInteger(semitones)) return;
  if (sameString)
    return {
      string: cursor.string,
      fret: Math.max(0, Math.min(instrument.frets, note.fret + semitones)),
    };
  if (semitones === 0) return note;
  const { min, max } = range(instrument);
  const midi = Math.max(min, Math.min(max, open + note.fret + semitones));
  return positionsOf(instrument, midi)
    .filter((next) => notePositionAvailable(score, cursor, next, instrument))
    .sort(
      (a, b) =>
        Math.abs(a.fret - note.fret) - Math.abs(b.fret - note.fret) ||
        Math.abs(a.string - note.string) - Math.abs(b.string - note.string),
    )[0];
}

export function transposeNote(
  score: Score,
  cursor: EditCursor,
  instrument: Instrument,
  semitones: number,
  sameString = false,
): Edit {
  const next = transposedPosition(score, cursor, instrument, semitones, sameString);
  return next ? setNotePosition(score, cursor, next, instrument) : { score, cursor };
}

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
  const result = edit(score, cursor);
  const keepSelection =
    state.history.present.noteSelected &&
    result.score.measures[result.cursor.measure]?.events[result.cursor.event]?.id ===
      score.measures[cursor.measure]?.events[cursor.event]?.id &&
    noteAtCursor(result.score, result.cursor);
  const next = keepSelection ? { ...result, noteSelected: true as const } : result;
  if (next.score === score && next.notice)
    return { ...state, history: { ...state.history, present: next } };
  if (next.score === score && next.cursor === cursor) return state;
  return { ...state, history: commit(state.history, next) };
}

export function selectScoreCursor(state: ScoreEditorState, cursor: EditCursor): ScoreEditorState {
  const { history } = state;
  return {
    ...state,
    history: {
      ...history,
      present: { score: history.present.score, cursor },
    },
  };
}

export function selectNote(state: ScoreEditorState, cursor: EditCursor): ScoreEditorState {
  const next = selectScoreCursor(state, cursor);
  if (noteAtCursor(next.history.present.score, cursor)) next.history.present.noteSelected = true;
  return next;
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
  if (!Number.isFinite(start) || start < 0 || !Number.isFinite(duration) || start >= duration)
    return state;
  const secondsPerBeat = 60 / bpm;
  if (!Number.isFinite(secondsPerBeat) || secondsPerBeat <= 0) return state;
  const score = state.history.present.score;
  const measures = state.timeMap.measures.filter((time) => time < start - 0.05);
  let meter = measureMeter(score, measures.length);
  let beats = 0;
  for (let time = start; time <= duration + 1e-9; time = start + beats * secondsPerBeat) {
    meter = score.measures[measures.length]?.meter ?? meter;
    if (measures.length >= MAX_SCORE_MEASURES || secondsPerBeat * meter.beats < 0.05) return state;
    measures.push(Math.min(time, duration));
    beats += meter.beats;
  }
  return updateScoreTimeMap(state, { ...state.timeMap, measures });
}
