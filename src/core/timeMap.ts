import { measureMeter } from './score';
import type { MusicalPosition, Score, TimeMap } from './scoreTypes';
export type { MusicalPosition, TimeMap } from './scoreTypes';
const validTime = (n: number) => Number.isFinite(n) && n >= 0;
export const emptyTimeMap = (): TimeMap => ({ measures: [], beats: [] });
function add(map: TimeMap, kind: 'measures' | 'beats', time: number): TimeMap {
  if (!validTime(time) || map[kind].some((t) => Math.abs(t - time) < 0.05 - 1e-10)) return map;
  return { ...map, [kind]: [...map[kind], time].sort((a, b) => a - b) };
}
export const addMeasureMarker = (map: TimeMap, time: number) => add(map, 'measures', time);
export const addBeatMarker = (map: TimeMap, time: number) => add(map, 'beats', time);
export function removeMarkerNear(map: TimeMap, time: number, tolerance = 0.15): TimeMap {
  if (!validTime(time) || !validTime(tolerance)) return map;
  let distance = Infinity,
    index = -1,
    kind: 'measures' | 'beats' = 'measures';
  for (const k of ['measures', 'beats'] as const)
    map[k].forEach((t, i) => {
      const d = Math.abs(t - time);
      if (d <= tolerance + 1e-10 && d < distance) {
        distance = d;
        index = i;
        kind = k;
      }
    });
  return index < 0 ? map : { ...map, [kind]: map[kind].filter((_, i) => i !== index) };
}
export function moveMeasureMarker(map: TimeMap, index: number, time: number): TimeMap {
  if (!validTime(time) || !Number.isInteger(index) || index < 0 || index >= map.measures.length)
    return map;
  const low = index ? map.measures[index - 1]! + 0.05 : 0;
  const high = index + 1 < map.measures.length ? map.measures[index + 1]! - 0.05 : Infinity;
  const value = Math.max(low, Math.min(high, time));
  return { ...map, measures: map.measures.map((t, i) => (i === index ? value : t)) };
}
export function measureSpan(
  map: TimeMap,
  index: number,
  duration: number,
): { start: number; end: number } | null {
  if (!validTime(duration) || !Number.isInteger(index) || index < 0) return null;
  const start = map.measures[index];
  if (start === undefined || start >= duration) return null;
  const next = map.measures[index + 1];
  const previous = map.measures[index - 1];
  // A lone marker has no prior tempo: the remaining audio is its span.
  const end = Math.min(
    duration,
    next ?? (previous === undefined ? duration : start + start - previous),
  );
  return end > start ? { start, end } : null;
}
/** Manual taps describe successive interior pulses. With a partial set, assign
 * each to a distinct nearest nominal pulse, then interpolate the missing ones.
 * A complete set naturally becomes pulse 1, 2, … even with a very uneven tempo. */
export function beatAnchors(
  map: TimeMap,
  score: Score,
  index: number,
  duration: number,
): { beat: number; time: number }[] | null {
  const span = measureSpan(map, index, duration);
  if (!span || !score.measures[index]) return null;
  const count = measureMeter(score, index).beats;
  const taps = map.beats.filter((t) => t > span.start && t < span.end);
  const anchors = [{ beat: 0, time: span.start }];
  // More taps than metric pulses are harmless: use the earliest fitting taps.
  const interior = taps.slice(0, Math.max(0, count - 1));
  interior.forEach((time, i) => {
    const nominal = Math.round(((time - span.start) / (span.end - span.start)) * count);
    const min = anchors.at(-1)!.beat + 1;
    const max = count - (interior.length - i);
    anchors.push({ beat: Math.max(min, Math.min(max, nominal)), time });
  });
  anchors.push({ beat: count, time: span.end });
  return anchors;
}
export function positionAt(
  map: TimeMap,
  score: Score,
  time: number,
  duration: number,
): MusicalPosition | null {
  if (!validTime(time) || time > duration) return null;
  let index = -1;
  // Upper bound includes exact measure boundaries in the new measure.
  let lo = 0,
    hi = Math.min(map.measures.length, score.measures.length);
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (map.measures[mid]! <= time) lo = mid + 1;
    else hi = mid;
  }
  index = lo - 1;
  if (index > 0 && time === duration && map.measures[index] === duration) index--;
  const anchors = beatAnchors(map, score, index, duration);
  if (!anchors || time > anchors.at(-1)!.time) return null;
  const right = anchors.findIndex((a) => a.time > time);
  if (right < 0) return { measure: index, beat: anchors.at(-1)!.beat };
  const a = anchors[right - 1]!,
    b = anchors[right]!;
  return {
    measure: index,
    beat: a.beat + ((time - a.time) / (b.time - a.time)) * (b.beat - a.beat),
  };
}
export function timeAt(
  map: TimeMap,
  score: Score,
  position: MusicalPosition,
  duration: number,
): number | null {
  const anchors = beatAnchors(map, score, position.measure, duration);
  if (!anchors || !validTime(position.beat) || position.beat > anchors.at(-1)!.beat) return null;
  const right = anchors.findIndex((a) => a.beat > position.beat);
  if (right < 0) return anchors.at(-1)!.time;
  const a = anchors[right - 1]!,
    b = anchors[right]!;
  return a.time + ((position.beat - a.beat) / (b.beat - a.beat)) * (b.time - a.time);
}
const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >>> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
export function tapTempo(taps: number[]): { bpm: number; interval: number } | null {
  if (taps.length < 3 || taps.some((t) => !validTime(t))) return null;
  const intervals = taps
    .slice(1)
    .map((t, i) => t - taps[i]!)
    .slice(-8);
  if (intervals.some((i) => i <= 0)) return null;
  const mid = median(intervals);
  const filtered = intervals.filter((i) => Math.abs(i - mid) <= mid * 0.25);
  if (!filtered.length) return null;
  const interval = median(filtered);
  return { bpm: 60 / interval, interval };
}
export function generateMeasures(
  map: TimeMap,
  options: { start: number; bpm: number; beatsPerMeasure: number; until: number },
): TimeMap {
  const { start, bpm, beatsPerMeasure, until } = options;
  if (
    !validTime(start) ||
    !validTime(until) ||
    until < start ||
    !Number.isFinite(bpm) ||
    bpm <= 0 ||
    !Number.isInteger(beatsPerMeasure) ||
    beatsPerMeasure < 1
  )
    return map;
  const step = (60 / bpm) * beatsPerMeasure;
  const count = Math.floor((until - start) / step + 1e-9) + 1;
  if (!Number.isFinite(count) || count > 100000) return map;
  const measures = map.measures.filter((t) => t < start - 0.05);
  for (let i = 0; i < count; i++) measures.push(start + i * step);
  return { ...map, measures };
}
export function parseTimeMap(value: unknown): TimeMap | null {
  try {
    if (!value || typeof value !== 'object') return null;
    const m = value as TimeMap;
    const valid = (a: number[]) =>
      Array.isArray(a) &&
      a.length <= 100000 &&
      a.every(
        (t, i) => typeof t === 'number' && validTime(t) && (!i || t - a[i - 1]! >= 0.05 - 1e-10),
      );
    return valid(m.measures) && valid(m.beats)
      ? { measures: [...m.measures], beats: [...m.beats] }
      : null;
  } catch {
    return null;
  }
}
