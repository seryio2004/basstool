import { exampleTimeline, LessonExample } from './course';
import { midiOf } from './notation';

// Lesson diagrams are data. Each kind is drawn by src/components/harmony/LessonDiagram.tsx.
// Steps are what the learner moves through, by hand or while the example sounds.

export type HarmonicFunction = 'T' | 'S' | 'D';
export const functionNames: Record<HarmonicFunction, string> = {
  T: 'Tónica',
  S: 'Subdominante',
  D: 'Dominante',
};

export type StaffNoteRole = 'chord' | 'passing' | 'added' | 'melody';
export type StaffColumn = {
  notes: string[]; // spelled pitches, low to high
  label: string;
  caption: string;
  roles?: Partial<Record<string, StaffNoteRole>>; // by spelling
  marks?: Partial<Record<string, string>>; // small text next to a notehead, by spelling
};
export type KeyboardStep = {
  notes: string[]; // sounding / highlighted keys
  context?: string[]; // keys shown as the surrounding collection
  label: string;
  caption: string;
};
export type RhythmEvent = {
  at: number; // in beats from the row start
  dur: number;
  midi?: number[];
  accent?: boolean;
  tieFrom?: boolean; // continues the previous event without a new attack
  volume?: number; // 0–1 relative intensity
  label?: string;
};
export type RhythmRow = {
  label: string;
  beats: number;
  beatGroups?: number[];
  events: RhythmEvent[];
};
export type ProgressionChord = {
  label: string;
  numeral: string;
  func?: HarmonicFunction;
  beats: number;
  notes: string[];
  chromatic?: string; // spelled note that leaves the key
};
export type ProgressionRow = { label: string; beatsPerBar: number; chords: ProgressionChord[] };
export type FunctionChord = {
  label: string;
  numeral: string;
  func: HarmonicFunction | 'Dsec';
  caption: string;
};
export type FormSection = { name: string; ending?: number };

export type LessonDiagram = { title: string; summary: string } & (
  | { kind: 'staff'; columns: StaffColumn[]; voiceLeading?: boolean; contour?: boolean }
  | {
      kind: 'keyboard';
      from: number;
      to: number;
      steps: KeyboardStep[];
      showSteps?: boolean; // T / S arcs between consecutive highlighted keys
      countSemitones?: boolean;
    }
  | {
      kind: 'rhythm';
      rows: RhythmRow[];
      pulse?: boolean; // audible click on each pulse (or beat group)
      beatSeconds?: number; // overrides the course reference tempo
      captions: string[];
    }
  | { kind: 'progression'; rows: ProgressionRow[]; captions: string[] }
  | { kind: 'functions'; chords: FunctionChord[] }
  | { kind: 'fifths'; selected: string; path?: string[]; caption?: string }
  | { kind: 'form'; written: FormSection[]; order: number[]; captions: string[] }
);

export type TimelineEvent = {
  at: number; // seconds
  duration: number;
  notes: number[];
  volume: number;
  step: number;
};
export type DiagramTimeline = {
  events: TimelineEvent[];
  clicks: { at: number; accent: boolean }[];
  steps: { at: number; duration: number }[];
  total: number;
  audible: boolean;
};

/** Pulse positions in beats: one per beat, or the start of each beat group. */
export function pulsesOf(row: RhythmRow): number[] {
  if (!row.beatGroups) return Array.from({ length: row.beats }, (_, b) => b);
  let at = 0;
  return row.beatGroups.map((size) => {
    const start = at;
    at += size;
    return start;
  });
}

/** Number of steps a learner can move through in a diagram. */
export function diagramSteps(diagram: LessonDiagram): number {
  switch (diagram.kind) {
    case 'staff':
      return diagram.columns.length;
    case 'keyboard':
      return diagram.steps.length;
    case 'rhythm':
      return diagram.rows.reduce((n, row) => n + row.events.length, 0);
    case 'progression':
      return diagram.rows.reduce((n, row) => n + row.chords.length, 0);
    case 'functions':
      return diagram.chords.length;
    case 'fifths':
      return diagram.path ? 1 : 12;
    case 'form':
      return diagram.order.length;
  }
}

