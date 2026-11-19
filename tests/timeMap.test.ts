import test from 'node:test';
import assert from 'node:assert/strict';
import * as t from '../src/core/timeMap';
import { emptyScore, setMeter } from '../src/core/score';
const close = (a: number | null, b: number) =>
  assert.ok(a !== null && Math.abs(a - b) < 1e-8, `${a} ≠ ${b}`);
test('ordered markers ignore near duplicates and remove nearest only', () => {
  let m = t.addMeasureMarker(t.emptyTimeMap(), 4);
  m = t.addMeasureMarker(m, 2);
  assert.deepEqual(t.addMeasureMarker(m, 2.049), m);
  assert.deepEqual(t.addMeasureMarker(m, -1), m);
  m = t.addBeatMarker(m, 2.1);
  assert.deepEqual(t.removeMarkerNear(m, 2.09).beats, []);
  assert.deepEqual(t.removeMarkerNear(m, 9), m);
  assert.deepEqual(t.moveMeasureMarker(m, 0, 8).measures, [3.95, 4]);
  assert.deepEqual(t.moveMeasureMarker(m, 1, 0).measures, [2, 2.05]);
});
test('spans extrapolate last duration, clip to audio and handle lone marker', () => {
  const m = { measures: [1, 3, 6], beats: [] };
  assert.deepEqual(t.measureSpan(m, 2, 20), { start: 6, end: 9 });
  assert.deepEqual(t.measureSpan(m, 2, 8), { start: 6, end: 8 });
  assert.equal(t.measureSpan(m, 3, 20), null);
  assert.equal(t.measureSpan(m, 2, 5), null);
  assert.deepEqual(t.measureSpan({ measures: [2], beats: [] }, 0, 9), { start: 2, end: 9 });
});
test('positions interpolate manual pulses and roundtrip variable meters/tempos', () => {
  const score = setMeter(emptyScore(), 1, { beats: 3, unit: 4 });
  const map = { measures: [1, 5, 8], beats: [1.8, 2.9, 4.5, 6.5, 7] };
  assert.equal(t.positionAt(map, score, 0.5, 11), null);
  assert.deepEqual(t.positionAt(map, score, 1.8, 11), { measure: 0, beat: 1 });
  assert.deepEqual(t.positionAt(map, score, 5, 11), { measure: 1, beat: 0 });
  close(t.timeAt(map, score, { measure: 0, beat: 2.5 }, 11), 3.7);
  for (let time = 1; time <= 11; time += 0.017) {
    const p = t.positionAt(map, score, time, 11);
    assert.ok(p);
    close(t.timeAt(map, score, p, 11), time);
  }
  assert.equal(t.timeAt(map, score, { measure: 0, beat: 5 }, 11), null);
  assert.equal(t.positionAt(map, score, 11.1, 11), null);
  assert.equal(t.timeAt(map, score, { measure: 9, beat: 0 }, 11), null);
});
test('uniform and partial pulse interpolation retain endpoints', () => {
  const score = emptyScore(),
    map = { measures: [0, 4], beats: [] };
  close(t.timeAt(map, score, { measure: 0, beat: 2.5 }, 8), 2.5);
  const partial = { ...map, beats: [2.2] };
  close(t.timeAt(partial, score, { measure: 0, beat: 2 }, 8), 2.2);
  close(t.timeAt(partial, score, { measure: 0, beat: 1 }, 8), 1.1);
  close(t.timeAt(partial, score, { measure: 0, beat: 4 }, 8), 4);
});
test('tap tempo uses recent median and rejects outliers', () => {
  assert.equal(t.tapTempo([0, 0.5]), null);
  assert.equal(t.tapTempo([0, 0, 1]), null);
  close(t.tapTempo([0, 0.5, 1, 1.5, 3.5, 4, 4.5])!.bpm, 120);
  const taps = [0, 1, 2, 3];
  for (let i = 0; i < 9; i++) taps.push(taps.at(-1)! + 0.5);
  close(t.tapTempo(taps)!.interval, 0.5);
});
test('generation replaces from start, keeps beats and validates options', () => {
  const map = { measures: [0, 2, 4, 6], beats: [1, 3] };
  assert.deepEqual(t.generateMeasures(map, { start: 4, bpm: 60, beatsPerMeasure: 3, until: 11 }), {
    measures: [0, 2, 4, 7, 10],
    beats: [1, 3],
  });
  assert.equal(t.generateMeasures(map, { start: 0, bpm: 0, beatsPerMeasure: 4, until: 10 }), map);
});
test('parse rejects unsorted, too close and nonfinite markers', () => {
  assert.deepEqual(t.parseTimeMap({ measures: [0, 2], beats: [1] }), {
    measures: [0, 2],
    beats: [1],
  });
  for (const value of [
    null,
    {},
    { measures: [2, 1], beats: [] },
    { measures: [0, 0.01], beats: [] },
    { measures: [], beats: [NaN] },
    { measures: ['1'], beats: [] },
  ])
    assert.equal(t.parseTimeMap(value), null);
});

test('audio endpoint on a boundary remains the final valid measure endpoint', () => {
  const map = { measures: [0, 4, 8], beats: [] },
    score = emptyScore();
  assert.deepEqual(t.positionAt(map, score, 8, 8), { measure: 1, beat: 4 });
  close(t.timeAt(map, score, { measure: 1, beat: 4 }, 8), 8);
});
