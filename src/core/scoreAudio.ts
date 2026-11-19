import { positionsOf, type Instrument } from './instrument';
import { addF, durationValue, fraction, measureMeter } from './score';
import type { Score, TimeMap } from './scoreTypes';
import { beatAnchors, timeAtBeat } from './timeMap';

export function pianoPosition(instrument: Instrument, midi: number, preference: 'low' | 'high') {
  return positionsOf(instrument, midi).sort((a, b) =>
    preference === 'low' ? a.fret - b.fret : b.fret - a.fret,
  )[0];
}

export type TimedEvent = {
  id: string;
  measure: number;
  event: number;
  start: number;
  end: number;
  midi?: number;
  tie?: boolean;
};
export function scoreTimeline(
  score: Score,
  map: TimeMap,
  duration: number,
  instrument: Instrument,
): TimedEvent[] {
  return score.measures.flatMap((bar, measure) => {
    const anchors = beatAnchors(map, score, measure, duration);
    if (!anchors) return [];
    const meter = measureMeter(score, measure);
    // Legacy overfull bars stop at the next bar line.
    const at = (beat: number) => timeAtBeat(anchors, Math.min(meter.beats, beat))!;
    let offset = fraction(0, 1);
    return bar.events.flatMap((e, event) => {
      const start = at((offset.n * meter.unit) / offset.d);
      offset = addF(offset, durationValue(e.duration));
      const end = at((offset.n * meter.unit) / offset.d);
      const open = e.note && instrument.strings[e.note.string];
      return end > start
        ? [
            {
              id: e.id,
              measure,
              event,
              start,
              end,
              midi: open !== undefined && e.note ? open + e.note.fret : undefined,
              tie: e.tie,
            },
          ]
        : [];
    });
  });
}
export type Tone = { start: number; end: number; midi: number };
export function synthTones(events: TimedEvent[]): Tone[] {
  const notes: Tone[] = [];
  let tied = false;
  for (const e of events) {
    const prev = notes.at(-1);
    if (e.midi !== undefined) {
      if (tied && prev?.midi === e.midi && Math.abs(prev.end - e.start) < 1e-7) prev.end = e.end;
      else notes.push({ midi: e.midi, start: e.start, end: e.end });
    }
    tied = !!e.tie;
  }
  return notes;
}
// Project a window of media time onto the AudioContext clock, including a note
// already sounding after a seek. Entries are ordered and monophonic.
export function scheduleTones(
  tones: Tone[],
  from: number,
  to: number,
  rate: number,
  clock: number,
  stop: number,
) {
  let lo = 0,
    hi = tones.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (tones[mid]!.end <= from) lo = mid + 1;
    else hi = mid;
  }
  const result = [];
  for (let i = lo; i < tones.length; i++) {
    const tone = tones[i]!;
    if (tone.start >= Math.min(to, stop)) break;
    result.push({
      midi: tone.midi,
      when: clock + Math.max(0, tone.start - from) / rate,
      until: clock + (Math.min(stop, tone.end) - from) / rate,
      id: i,
    });
  }
  return result;
}
