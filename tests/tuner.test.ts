import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tunings } from '../src/core/instrument';
import {
  frequency,
  minTunerHz,
  pitchFromSamples,
  tuning,
  tunerWindowSize,
} from '../src/core/music';
import { targetString } from '../src/core/tuner';

function signal(hz: number, rate: number, harmonics = [0.25], phase = 0.37) {
  return Float32Array.from({ length: tunerWindowSize }, (_, i) =>
    harmonics.reduce(
      (sum, amplitude, h) =>
        sum + amplitude * Math.sin((h + 1) * ((2 * Math.PI * hz * i) / rate + phase)),
      0,
    ),
  );
}

for (const rate of [44100, 48000]) {
  test(`all open strings of all five tunings are within 3 cents at ${rate} Hz`, () => {
    assert.ok(tunerWindowSize >= (2 * rate) / frequency(23));
    assert.ok(tunerWindowSize >= (2 * rate) / minTunerHz);
    for (const instrument of Object.values(tunings)) {
      for (const [string, midi] of instrument.strings.entries()) {
        for (const reference of [415, 440, 466]) {
          for (const cents of [-25, 0, 25]) {
            const expected = frequency(midi, reference) * 2 ** (cents / 1200);
            const actual = pitchFromSamples(signal(expected, rate), rate);
            assert.ok(actual, `${instrument.name}, ${midi}: no signal`);
            assert.ok(
              Math.abs(1200 * Math.log2(actual / expected)) < 3,
              `${midi}: ${actual} vs ${expected}`,
            );
            const target = targetString(instrument, actual, reference);
            assert.equal(target.string, string);
            assert.ok(Math.abs(target.cents - cents) < 3);
          }
        }
      }
    }
  });
  test(`dominant second/third harmonics do not cause octave errors at ${rate} Hz`, () => {
    for (const instrument of Object.values(tunings)) {
      for (const midi of instrument.strings) {
        for (const harmonics of [
          [0.08, 0.5],
          [0.025, 0.5],
          [0.05, 0.5, 0.2],
        ]) {
          for (const phase of [0, 0.73, 2.1]) {
            const expected = frequency(midi);
            const actual = pitchFromSamples(signal(expected, rate, harmonics, phase), rate);
            assert.ok(actual);
            assert.ok(
              Math.abs(1200 * Math.log2(actual / expected)) < 3,
              `${midi}, ${harmonics}: ${actual} vs ${expected}`,
            );
          }
        }
      }
    }
  });
  test(`28 Hz boundary and higher pitches remain detectable at ${rate} Hz`, () => {
    for (const expected of [28, 29, 196, 440, 659.25, 1100]) {
      const actual = pitchFromSamples(signal(expected, rate), rate);
      assert.ok(actual);
      assert.ok(Math.abs(1200 * Math.log2(actual / expected)) < 3, `${actual} vs ${expected}`);
    }
  });
}

test('tuning uses an inclusive 415–466 Hz reference and validates input', () => {
  for (const reference of [415, 432, 440, 466]) {
    assert.deepEqual(tuning(reference, reference), {
      name: 'La',
      octave: 4,
      cents: 0,
      hz: reference,
    });
    assert.equal(tuning(reference * 2 ** (17 / 1200), reference).cents, 17);
  }
  for (const reference of [414.9, 466.1, NaN, Infinity]) {
    assert.throws(() => tuning(440, reference), RangeError);
    assert.throws(() => targetString(tunings.standard4, 41, reference), RangeError);
  }
  for (const hz of [0, -1, NaN, Infinity]) {
    assert.throws(() => tuning(hz), RangeError);
    assert.throws(() => targetString(tunings.standard4, hz), RangeError);
  }
});

test('target is an open string, with signed cents even beyond the nearest chromatic note', () => {
  assert.equal(targetString(tunings.standard5, frequency(23)).string, 0);
  const sharp = targetString(tunings.standard4, frequency(29));
  assert.equal(sharp.midi, 28);
  assert.equal(sharp.cents, 100);
  assert.equal(targetString(tunings.standard4, frequency(27)).cents, -100);
  assert.equal(targetString(tunings.standard4, frequency(67)).string, 3);
  const midpoint = { name: 'Empate', strings: [40, 44], frets: 12 };
  assert.equal(targetString(midpoint, frequency(42)).string, 0);
});

test('silence, DC, quiet and invalid samples do not produce a pitch', () => {
  assert.equal(pitchFromSamples(new Float32Array(tunerWindowSize), 48000), null);
  assert.equal(pitchFromSamples(new Float32Array(tunerWindowSize).fill(0.3), 48000), null);
  assert.equal(pitchFromSamples(signal(41.2, 48000, [0.005]), 48000), null);
  assert.equal(pitchFromSamples(new Float32Array([NaN, 1, 2, 3]), 48000), null);
  assert.equal(pitchFromSamples(new Float32Array(), 48000), null);
  assert.equal(pitchFromSamples(signal(41.2, 48000), 0), null);
});
