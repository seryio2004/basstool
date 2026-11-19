export const drumPieces = ['kick', 'snare', 'cymbal'] as const;
export type DrumPiece = (typeof drumPieces)[number];
export type Drum = 'kick' | 'snare' | 'hat' | 'ride';
type ListenDrum = Exclude<Drum, 'ride'>;
export type DrumLevels = Record<DrumPiece, number>;
export const drumPiece = (drum: Drum): DrumPiece =>
  drum === 'hat' || drum === 'ride' ? 'cymbal' : drum;

const eighths = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
const swingHats = [0, 2 / 3, 1, 5 / 3, 2, 8 / 3, 3, 11 / 3];
export const listenDrums = {
  rock: { kick: [0, 2, 2.5], snare: [1, 3], hat: eighths },
  funk: { kick: [0, 0.75, 2, 2.75], snare: [1, 3], hat: [...eighths, 1.75, 3.75] },
  blues: { kick: [0, 2], snare: [1, 3], hat: swingHats },
  reggae: { kick: [2], snare: [2], hat: [0.5, 1.5, 2.5, 3.5] },
  latin: { kick: [0, 1.5, 3], snare: [0, 1.5, 3], hat: eighths },
  jazz: { kick: [0, 1, 2, 3], snare: [1, 3 + 2 / 3], hat: [0, 1, 1 + 2 / 3, 2, 3, 3 + 2 / 3] },
} satisfies Record<string, Record<ListenDrum, number[]>>;

export function listenDrumTimeline(
  genre: keyof typeof listenDrums,
  bars: number,
  beatSeconds: number,
) {
  return Array.from({ length: bars }, (_, bar) =>
    (['kick', 'snare', 'hat'] as const).flatMap((drum) =>
      listenDrums[genre][drum].map((beat) => ({
        drum,
        start: (bar * 4 + beat) * beatSeconds,
        accent: Number.isInteger(beat),
      })),
    ),
  ).flat();
}

export const drumGenres = [
  { value: 'rock', label: 'Rock' },
  { value: 'funk', label: 'Funk' },
  { value: 'blues', label: 'Blues' },
  { value: 'reggae', label: 'Reggae' },
  { value: 'latin', label: 'Latino' },
  { value: 'jazz', label: 'Jazz' },
  { value: 'pop', label: 'Pop' },
  { value: 'metal', label: 'Metal' },
] as const;
export type DrumGenre = (typeof drumGenres)[number]['value'];
export type DrumMeter = '4/4' | '3/4' | '6/8' | '12/8';
export type DrumVariation = 'A' | 'B' | 'fill';
export type Groove = {
  genre: DrumGenre;
  variation: DrumVariation;
  bpm: number;
  meter: DrumMeter;
  swing: number;
  fillEvery?: 0 | 4 | 8;
  levels?: DrumLevels;
};
export type DrumHit = { drum: Drum; accent: boolean; velocity: number };
export type DrumStep = { pulse: number; hits: DrumHit[] };

type Pattern = readonly [kick: number[], snare: number[], cymbal: number[]];
type Variations = readonly [a: Pattern, b: Pattern];
const eights = eighths.map((beat) => beat * 4);
const fromListen = (genre: keyof typeof listenDrums): Pattern => {
  const { kick, snare, hat } = listenDrums[genre];
  const steps = (beats: number[]) => beats.map((beat) => Math.floor(beat * 4));
  return [steps(kick), steps(snare), steps(hat)];
};
const sixteenths = Array.from({ length: 16 }, (_, i) => i);
const fourFour: Record<DrumGenre, Variations> = {
  rock: [fromListen('rock'), [[0, 6, 8, 14], [4, 12], eights]],
  funk: [fromListen('funk'), [[0, 6, 9, 14], [2, 4, 10, 12, 15], sixteenths]],
  blues: [fromListen('blues'), [[0, 6, 8, 14], [4, 12], eights]],
  reggae: [fromListen('reggae'), [[8], [8, 15], [0, 2, 6, 8, 10, 14]]],
  latin: [
    [[0, 6, 8, 14], [0, 3, 6, 10, 12], eights],
    [[2, 6, 10, 14], [2, 4, 8, 11, 14], eights],
  ],
  jazz: [
    fromListen('jazz'),
    [
      [0, 10],
      [2, 7, 12],
      [0, 4, 6, 8, 12, 14],
    ],
  ],
  pop: [
    [[0, 4, 8, 12], [4, 12], eights],
    [
      [0, 4, 7, 8, 12, 15],
      [4, 12],
      [2, 6, 10, 14],
    ],
  ],
  metal: [
    [[0, 2, 3, 6, 8, 10, 11, 14, 15], [4, 12], eights],
    [sixteenths, [4, 12], [0, 4, 8, 12]],
  ],
};
const otherMeters: Record<Exclude<DrumMeter, '4/4'>, Partial<Record<DrumGenre, Variations>>> = {
  '3/4': {
    rock: [
      [[0, 8], [4], [0, 2, 4, 6, 8, 10]],
      [
        [0, 6, 10],
        [4, 8],
        [0, 2, 4, 6, 8, 10],
      ],
    ],
    jazz: [
      [[0], [4, 8], [0, 4, 6, 8, 10]],
      [
        [0, 6],
        [2, 8],
        [0, 2, 4, 6, 8],
      ],
    ],
    pop: [
      [
        [0, 4, 8],
        [4, 8],
        [2, 6, 10],
      ],
      [
        [0, 4, 7, 8],
        [4, 8],
        [0, 2, 4, 6, 8, 10],
      ],
    ],
  },
  '6/8': {
    rock: [
      [[0], [6], [0, 2, 4, 6, 8, 10]],
      [[0, 4, 10], [6], [0, 2, 4, 6, 8, 10]],
    ],
    pop: [
      [[0, 4], [6], [0, 2, 4, 6, 8, 10]],
      [
        [0, 3, 8],
        [6, 10],
        [0, 4, 6, 10],
      ],
    ],
    metal: [
      [[0, 2, 3, 8, 10, 11], [6], [0, 2, 4, 6, 8, 10]],
      [[0, 1, 2, 3, 4, 5, 9, 10, 11], [6], [0, 4, 6, 10]],
    ],
  },
  '12/8': {
    blues: [
      [
        [0, 12],
        [6, 18],
        [0, 4, 6, 10, 12, 16, 18, 22],
      ],
      [
        [0, 4, 12, 16, 22],
        [6, 18],
        [0, 4, 6, 10, 12, 16, 18, 22],
      ],
    ],
  },
};
const meters = {
  '4/4': { steps: 16, stepsPerPulse: 4 },
  '3/4': { steps: 12, stepsPerPulse: 4 },
  '6/8': { steps: 12, stepsPerPulse: 6 },
  '12/8': { steps: 24, stepsPerPulse: 6 },
} as const;

