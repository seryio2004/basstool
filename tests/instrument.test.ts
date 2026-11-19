import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Instrument, noteAt, positionsOf, range, tunings } from '../src/core/instrument';

test('the five bass tunings include the expected open strings and 24th frets', () => {
  const expected = [
    [28, 33, 38, 43],
    [23, 28, 33, 38, 43],
    [23, 28, 33, 38, 43, 48],
    [26, 33, 38, 43],
    [27, 32, 37, 42],
  ];
  Object.values(tunings).forEach((instrument, index) => {
    assert.deepEqual(instrument.strings, expected[index]);
    instrument.strings.forEach((open, string) => {
      assert.equal(noteAt(instrument, string, 0), open);
      assert.equal(noteAt(instrument, string, 24), open + 24);
    });
    assert.deepEqual(range(instrument), {
      min: expected[index]![0],
      max: expected[index]!.at(-1)! + 24,
    });
  });
});

test('positionsOf returns every occurrence of an exact pitch, including open and last fret', () => {
  assert.deepEqual(positionsOf(tunings.standard4, 43), [
    { string: 0, fret: 15 },
    { string: 1, fret: 10 },
    { string: 2, fret: 5 },
    { string: 3, fret: 0 },
  ]);
  assert.deepEqual(positionsOf(tunings.standard4, 67), [{ string: 3, fret: 24 }]);
  assert.deepEqual(positionsOf(tunings.standard4, 23), []);
  assert.deepEqual(positionsOf(tunings.standard4, 68), []);
});

test('custom instruments and zero-fret instruments work without assuming bass string count', () => {
  const instrument: Instrument = { name: 'Personalizado', strings: [40, 45], frets: 12 };
  assert.equal(noteAt(instrument, 1, 12), 57);
  assert.deepEqual(range(instrument), { min: 40, max: 57 });
  const openOnly = { ...instrument, frets: 0 };
  assert.deepEqual(positionsOf(openOnly, 40), [{ string: 0, fret: 0 }]);
  assert.deepEqual(range(openOnly), { min: 40, max: 45 });
});

test('invalid strings, frets, MIDI and instruments fail explicitly', () => {
  for (const string of [-1, 4, 0.5, NaN]) {
    assert.throws(() => noteAt(tunings.standard4, string, 0), RangeError);
  }
  for (const fret of [-1, 25, 1.5, Infinity]) {
    assert.throws(() => noteAt(tunings.standard4, 0, fret), RangeError);
  }
  for (const midi of [-1, 128, 30.5, NaN]) {
    assert.throws(() => positionsOf(tunings.standard4, midi), RangeError);
  }
  for (const changes of [
    { strings: [] },
    { strings: [43, 28] },
    { strings: [28.5] },
    { strings: [-1] },
    { strings: [110] },
    { frets: -1 },
    { frets: 1.5 },
  ]) {
    const invalid = { ...tunings.standard4, ...changes };
    assert.throws(() => range(invalid), RangeError);
    assert.throws(() => positionsOf(invalid, 40), RangeError);
    assert.throws(() => noteAt(invalid, 0, 0), RangeError);
  }
});
