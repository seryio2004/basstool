import { expectedHits } from './music';
import { parsePitch } from './notation';
import { analyseHits } from './rhythm';
import { arpeggios, majorTriads, type TheoryPattern } from './theory';

const suffixes = {
  '': 'major',
  m: 'minor',
  dim: 'diminished',
  aug: 'augmented',
  sus2: 'sus2',
  sus4: 'sus4',
  '7': 'dominant7',
  maj7: 'major7',
  m7: 'minor7',
  m7b5: 'halfDiminished7',
  dim7: 'diminished7',
  mMaj7: 'minorMajor7',
  augMaj7: 'augmentedMajor7',
} as const satisfies Record<string, keyof typeof arpeggios>;

export type Chord = { symbol: string; tonic: string; root: number; arpeggio: TheoryPattern };
export type RhythmInput = 'manual' | 'mic';
export type RhythmHit = { t: number; midi?: number | null };

const pitchClass = (midi: number) => ((midi % 12) + 12) % 12;

export function parseTrainChord(text: string): Chord | null {
  const normalized = text.replaceAll('♭', 'b').replaceAll('♯', '#').replace(/°/g, 'dim');
  const match = /^(Do|Re|Mi|Fa|Sol|La|Si|[A-G])([#b]?)(.*)$/.exec(normalized);
  if (!match) return null;
  const [, name, accidental, suffix] = match;
  if (!Object.hasOwn(suffixes, suffix!)) return null;
  const latin = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'].indexOf(name!);
  const tonic = (latin < 0 ? name : 'CDEFGAB'[latin]) + accidental!;
  return {
    symbol: tonic + suffix,
    tonic,
    root: pitchClass(parsePitch(tonic + '4').midi),
    arpeggio: arpeggios[suffixes[suffix as keyof typeof suffixes]],
  };
}

export function manualTrainChords(text: string): Chord[] | null {
  const symbols = text
    .trim()
    .split(/[\s,|]+/)
    .filter(Boolean);
  if (!symbols.length || symbols.length > 16) return null;
  const chords = symbols.map(parseTrainChord);
  return chords.every((chord) => chord !== null)
    ? Array.from({ length: 16 }, (_, i) => chords[i % chords.length]!)
    : null;
}

export function tonalTrainChords(tonic: string, progression: string): Chord[] {
  const degrees = progression.split(',').map(Number);
  const triads = majorTriads(parsePitch(tonic + '4').midi, progression);
  const chords = triads.map(({ root, quality }, index) => {
    const degree = degrees[index]!;
    const letter = 'CDEFGAB'[('CDEFGAB'.indexOf(tonic[0]!) + degree) % 7]!;
    const natural = parsePitch(letter + '4').midi;
    const alteration = pitchClass(root - natural);
    const suffix = quality === 'minor' ? 'm' : quality === 'diminished' ? 'dim' : '';
    return parseTrainChord(
      letter + (alteration === 1 ? '#' : alteration === 11 ? 'b' : '') + suffix,
    )!;
  });
  return chords.flatMap((chord) => Array.from({ length: 4 }, () => chord));
}

export function trainTones(chord: Chord, level: number) {
  const { tones } = chord.arpeggio;
  return level === 1
    ? tones.slice(0, 1)
    : level === 2
      ? tones.filter((tone) => tone.degree === 1 || tone.degree === 5)
      : tones;
}

/**
 * Ordered levels continue across adjacent cells of the same chord. Free mode
 * accepts any chord tone on each written onset. Octave is always the player's choice.
 */
export function trainTargets(
  pattern: number[],
  bpm: number,
  chords?: Chord[] | null,
  level = 1,
): TrainTarget[] {
  let position = 0;
  let previous: Chord | undefined;
  return expectedHits(pattern, bpm).map((note) => {
    const chord = chords?.[note.block];
    if (!chord) return note;
    if (chord.symbol !== previous?.symbol) position = 0;
    previous = chord;
    const tones = trainTones(chord, level);
    const allowed = level === 4 ? tones : [tones[position++ % tones.length]!];
    return { ...note, pitches: allowed.map(({ semitones }) => pitchClass(chord.root + semitones)) };
  });
}

export type TrainTarget = { t: number; block: number; pitches?: number[] };

export function scoreTrain(
  expected: TrainTarget[],
  hits: RhythmHit[],
  tolerance: number,
  beat: number,
  checkPitch: boolean,
) {
  const { matched } = analyseHits(
    expected,
    hits.map(({ t }) => t),
    tolerance,
    beat,
  );
  const correct = matched.filter(({ e, h }) => {
    const pitches = expected[e]!.pitches;
    const midi = hits[h]!.midi;
    return !checkPitch || !pitches || (midi != null && pitches.includes(pitchClass(midi)));
  }).length;
  return {
    correct,
    total: Math.max(expected.length, hits.length),
    missed: expected.length - matched.length,
    extras: hits.length - matched.length,
    wrongPitch: matched.length - correct,
    bias: matched.length
      ? Math.round((matched.reduce((sum, hit) => sum + hit.delta, 0) * 1000) / matched.length) + 0
      : null,
  };
}
