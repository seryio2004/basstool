import assert from 'node:assert/strict';
import test from 'node:test';
import { chordBoxWidth, chordRoots, chordShapes, type ChordQuality } from '../src/core/chordShapes';
import { noteAt, tunings } from '../src/core/instrument';
import { parsePitch } from '../src/core/notation';
import { bassScales } from '../src/core/profile';
import { dictionaryArpeggios } from '../src/core/theory';

const pc = (midi: number) => (midi + 120) % 12;
const qualities = Object.keys(dictionaryArpeggios) as ChordQuality[];

test('all profile tunings and scales offer 2–3 distinct playable shapes for every chord', () => {
  for (const instrument of Object.values(tunings)) {
    for (const scale of bassScales) {
      for (const root of chordRoots) {
        for (const quality of qualities) {
          const description = `${root}${quality} · ${instrument.name} · ${scale}″`;
          const { spelling, shapes, legend } = chordShapes(root, quality, instrument, scale);
          const expected = [
            ...new Set(dictionaryArpeggios[quality].tones.map(({ semitones }) => pc(semitones))),
          ].sort((a, b) => a - b);
          const rootMidi = parsePitch(`${root}4`).midi;
          assert.equal(pc(parsePitch(`${spelling}4`).midi), pc(rootMidi), description);
          assert.equal(legend.length, expected.length, description);
          assert.ok(shapes.length >= 2 && shapes.length <= 3, description);
          const positions = shapes.map(({ notes }) =>
            notes.map(({ string, fret }) => [string, fret]),
          );
          assert.equal(
            new Set(positions.map((shape) => JSON.stringify(shape))).size,
            shapes.length,
            description,
          );
          for (const shape of shapes) {
            const pitches = shape.notes.map((note) => note.midi);
            assert.equal(pc(pitches[0]!), pc(rootMidi), description);
            assert.deepEqual(
              [...new Set(pitches.map((midi) => pc(midi - rootMidi)))],
              expected,
              description,
            );
            assert.deepEqual(
              [...new Set(pitches)].sort((a, b) => a - b),
              pitches,
              description,
            );
            const frets = shape.notes.map((note) => {
              assert.equal(noteAt(instrument, note.string, note.fret), note.midi, description);
              assert.equal(parsePitch(note.spelling).midi, note.midi, description);
              return note.fret;
            });
            assert.equal(shape.firstFret, Math.min(...frets), description);
            assert.equal(shape.lastFret, Math.max(...frets), description);
            if (shape.kind === 'twoOctaves') {
              assert.equal(pitches.at(-1)! - pitches[0]!, 24, description);
              assert.equal(pitches.length, 2 * expected.length + 1, description);
              if (shape.splitAt !== undefined)
                assert.equal(pitches[shape.splitAt], pitches[0]! + 12);
            }
            if (shape.kind === 'open') assert.equal(shape.firstFret, 0, description);
            if (shape.kind === 'box') assert.ok(shape.firstFret > 0, description);
            const positions = shape.splitAt
              ? [frets.slice(0, shape.splitAt), frets.slice(shape.splitAt)]
              : [frets];
            for (const frets of positions) {
              const first = Math.min(...frets);
              assert.ok(
                Math.max(...frets) <=
                  (first ? first - 1 : 0) + chordBoxWidth(scale, Math.max(1, first)),
                description,
              );
            }
          }
        }
      }
    }
  }
});

test('extended formulas preserve compound degrees, altered spellings and profile nomenclature', () => {
  const thirteenth = chordShapes('C', '13', tunings.standard4, 34).legend;
  assert.deepEqual(
    thirteenth.map((tone) => tone.degree),
    ['1', '3', '5', '♭7', '9', '11', '13'],
  );
  assert.deepEqual(
    thirteenth.map((tone) => tone.name),
    ['Do', 'Mi', 'Sol', 'Si♭', 'Re', 'Fa', 'La'],
  );
  const sharpNine = chordShapes('C', '7(♯9)', tunings.standard5, 34, 'english').legend;
  assert.deepEqual(sharpNine.at(-1), { degree: '♯9', step: 9, name: 'D♯' });
  const alt = chordShapes('F#', '7(♯5)', tunings.standard4, 34, 'english');
  assert.equal(alt.legend.find(({ degree }) => degree === '♯5')?.name, 'C𝄪');
  assert.deepEqual(
    chordShapes('C', '13', { strings: [48], name: 'Una cuerda', frets: 0 }, 34).shapes,
    [],
  );
});

test('an E minor arpeggio on four strings offers open, four-fret and two-octave fingerings', () => {
  const { shapes } = chordShapes('E', 'm', tunings.standard4, 34);
  assert.deepEqual(
    shapes.map((shape) => shape.kind),
    ['open', 'box', 'twoOctaves'],
  );
  assert.ok(shapes[1]!.lastFret - shapes[1]!.firstFret < 4);
  assert.equal(shapes[2]!.splitAt, 3);
});
