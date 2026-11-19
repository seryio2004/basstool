import { parseTrainChord, type Chord, type ChordFunction } from './chordTrain';
import { parsePitch } from './notation';
import { chordArpeggios, scales } from './theory';

export type TrainMode = 'major' | 'minor';
export type TrainDifficulty = 'triads' | 'sevenths' | 'extensions';
type Suffix = keyof typeof chordArpeggios;
type TrainBar = [degree: number, suffix: Suffix, role: ChordFunction];
type TrainProgression = { value: string; label: string; mode: TrainMode; bars: TrainBar[] };

const tonic = 'tonic';
const subdominant = 'subdominant';
const dominant = 'dominant';

function blues(major: boolean): TrainBar[] {
  const i: TrainBar = [1, major ? '7' : 'm7', tonic];
  const iv: TrainBar = [4, major ? '7' : 'm7', subdominant];
  const v: TrainBar = [5, '7', dominant];
  return [
    i,
    i,
    i,
    i,
    iv,
    iv,
    i,
    i,
    ...(major ? [v, iv] : [[6, '7', subdominant] as TrainBar, v]),
    i,
    v,
  ];
}

// Degrees refer to the major or natural minor scale of the selected key.
// Modal vamps retain the same degree spelling and supply the modal qualities.
export const trainProgressions: TrainProgression[] = [
  {
    value: 'pop',
    label: 'I · V · vi · IV',
    mode: 'major',
    bars: [
      [1, '', tonic],
      [5, '', dominant],
      [6, 'm', tonic],
      [4, '', subdominant],
    ],
  },
  {
    value: 'fifties',
    label: 'I · vi · IV · V',
    mode: 'major',
    bars: [
      [1, '', tonic],
      [6, 'm', tonic],
      [4, '', subdominant],
      [5, '', dominant],
    ],
  },
  {
    value: 'major-cadence',
    label: 'ii · V · I mayor',
    mode: 'major',
    bars: [
      [2, 'm7', subdominant],
      [5, '7', dominant],
      [1, 'maj7', tonic],
      [1, 'maj7', tonic],
    ],
  },
  {
    value: 'minor-cadence',
    label: 'iiø · V · i menor',
    mode: 'minor',
    bars: [
      [2, 'm7b5', subdominant],
      [5, '7', dominant],
      [1, 'm', tonic],
      [1, 'm', tonic],
    ],
  },
  { value: 'major-blues', label: 'Blues de 12 compases', mode: 'major', bars: blues(true) },
  { value: 'minor-blues', label: 'Blues menor de 12 compases', mode: 'minor', bars: blues(false) },
  {
    value: 'dorian',
    label: 'Vamp dórico · i · IV',
    mode: 'minor',
    bars: [
      [1, 'm7', tonic],
      [4, '7', subdominant],
      [1, 'm7', tonic],
      [4, '7', subdominant],
    ],
  },
  {
    value: 'mixolydian',
    label: 'Vamp mixolidio · I · ♭VII',
    mode: 'major',
    bars: [
      [1, '7', tonic],
      [-7, '', subdominant],
      [1, '7', tonic],
      [-7, '', subdominant],
    ],
  },
  {
    value: 'major-funk',
    label: 'Funk de un acorde',
    mode: 'major',
    bars: Array<TrainBar>(4).fill([1, '9', tonic]),
  },
  {
    value: 'minor-funk',
    label: 'Funk menor de un acorde',
    mode: 'minor',
    bars: Array<TrainBar>(4).fill([1, 'm9', tonic]),
  },
  {
    value: 'minor-pop',
    label: 'i · ♭VI · ♭III · ♭VII',
    mode: 'minor',
    bars: [
      [1, 'm', tonic],
      [6, '', subdominant],
      [3, '', tonic],
      [7, '', subdominant],
    ],
  },
];

export function progressionChords(key: string, progression: TrainProgression): Chord[] {
  const root = parsePitch(key + '4');
  const scale = progression.mode === 'major' ? scales.major : scales.naturalMinor;
  return progression.bars.flatMap(([degree, suffix, role]) => {
    const index = Math.abs(degree) - 1;
    const letterIndex = root.letter + index;
    const letter = 'CDEFGAB'[letterIndex % 7]!;
    const natural = parsePitch(letter + (4 + Math.floor(letterIndex / 7)));
    const alter = root.midi + scale.tones[index]!.semitones - Number(degree < 0) - natural.midi;
    const accidental = alter < 0 ? 'b'.repeat(-alter) : '#'.repeat(alter);
    const chord = parseTrainChord(letter + accidental + suffix)!;
    return Array<Chord>(4).fill({ ...chord, role });
  });
}

const variants: Record<TrainDifficulty, Partial<Record<Suffix, readonly Suffix[]>>> = {
  triads: { '7': [''], '9': [''], maj7: [''], m7b5: ['dim'], m7: ['m'], m9: ['m'] },
  sevenths: { '': ['maj7'], '9': ['7'], m: ['m7'], m9: ['m7'] },
  extensions: {
    '': ['maj9', '6', 'add9'],
    '7': ['9'],
    maj7: ['maj9', '6'],
    m: ['m9', 'm6'],
    m7: ['m9'],
  },
};

export function randomTrainProgression(
  mode: TrainMode,
  difficulty: TrainDifficulty,
  random = Math.random,
): TrainProgression {
  const pick = <T>(options: readonly T[]) => options[Math.floor(random() * options.length)]!;
  const selected = pick(trainProgressions.filter((progression) => progression.mode === mode));
  // Reuse the voicing if the same chord returns, including one-chord workouts.
  const voicings = new Map<string, Suffix>();
  return {
    ...selected,
    bars: selected.bars.map(([degree, suffix, role]) => {
      const key = degree + ':' + suffix;
      // A major V takes a minor seventh to preserve its dominant function.
      const quality = suffix === '' && role === dominant && difficulty !== 'triads' ? '7' : suffix;
      const voicing = voicings.get(key) ?? pick(variants[difficulty][quality] ?? [quality]);
      voicings.set(key, voicing);
      return [degree, voicing, role];
    }),
  };
}
