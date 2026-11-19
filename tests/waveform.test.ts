import assert from 'node:assert/strict';
import test from 'node:test';
import { envelope, loopFromTimes, moveLoopEdge, wavePath, zoomWave } from '../src/core/waveform';

test('envelope at 1× takes the largest peak in each column', () => {
  const peaks = Array<number>(16000).fill(0);
  peaks[0] = 0.25;
  peaks[3999] = 0.5;
  peaks[4000] = 0.75;
  peaks[15999] = 1;
  assert.deepEqual(envelope(peaks, 32, 0, 32, 4), [0.5 ** 0.8, 0.75 ** 0.8, 0, 1]);
});

test('envelope at 32× uses only the peaks overlapping the visible columns', () => {
  const peaks = Array<number>(16000).fill(0);
  peaks[999] = 1;
  peaks[1000] = 0.25;
  peaks[1124] = 0.5;
  peaks[1125] = 0.75;
  peaks[1499] = 0.125;
  peaks[1500] = 1;
  assert.deepEqual(envelope(peaks, 32, 2, 3, 4), [0.5 ** 0.8, 0.75 ** 0.8, 0, 0.125 ** 0.8]);
  // A column narrower than a peak bucket retains that peak.
  assert.deepEqual(envelope([0, 1], 32, 16, 17, 4), [1, 1, 1, 1]);
  // Nonaligned edges include each overlapping bucket. Columns outside the audio are silent.
  assert.deepEqual(envelope([0.25, 1], 2, 0.75, 2.25, 3), [1, 1, 1]);
  assert.deepEqual(envelope([1], 1, -1, 2, 3), [0, 1, 0]);
  assert.deepEqual(envelope([], 32, 0, 1, 2), [0, 0]);
});

test('wavePath closes a continuous trace mirrored around the center', () => {
  assert.equal(wavePath([], 32, 1), '');
  assert.equal(wavePath([1, 0.5], 32, 2), 'M0 16 L1.0 4.0 L3.0 10.0 L4.0 16 L3.0 22.0 L1.0 28.0 Z');
});

test('drag selection rejects loops shorter than 0.2 s in both directions', () => {
  assert.equal(loopFromTimes(10, 10.199), null);
  assert.equal(loopFromTimes(10.199, 10), null);
  assert.deepEqual(loopFromTimes(10.2, 10), { a: 10, b: 10.2 });
  assert.deepEqual(loopFromTimes(10, 11), { a: 10, b: 11 });
});

test('zoom preserves the time below the pointer and handles moving pinch midpoints', () => {
  const base = { zoom: 4, start: 20 };
  assert.deepEqual(zoomWave(80, base, 8, 0.25), { zoom: 8, start: 22.5 });
  assert.deepEqual(zoomWave(80, base, 8, 0.25, 0.75), { zoom: 8, start: 17.5 });
  assert.deepEqual(zoomWave(80, base, 4, 0.25, 0.75), { zoom: 4, start: 10 });
  assert.deepEqual(zoomWave(80, base, 0.5, 0.25), { zoom: 1, start: 0 });
  assert.deepEqual(zoomWave(80, { zoom: 32, start: 77.5 }, 64, 1, 0), { zoom: 32, start: 77.5 });
  assert.deepEqual(zoomWave(80, base, 4, 0, 2), { zoom: 4, start: 0 });
});

test('loop handles snap to the nearest reachable mark within tolerance', () => {
  const loop = { a: 2, b: 4 };
  const marks = [1, 3, 3.95, 4.5, 5];
  assert.deepEqual(moveLoopEdge(loop, 'a', 3.1, 5, marks, 0.15), { a: 3, b: 4 });
  assert.deepEqual(moveLoopEdge(loop, 'a', 3.1, 5, marks, 0.05), { a: 3.1, b: 4 });
  assert.deepEqual(moveLoopEdge(loop, 'a', 4.5, 5, marks, 0.2), { a: 3.8, b: 4 });
  assert.deepEqual(moveLoopEdge(loop, 'b', 4.46, 5, marks, 0.15), { a: 2, b: 4.5 });
  assert.deepEqual(moveLoopEdge(loop, 'b', 7, 5, [], 0.15), { a: 2, b: 5 });
  assert.deepEqual(moveLoopEdge(loop, 'b', 1, 5, [], 0.15), { a: 2, b: 2.2 });
});
