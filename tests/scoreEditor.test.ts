import assert from 'node:assert/strict';
import test from 'node:test';
import { tunings } from '../src/core/instrument';
import {
  emptyScore,
  eventNotes,
  insertNote,
  insertRest,
  parseScore,
  redo,
  setChordNote,
  setMeter,
  tiedStrings,
  toggleTie,
  undo,
} from '../src/core/score';
import { scoreTimeline, synthTones } from '../src/core/scoreAudio';
import {
  advanceAfterEntry,
  entryMeasureFill,
  eraseEntry,
  stepEntryDuration,
  createScoreEditor,
  editScore,
  fillScoreMeasures,
  moveNoteSelection,
  moveNoteToString,
  noteAtCursor,
  restoreScore,
  selectNote,
  selectScoreCursor,
  setNoteDuration,
  setNotePosition,
  transposeNote,
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
  const base = createScoreEditor(emptyScore({ beats: 4, unit: 4 }, 1), {
    measures: [2],
    beats: [],
  });
  const at120 = fillScoreMeasures(base, 2, 120, 20);
  assert.deepEqual(at120.timeMap.measures.slice(0, 4), [2, 4, 6, 8]); // 4/4 a 120 = 2 s por compás
  const at100 = fillScoreMeasures(at120, 2, 100, 20);
  assert.deepEqual(at100.timeMap.measures.slice(0, 3), [2, 4.4, 6.8]); // 2,4 s por compás
  const withPickup = createScoreEditor(emptyScore({ beats: 4, unit: 4 }, 2), {
    measures: [0.5, 2],
    beats: [],
  });
  assert.equal(fillScoreMeasures(withPickup, 2, 120, 20).timeMap.measures[0], 0.5);
});

test('resizing a selected chord splits both voices at the barline and keeps audio marks', () => {
  const instrument = tunings.standard4;
  const half = { base: 2, dots: 0 } as const;
  const quarter = { base: 4, dots: 0 } as const;
  const meter = { beats: 3, unit: 4 } as const;
  const start = insertRest(emptyScore(meter, 2), { measure: 0, event: 0, string: 0 }, half);
  const chord = setChordNote(start.score, start.cursor, 7, quarter, instrument);
  const withSecond = setChordNote(
    chord.score,
    { ...chord.cursor, string: 2 },
    4,
    quarter,
    instrument,
  );
  const timeMap = { measures: [0, 1.5, 3], beats: [0.4, 0.9, 2.1] };
  const selected = selectNote(createScoreEditor(withSecond.score, timeMap), withSecond.cursor);
  assert.equal(selected.history.past.length, 0);
  const resized = editScore(selected, (s, c) => setNoteDuration(s, c, half));
  const { score, cursor, notice, noteSelected } = resized.history.present;
  const first = score.measures[0]!.events[1]!;
  const second = score.measures[1]!.events[0]!;
  assert.equal(notice, 'split');
  assert.equal(noteSelected, true);
  assert.deepEqual(cursor, withSecond.cursor);
  assert.equal(first.id, withSecond.score.measures[0]!.events[1]!.id);
  assert.deepEqual(first.duration, quarter);
  assert.deepEqual(second.duration, quarter);
  assert.deepEqual(tiedStrings(first), [0, 2]);
  assert.deepEqual(eventNotes(second), eventNotes(first));
  assert.equal(entryMeasureFill(score, 0).status, 'full');
  assert.equal(resized.timeMap, timeMap);
  assert.deepEqual(synthTones(scoreTimeline(score, timeMap, 4, instrument)), [
    { midi: 35, start: 0.9, end: 2.1 },
    { midi: 42, start: 0.9, end: 2.1 },
  ]);
  assert.deepEqual(restoreScore(resized, undo).history.present, selected.history.present);
  assert.deepEqual(
    restoreScore(restoreScore(resized, undo), redo).history.present,
    resized.history.present,
  );
});

test('shortening moves subsequent notes and pads the tail with writable rests', () => {
  const instrument = tunings.standard4;
  const cursor = { measure: 0, event: 0, string: 0 };
  const half = { base: 2, dots: 0 } as const;
  const triplet = { base: 8, dots: 0, triplet: true } as const;
  const first = insertNote(emptyScore(undefined, 2), cursor, 7, half, instrument);
  const written = insertNote(first.score, first.cursor, 9, half, instrument);
  const shorter = setNoteDuration(written.score, cursor, triplet);
  const events = shorter.score.measures[0]!.events;
  assert.deepEqual(events[0]!.duration, triplet);
  assert.equal(events[1]!.id, written.score.measures[0]!.events[1]!.id);
  assert.ok(events.slice(2).length && events.slice(2).every((event) => !eventNotes(event).length));
  assert.equal(entryMeasureFill(shorter.score, 0).status, 'full');
  const roundTrip = parseScore(JSON.parse(JSON.stringify(shorter.score)))!;
  assert.deepEqual(setNoteDuration(roundTrip, cursor, half).score.measures[0]!.events.length, 2);
  const inserted = insertNote(roundTrip, { ...cursor, event: 2 }, 12, triplet, instrument);
  assert.equal(inserted.cursor.measure, 0);
  assert.deepEqual(inserted.score.measures[0]!.events[2]!.note, { string: 0, fret: 12 });
});

