import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuestion,
  expectedHits,
  frequency,
  makePattern,
  noteName,
  pitchFromSamples,
  tuning,
} from '../src/core/music';
import { analyseHits, OnsetDetector } from '../src/core/rhythm';
import { scoreAttempt } from '../src/core/types';

test('reference pitches and tuner detect A4 at common device sample rates', () => {
  assert.equal(frequency(69), 440);
  assert.equal(noteName(60), 'Do');
  assert.equal(tuning(440).cents, 0);
  for (const rate of [44100, 48000]) {
    for (const expected of [41.2, 82.4, 196, 440, 659.25]) {
      const samples = Float32Array.from(
        { length: 4096 },
        (_, i) => 0.2 * Math.sin((2 * Math.PI * expected * i) / rate),
      );
      const pitch = pitchFromSamples(samples, rate);
      assert.ok(
        pitch && Math.abs(pitch - expected) < 4,
        `Detected ${pitch} instead of ${expected} at ${rate}`,
      );
    }
  }
  assert.equal(pitchFromSamples(new Float32Array(4096), 48000), null);
});
test('GrooveTrain preserves original overlapping-window matching and extra-hit penalties', () => {
  const expected = [
    { t: 0, block: 0 },
    { t: 0.1, block: 0 },
  ];
  assert.equal(analyseHits(expected, [0.06, 0.14], 0.07, 0.5).matched.length, 2);
  const result = analyseHits(
    [
      { t: 0, block: 0 },
      { t: 0.25, block: 0 },
      { t: 0.5, block: 1 },
    ],
    [0, 0.5, 0.8],
    0.06,
    0.5,
  );
  assert.equal(result.matched.length, 2);
  assert.deepEqual([...result.badBlocks].sort(), [0, 1]);
  assert.equal(result.goodBlocks.size, 0);
  assert.equal(scoreAttempt(result.matched.length, Math.max(3, 3)), 67);
});
test('pattern configuration is reproducible and quarter notes align with BPM', () => {
  const pattern = makePattern(1, 16, () => 0.99);
  assert.deepEqual(pattern, Array(16).fill(5));
  assert.deepEqual(expectedHits([5, 0], 60), [
    { t: 0, block: 0 },
    { t: 1, block: 1 },
    { t: 1.5, block: 1 },
  ]);
  for (const module of ['notes', 'intervals', 'reading'] as const) {
    const question = buildQuestion(module, () => 0);
    assert.ok(question.choices.includes(question.answer));
    assert.equal(question.notes.length, module === 'reading' ? 4 : module === 'intervals' ? 2 : 1);
  }
});
test('scores reject impossible or empty attempts', () => {
  assert.throws(() => scoreAttempt(0, 0));
  assert.throws(() => scoreAttempt(9, 8));
  assert.throws(() => scoreAttempt(-1, 8));
  assert.equal(scoreAttempt(7, 8), 88);
});
test('original onset detector counts a sustained attack only once', () => {
  const detector = new OnsetDetector(48000);
  let hits = 0;
  for (let frame = 0; frame < 48000; frame += 128) {
    const samples = Float32Array.from({ length: 128 }, (_, i) =>
      (frame + i) / 48000 > 0.1 ? 0.1 : 0.001,
    );
    if (detector.process(samples, frame / 48000).hit) hits++;
  }
  assert.equal(hits, 1);
});
