import { positionsOf, range, type Instrument } from './instrument';
import type { Level } from './profile';
import { scoreTimeline, synthTones } from './scoreAudio';
import type { Duration, Score, ScoreEvent } from './scoreTypes';

export const listenGenres = [
  { value: 'rock', label: 'Rock' },
  { value: 'funk', label: 'Funk' },
  { value: 'blues', label: 'Blues' },
  { value: 'reggae', label: 'Reggae' },
  { value: 'latin', label: 'Latino' },
  { value: 'jazz', label: 'Jazz' },
] as const;
export type ListenGenre = (typeof listenGenres)[number]['value'];

/** A daily plan can provide this preset and a stable seed for all repeats of a challenge. */
export type ListenRepeatPreset = {
  genre: ListenGenre;
  difficulty: Level;
  chords: boolean;
  seed?: number;
};
export const listenRepeatLevels = {
  beginner: { bars: 1, bpm: 68, timing: 0.15, cents: 48 },
  intermediate: { bars: 2, bpm: 88, timing: 0.105, cents: 38 },
  advanced: { bars: 2, bpm: 112, timing: 0.075, cents: 30 },
} as const;
export const listenLevelOrder = ['beginner', 'intermediate', 'advanced'] as const;
export const repeatBeats = 8;

type Hit = [step: number, offsets: number | readonly number[] | 'dead'];
type Motif = { hits: Hit[]; chord: number[] };
const major = [4, 7];
const minor = [3, 7];
const dominant = [4, 10];

// A bar has 16 steps. Alternatives at a hit are scale tones or passing notes
// for that motif. The first tones and syncopations give each genre its shape.
const motifs: Record<ListenGenre, Record<Level, Motif>> = {
  rock: {
    beginner: {
      hits: [
        [0, 0],
        [4, 0],
        [8, 7],
        [12, [0, 7]],
      ],
      chord: major,
    },
    intermediate: {
      hits: [
        [0, 0],
        [2, 0],
        [4, 7],
        [6, [4, 7]],
        [8, 0],
        [12, [2, 7]],
        [14, [4, 7, 9]],
      ],
      chord: major,
    },
    advanced: {
      hits: [
        [0, 0],
        [2, 7],
        [4, 0],
        [7, [7, 12]],
        [8, 12],
        [10, [9, 10]],
        [12, [5, 7]],
        [14, [7, 10]],
      ],
      chord: dominant,
    },
  },
  funk: {
    beginner: {
      hits: [
        [0, 0],
        [4, [0, 3]],
        [10, 7],
        [12, [3, 7]],
      ],
      chord: minor,
    },
    intermediate: {
      hits: [
        [0, 0],
        [4, 7],
        [6, 0],
        [8, [3, 7]],
        [10, 10],
        [14, [5, 7, 10]],
      ],
      chord: minor,
    },
    advanced: {
      hits: [
        [0, 0],
        [3, 'dead'],
        [4, 12],
        [6, [9, 10]],
        [7, 'dead'],
        [8, 0],
        [11, [3, 5]],
        [12, 7],
        [14, [9, 10, 12]],
      ],
      chord: [3, 10],
    },
  },
  blues: {
    beginner: {
      hits: [
        [0, 0],
        [4, 3],
        [8, 5],
        [12, [7, 10]],
      ],
      chord: dominant,
    },
    intermediate: {
      hits: [
        [0, 0],
        [4, 3],
        [8, 5],
        [10, 6],
        [12, 7],
        [14, [5, 7, 10]],
      ],
      chord: dominant,
    },
    advanced: {
      hits: [
        [0, 0],
        [2, 3],
        [4, 5],
        [6, 6],
        [8, 7],
        [10, [9, 10]],
        [12, 12],
        [14, [6, 10, 11]],
      ],
      chord: dominant,
    },
  },
  reggae: {
    beginner: {
      hits: [
        [4, 0],
        [8, 7],
        [12, [3, 7]],
      ],
      chord: minor,
    },
    intermediate: {
      hits: [
        [4, 0],
        [6, [3, 7]],
        [8, 7],
        [12, [5, 10]],
        [14, [2, 3, 7]],
      ],
      chord: minor,
    },
    advanced: {
      hits: [
        [5, 0],
        [7, [3, 5]],
        [8, 7],
        [10, 12],
        [11, [3, 5]],
        [12, [9, 10]],
        [14, [3, 5, 7]],
      ],
      chord: [3, 10],
    },
  },
  latin: {
    beginner: {
      hits: [
        [0, 0],
        [6, 7],
        [12, [0, 7]],
      ],
      chord: major,
    },
    intermediate: {
      hits: [
        [0, 0],
        [4, [4, 7]],
        [6, 7],
        [10, [2, 9]],
        [12, 0],
        [14, [4, 7]],
      ],
      chord: major,
    },
    advanced: {
      hits: [
        [0, 0],
        [3, [4, 7]],
        [6, 7],
        [8, [10, 12]],
        [10, [5, 9]],
        [12, 0],
        [14, [7, 11, 12]],
      ],
      chord: dominant,
    },
  },
  jazz: {
    beginner: {
      hits: [
        [0, 0],
        [4, [2, 4]],
        [8, 7],
        [12, [4, 9]],
      ],
      chord: major,
    },
    intermediate: {
      hits: [
        [0, 0],
        [4, [2, 4]],
        [8, 7],
        [10, 9],
        [12, [5, 11]],
        [14, [7, 11]],
      ],
      chord: major,
    },
    advanced: {
      hits: [
        [0, 0],
        [4, 4],
        [7, [5, 7]],
        [8, [7, 9]],
        [10, [9, 10]],
        [12, 12],
        [14, [11, 13]],
      ],
      chord: dominant,
    },
  },
};

