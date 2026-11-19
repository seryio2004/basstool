import { Instrument, Position, validateInstrument } from './instrument';
import { accidentalSign, Nomenclature, parsePitch, pitchName } from './notation';

export type TheoryTone = { readonly semitones: number; readonly degree: number };
export type TheoryPattern = { readonly name: string; readonly tones: readonly TheoryTone[] };
export type FretRange = { readonly min: number; readonly max: number };
export type TheoryPosition = Position & {
  midi: number;
  /** ASCII spelling with octave, compatible with notation.parsePitch. */
  spelling: string;
  name: string;
  degree: number;
  /** Degree relative to the major scale: 1, ♭3, ♯4… */
  degreeLabel: string;
  isRoot: boolean;
};

const majorSteps = [0, 2, 4, 5, 7, 9, 11] as const;
const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const pattern = (
  name: string,
  semitones: number[],
  degrees = [1, 2, 3, 4, 5, 6, 7],
): TheoryPattern => ({
  name,
  tones: semitones.map((value, i) => ({ semitones: value, degree: degrees[i]! })),
});

const ionian = pattern('Jónico', [0, 2, 4, 5, 7, 9, 11]);
const aeolian = pattern('Eólico', [0, 2, 3, 5, 7, 8, 10]);
export const scales = {
  major: { ...ionian, name: 'Mayor' },
  naturalMinor: { ...aeolian, name: 'Menor natural' },
  ionian,
  dorian: pattern('Dórico', [0, 2, 3, 5, 7, 9, 10]),
  phrygian: pattern('Frigio', [0, 1, 3, 5, 7, 8, 10]),
  lydian: pattern('Lidio', [0, 2, 4, 6, 7, 9, 11]),
  mixolydian: pattern('Mixolidio', [0, 2, 4, 5, 7, 9, 10]),
  aeolian,
  locrian: pattern('Locrio', [0, 1, 3, 5, 6, 8, 10]),
  majorPentatonic: pattern('Pentatónica mayor', [0, 2, 4, 7, 9], [1, 2, 3, 5, 6]),
  minorPentatonic: pattern('Pentatónica menor', [0, 3, 5, 7, 10], [1, 3, 4, 5, 7]),
  // Minor blues: the passing tone is spelled as a flattened fifth.
  blues: pattern('Blues', [0, 3, 5, 6, 7, 10], [1, 3, 4, 5, 5, 7]),
  harmonicMinor: pattern('Menor armónica', [0, 2, 3, 5, 7, 8, 11]),
  // Ascending / jazz melodic minor. Descending classical form is naturalMinor.
  melodicMinor: pattern('Menor melódica', [0, 2, 3, 5, 7, 9, 11]),
} as const satisfies Record<string, TheoryPattern>;

export const arpeggios = {
  major: pattern('Mayor', [0, 4, 7], [1, 3, 5]),
  minor: pattern('Menor', [0, 3, 7], [1, 3, 5]),
  diminished: pattern('Disminuido', [0, 3, 6], [1, 3, 5]),
  augmented: pattern('Aumentado', [0, 4, 8], [1, 3, 5]),
  sus2: pattern('Suspendido de segunda', [0, 2, 7], [1, 2, 5]),
  sus4: pattern('Suspendido de cuarta', [0, 5, 7], [1, 4, 5]),
  dominant7: pattern('Séptima de dominante', [0, 4, 7, 10], [1, 3, 5, 7]),
  major7: pattern('Séptima mayor', [0, 4, 7, 11], [1, 3, 5, 7]),
  minor7: pattern('Menor séptima', [0, 3, 7, 10], [1, 3, 5, 7]),
  halfDiminished7: pattern('Semidisminuido', [0, 3, 6, 10], [1, 3, 5, 7]),
  diminished7: pattern('Séptima disminuida', [0, 3, 6, 9], [1, 3, 5, 7]),
  minorMajor7: pattern('Menor con séptima mayor', [0, 3, 7, 11], [1, 3, 5, 7]),
  augmentedMajor7: pattern('Aumentado con séptima mayor', [0, 4, 8, 11], [1, 3, 5, 7]),
} as const satisfies Record<string, TheoryPattern>;

/**
 * Tonic is a spelled pitch class (C, F#, Bb…), independent of octave.
 * Includes both fret endpoints and every octave; sorted by string then fret.
 * Written letters follow the diatonic degree, including double accidentals.
 */
export function positionsFor(
  tonic: string,
  collection: TheoryPattern,
  instrument: Instrument,
  frets: FretRange = { min: 0, max: instrument.frets },
  nomenclature: Nomenclature = 'latin',
): TheoryPosition[] {
  validateInstrument(instrument);
  if (
    !Number.isInteger(frets.min) ||
    !Number.isInteger(frets.max) ||
    frets.min < 0 ||
    frets.max > instrument.frets ||
    frets.min > frets.max
  ) {
    throw new RangeError(
      'El rango de trastes debe estar dentro del instrumento, con mínimo ≤ máximo.',
    );
  }
  if (!/^[A-G](##|#|bb|b)?$/.test(tonic)) {
    throw new Error('La tónica debe ser una nota escrita sin octava (C, F#, Bb…).');
  }
  const root = parsePitch(`${tonic}4`);
  if (!collection.tones.length) throw new RangeError('La escala o arpegio debe contener notas.');
  const tones = collection.tones.map(({ semitones, degree }) => {
    if (
      !Number.isInteger(semitones) ||
      semitones < 0 ||
      semitones > 11 ||
      !Number.isInteger(degree) ||
      degree < 1 ||
      degree > 7
    ) {
      throw new RangeError('Los intervalos deben estar entre 0 y 11 y los grados entre 1 y 7.');
    }
    const diatonic = root.letter + degree - 1;
    const letter = diatonic % 7;
    const naturalMidi = parsePitch(`${letters[letter]}${4 + Math.floor(diatonic / 7)}`).midi;
    const alter = root.midi + semitones - naturalMidi;
    if (Math.abs(alter) > 2)
      throw new RangeError('La tonalidad requiere alteraciones mayores que dobles.');
    return {
      semitones,
      degree,
      letter,
      alter,
      degreeLabel: `${accidentalSign(semitones - majorSteps[degree - 1]!)}${degree}`,
    };
  });
  const result: TheoryPosition[] = [];
  instrument.strings.forEach((open, string) => {
    for (let fret = frets.min; fret <= frets.max; fret++) {
      const midi = open + fret;
      for (const tone of tones) {
        if ((((midi - root.midi) % 12) + 12) % 12 !== tone.semitones) continue;
        const natural = parsePitch(`${letters[tone.letter]}4`).midi % 12;
        const octave = (midi - natural - tone.alter) / 12 - 1;
        const accidental = tone.alter >= 0 ? '#'.repeat(tone.alter) : 'b'.repeat(-tone.alter);
        const spelling = `${letters[tone.letter]}${accidental}${octave}`;
        result.push({
          string,
          fret,
          midi,
          spelling,
          name: pitchName(spelling, false, nomenclature),
          degree: tone.degree,
          degreeLabel: tone.degreeLabel,
          isRoot: tone.semitones === 0,
        });
      }
    }
  });
  return result;
}
