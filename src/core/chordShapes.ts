import type { Instrument } from './instrument';
import type { Nomenclature } from './notation';
import type { BassScale } from './profile';
import { dictionaryArpeggios, namedTones, positionsFor, type TheoryPosition } from './theory';

export type ChordQuality = keyof typeof dictionaryArpeggios;
export type ChordShape = {
  kind: 'open' | 'box' | 'twoOctaves';
  notes: TheoryPosition[];
  firstFret: number;
  lastFret: number;
  /** Index of the octave root where a change of hand position may be needed. */
  splitAt?: number;
};

export const chordRoots = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;
const enharmonicRoots = ['B#', 'C#', 'D', 'D#', 'Fb', 'E#', 'Gb', 'G', 'G#', 'A', 'A#', 'Cb'];
export type ChordRoot = (typeof chordRoots)[number];
const pc = (midi: number) => ((midi % 12) + 12) % 12;

type Path = { notes: TheoryPosition[]; cost: number };
function bestPath(
  positions: TheoryPosition[],
  pitches: number[],
  requireOpen: boolean,
): Path | undefined {
  let paths: Path[] = [{ notes: [], cost: 0 }];
  for (const pitch of pitches) {
    const next: Path[] = [];
    for (const position of positions) {
      if (position.midi !== pitch) continue;
      // Keep the best path to each position for each open-string state.
      let withOpen: Path | undefined;
      let withoutOpen: Path | undefined;
      for (const path of paths) {
        const previous = path.notes.at(-1);
        const cost =
          path.cost +
          (previous
            ? Math.abs(position.fret - previous.fret) +
              2 * Math.abs(position.string - previous.string)
            : 0);
        if (position.fret === 0 || path.notes.some((note) => note.fret === 0)) {
          if (!withOpen || cost < withOpen.cost)
            withOpen = { notes: [...path.notes, position], cost };
        } else if (!withoutOpen || cost < withoutOpen.cost) {
          withoutOpen = { notes: [...path.notes, position], cost };
        }
      }
      if (withOpen) next.push(withOpen);
      if (withoutOpen) next.push(withoutOpen);
    }
    paths = next;
  }
  return paths
    .filter((path) => !requireOpen || path.notes.some((note) => note.fret === 0))
    .sort((a, b) => a.cost - b.cost)[0];
}

function shape(kind: ChordShape['kind'], notes: TheoryPosition[]): ChordShape {
  return {
    kind,
    notes,
    firstFret: Math.min(...notes.map((note) => note.fret)),
    lastFret: Math.max(...notes.map((note) => note.fret)),
  };
}

/** Maximum physical span of five adjacent frets on a 34-inch scale at the nut. */
export function chordBoxWidth(scale: BassScale, firstFret: number) {
  return scale * 2 ** (-(firstFret - 1) / 12) <= 34 ? 5 : 4;
}

/** Open and fretted shapes use ascending pitch classes from the root.
 * Two-octave arpeggios close on the root two octaves above. The compound degrees retain
 * their names in both shapes, even when folded into the first octave for fingering.
 */
export function chordShapes(
  root: ChordRoot,
  quality: ChordQuality,
  instrument: Instrument,
  scale: BassScale,
  nomenclature: Nomenclature = 'latin',
) {
  const pattern = dictionaryArpeggios[quality];
  let spelling = root as string;
  let positions: TheoryPosition[];
  try {
    positions = positionsFor(spelling, pattern, instrument, undefined, nomenclature);
  } catch (error) {
    if (!(error instanceof RangeError) || !error.message.includes('alteraciones')) throw error;
    spelling = enharmonicRoots[chordRoots.indexOf(root)]!;
    positions = positionsFor(spelling, pattern, instrument, undefined, nomenclature);
  }

  const legend = namedTones(spelling, pattern, nomenclature);
  const intervals = [...new Set(pattern.tones.map((tone) => pc(tone.semitones)))].sort(
    (a, b) => a - b,
  );
  const roots = [
    ...new Set(positions.filter((position) => position.isRoot).map((p) => p.midi)),
  ].sort((a, b) => a - b);
  const openPositions = positions.filter((p) => p.fret <= chordBoxWidth(scale, 1));
  let open: Path | undefined;
  for (const midi of roots) {
    open = bestPath(
      openPositions,
      intervals.map((n) => midi + n),
      true,
    );
    if (open) break;
  }

  // Prefer four adjacent frets. A wider box is available where the scale permits it.
  const frettedWindows = [4, 5].flatMap((width) =>
    Array.from({ length: instrument.frets }, (_, i) => i + 1)
      .filter((first) => chordBoxWidth(scale, first) >= width)
      .map((first) => positions.filter((p) => p.fret >= first && p.fret < first + width)),
  );
  const windows = [openPositions, ...frettedWindows];

  const boxes: ChordShape[] = [];
  for (const window of frettedWindows) {
    for (const midi of roots) {
      const path = bestPath(
        window,
        intervals.map((n) => midi + n),
        false,
      );
      if (!path) continue;
      const candidate = shape('box', path.notes);
      if (
        boxes.every(
          (box) => box.lastFret < candidate.firstFret || candidate.lastFret < box.firstFret,
        )
      ) {
        boxes.push(candidate);
      }
      if (boxes.length === 2) break;
    }
    if (boxes.length === 2) break;
  }

  let twoOctaves: ChordShape | undefined;
  for (const midi of roots) {
    const low = intervals.map((n) => midi + n);
    const high = [...low.map((n) => n + 12), midi + 24];
    if (high.at(-1)! > instrument.strings.at(-1)! + instrument.frets) break;
    for (const window of windows) {
      const path = bestPath(window, [...low, ...high], false);
      if (path) {
        twoOctaves = shape('twoOctaves', path.notes);
        break;
      }
    }
    if (!twoOctaves) {
      // If the full arpeggio does not fit one position, shift at the octave root.
      const lower = windows
        .map((window) => bestPath(window, low, false))
        .filter((path) => path !== undefined);
      const upper = windows
        .map((window) => bestPath(window, high, false))
        .filter((path) => path !== undefined);
      const best = lower
        .flatMap((a) =>
          upper.map((b) => {
            const before = a.notes.at(-1)!;
            const after = b.notes[0]!;
            return {
              notes: [...a.notes, ...b.notes],
              cost:
                a.cost +
                b.cost +
                2 * Math.abs(after.fret - before.fret) +
                Math.abs(after.string - before.string),
            };
          }),
        )
        .sort((a, b) => a.cost - b.cost)[0];
      if (best) twoOctaves = { ...shape('twoOctaves', best.notes), splitAt: low.length };
    }
    if (twoOctaves) break;
  }

  const shapes = [
    ...(open ? [shape('open', open.notes)] : []),
    ...boxes.slice(0, open && twoOctaves ? 1 : 2),
  ];
  if (twoOctaves) shapes.push(twoOctaves);
  return { spelling, legend, shapes };
}
