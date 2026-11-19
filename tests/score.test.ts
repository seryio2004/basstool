import test from 'node:test';
import assert from 'node:assert/strict';
import * as s from '../src/core/score';
import { tunings } from '../src/core/instrument';
import type { Score } from '../src/core/scoreTypes';
const instrument = tunings.standard4;
const quarter = { base: 4, dots: 0 } as const;
const cursor = { measure: 0, event: 0, string: 0 };
function written(): Score {
  return s.insertNote(s.emptyScore(undefined, 1), cursor, 3, quarter, instrument).score;
}
test('fractions reduce, add, subtract and compare exactly; invalid input throws', () => {
  assert.deepEqual(s.fraction(-6, 8), { n: -3, d: 4 });
  assert.deepEqual(s.fraction(0, 8), { n: 0, d: 1 });
  assert.deepEqual(s.addF(s.fraction(1, 3), s.fraction(1, 6)), { n: 1, d: 2 });
  assert.deepEqual(s.subF(s.fraction(1, 4), s.fraction(1, 3)), { n: -1, d: 12 });
  assert.equal(s.compareF(s.fraction(1, 3), s.fraction(2, 6)), 0);
  assert.equal(s.compareF(s.fraction(1, 3), s.fraction(1, 2)), -1);
  for (const d of [0, -1, 0.5, Infinity]) assert.throws(() => s.fraction(1, d));
  assert.throws(() => s.fraction(0.1, 1));
  assert.deepEqual(s.durationValue({ base: 8, dots: 1, triplet: true }), { n: 1, d: 8 });
  for (const base of [1, 2, 4, 8, 16] as const) {
    assert.deepEqual(
      s.addF(
        s.addF(
          s.durationValue({ base, dots: 0, triplet: true }),
          s.durationValue({ base, dots: 0, triplet: true }),
        ),
        s.durationValue({ base, dots: 0, triplet: true }),
      ),
      s.fraction(2, base),
    );
  }
});
test('default measures, inherited meter and exact fill including unusual meters', () => {
  const score = s.emptyScore();
  assert.equal(score.measures.length, 4);
  assert.equal(score.measures[0]!.events.length, 1);
  assert.equal(s.measureFill(score, 0).status, 'full');
  for (const meter of [
    { beats: 5, unit: 4 },
    { beats: 6, unit: 8 },
    { beats: 7, unit: 8 },
    { beats: 3, unit: 2 },
  ] as const)
    assert.equal(s.measureFill(s.emptyScore(meter), 0).status, 'full');
  const changed = s.setMeter(score, 1, { beats: 3, unit: 4 });
  assert.deepEqual(s.measureMeter(changed, 3), { beats: 3, unit: 4 });
  assert.equal(s.measureFill(changed, 1).status, 'over');
  assert.deepEqual(score.meter, { beats: 4, unit: 4 });
  assert.equal(s.ensureMeasures(score, 8).measures.length, 8);
  assert.equal(s.ensureMeasures(score, 2), score);
  assert.equal(s.removeMeasure(s.emptyScore(undefined, 1), 0).measures.length, 1);
  assert.equal(s.addMeasure(score, -1).measures.length, 5);
  assert.equal(s.setKey(score, -7).keyFifths, -7);
  assert.throws(() => s.setKey(score, 8));
});
test('immutable insertion, editing, rests, deletion and end insertion', () => {
  const initial = s.emptyScore(undefined, 1),
    before = JSON.stringify(initial);
  const edit = s.insertNote(initial, cursor, 3, quarter, instrument);
  assert.equal(JSON.stringify(initial), before);
  assert.equal(edit.cursor.event, 1);
  assert.equal(edit.score.measures[0]!.events.length, 1);
  assert.equal(s.measureFill(edit.score, 0).status, 'short');
  assert.throws(() => s.insertNote(initial, cursor, 25, quarter, instrument));
  assert.throws(() => s.insertNote(initial, { ...cursor, string: 4 }, 0, quarter, instrument));
  const rest = s.insertRest(edit.score, edit.cursor, quarter);
  assert.equal(rest.score.measures[0]!.events.length, 2);
  assert.equal(rest.score.measures[0]!.events[1]!.note, undefined);
  const fret = s.setFret(rest.score, { ...cursor, event: 1, string: 1 }, 5, instrument);
  assert.deepEqual(fret.score.measures[0]!.events[1]!.note, { string: 1, fret: 5 });
  const dotted = s.toggleDot(edit.score, cursor);
  assert.equal(dotted.score.measures[0]!.events[0]!.duration.dots, 1);
  const triplet = s.toggleTriplet(dotted.score, cursor);
  assert.deepEqual(s.durationValue(triplet.score.measures[0]!.events[0]!.duration), { n: 1, d: 4 });
  assert.equal(
    s.setTechnique(edit.score, cursor, 'slide').score.measures[0]!.events[0]!.technique,
    'slide',
  );
  assert.equal(
    s.setDuration(edit.score, cursor, { base: 2, dots: 0 }).score.measures[0]!.events[0]!.duration
      .base,
    2,
  );
  const deleted = s.deleteEvent(edit.score, cursor);
  assert.equal(s.measureFill(deleted.score, 0).status, 'empty');
  assert.equal(s.setFret(deleted.score, cursor, 0, instrument).score.measures[0]!.events.length, 1);
});
test('cursor includes trailing insertion point and moves toward higher strings', () => {
  const score = s.ensureMeasures(written(), 2);
  let c = s.moveCursor(score, cursor, 'up', instrument);
  assert.equal(c.string, 1);
  c = s.moveCursor(score, c, 'down', instrument);
  assert.equal(c.string, 0);
  c = s.moveCursor(score, c, 'right', instrument);
  assert.equal(c.event, 1);
  c = s.moveCursor(score, c, 'right', instrument);
  assert.equal(c.measure, 1);
  assert.equal(c.event, 0);
  c = s.moveCursor(score, c, 'left', instrument);
  assert.equal(c.measure, 0);
  assert.equal(c.event, 1);
  assert.equal(s.moveCursor(score, c, 'nextMeasure', instrument).measure, 1);
  assert.equal(s.moveCursor(score, c, 'prevMeasure', instrument).measure, 0);
});
test('ties require equal notes, editing pitch clears ties, and ties cross bars', () => {
  let score = written();
  score = s.insertNote(score, { ...cursor, event: 1 }, 3, quarter, instrument).score;
  score = s.toggleTie(score, cursor).score;
  assert.equal(score.measures[0]!.events[0]!.tie, true);
  assert.equal(
    s.setFret(score, { ...cursor, event: 1 }, 4, instrument).score.measures[0]!.events[0]!.tie,
    undefined,
  );
  assert.equal(s.toggleTie(written(), cursor).score.measures[0]!.events[0]!.tie, undefined);
  assert.equal(
    s.deleteEvent(score, { ...cursor, event: 1 }).score.measures[0]!.events[0]!.tie,
    undefined,
  );
  score = s.addMeasure(written(), 0);
  score = s.insertNote(score, { ...cursor, measure: 1 }, 3, quarter, instrument).score;
  assert.equal(s.toggleTie(score, cursor).score.measures[0]!.events[0]!.tie, true);
});
test('retune preserves pitch and chooses smallest fret; unplayable becomes rest', () => {
  const score = written(); // G1
  const tuned = s.retune(score, instrument, tunings.dropD);
  assert.deepEqual(tuned.measures[0]!.events[0]!.note, { string: 0, fret: 5 });
  const e = s.insertNote(
    s.emptyScore(undefined, 1),
    { ...cursor, string: 1 },
    5,
    quarter,
    instrument,
  ).score;
  assert.deepEqual(s.retune(e, instrument, instrument).measures[0]!.events[0]!.note, {
    string: 2,
    fret: 0,
  });
  const rest = s.retune(score, instrument, { name: 'agudo', strings: [60], frets: 2 });
  assert.equal(rest.measures[0]!.events[0]!.note, undefined);
  assert.deepEqual(rest.measures[0]!.events[0]!.duration, quarter);
});
test('history caps at 100, undo/redo and editing discards redo', () => {
  let h = s.createHistory(written());
  for (let i = 0; i < 105; i++) h = s.commit(h, s.setKey(h.present, i % 7));
  assert.equal(h.past.length, 100);
  const present = h.present;
  h = s.undo(h);
  assert.equal(h.future.length, 1);
  h = s.redo(h);
  assert.equal(h.present, present);
  h = s.commit(s.undo(h), written());
  assert.equal(h.future.length, 0);
  assert.equal(s.undo(s.createHistory(present)).present, present);
});
test('parse validates corrupt data without throwing and returns detached data', () => {
  const score = written();
  assert.deepEqual(s.parseScore(score), score);
  assert.notEqual(s.parseScore(score)!.measures, score.measures);
  for (const value of [
    null,
    [],
    {},
    { ...score, version: 2 },
    { ...score, keyFifths: 99 },
    { ...score, measures: [] },
    { ...score, meter: { beats: NaN, unit: 4 } },
    { ...score, measures: [score.measures[0], score.measures[0]] },
  ])
    assert.equal(s.parseScore(value), null);
  for (const corrupt of [
    { duration: { base: 3, dots: 0 } },
    { note: { string: -1, fret: 0 } },
    { note: null },
    { technique: 'vibrato' },
  ]) {
    assert.equal(
      s.parseScore({
        ...score,
        measures: [
          { ...score.measures[0], events: [{ ...score.measures[0]!.events[0], ...corrupt }] },
        ],
      }),
      null,
    );
  }
});

