import { noteAt, positionsOf, type Instrument, type Position } from '../core/instrument';
import { midiSpelling, type ScoreNote } from '../core/notation';
import type { Level } from '../core/profile';

type Articulation = 'i' | 'm' | 'P' | 'T' | '×';
type Step = Position & { articulation?: Articulation };
type Technique = {
  title: string;
  description: string;
  level: Level;
  bpm: number;
  pattern: (instrument: Instrument) => Step[];
};

const line = (string: number, frets: number[]): Step[] => frets.map((fret) => ({ string, fret }));
const step = (string: number, fret: number, articulation?: Articulation): Step => ({
  string,
  fret,
  articulation,
});

function octaves(instrument: Instrument, slap = false): Step[] {
  return [2, 4, 3, 5].flatMap((fret, i) => {
    const string = i % Math.max(1, instrument.strings.length - 2);
    const midi = noteAt(instrument, string, fret);
    const choices = positionsOf(instrument, midi + 12);
    const octave = choices.find((p) => p.string === string + 2) ?? choices.at(-1);
    if (!octave) return [];
    return [
      step(string, fret, slap ? 'T' : undefined),
      step(octave.string, octave.fret, slap ? 'P' : undefined),
    ];
  });
}

export const techniques = {
  chromatic: {
    title: 'Cromático 1–2–3–4',
    description:
      'Usa un dedo por traste. Sube en la cuerda grave y vuelve en la siguiente sin apretar de más.',
    level: 'beginner',
    bpm: 60,
    pattern: () => [...line(0, [5, 6, 7, 8]), ...line(1, [8, 7, 6, 5])],
  },
  permutations: {
    title: 'Permutaciones 1–3–2–4 y 2–4–1–3',
    description:
      'Toca 1–3–2–4 en una cuerda y 2–4–1–3 en la siguiente. Mantén los dedos cerca del diapasón.',
    level: 'intermediate',
    bpm: 54,
    pattern: () => [...line(0, [5, 7, 6, 8]), ...line(1, [6, 8, 5, 7])],
  },
  stringSkips: {
    title: 'Saltos de cuerda',
    description:
      'Salta una cuerda en cada cruce. Apaga la nota anterior antes de que suene la siguiente.',
    level: 'intermediate',
    bpm: 64,
    pattern: (instrument) =>
      [0, 2, 0, 2, 1, 3, 1, 3].map((s, i) =>
        step(Math.min(s, instrument.strings.length - 1), 5 + (i % 4)),
      ),
  },
  spider: {
    title: 'Araña',
    description:
      'Reparte los cuatro dedos entre dos cuerdas. Deja cerca del mástil los dedos que esperan.',
    level: 'intermediate',
    bpm: 52,
    pattern: () => [
      step(0, 5),
      step(1, 6),
      step(0, 7),
      step(1, 8),
      step(1, 5),
      step(0, 6),
      step(1, 7),
      step(0, 8),
    ],
  },
  rake: {
    title: 'Muteo y rastrillo',
    description:
      'Vuelve de agudo a grave con el mismo dedo de ataque. Apaga con la mano del mástil las cuerdas marcadas con ×.',
    level: 'intermediate',
    bpm: 56,
    pattern: () => [
      step(3, 5, 'i'),
      step(2, 5, '×'),
      step(1, 5, '×'),
      step(0, 5, 'i'),
      step(3, 7, 'm'),
      step(2, 7, '×'),
      step(1, 7, '×'),
      step(0, 7, 'm'),
    ],
  },
  alternating: {
    title: 'Alternancia de dedos',
    description:
      'Alterna índice (i) y medio (m) con el mismo volumen, también al cambiar de cuerda.',
    level: 'beginner',
    bpm: 68,
    pattern: () => [0, 0, 0, 1, 1, 1, 0, 0].map((s, i) => step(s, 5, i % 2 ? 'm' : 'i')),
  },
  octaves: {
    title: 'Octavas',
    description: 'Toca cada nota grave y su octava. Controla el apagado en el salto de vuelta.',
    level: 'beginner',
    bpm: 60,
    pattern: (instrument) => octaves(instrument),
  },
  slap: {
    title: 'Slap básico',
    description:
      'Golpea la grave con el pulgar (T) y tira de la aguda con el índice (P, pop). Empieza con poco recorrido.',
    level: 'intermediate',
    bpm: 52,
    pattern: (instrument) => octaves(instrument, true),
  },
  ghosts: {
    title: 'Notas fantasma',
    description:
      'Roza la cuerda sin apretarla en las notas marcadas con ×. Mantén el pulso al pasar de nota a ruido.',
    level: 'beginner',
    bpm: 62,
    pattern: () => [
      step(0, 5),
      step(0, 5, '×'),
      step(0, 5, '×'),
      step(1, 7),
      step(1, 7, '×'),
      step(0, 5),
      step(0, 5, '×'),
      step(0, 7),
    ],
  },
} satisfies Record<string, Technique>;

export type TechniqueId = keyof typeof techniques;
export type TechniqueNote = ScoreNote & { articulation?: Articulation };

export function techniqueTab(id: TechniqueId, instrument: Instrument): TechniqueNote[] {
  return techniques[id].pattern(instrument).map(({ string, fret, articulation }) => {
    const midi = noteAt(instrument, string, fret);
    return { midi, spelling: midiSpelling(midi), position: { string, fret }, articulation };
  });
}

export const techniqueWarmups: Record<Level, readonly TechniqueId[]> = {
  beginner: ['chromatic', 'alternating', 'octaves'],
  intermediate: ['chromatic', 'permutations', 'spider'],
  advanced: ['stringSkips', 'rake', 'slap'],
};
