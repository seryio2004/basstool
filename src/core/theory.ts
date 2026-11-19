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
  major6: pattern('Mayor con sexta', [0, 4, 7, 9], [1, 3, 5, 6]),
  minor6: pattern('Menor con sexta', [0, 3, 7, 9], [1, 3, 5, 6]),
  dominant9: pattern('Novena de dominante', [0, 4, 7, 10, 14], [1, 3, 5, 7, 9]),
  major9: pattern('Mayor con novena', [0, 4, 7, 11, 14], [1, 3, 5, 7, 9]),
  minor9: pattern('Menor con novena', [0, 3, 7, 10, 14], [1, 3, 5, 7, 9]),
  add9: pattern('Mayor con novena añadida', [0, 4, 7, 14], [1, 3, 5, 9]),
} as const satisfies Record<string, TheoryPattern>;

export const chordArpeggios = {
  '': arpeggios.major,
  m: arpeggios.minor,
  dim: arpeggios.diminished,
  aug: arpeggios.augmented,
  sus2: arpeggios.sus2,
  sus4: arpeggios.sus4,
  '7': arpeggios.dominant7,
  maj7: arpeggios.major7,
  m7: arpeggios.minor7,
  m7b5: arpeggios.halfDiminished7,
  dim7: arpeggios.diminished7,
  mMaj7: arpeggios.minorMajor7,
  augMaj7: arpeggios.augmentedMajor7,
  '6': arpeggios.major6,
  m6: arpeggios.minor6,
  '9': arpeggios.dominant9,
  maj9: arpeggios.major9,
  m9: arpeggios.minor9,
  add9: arpeggios.add9,
} as const;

/** Cifrado extendido del diccionario y del reconocimiento por croma. */
export const dictionaryArpeggios = {
  ...chordArpeggios,
  '6/9': pattern('Sexta y novena', [0, 4, 7, 9, 14], [1, 3, 5, 6, 9]),
  'm(maj9)': pattern('Menor con séptima mayor y novena', [0, 3, 7, 11, 14], [1, 3, 5, 7, 9]),
  '7(♭9)': pattern('Séptima con novena menor', [0, 4, 7, 10, 13], [1, 3, 5, 7, 9]),
  '7(♯9)': pattern('Séptima con novena aumentada', [0, 4, 7, 10, 15], [1, 3, 5, 7, 9]),
  '7(♭5)': pattern('Séptima con quinta disminuida', [0, 4, 6, 10], [1, 3, 5, 7]),
  '7(♯5)': pattern('Séptima con quinta aumentada', [0, 4, 8, 10], [1, 3, 5, 7]),
  '7(♯11)': pattern('Séptima con oncena aumentada', [0, 4, 7, 10, 18], [1, 3, 5, 7, 11]),
  'maj7(♯11)': pattern('Séptima mayor con oncena aumentada', [0, 4, 7, 11, 18], [1, 3, 5, 7, 11]),
  '11': pattern('Oncena de dominante', [0, 4, 7, 10, 14, 17], [1, 3, 5, 7, 9, 11]),
  m11: pattern('Menor con oncena', [0, 3, 7, 10, 14, 17], [1, 3, 5, 7, 9, 11]),
  '13': pattern('Trecena de dominante', [0, 4, 7, 10, 14, 17, 21], [1, 3, 5, 7, 9, 11, 13]),
  m13: pattern('Menor con trecena', [0, 3, 7, 10, 14, 17, 21], [1, 3, 5, 7, 9, 11, 13]),
  'm(add9)': pattern('Menor con novena añadida', [0, 3, 7, 14], [1, 3, 5, 9]),
  add11: pattern('Mayor con oncena añadida', [0, 4, 7, 17], [1, 3, 5, 11]),
  '7sus4': pattern('Séptima suspendida', [0, 5, 7, 10], [1, 4, 5, 7]),
  'm6/9': pattern('Menor con sexta y novena', [0, 3, 7, 9, 14], [1, 3, 5, 6, 9]),
  '9(♯11)': pattern('Novena con oncena aumentada', [0, 4, 7, 10, 14, 18], [1, 3, 5, 7, 9, 11]),
} as const;

export const majorProgressions = [
  { value: '0,4,5,3', label: 'I · V · vi · IV' },
  { value: '1,4,0,0', label: 'ii · V · I · I' },
  { value: '0,3,4,0', label: 'I · IV · V · I' },
];

export const majorDegrees = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

export function majorTriads(tonic: number, progression: string) {
  return progression.split(',').map((degree) => {
    const index = Number(degree);
    const quality = index === 6 ? 'diminished' : [1, 2, 5].includes(index) ? 'minor' : 'major';
    return { root: tonic + majorSteps[index]!, quality, degree: majorDegrees[index]! } as const;
  });
}

function spellPattern(tonic: string, collection: TheoryPattern) {
  if (!/^[A-G](##|#|bb|b)?$/.test(tonic)) {
    throw new Error('La tónica debe ser una nota escrita sin octava (C, F#, Bb…).');
  }
  const root = parsePitch(`${tonic}4`);
  if (!collection.tones.length) throw new RangeError('La escala o arpegio debe contener notas.');
  const tones = collection.tones.map(({ semitones, degree }) => {
    const simpleDegree = (degree - 1) % 7;
    const octave = 12 * Math.floor((degree - 1) / 7);
    if (
      !Number.isInteger(semitones) ||
      semitones < octave ||
      semitones > octave + 11 ||
      !Number.isInteger(degree) ||
      degree < 1 ||
      degree > 13
    ) {
      throw new RangeError('El intervalo debe corresponder a la octava de un grado del 1 al 13.');
    }
    const diatonic = root.letter + degree - 1;
    const letter = diatonic % 7;
    const naturalMidi = parsePitch(`${letters[letter]}${4 + Math.floor(diatonic / 7)}`).midi;
    const alter = root.midi + semitones - naturalMidi;
    if (Math.abs(alter) > 2)
      throw new RangeError('La tonalidad requiere alteraciones mayores que dobles.');
    return {
      midi: root.midi + semitones,
      semitones: semitones % 12,
      degree,
      letter,
      alter,
      degreeLabel: `${accidentalSign(semitones - octave - majorSteps[simpleDegree]!)}${degree}`,
    };
  });
  return { root, tones };
}

function spellAt(midi: number, { letter, alter }: { letter: number; alter: number }) {
  const natural = parsePitch(`${letters[letter]}4`).midi % 12;
  const octave = (midi - natural - alter) / 12 - 1;
  const accidental = alter >= 0 ? '#'.repeat(alter) : 'b'.repeat(-alter);
  return `${letters[letter]}${accidental}${octave}`;
}

export function namedTones(tonic: string, collection: TheoryPattern, nomenclature: Nomenclature) {
  return spellPattern(tonic, collection).tones.map((tone) => ({
    degree: tone.degreeLabel,
    step: tone.degree,
    name: pitchName(spellAt(tone.midi, tone), false, nomenclature),
  }));
}

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
  const { root, tones } = spellPattern(tonic, collection);
  const result: TheoryPosition[] = [];
  instrument.strings.forEach((open, string) => {
    for (let fret = frets.min; fret <= frets.max; fret++) {
      const midi = open + fret;
      for (const tone of tones) {
        if ((((midi - root.midi) % 12) + 12) % 12 !== tone.semitones) continue;
        const spelling = spellAt(midi, tone);
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