const figures: [steps: number, base: Duration['base'], dots: Duration['dots']][] = [
  [16, 1, 0],
  [12, 2, 1],
  [8, 2, 0],
  [6, 4, 1],
  [4, 4, 0],
  [3, 8, 1],
  [2, 8, 0],
  [1, 16, 0],
];

export function makeListenPhrase(preset: ListenRepeatPreset, instrument: Instrument) {
  const { genre, difficulty } = preset;
  const seed = (preset.seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0;
  let state = seed;
  const pick = <T>(items: readonly T[]) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return items[Math.floor((state / 2 ** 32) * items.length)]!;
  };
  const { bars, bpm } = listenRepeatLevels[difficulty];
  const { hits, chord } = motifs[genre][difficulty];
  const { min, max } = range(instrument);
  const offsets = (value: Hit[1]): readonly number[] =>
    value === 'dead' ? [0] : typeof value === 'number' ? [value] : value;
  const playable = (midi: number) => midi <= max && positionsOf(instrument, midi).length > 0;
  const roots = Array.from({ length: Math.min(max - min + 1, 12) }, (_, i) => min + i).filter(
    (root) => hits.every(([, value]) => offsets(value).some((n) => playable(root + n))),
  );
  const root = roots.length ? pick(roots) : min;

  function measure(bar: number) {
    const events: ScoreEvent[] = [];
    function add(steps: number, note?: ScoreEvent['note'], dead = false) {
      while (steps > 0) {
        const [length, base, dots] = figures.find(([length]) => length <= steps)!;
        steps -= length;
        events.push({
          id: `${bar}-${events.length}`,
          duration: { base, dots },
          ...(note && { notes: [note] }),
          ...(note && steps > 0 && { tie: true }),
          ...(dead && { technique: 'dead' }),
        });
      }
    }
    let step = 0;
    hits.forEach(([at, value], index) => {
      add(at - step);
      const pitches = offsets(value)
        .map((n) => root + n)
        .filter(playable);
      const midi = pitches.length ? pick(pitches) : root;
      const note = positionsOf(instrument, midi).reduce((best, p) =>
        p.fret < best.fret ? p : best,
      );
      const gap = (hits[index + 1]?.[0] ?? 16) - at;
      const length = value === 'dead' ? 1 : Math.min(gap, genre === 'reggae' ? 6 : 4);
      add(length, note, value === 'dead');
      step = at + length;
    });
    add(16 - step);
    return { id: String(bar), events };
  }

  const score: Score = {
    version: 1,
    meter: { beats: 4, unit: 4 },
    keyFifths: 0,
    measures: Array.from({ length: bars }, (_, i) => measure(i)),
  };
  const beatSeconds = 60 / bpm;
  const duration = bars * 4 * beatSeconds;
  const tones = synthTones(
    scoreTimeline(score, { measures: [], beats: [] }, duration, instrument, bpm),
  );
  const chordRoot = 60 + (root % 12);
  return {
    genre,
    difficulty,
    seed,
    bpm,
    bars,
    duration,
    beatSeconds,
    score,
    tones,
    chord: chord.map((i) => chordRoot + i),
  };
}