/** Caption for a step; rhythm and progression captions are per row. */
export function stepCaption(diagram: LessonDiagram, step: number): string {
  switch (diagram.kind) {
    case 'staff':
      return diagram.columns[step]?.caption ?? '';
    case 'keyboard':
      return diagram.steps[step]?.caption ?? '';
    case 'functions':
      return diagram.chords[step]?.caption ?? '';
    case 'form':
      return diagram.captions[step] ?? '';
    case 'rhythm':
    case 'progression': {
      const { row } = rowOfStep(diagram, step);
      return diagram.captions[row] ?? '';
    }
    case 'fifths':
      return diagram.caption ?? '';
  }
}

export function rowOfStep(
  diagram: Extract<LessonDiagram, { kind: 'rhythm' | 'progression' }>,
  step: number,
) {
  const sizes =
    diagram.kind === 'rhythm'
      ? diagram.rows.map((r) => r.events.length)
      : diagram.rows.map((r) => r.chords.length);
  let row = 0,
    index = step;
  while (row < sizes.length - 1 && index >= sizes[row]!) index -= sizes[row++]!;
  return { row, index };
}

/**
 * Sound and step schedule. Diagrams that carry their own rhythm or chords
 * (rhythm, progression) are played from that data; staff, keyboard and
 * function diagrams follow the lesson example, one step per sounding event.
 * Form diagrams are silent and advance one section at a time.
 */
export function diagramTimeline(
  diagram: LessonDiagram,
  example: LessonExample,
  secondsPerBeat = 0.75,
): DiagramTimeline {
  const events: TimelineEvent[] = [],
    clicks: DiagramTimeline['clicks'] = [];
  let total = 0;
  if (diagram.kind === 'rhythm' && diagram.beatSeconds) secondsPerBeat = diagram.beatSeconds;
  if (diagram.kind === 'rhythm' || diagram.kind === 'progression') {
    const gap = 1; // beats of silence between compared rows
    let offset = 0,
      step = 0;
    diagram.rows.forEach((row, r) => {
      if (diagram.kind === 'rhythm') {
        const rhythmRow = row as RhythmRow;
        rhythmRow.events.forEach((e) =>
          events.push({
            at: (offset + e.at) * secondsPerBeat,
            duration: e.dur * secondsPerBeat,
            notes: e.tieFrom ? [] : e.midi || [72],
            volume: e.volume ?? (e.accent ? 1 : 0.6),
            step: step++,
          }),
        );
        if (diagram.pulse)
          pulsesOf(rhythmRow).forEach((b, i) =>
            clicks.push({ at: (offset + b) * secondsPerBeat, accent: i === 0 }),
          );
        offset += rhythmRow.beats;
      } else {
        let at = 0;
        (row as ProgressionRow).chords.forEach((c) => {
          events.push({
            at: (offset + at) * secondsPerBeat,
            duration: c.beats * secondsPerBeat,
            notes: c.notes.map(midiOf),
            volume: 0.7,
            step: step++,
          });
          at += c.beats;
        });
        offset += at;
      }
      if (r < diagram.rows.length - 1) offset += gap;
    });
    total = offset * secondsPerBeat;
  } else if (diagram.kind === 'form') {
    const each = 1.4;
    diagram.order.forEach((_, i) =>
      events.push({ at: i * each, duration: each, notes: [], volume: 0, step: i }),
    );
    total = diagram.order.length * each;
  } else if (diagram.kind !== 'fifths') {
    exampleTimeline(example, secondsPerBeat).forEach((e, i) =>
      events.push({ ...e, volume: 0.7, step: i }),
    );
    total = events.reduce((end, e) => Math.max(end, e.at + e.duration), 0);
  }
  const steps: DiagramTimeline['steps'] = [];
  for (const e of events) {
    const current = steps[e.step];
    if (!current) steps[e.step] = { at: e.at, duration: e.duration };
  }
  return {
    events,
    clicks,
    steps,
    total,
    audible: events.some((e) => e.notes.length > 0),
  };
}
