import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestion, intervals } from '../src/core/exercises';
import { tunings, range, noteAt } from '../src/core/instrument';
import {
  ledgerSteps,
  staffStep,
  midiOf,
  pitchName,
  parsePitch,
  tabPositions,
} from '../src/core/notation';
import type { ExerciseConfig } from '../src/core/types';

test('bass staff uses written G2 on the first line, A3 on the fifth, and all ledger lines', () => {
  assert.equal(staffStep('G2', 'bass'), 0);
  assert.equal(staffStep('A3', 'bass'), 8);
  assert.equal(staffStep('G1', 'bass', 1), 0);
  assert.equal(staffStep('A2', 'bass', 1), 8);
  assert.equal(staffStep('Bb2', 'bass'), staffStep('B2', 'bass'));
  assert.deepEqual(ledgerSteps(-7), [-2, -4, -6]);
  assert.deepEqual(ledgerSteps(15), [10, 12, 14]);
  assert.deepEqual(ledgerSteps(9), []);
  assert.equal(staffStep('E4', 'treble'), 0);
});

test('all questions stay playable on every tuning; tab positions and answers agree', () => {
  let seed = 123;
  const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32;
  for (const instrument of Object.values(tunings)) {
    const { min, max } = range(instrument);
    for (const nomenclature of ['latin', 'english'] as const) {
      for (const module of ['notes', 'intervals', 'reading'] as const) {
        for (const modality of ['visual', 'ear', 'tab', 'fretboard'] as const) {
          if (modality === 'fretboard' && module !== 'notes') continue;
          for (let i = 0; i < 75; i++) {
            const q = buildQuestion(module, { instrument, nomenclature, modality }, random);
            assert.ok(q.choices.includes(q.answer));
            q.scoreNotes.forEach((note, index) => {
              assert.ok(note.midi >= min && note.midi <= max);
              assert.equal(midiOf(note.spelling), note.midi);
              assert.equal(
                noteAt(instrument, note.position!.string, note.position!.fret),
                note.midi,
              );
              assert.equal(q.answers[index], pitchName(note.spelling, false, nomenclature));
              if (module !== 'intervals') assert.ok(q.choices.includes(q.answers[index]!));
            });
            if (q.position) {
              assert.equal(noteAt(instrument, q.position.string, q.position.fret), q.notes[0]);
              assert.match(q.prompt!, /Cuerda .+ · traste \d+/);
            }
          }
        }
      }
    }
  }
});

test('all twelve intervals are generated with the right written degree', () => {
  const found = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const q = buildQuestion('intervals', {}, () => i / 1000);
    const semitones = q.notes[1]! - q.notes[0]!;
    assert.equal(q.answer, intervals.find((item) => item.semitones === semitones)!.name);
    const degree = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7][semitones]!;
    assert.equal(
      parsePitch(q.scoreNotes[1]!.spelling).diatonic -
        parsePitch(q.scoreNotes[0]!.spelling).diatonic,
      degree,
    );
    found.add(q.answer);
  }
  assert.equal(found.size, 12);
});

test('fretboard endpoints, chromatic nomenclatures and legacy signatures', () => {
  const instrument = tunings.standard6;
  const low = buildQuestion('notes', { instrument, modality: 'fretboard' }, () => 0);
  const high = buildQuestion('notes', { instrument, modality: 'fretboard' }, () => 0.999999);
  assert.deepEqual(low.position, { string: 0, fret: 0 });
  assert.deepEqual(high.position, { string: 5, fret: 24 });
  const latin = buildQuestion('notes', {}, () => 0);
  const english = buildQuestion('notes', { nomenclature: 'english' }, () => 0);
  assert.ok(latin.choices.includes('Do♯'));
  assert.ok(english.choices.includes('C♯'));
  assert.equal(buildQuestion('reading', () => 0).notes.length, 4);
  const legacy: ExerciseConfig = { bpm: 90, level: 1, modality: 'visual', reading: 'notes' };
  assert.equal(legacy.instrument, undefined);
  assert.equal(legacy.clef, undefined);
});

test('tablature keeps explicit fingering, highest string on top, and rejects wrong positions', () => {
  const instrument = tunings.standard4;
  assert.deepEqual(
    tabPositions([{ midi: 36, spelling: 'C2', position: { string: 1, fret: 3 } }], instrument),
    [{ string: 1, fret: 3, row: 2 }],
  );
  assert.deepEqual(
    tabPositions([{ midi: 43, spelling: 'G2', position: { string: 3, fret: 0 } }], instrument),
    [{ string: 3, fret: 0, row: 0 }],
  );
  assert.throws(
    () =>
      tabPositions([{ midi: 36, spelling: 'C2', position: { string: 1, fret: 4 } }], instrument),
    /no corresponde/,
  );
});
