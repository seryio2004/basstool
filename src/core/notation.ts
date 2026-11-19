// Spelled pitches for diagrams. A spelling keeps the written name (Do♯ vs Re♭),
// which MIDI numbers alone lose. Format: letter + optional accidental + octave,
// e.g. 'C4', 'F#4', 'Bb3', 'Ebb4'. Octave 4 contains middle C (MIDI 60).
const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const naturalSemitones = [0, 2, 4, 5, 7, 9, 11];
const spanish = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
const accidentalSigns: Record<string, string> = { '': '', '#': '♯', '##': '𝄪', b: '♭', bb: '𝄫' };

export type SpelledPitch = {
  spelling: string;
  letter: number; // 0 = C … 6 = B
  alter: number; // -2 … 2
  octave: number;
  midi: number;
  diatonic: number; // octave * 7 + letter: one unit per staff line or space
};

export function parsePitch(spelling: string): SpelledPitch {
  const match = /^([A-G])(##|#|bb|b)?(-?\d)$/.exec(spelling);
  if (!match) throw new Error(`Altura no válida: ${spelling}`);
  const letter = letters.indexOf(match[1] as (typeof letters)[number]);
  const accidental = match[2] || '';
  const alter = accidental.startsWith('#') ? accidental.length : -accidental.length;
  const octave = Number(match[3]);
  return {
    spelling,
    letter,
    alter,
    octave,
    midi: (octave + 1) * 12 + naturalSemitones[letter]! + alter,
    diatonic: octave * 7 + letter,
  };
}

export const accidentalSign = (alter: number) =>
  accidentalSigns[alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter)] ?? '';

export type Nomenclature = 'latin' | 'english';

/** Defaults to Latin names for existing diagrams; preserves the written accidental. */
export function pitchName(
  spelling: string,
  withOctave = false,
  nomenclature: Nomenclature = 'latin',
) {
  const p = parsePitch(spelling);
  const names = nomenclature === 'english' ? letters : spanish;
  return `${names[p.letter]}${accidentalSign(p.alter)}${withOctave ? p.octave : ''}`;
}

export const midiOf = (spelling: string) => parsePitch(spelling).midi;

/** Semitone distance between consecutive pitches, named as the course does. */
export function stepName(semitones: number) {
  if (semitones === 1) return 'S';
  if (semitones === 2) return 'T';
  if (semitones === 3) return 'T+S';
  return `${semitones}`;
}

export const isBlackKey = (midi: number) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

/** Keys of the circle of fifths, clockwise from C. Accidentals: + sharps, − flats. */
export const fifthsCircle = [
  { major: 'C', name: 'Do', minor: 'La', accidentals: 0 },
  { major: 'G', name: 'Sol', minor: 'Mi', accidentals: 1 },
  { major: 'D', name: 'Re', minor: 'Si', accidentals: 2 },
  { major: 'A', name: 'La', minor: 'Fa♯', accidentals: 3 },
  { major: 'E', name: 'Mi', minor: 'Do♯', accidentals: 4 },
  { major: 'B', name: 'Si', minor: 'Sol♯', accidentals: 5 },
  { major: 'F#', name: 'Fa♯', minor: 'Re♯', accidentals: 6 },
  { major: 'Db', name: 'Re♭', minor: 'Si♭', accidentals: -5 },
  { major: 'Ab', name: 'La♭', minor: 'Fa', accidentals: -4 },
  { major: 'Eb', name: 'Mi♭', minor: 'Do', accidentals: -3 },
  { major: 'Bb', name: 'Si♭', minor: 'Sol', accidentals: -2 },
  { major: 'F', name: 'Fa', minor: 'Re', accidentals: -1 },
] as const;

export function signatureText(accidentals: number) {
  if (!accidentals) return 'sin alteraciones';
  const n = Math.abs(accidentals);
  return `${n} ${accidentals > 0 ? (n === 1 ? 'sostenido' : 'sostenidos') : n === 1 ? 'bemol' : 'bemoles'}`;
}

/** Sharps and flats of a major key signature, in written order. */
export function signatureNotes(accidentals: number) {
  const sharps = ['Fa♯', 'Do♯', 'Sol♯', 'Re♯', 'La♯', 'Mi♯', 'Si♯'];
  const flats = ['Si♭', 'Mi♭', 'La♭', 'Re♭', 'Sol♭', 'Do♭', 'Fa♭'];
  return accidentals >= 0 ? sharps.slice(0, accidentals) : flats.slice(0, -accidentals);
}