export type ListenPhrase = ReturnType<typeof makeListenPhrase>;
export type ListenAttack = { time: number; hz: number | null };

export function gradeListenPhrase(phrase: ListenPhrase, attacks: readonly ListenAttack[]) {
  const { timing, cents } = listenRepeatLevels[phrase.difficulty];
  const detected = [...attacks].sort((a, b) => a.time - b.time);
  // Ordered one-to-one matching. Adjacent timing windows can overlap in
  // syncopated patterns, so assigning greedily can discard a correct note.
  const row = new Array<number>(detected.length + 1).fill(0);
  for (const tone of phrase.tones) {
    let diagonal = 0;
    for (let i = 1; i <= detected.length; i++) {
      const above = row[i]!;
      const attack = detected[i - 1]!;
      const actual = attack.hz === null ? Infinity : 69 + 12 * Math.log2(attack.hz / 440);
      const matches =
        Math.abs(tone.start - attack.time) <= timing &&
        (tone.dead ? attack.hz === null : Math.abs(actual - tone.midi) * 100 <= cents);
      row[i] = Math.max(row[i - 1]!, above, diagonal + Number(matches));
      diagonal = above;
    }
  }
  const correct = row.at(-1)!;
  const extra = Math.max(0, detected.length - correct);
  const total = phrase.tones.length;
  return { correct, total, extra, passed: correct === total && extra === 0 };
}

export type Drum = 'kick' | 'snare' | 'hat';
const eighths = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
const swingHats = [0, 2 / 3, 1, 5 / 3, 2, 8 / 3, 3, 11 / 3];
export const listenDrums: Record<ListenGenre, Record<Drum, number[]>> = {
  rock: { kick: [0, 2, 2.5], snare: [1, 3], hat: eighths },
  funk: { kick: [0, 0.75, 2, 2.75], snare: [1, 3], hat: [...eighths, 1.75, 3.75] },
  blues: { kick: [0, 2], snare: [1, 3], hat: swingHats },
  reggae: { kick: [2], snare: [2], hat: [0.5, 1.5, 2.5, 3.5] },
  latin: { kick: [0, 1.5, 3], snare: [0, 1.5, 3], hat: eighths },
  jazz: { kick: [0, 1, 2, 3], snare: [1, 3 + 2 / 3], hat: [0, 1, 1 + 2 / 3, 2, 3, 3 + 2 / 3] },
};

export function listenCycle(phrase: ListenPhrase, withChords: boolean) {
  const repeatEnd = phrase.duration + repeatBeats * phrase.beatSeconds;
  const drums = Array.from({ length: phrase.bars + repeatBeats / 4 }, (_, bar) =>
    (Object.keys(listenDrums[phrase.genre]) as Drum[]).flatMap((drum) =>
      listenDrums[phrase.genre][drum].map((beat) => ({
        drum,
        start: (bar * 4 + beat) * phrase.beatSeconds,
        accent: Number.isInteger(beat),
      })),
    ),
  ).flat();
  const chords = withChords
    ? Array.from({ length: phrase.bars }, (_, bar) =>
        phrase.chord.map((midi) => ({
          midi,
          start: bar * 4 * phrase.beatSeconds,
          end: (bar * 4 + 2.75) * phrase.beatSeconds,
        })),
      ).flat()
    : [];
  return { repeatStart: phrase.duration, repeatEnd, bass: phrase.tones, drums, chords };
}
