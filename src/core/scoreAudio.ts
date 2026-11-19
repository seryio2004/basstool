import { positionsOf, type Instrument } from './instrument';
import { eventNotes, tiedStrings, addF, durationValue, fraction, measureMeter } from './score';
import type { Measure, Meter, Score, ScoreEvent, TimeMap } from './scoreTypes';
import { beatAnchors, scorePlaybackMap, timeAtBeat } from './timeMap';

export function pianoPosition(
  instrument: Instrument,
  midi: number,
  preference: 'low' | 'high',
  occupied: readonly number[] = [],
) {
  return positionsOf(instrument, midi).sort(
    (a, b) =>
      Number(occupied.includes(a.string)) - Number(occupied.includes(b.string)) ||
      (preference === 'low' ? a.fret - b.fret : b.fret - a.fret),
  )[0];
}

export function noteMidi(event: ScoreEvent, instrument: Instrument): number | undefined {
  return event.technique === 'dead' ? undefined : soundingVoices(event, instrument)[0]?.midi;
}

function soundingVoices(event: ScoreEvent, instrument: Instrument) {
  const ties = tiedStrings(event);
  return eventNotes(event).flatMap((note) => {
    const open = instrument.strings[note.string];
    return open === undefined
      ? []
      : [{ string: note.string, midi: open + note.fret, tie: ties.includes(note.string) }];
  });
}

export function chordSegment(bar: Measure, meter: Meter, beat: number, instrument: Instrument) {
  let start = 0;
  let end = meter.beats;
  for (const chord of bar.chords ?? []) {
    if (chord.beat <= beat) start = Math.max(start, chord.beat);
    else end = Math.min(end, chord.beat);
  }
  let offset = fraction(0, 1);
  const notes = bar.events.flatMap((event) => {
    const from = (offset.n * meter.unit) / offset.d;
    offset = addF(offset, durationValue(event.duration));
    const to = (offset.n * meter.unit) / offset.d;
    return from < end && to > start && event.technique !== 'dead'
      ? soundingVoices(event, instrument).map((v) => v.midi)
      : [];
  });
  return { start, end, notes };
}

export type TimedEvent = {
  id: string;
  measure: number;
  event: number;
  start: number;
  end: number;
  voices?: { string: number; midi: number; tie: boolean }[];
  midi?: number;
  tie?: boolean;
  dead?: boolean;
};
export function scoreTimeline(
  score: Score,
  map: TimeMap,
  duration: number,
  instrument: Instrument,
  bpm?: number,
): TimedEvent[] {
  const playback = scorePlaybackMap(score, map, bpm);
  return score.measures.flatMap((bar, measure) => {
    if ((playback.measures[measure] ?? Infinity) >= duration) return [];
    const anchors = beatAnchors(playback, score, measure, duration);
    if (!anchors) return [];
    const meter = measureMeter(score, measure);
    // Legacy overfull bars stop at the next bar line.
    const at = (beat: number) => timeAtBeat(anchors, Math.min(meter.beats, beat))!;
    let offset = fraction(0, 1);
    return bar.events.flatMap((e, event) => {
      const start = at((offset.n * meter.unit) / offset.d);
      offset = addF(offset, durationValue(e.duration));
      const end = Math.min(duration, at((offset.n * meter.unit) / offset.d));
      if (end <= start) return [];
      const voices = soundingVoices(e, instrument);
      const dead = e.technique === 'dead';
      return [
        {
          id: e.id,
          measure,
          event,
          start,
          end,
          midi: dead ? undefined : voices[0]?.midi,
          tie: e.tie,
          voices,
          ...(dead ? { dead: true } : {}),
        },
      ];
    });
  });
}
export type Tone = { start: number; end: number; midi: number; dead?: boolean };
export const DEAD_NOTE_SECONDS = 0.075;
export function synthTones(events: TimedEvent[]): Tone[] {
  const notes: Tone[] = [];
  let sustained = new Map<number, Tone>();
  for (const e of events) {
    const next = new Map<number, Tone>();
    const voices =
      e.voices ?? (e.midi === undefined ? [] : [{ string: 0, midi: e.midi, tie: e.tie }]);
    for (const v of voices) {
      let tone = sustained.get(v.string);
      if (
        tone?.midi === v.midi &&
        Boolean(tone.dead) === Boolean(e.dead) &&
        Math.abs(tone.end - e.start) < 1e-7
      ) {
        tone.end = e.end;
      } else {
        tone = { midi: v.midi, start: e.start, end: e.end, ...(e.dead ? { dead: true } : {}) };
        notes.push(tone);
      }
      if (v.tie) next.set(v.string, tone);
    }
    sustained = next;
  }
  return notes;
}
// Prefix maxima stay monotonic when a tied voice outlasts later attacks.
export function toneEndIndex(tones: Tone[]): number[] {
  let latest = -Infinity;
  return tones.map((tone) => (latest = Math.max(latest, tone.end)));
}

// Project a window of media time onto the AudioContext clock, including a note
// already sounding after a seek. Simultaneous tones may end in any order.
export function scheduleTones(
  tones: Tone[],
  from: number,
  to: number,
  rate: number,
  clock: number,
  stop: number,
  ends = toneEndIndex(tones),
) {
  let lo = 0,
    hi = ends.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (ends[mid]! <= from) lo = mid + 1;
    else hi = mid;
  }
  const result = [];
  for (let i = lo; i < tones.length; i++) {
    const tone = tones[i]!;
    if (tone.start >= Math.min(to, stop)) break;
    const end = tone.dead ? Math.min(tone.end, tone.start + DEAD_NOTE_SECONDS * rate) : tone.end;
    if (Math.min(stop, end) <= from) continue;
    result.push({
      midi: tone.midi,
      when: clock + Math.max(0, tone.start - from) / rate,
      until: clock + (Math.min(stop, end) - from) / rate,
      id: i,
      ...(tone.dead ? { dead: true as const } : {}),
    });
  }
  return result;
}
