import { type Instrument, type Position, noteAt, positionsOf, range, tunings } from './instrument';
import { type Nomenclature, type ScoreNote, midiSpelling, pitchName, parsePitch } from './notation';

export type ExerciseModality = 'visual' | 'ear' | 'fretboard' | 'tab';
export const intervals = [
  { semitones: 1, name: '2.ª menor' },
  { semitones: 2, name: '2.ª mayor' },
  { semitones: 3, name: '3.ª menor' },
  { semitones: 4, name: '3.ª mayor' },
  { semitones: 5, name: '4.ª justa' },
  { semitones: 6, name: '4.ª aumentada/5.ª disminuida (tritono)' },
  { semitones: 7, name: '5.ª justa' },
  { semitones: 8, name: '6.ª menor' },
  { semitones: 9, name: '6.ª mayor' },
  { semitones: 10, name: '7.ª menor' },
  { semitones: 11, name: '7.ª mayor' },
  { semitones: 12, name: '8.ª justa' },
];
export type Question = {
  notes: number[]; // Sounding MIDI, also used by audio.
  scoreNotes: ScoreNote[];
  answers: string[];
  answer: string;
  choices: string[];
  position?: Position;
  prompt?: string;
};
export type QuestionOptions = {
  instrument?: Instrument;
  nomenclature?: Nomenclature;
  modality?: ExerciseModality;
};
/** The old (module, random) signature remains supported. */
export function buildQuestion(
  module: 'notes' | 'intervals' | 'reading',
  optionsOrRandom: QuestionOptions | (() => number) = {},
  random = Math.random,
): Question {
  const options = typeof optionsOrRandom === 'function' ? {} : optionsOrRandom;
  if (typeof optionsOrRandom === 'function') random = optionsOrRandom;
  const instrument = options.instrument ?? tunings.standard4;
  const nomenclature = options.nomenclature ?? 'latin';
  const bounds = range(instrument);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const playable = Array.from(
    { length: bounds.max - bounds.min + 1 },
    (_, i) => bounds.min + i,
  ).filter((midi) => positionsOf(instrument, midi).length > 0);
  let notes: number[];
  let interval: (typeof intervals)[number] | undefined;
  let position: Position | undefined;
  if (module === 'intervals') {
    const pairs = intervals.flatMap((item) =>
      playable
        .filter((root) => playable.includes(root + item.semitones))
        .map((root) => ({ root, interval: item })),
    );
    if (!pairs.length)
      throw new RangeError('El instrumento no permite intervalos de 2.ª menor a 8.ª justa.');
    const pair = pick(pairs);
    interval = pair.interval;
    notes = [pair.root, pair.root + interval.semitones];
  } else if (options.modality === 'fretboard') {
    position = {
      string: Math.floor(random() * instrument.strings.length),
      fret: Math.floor(random() * (instrument.frets + 1)),
    };
    notes = [noteAt(instrument, position.string, position.fret)];
  } else {
    notes = Array.from({ length: module === 'reading' ? 4 : 1 }, () => pick(playable));
  }
  const scoreNotes = notes.map((midi) => ({
    midi,
    spelling: midiSpelling(midi),
    position: positionsOf(instrument, midi)[0]!,
  }));
  if (interval) {
    // Spell the upper note by interval degree, so a written minor third is
    // also a third on the staff (e.g. C#–E, rather than C#–D##).
    const degrees = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7];
    const root = parsePitch(scoreNotes[0]!.spelling);
    const diatonic = root.diatonic + degrees[interval.semitones]!;
    const letter = ['C', 'D', 'E', 'F', 'G', 'A', 'B'][diatonic % 7]!;
    const octave = Math.floor(diatonic / 7);
    const alter = notes[1]! - parsePitch(`${letter}${octave}`).midi;
    scoreNotes[1]!.spelling = `${letter}${alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter)}${octave}`;
  }
  if (position) scoreNotes[0]!.position = position;
  const answers = scoreNotes.map((note) => pitchName(note.spelling, false, nomenclature));
  return {
    notes,
    scoreNotes,
    answers,
    answer: interval?.name ?? answers[0]!,
    choices: interval
      ? intervals.map((item) => item.name)
      : Array.from({ length: 12 }, (_, pc) =>
          pitchName(midiSpelling(60 + pc), false, nomenclature),
        ),
    position,
    prompt: position
      ? `Cuerda ${pitchName(midiSpelling(instrument.strings[position.string]!), false, nomenclature)} · traste ${position.fret}`
      : undefined,
  };
}