test('moving a chord voice preserves its slot and the other voice and clears only broken ties', () => {
  const instrument = tunings.standard4;
  const cursor = { measure: 0, event: 0, string: 0 };
  const quarter = { base: 4, dots: 0 } as const;
  const first = setChordNote(emptyScore(), cursor, 7, quarter, instrument);
  const addVoice = setChordNote(first.score, { ...cursor, string: 2 }, 4, quarter, instrument);
  const after = { ...cursor, event: 1 };
  const second = insertNote(addVoice.score, after, 7, quarter, instrument);
  const chord = setChordNote(second.score, { ...after, string: 2 }, 4, quarter, instrument);
  const bothTied = toggleTie(toggleTie(chord.score, cursor).score, { ...cursor, string: 2 }).score;
  const state = selectNote(createScoreEditor(bothTied), cursor);
  assert.deepEqual(moveNoteToString(bothTied, cursor, instrument, 1), { string: 1, fret: 2 });
  assert.equal(moveNoteToString(bothTied, cursor, instrument, 2), undefined);
  assert.deepEqual(moveNoteToString(bothTied, cursor, instrument, 3), { string: 3, fret: 7 });
  const collision = editScore(state, (s, c) =>
    setNotePosition(s, c, { string: 2, fret: 1 }, instrument),
  );
  assert.equal(collision, state);
  const updated = editScore(state, (s, c) =>
    setNotePosition(s, c, { string: 1, fret: 2 }, instrument),
  );
  const changed = updated.history.present.score.measures[0]!.events[0]!;
  assert.equal(updated.history.past.length, 1);
  assert.deepEqual(updated.history.present.cursor, { ...cursor, string: 1 });
  assert.equal(updated.history.present.noteSelected, true);
  assert.deepEqual(changed.duration, quarter);
  assert.deepEqual(changed.notes, [
    { string: 1, fret: 2 },
    { string: 2, fret: 4 },
  ]);
  assert.deepEqual(tiedStrings(changed), [2]);
  assert.deepEqual(restoreScore(updated, undo).history.present, state.history.present);
});

test('transposition respects tuning, fret bounds and the nearest available chord position', () => {
  const instrument = tunings.dropD;
  const cursor = { measure: 0, event: 0, string: 0 };
  const quarter = { base: 4, dots: 0 } as const;
  const { score } = insertNote(emptyScore(), cursor, 7, quarter, instrument);
  const at = (delta: number, fixed = false) => {
    const edit = transposeNote(score, cursor, instrument, delta, fixed);
    return noteAtCursor(edit.score, edit.cursor);
  };
  assert.deepEqual(at(-100), { string: 0, fret: 0 });
  assert.deepEqual(at(100), { string: 3, fret: 24 });
  assert.deepEqual(at(100, true), { string: 0, fret: 24 });
  assert.deepEqual(at(8), { string: 1, fret: 8 });
  assert.equal(setNotePosition(score, cursor, { string: 0, fret: 25 }, instrument).score, score);
  assert.equal(setNotePosition(score, cursor, { string: 4, fret: 1 }, instrument).score, score);
});

test('note navigation skips silence and changes only the selected voice within a chord', () => {
  const instrument = tunings.standard4;
  const cursor = { measure: 0, event: 0, string: 0 };
  const quarter = { base: 4, dots: 0 } as const;
  const first = insertNote(emptyScore(), cursor, 7, quarter, instrument);
  const rest = insertRest(first.score, first.cursor, quarter);
  const chord = setChordNote(rest.score, rest.cursor, 4, quarter, instrument);
  const upper = { ...chord.cursor, string: 2 };
  const { score } = setChordNote(chord.score, upper, 2, quarter, instrument);
  assert.deepEqual(moveNoteSelection(score, cursor, 'right'), chord.cursor);
  assert.deepEqual(moveNoteSelection(score, chord.cursor, 'up'), upper);
  assert.deepEqual(moveNoteSelection(score, upper, 'down'), chord.cursor);
  assert.deepEqual(moveNoteSelection(score, upper, 'left'), cursor);
  assert.equal(moveNoteSelection(score, cursor, 'left'), undefined);
  assert.equal(
    selectNote(createScoreEditor(score), first.cursor).history.present.noteSelected,
    undefined,
  );
});