test('score documents ignore corruption, serialize writes and recover from write errors', async (t) => {
  const { default: storage } = await import('@react-native-async-storage/async-storage');
  const { loadScoreDoc, saveScoreDoc } = await import('../src/data/scores');
  let stored: string | null = null;
  t.mock.method(storage, 'getItem', async (key: string) => {
    assert.equal(key, 'clasro.scores.v1');
    return stored;
  });
  t.mock.method(storage, 'setItem', async (key: string, value: string) => {
    assert.equal(key, 'clasro.scores.v1');
    stored = value;
  });
  for (const data of ['{broken', 'null', '[]', '{"song":{}}']) {
    stored = data;
    assert.equal(await loadScoreDoc('song'), null);
  }
  const doc = {
    score: written(),
    timeMap: { measures: [0, 2], beats: [1] },
    display: 'both' as const,
    updatedAt: '2026-11-19T12:00:00.000Z',
  };
  stored = null;
  const operation = saveScoreDoc('song', doc);
  doc.score.measures[0]!.events[0]!.note!.fret = 12;
  await operation;
  assert.equal((await loadScoreDoc('song'))!.score.measures[0]!.events[0]!.note!.fret, 3);
  await Promise.all(Array.from({ length: 10 }, (_, i) => saveScoreDoc(`song-${i}`, doc)));
  for (let i = 0; i < 10; i++) assert.deepEqual(await loadScoreDoc(`song-${i}`), doc);
  await assert.rejects(saveScoreDoc('', doc));
  await assert.rejects(saveScoreDoc('bad', { ...doc, display: 'invalid' as 'both' }));
  t.mock.method(storage, 'setItem', async () => {
    throw new Error('quota');
  });
  await assert.rejects(saveScoreDoc('song', doc), /quota/);
  t.mock.method(storage, 'setItem', async (_: string, value: string) => {
    stored = value;
  });
  await saveScoreDoc('__proto__', doc);
  assert.deepEqual(await loadScoreDoc('__proto__'), doc);
});

test('parse rejects dangling ties and techniques on rests', () => {
  const score = written();
  score.measures[0]!.events[0]!.tie = true;
  assert.equal(s.parseScore(score), null);
  const rest = s.emptyScore();
  rest.measures[0]!.events[0]!.technique = 'slide';
  assert.equal(s.parseScore(rest), null);
});
