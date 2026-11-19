import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tunings } from '../src/core/instrument';
import { parsePitch, pitchName } from '../src/core/notation';
import { arpeggios, positionsFor, scales } from '../src/core/theory';

const chromaticOctave = { name: 'Una cuerda', strings: [60], frets: 11 };

test('scales cover seven modes, pentatonics, blues and harmonic/melodic minor', () => {
  const expected = {
    major: [0, 2, 4, 5, 7, 9, 11],
    naturalMinor: [0, 2, 3, 5, 7, 8, 10],
    ionian: [0, 2, 4, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    majorPentatonic: [0, 2, 4, 7, 9],
    minorPentatonic: [0, 3, 5, 7, 10],
    blues: [0, 3, 5, 6, 7, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  };
  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    assert.deepEqual(
      positionsFor('C', scales[key], chromaticOctave).map((p) => p.midi - 60),
      expected[key],
      key,
    );
  }
});

test('triads and seventh chords have correct sounding intervals and degree labels', () => {
  const expected = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
    augmented: [0, 4, 8],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
    dominant7: [0, 4, 7, 10],
    major7: [0, 4, 7, 11],
    minor7: [0, 3, 7, 10],
    halfDiminished7: [0, 3, 6, 10],
    diminished7: [0, 3, 6, 9],
    minorMajor7: [0, 3, 7, 11],
    augmentedMajor7: [0, 4, 8, 11],
  };
  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    assert.deepEqual(
      positionsFor('C', arpeggios[key], chromaticOctave).map((p) => p.midi - 60),
      expected[key],
      key,
    );
  }
  const diminished = positionsFor('C', arpeggios.diminished7, chromaticOctave);
  assert.deepEqual(
    diminished.map((p) => p.degreeLabel),
    ['1', '♭3', '♭5', '𝄫7'],
  );
  assert.equal(diminished.at(-1)!.spelling, 'Bbb4');
});

test('key spelling follows diatonic degrees in flat and sharp keys in both nomenclatures', () => {
  const f = positionsFor('F', scales.major, { ...chromaticOctave, strings: [65] });
  assert.deepEqual(
    f.map((p) => p.name),
    ['Fa', 'Sol', 'La', 'Si♭', 'Do', 'Re', 'Mi'],
  );
  assert.deepEqual(
    f.map((p) => p.degree),
    [1, 2, 3, 4, 5, 6, 7],
  );
  const fs = positionsFor(
    'F#',
    scales.major,
    { ...chromaticOctave, strings: [66] },
    undefined,
    'english',
  );
  assert.deepEqual(
    fs.map((p) => p.name),
    ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯'],
  );
  const db = positionsFor('Db', scales.major, { ...chromaticOctave, strings: [61] });
  assert.deepEqual(
    db.map((p) => p.name),
    ['Re♭', 'Mi♭', 'Fa', 'Sol♭', 'La♭', 'Si♭', 'Do'],
  );
  assert.equal(pitchName('Bb3', true, 'english'), 'B♭3');
  assert.equal(pitchName('Bb3', true), 'Si♭3');
});

test('fretboard data covers C major and A minor pentatonic, including repeated roots and endpoints', () => {
  const c = positionsFor('C', scales.major, tunings.standard4, { min: 0, max: 5 });
  assert.deepEqual(
    c.map((p) => [p.string, p.fret]),
    [
      [0, 0],
      [0, 1],
      [0, 3],
      [0, 5],
      [1, 0],
      [1, 2],
      [1, 3],
      [1, 5],
      [2, 0],
      [2, 2],
      [2, 3],
      [2, 5],
      [3, 0],
      [3, 2],
      [3, 4],
      [3, 5],
    ],
  );
  assert.deepEqual(
    c.filter((p) => p.isRoot).map((p) => [p.string, p.fret]),
    [
      [1, 3],
      [3, 5],
    ],
  );
  const a = positionsFor('A', scales.minorPentatonic, tunings.standard5, { min: 0, max: 5 });
  assert.deepEqual(
    a.filter((p) => p.string === 0).map((p) => [p.fret, p.name, p.degreeLabel]),
    [
      [1, 'Do', '♭3'],
      [3, 'Re', '4'],
      [5, 'Mi', '5'],
    ],
  );
  const last = positionsFor('G', scales.major, tunings.standard4, { min: 24, max: 24 });
  assert.ok(last.some((p) => p.string === 3 && p.fret === 24 && p.isRoot));
});

test('all catalog pitches retain exact MIDI and octave even across written octave boundaries', () => {
  for (const tonic of ['C', 'F', 'F#', 'Db', 'Bb', 'B', 'C#', 'G#']) {
    for (const collection of [...Object.values(scales), ...Object.values(arpeggios)]) {
      const positions = positionsFor(tonic, collection, tunings.standard6);
      assert.ok(positions.length);
      for (const position of positions) {
        assert.equal(
          parsePitch(position.spelling).midi,
          position.midi,
          `${tonic}: ${position.spelling}`,
        );
        assert.equal(position.midi, tunings.standard6.strings[position.string]! + position.fret);
        assert.equal(position.isRoot, position.degree === 1);
      }
    }
  }
  const cb = positionsFor('Cb', scales.major, { ...chromaticOctave, strings: [59], frets: 0 });
  assert.equal(cb[0]!.spelling, 'Cb4');
  const bs = positionsFor('B', scales.lydian, { ...chromaticOctave, strings: [65], frets: 0 });
  assert.equal(bs[0]!.spelling, 'E#4');
});

test('invalid fret ranges and tonics fail explicitly', () => {
  for (const frets of [
    { min: -1, max: 5 },
    { min: 0, max: 25 },
    { min: 5, max: 4 },
    { min: 0.5, max: 5 },
    { min: 0, max: NaN },
  ]) {
    assert.throws(() => positionsFor('C', scales.major, tunings.standard4, frets), RangeError);
  }
  for (const tonic of ['H', 'C4', 'Do', '', 'F###']) {
    assert.throws(() => positionsFor(tonic, scales.major, tunings.standard4));
  }
  assert.throws(
    () => positionsFor('C', { name: 'Vacío', tones: [] }, tunings.standard4),
    RangeError,
  );
  // The notation model supports up to double accidentals; never silently respell.
  assert.throws(() => positionsFor('Cb', arpeggios.diminished7, tunings.standard4), RangeError);
  for (const tone of [
    { semitones: 12, degree: 1 },
    { semitones: 0, degree: 8 },
  ]) {
    assert.throws(
      () => positionsFor('C', { name: 'Inválido', tones: [tone] }, tunings.standard4),
      RangeError,
    );
  }
});
