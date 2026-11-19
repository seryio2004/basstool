import assert from 'node:assert/strict';
import test from 'node:test';
import { tunings } from '../src/core/instrument';
import { emptyScore, insertNote, insertRest, redo, setMeter, undo } from '../src/core/score';
import {
  advanceAfterEntry,
  entryMeasureFill,
  eraseEntry,
  stepEntryDuration,
  createScoreEditor,
  editScore,
  fillScoreMeasures,
  restoreScore,
  selectScoreCursor,
  updateScoreTimeMap,
} from '../src/core/scoreEditor';
import { addMeasureMarker, positionAt, tapTempo } from '../src/core/timeMap';

test('writing advances the cursor and undo restores the insertion point', () => {
  const initial = createScoreEditor();
  const insert = (state: typeof initial, fret: number) =>
    editScore(state, (score, cursor) =>
      insertNote(score, cursor, fret, { base: 8, dots: 0 }, tunings.standard4),
    );
  const selected = selectScoreCursor(initial, { measure: 2, event: 0, string: 3 });
  const written = insert(selected, 12);
  assert.equal(written.history.present.cursor.event, 1);
  assert.deepEqual(written.history.present.score.measures[2]!.events[0]!.note, {
    string: 3,
    fret: 12,
  });

  const undone = restoreScore(written, undo);
  assert.deepEqual(undone.history.present.cursor, selected.history.present.cursor);
  assert.equal(insert(undone, 2).history.present.score.measures[2]!.events.length, 1);
  assert.deepEqual(restoreScore(undone, redo).history.present, written.history.present);
});

test('markers grow the score and survive undo and redo of notation', () => {
  const initial = createScoreEditor(emptyScore({ beats: 4, unit: 4 }, 1));
  const written = editScore(initial, (score, cursor) =>
    insertNote(score, cursor, 3, { base: 4, dots: 0 }, tunings.standard4),
  );
  const first = updateScoreTimeMap(written, addMeasureMarker(written.timeMap, 0));
  const marked = updateScoreTimeMap(first, addMeasureMarker(first.timeMap, 2));
  const undone = restoreScore(marked, undo);
  for (const state of [marked, undone, restoreScore(undone, redo)]) {
    assert.deepEqual(state.timeMap.measures, [0, 2]);
    assert.equal(state.history.present.score.measures.length, 2);
    assert.deepEqual(positionAt(state.timeMap, state.history.present.score, 2, 6), {
      measure: 1,
      beat: 0,
    });
  }
  assert.deepEqual(
    undone.history.present,
    createScoreEditor(initial.history.present.score, marked.timeMap).history.present,
  );
});

test('fill from the current audio position uses the meter there and retains earlier marks', () => {
  const score = setMeter(emptyScore(), 1, { beats: 3, unit: 4 });
  const state = createScoreEditor(score, { measures: [1, 3, 5], beats: [2] });
  const tempo = tapTempo([0, 0.5, 1, 1.5])!;
  const filled = fillScoreMeasures(state, 3, tempo.bpm, 9);
  assert.deepEqual(filled.timeMap, { measures: [1, 3, 4.5, 6, 7.5, 9], beats: [2] });
  assert.equal(filled.history.present.score.measures.length, 6);
});

test('filling after the first marker follows later meter changes', () => {
  const score = setMeter(emptyScore(), 1, { beats: 3, unit: 4 });
  const state = createScoreEditor(score, { measures: [1], beats: [] });
  assert.deepEqual(fillScoreMeasures(state, 1, 120, 7).timeMap.measures, [1, 3, 4.5, 6]);
});

test('entry duration steps between supported figures and preserves its modifiers', () => {
  const duration = { base: 8, dots: 1, triplet: true } as const;
  assert.deepEqual(stepEntryDuration(duration, 'longer'), { ...duration, base: 4 });
  assert.deepEqual(stepEntryDuration(duration, 'shorter'), { ...duration, base: 16 });
  assert.equal(stepEntryDuration({ base: 1, dots: 0 }, 'longer').base, 1);
  assert.equal(stepEntryDuration({ base: 16, dots: 0 }, 'shorter').base, 16);
});

test('writing crosses exact bar lines in one undo step and keeps authored rests', () => {
  const initial = createScoreEditor(emptyScore({ beats: 2, unit: 4 }, 1));
  const quarter = { base: 4, dots: 0 } as const;
  const write = (state: typeof initial) =>
    editScore(state, (s, c) => advanceAfterEntry(insertRest(s, c, quarter)));
  assert.equal(entryMeasureFill(initial.history.present.score, 0).status, 'empty');
  const first = write(initial);
  assert.equal(entryMeasureFill(first.history.present.score, 0).status, 'short');
  assert.deepEqual(first.history.present.cursor, { measure: 0, event: 1, string: 1 });
  const second = write(first);
  assert.equal(entryMeasureFill(second.history.present.score, 0).status, 'full');
  assert.equal(entryMeasureFill(second.history.present.score, 1).status, 'empty');
  assert.deepEqual(second.history.present.cursor, { measure: 1, event: 0, string: 1 });
  assert.deepEqual(restoreScore(second, undo).history.present, first.history.present);
  const { score, cursor } = second.history.present;
  const inserted = insertNote(score, { ...cursor, measure: 0 }, 2, quarter, tunings.standard4);
  assert.equal(entryMeasureFill(inserted.score, 0).status, 'full');
  assert.equal(entryMeasureFill(inserted.score, 1).status, 'short');
  assert.deepEqual(inserted.cursor, { ...cursor, event: 1 });
  assert.equal(inserted.score.measures[0]!.events.filter((e) => !e.note).length, 2);
  const erased = eraseEntry(score, cursor, true);
  assert.deepEqual(erased.cursor, { measure: 0, event: 1, string: 1 });
  assert.equal(erased.score.measures[0]!.events.length, 1);
  assert.equal(eraseEntry(score, cursor, false).score, score);
});

test('changing the meter of an untouched bar keeps its first note at beat zero', () => {
  const score = setMeter(emptyScore(undefined, 1), 0, { beats: 3, unit: 4 });
  const edit = insertNote(
    score,
    { measure: 0, event: 0, string: 0 },
    7,
    { base: 4, dots: 0 },
    tunings.standard4,
  );
  assert.equal(edit.score.measures[0]!.events.length, 1);
  assert.equal(entryMeasureFill(edit.score, 0).status, 'short');
});

test('changing the BPM relocates every measure from measure 1, keeping earlier marks', async () => {
  const { createScoreEditor, fillScoreMeasures } = await import('../src/core/scoreEditor');
  const { emptyScore } = await import('../src/core/score');
  const base = createScoreEditor(emptyScore({ beats: 4, unit: 4 }, 1), { measures: [2], beats: [] });
  const at120 = fillScoreMeasures(base, 2, 120, 20);
  assert.deepEqual(at120.timeMap.measures.slice(0, 4), [2, 4, 6, 8]); // 4/4 a 120 = 2 s por compás
  const at100 = fillScoreMeasures(at120, 2, 100, 20);
  assert.deepEqual(at100.timeMap.measures.slice(0, 3), [2, 4.4, 6.8]); // 2,4 s por compás
  const withPickup = createScoreEditor(emptyScore({ beats: 4, unit: 4 }, 2), { measures: [0.5, 2], beats: [] });
  assert.equal(fillScoreMeasures(withPickup, 2, 120, 20).timeMap.measures[0], 0.5);
});
