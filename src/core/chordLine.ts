import type { TrainTarget } from './chordTrain';
import { levels, type Level } from './profile';

export type ChordLineDifficulty = Level | 'random';

export const chordLineDifficulties = [...levels, { value: 'random' as const, label: 'Aleatoria' }];

export const chordLineLevels = {
  beginner: { bpm: 72, rank: 0, harmony: 'triads' },
  intermediate: { bpm: 92, rank: 1, harmony: 'sevenths' },
  advanced: { bpm: 112, rank: 2, harmony: 'extensions' },
} as const;

export function resolveChordLineDifficulty(selection: ChordLineDifficulty, random = Math.random) {
  return selection === 'random' ? levels[Math.floor(random() * levels.length)]!.value : selection;
}

export const chordLineBeats = 4;
export const ticksPerBeat = 12;

type RhythmStep = number | readonly [ticks: number, kind: 'rest' | 'dead'];
type RhythmDefinition = {
  label: string;
  level: Level;
  steps: readonly RhythmStep[];
  triplet?: true;
};

// Positive steps are pitched notes. Rests and dead notes occupy their full written duration.
const chordLineRhythms = {
  quarters: { label: 'Negras', level: 'beginner', steps: [12, 12, 12, 12] },
  halves: { label: 'Blancas y negras', level: 'beginner', steps: [24, 12, 12] },
  rock: { label: 'Rock · corcheas', level: 'intermediate', steps: [6, 6, 6, 6, 6, 6, 6, 6] },
  syncopation: { label: 'Síncopas', level: 'intermediate', steps: [6, 12, 6, 6, 12, 6] },
  anticipation: { label: 'Anticipaciones', level: 'intermediate', steps: [12, 6, 18, 6, 6] },
  reggae: {
    label: 'Reggae',
    level: 'intermediate',
    steps: [[12, 'rest'], 12, 6, [6, 'rest'], 12],
  },
  bossa: { label: 'Bossa', level: 'intermediate', steps: [18, 6, 18, 6] },
  tumbao: { label: 'Tumbao', level: 'intermediate', steps: [[18, 'rest'], 18, 12] },
  sixteenths: {
    label: 'Semicorcheas',
    level: 'advanced',
    steps: [3, 3, 3, 3, 6, 6, 3, 3, 3, 3, 12],
  },
  triplets: {
    label: 'Tresillos',
    level: 'advanced',
    steps: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    triplet: true,
  },
  funk: {
    label: 'Funk · notas muertas',
    level: 'advanced',
    steps: [3, [3, 'dead'], 6, [3, 'rest'], 3, [3, 'dead'], 3, 6, [3, 'dead'], 3, 12],
  },
  shuffle: {
    label: 'Shuffle',
    level: 'advanced',
    steps: [8, 4, 8, 4, 8, 4, 8, 4],
    triplet: true,
  },
} satisfies Record<string, RhythmDefinition>;

export type ChordLineRhythm = keyof typeof chordLineRhythms;
export type ChordLineRhythmSelection = ChordLineRhythm | 'varied';

export type ChordLineSettings = {
  difficulty: ChordLineDifficulty;
  rhythm: ChordLineRhythmSelection;
};

export const defaultChordLineRhythm = (level: Level): ChordLineRhythmSelection =>
  level === 'beginner' ? 'quarters' : 'varied';

export type ChordLineSnapshot = ChordLineSettings & {
  resolvedDifficulty: Level;
  wagons: ChordLineRhythm[];
};

const rhythmIds = Object.keys(chordLineRhythms) as ChordLineRhythm[];

export function chordLineRhythmOptions(difficulty: Level) {
  return rhythmIds
    .filter(
      (id) => chordLineLevels[chordLineRhythms[id].level].rank <= chordLineLevels[difficulty].rank,
    )
    .map((value) => ({ value, label: chordLineRhythms[value].label }));
}

export function chordLineWagons(
  beats: number,
  difficulty: Level,
  rhythm: ChordLineRhythmSelection,
  random = Math.random,
): ChordLineRhythm[] {
  const allowed = chordLineRhythmOptions(difficulty).map(({ value }) => value);
  const fixed = rhythm !== 'varied' && allowed.includes(rhythm) ? rhythm : undefined;
  // Include the newest figures in the draw while keeping simpler measures in the line.
  const newest = allowed.filter((id) => chordLineRhythms[id].level === difficulty);
  let previous: ChordLineRhythm | undefined;
  return Array.from({ length: beats / chordLineBeats }, (_, index) => {
    const pool = (index % 2 === 0 ? newest : allowed).filter((id) => id !== previous);
    previous = fixed ?? pool[Math.floor(random() * pool.length)] ?? newest[0]!;
    return previous;
  });
}

export function chordLineMeasure(id: ChordLineRhythm) {
  const rhythm: RhythmDefinition = chordLineRhythms[id];
  let tick = 0;
  const events = rhythm.steps.map((step) => {
    const [duration, kind] = typeof step === 'number' ? ([step, 'note'] as const) : step;
    const event = { tick, duration, kind };
    tick += duration;
    return event;
  });
  return { ...rhythm, events };
}

export function chordLineAttacks(wagons: ChordLineRhythm[], bpm: number): TrainTarget[] {
  const tickSeconds = 60 / bpm / ticksPerBeat;
  return wagons.flatMap((id, index) =>
    chordLineMeasure(id).events.flatMap(({ tick, duration, kind }) =>
      kind === 'rest'
        ? []
        : [
            {
              t: (index * chordLineBeats * ticksPerBeat + tick) * tickSeconds,
              block: index * chordLineBeats + Math.floor(tick / ticksPerBeat),
              duration: duration * tickSeconds,
              dead: kind === 'dead',
            },
          ],
    ),
  );
}

export function chordLineTolerance(attacks: TrainTarget[], beat: number) {
  const shortest = attacks.reduce(
    (gap, note, index) => (index ? Math.min(gap, note.t - attacks[index - 1]!.t) : gap),
    beat,
  );
  return Math.min(0.135, shortest * 0.45);
}

type SettingsStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
};

export function createChordLineSettingsStorage(storage: SettingsStorage) {
  const keyFor = (profileId: string) => 'clasro.chordline.v1.' + profileId;
  const pending = new Map<string, Promise<unknown>>();
  return {
    async load(profileId: string, profileLevel: Level): Promise<ChordLineSettings> {
      const fallback: ChordLineSettings = {
        difficulty: profileLevel,
        rhythm: defaultChordLineRhythm(profileLevel),
      };
      const key = keyFor(profileId);
      await pending.get(key)?.catch(() => {});
      const raw = await storage.getItem(key);
      try {
        const saved = raw && JSON.parse(raw);
        const difficulty = chordLineDifficulties.find(
          ({ value }) => value === saved?.difficulty,
        )?.value;
        if (!difficulty) return fallback;
        const rhythm = saved.rhythm;
        const allowed = chordLineRhythmOptions(difficulty === 'random' ? 'advanced' : difficulty);
        return {
          difficulty,
          rhythm: allowed.find(({ value }) => value === rhythm)?.value ?? 'varied',
        };
      } catch {
        return fallback;
      }
    },
    async save(profileId: string, settings: ChordLineSettings) {
      const key = keyFor(profileId);
      const write = (pending.get(key) ?? Promise.resolve())
        .catch(() => {})
        .then(() => storage.setItem(key, JSON.stringify(settings)));
      pending.set(key, write);
      try {
        await write;
      } finally {
        if (pending.get(key) === write) pending.delete(key);
      }
    },
  };
}
