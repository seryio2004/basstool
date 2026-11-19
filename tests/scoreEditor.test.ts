import assert from 'node:assert/strict';
import test from 'node:test';
import { tunings } from '../src/core/instrument';
import { emptyScore, insertNote, redo, setMeter, undo } from '../src/core/score';
import {
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