export function drumMeters(genre: DrumGenre): DrumMeter[] {
  return [
    '4/4',
    ...(Object.keys(otherMeters) as (keyof typeof otherMeters)[]).filter(
      (meter) => otherMeters[meter][genre],
    ),
  ];
}

export const defaultSwing = (genre: DrumGenre, meter: DrumMeter) =>
  meters[meter].stepsPerPulse === 4 && (genre === 'jazz' || genre === 'blues') ? 60 : 0;

export const defaultGroove: Groove = {
  genre: 'rock',
  variation: 'A',
  bpm: 90,
  meter: '4/4',
  swing: 0,
};

export function grooveVariation(
  { variation, fillEvery }: Pick<Groove, 'variation' | 'fillEvery'>,
  bar: number,
): DrumVariation {
  return fillEvery && (bar + 1) % fillEvery === 0 ? 'fill' : variation;
}

/** Positions use the metrical pulse: a quarter in simple meters, a dotted quarter in compound. */
export function drumBar({
  genre,
  meter,
  swing,
  variation,
}: Pick<Groove, 'genre' | 'meter' | 'swing' | 'variation'>): DrumStep[] {
  const patterns = meter === '4/4' ? fourFour[genre] : otherMeters[meter][genre];
  if (!patterns) throw new Error('Compás no disponible para este género.');
  const { steps, stepsPerPulse } = meters[meter];
  const compound = stepsPerPulse === 6;
  const subdivision = !compound && (genre === 'jazz' || genre === 'blues') ? 2 : 1;
  const displacement = (Math.min(60, Math.max(0, swing || 0)) / 60) * (subdivision / 3);
  const pattern = patterns[variation === 'B' ? 1 : 0];
  const fillStart = steps - stepsPerPulse;
  const cymbal = genre === 'jazz' ? 'ride' : 'hat';
  return Array.from({ length: steps }, (_, i) => {
    const accent = i % stepsPerPulse === 0;
    const fill = variation === 'fill' && i >= fillStart;
    const hits: DrumHit[] = [];
    if (pattern[0].includes(i) && (!fill || i === fillStart))
      hits.push({ drum: 'kick', accent, velocity: genre === 'jazz' ? 0.4 : 1 });
    if (fill || pattern[1].includes(i)) {
      const ghost = (genre === 'funk' || genre === 'reggae') && i % 4 !== 0;
      hits.push({
        drum: 'snare',
        accent,
        velocity: fill && (i - fillStart) % 2 === 1 ? 0.55 : ghost ? 0.45 : 1,
      });
    }
    if (!fill && pattern[2].includes(i)) hits.push({ drum: cymbal, accent, velocity: 1 });
    const swung = Math.floor(i / subdivision) % 2 === 1;
    return { pulse: (i + (swung ? displacement : 0)) / stepsPerPulse, hits };
  });
}

export const pulsesPerBar = (meter: DrumMeter) => meters[meter].steps / meters[meter].stepsPerPulse;

/** Tap intervals are averaged across at most four pulses. */
export function tapTempo(previous: readonly number[], now: number) {
  const last = previous.at(-1);
  const taps =
    last !== undefined && now > last && now - last <= 1500 ? [...previous.slice(-4), now] : [now];
  const bpm =
    taps.length > 1
      ? Math.min(240, Math.max(40, Math.round((60_000 * (taps.length - 1)) / (now - taps[0]!))))
      : undefined;
  return { taps, bpm };
}
