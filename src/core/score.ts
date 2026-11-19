import { noteAt, validateInstrument, type Instrument } from './instrument';
import type {
  Duration,
  EditCursor,
  Fraction,
  Measure,
  MeasureFill,
  Meter,
  Score,
  ScoreEvent,
  Technique,
} from './scoreTypes';
export type {
  Duration,
  EditCursor,
  Fraction,
  Measure,
  MeasureFill,
  Meter,
  Score,
  ScoreEvent,
  Technique,
} from './scoreTypes';

const integer = (n: number) => Number.isSafeInteger(n);
export function fraction(n: number, d: number): Fraction {
  if (!integer(n) || !integer(d) || d <= 0) throw new RangeError('Fracción no válida.');
  let a = Math.abs(n),
    b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / (a || 1), d: d / (a || 1) };
}
export const addF = (a: Fraction, b: Fraction) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
export const subF = (a: Fraction, b: Fraction) => fraction(a.n * b.d - b.n * a.d, a.d * b.d);
export function compareF(a: Fraction, b: Fraction): -1 | 0 | 1 {
  // BigInt avoids loss of precision in cross products of valid safe integers.
  const d = BigInt(a.n) * BigInt(b.d) - BigInt(b.n) * BigInt(a.d);
  return d < 0n ? -1 : d > 0n ? 1 : 0;
}
const validDuration = (d: Duration) =>
  !!d &&
  [1, 2, 4, 8, 16].includes(d.base) &&
  [0, 1].includes(d.dots) &&
  (d.triplet === undefined || typeof d.triplet === 'boolean');
export function durationValue(d: Duration): Fraction {
  if (!validDuration(d)) throw new RangeError('Duración no válida.');
  return fraction(
    (d.dots ? 3 : 1) * (d.triplet ? 2 : 1),
    d.base * (d.dots ? 2 : 1) * (d.triplet ? 3 : 1),
  );
}
const validMeter = (m: Meter) =>
  !!m && integer(m.beats) && m.beats > 0 && m.beats <= 64 && [2, 4, 8].includes(m.unit);
function checkMeter(m: Meter) {
  if (!validMeter(m)) throw new RangeError('Métrica no válida.');
}
function fresh(score: Score, prefix: string): string {
  const ids = new Set(score.measures.flatMap((m) => [m.id, ...m.events.map((e) => e.id)]));
  let n = 1;
  while (ids.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}
function rests(meter: Meter, id: string): ScoreEvent[] {
  let left = fraction(meter.beats, meter.unit);
  const result: ScoreEvent[] = [];
  const values: Duration[] = [1, 2, 4, 8, 16].flatMap(
    (base) =>
      [
        { base, dots: 1 },
        { base, dots: 0 },
      ] as Duration[],
  );
  while (left.n > 0) {
    const duration = values.find((d) => compareF(durationValue(d), left) <= 0)!;
    result.push({ id: `${id}-r${result.length}`, duration });
    left = subF(left, durationValue(duration));
  }
  return result;
}
export function emptyScore(meter: Meter = { beats: 4, unit: 4 }, measures = 4): Score {
  checkMeter(meter);
  if (!integer(measures) || measures < 1) throw new RangeError('Número de compases no válido.');
  return {
    version: 1,
    meter: { ...meter },
    keyFifths: 0,
    measures: Array.from({ length: measures }, (_, i) => ({
      id: `m${i + 1}`,
      events: rests(meter, `m${i + 1}`),
    })),
  };
}
export function measureMeter(score: Score, index: number): Meter {
  for (let i = Math.min(index, score.measures.length - 1); i >= 0; i--)
    if (score.measures[i]!.meter) return score.measures[i]!.meter!;
  return score.meter;
}
export function measureFill(score: Score, index: number): MeasureFill {
  const m = score.measures[index];
  if (!m) throw new RangeError('Compás inexistente.');
  const meter = measureMeter(score, index),
    expected = fraction(meter.beats, meter.unit);
  const actual = m.events.reduce((sum, e) => addF(sum, durationValue(e.duration)), fraction(0, 1));
  const cmp = compareF(actual, expected);
  return {
    expected,
    actual,
    status: !m.events.length ? 'empty' : cmp < 0 ? 'short' : cmp > 0 ? 'over' : 'full',
  };
}
export function ensureMeasures(score: Score, count: number): Score {
  if (!integer(count) || count < 0) throw new RangeError('Número de compases no válido.');
  let result = score;
  while (result.measures.length < count) result = addMeasure(result, result.measures.length - 1);
  return result;
}
export function addMeasure(score: Score, after: number): Score {
  if (!integer(after) || after < -1 || after >= score.measures.length)
    throw new RangeError('Compás inexistente.');
  const id = fresh(score, 'm');
  const m = { id, events: rests(after < 0 ? score.meter : measureMeter(score, after), id) };
  return {
    ...score,
    measures: [...score.measures.slice(0, after + 1), m, ...score.measures.slice(after + 1)],
  };
}
export function removeMeasure(score: Score, index: number): Score {
  if (!score.measures[index] || score.measures.length === 1) return score;
  const meter = measureMeter(score, index + 1);
  const measures = score.measures.filter((_, i) => i !== index);
  if (measures[index]) measures[index] = { ...measures[index]!, meter };
  return cleanTies({ ...score, measures });
}
export function setMeter(score: Score, index: number, meter: Meter): Score {
  checkMeter(meter);
  if (!score.measures[index]) return score;
  return {
    ...score,
    measures: score.measures.map((m, i) => (i === index ? { ...m, meter: { ...meter } } : m)),
  };
}
export function setKey(score: Score, fifths: number): Score {
  if (!integer(fifths) || Math.abs(fifths) > 7) throw new RangeError('Armadura no válida.');
  return { ...score, keyFifths: fifths };
}
export type Edit = { score: Score; cursor: EditCursor };
function clampCursor(score: Score, cursor: EditCursor): EditCursor {
  const measure = Math.max(0, Math.min(score.measures.length - 1, Math.trunc(cursor.measure) || 0));
  return {
    measure,
    event: Math.max(
      0,
      Math.min(score.measures[measure]!.events.length, Math.trunc(cursor.event) || 0),
    ),
    string: Math.max(0, Math.trunc(cursor.string) || 0),
  };
}
// Without an instrument, only identical positions prove identical pitch. Edits clear
// affected outgoing/incoming ties; unrelated enharmonic positions remain untouched.
function cleanTies(score: Score, instrument?: Instrument): Score {
  const events = score.measures.flatMap((m) => m.events);
  const valid = new Set<string>();
  events.forEach((e, i) => {
    const next = events[i + 1];
    if (
      e.tie &&
      e.note &&
      next?.note &&
      (instrument
        ? noteAt(instrument, e.note.string, e.note.fret) ===
          noteAt(instrument, next.note.string, next.note.fret)
        : e.note.string === next.note.string && e.note.fret === next.note.fret)
    )
      valid.add(e.id);
  });
  return {
    ...score,
    measures: score.measures.map((m) => ({
      ...m,
      events: m.events.map((e) => (e.tie && !valid.has(e.id) ? { ...e, tie: undefined } : e)),
    })),
  };
}
function replace(
  score: Score,
  cursor: EditCursor,
  change: (event: ScoreEvent) => ScoreEvent,
): Edit {
  cursor = clampCursor(score, cursor);
  return {
    score: {
      ...score,
      measures: score.measures.map((m, i) =>
        i !== cursor.measure
          ? m
          : { ...m, events: m.events.map((e, j) => (j === cursor.event ? change(e) : e)) },
      ),
    },
    cursor,
  };
}
function insert(
  score: Score,
  cursor: EditCursor,
  duration: Duration,
  note?: ScoreEvent['note'],
): Edit {
  durationValue(duration);
  cursor = clampCursor(score, cursor);
  const event: ScoreEvent = {
    id: fresh(score, 'e'),
    duration: { ...duration },
    ...(note ? { note: { ...note } } : {}),
  };
  const measure = score.measures[cursor.measure]!;
  // A whole-bar placeholder is replaced when writing from its beginning.
  const placeholder =
    cursor.event === 0 &&
    measure.events.every((e) => !e.note) &&
    measureFill(score, cursor.measure).status === 'full';
  const events = placeholder
    ? [event]
    : [...measure.events.slice(0, cursor.event), event, ...measure.events.slice(cursor.event)];
  const result = {
    ...score,
    measures: score.measures.map((m, i) => (i === cursor.measure ? { ...m, events } : m)),
  };
  return { score: cleanTies(result), cursor: { ...cursor, event: cursor.event + 1 } };
}
export function insertNote(
  score: Score,
  cursor: EditCursor,
  fret: number,
  duration: Duration,
  instrument: Instrument,
): Edit {
  noteAt(instrument, cursor.string, fret);
  return insert(score, cursor, duration, { string: cursor.string, fret });
}
export const insertRest = (score: Score, cursor: EditCursor, duration: Duration): Edit =>
  insert(score, cursor, duration);
export function setFret(
  score: Score,
  cursor: EditCursor,
  fret: number,
  instrument: Instrument,
): Edit {
  noteAt(instrument, cursor.string, fret);
  const c = clampCursor(score, cursor);
  if (!score.measures[c.measure]!.events[c.event])
    return insertNote(score, c, fret, { base: 4, dots: 0 }, instrument);
  const edit = replace(score, c, (e) => ({ ...e, note: { string: c.string, fret } }));
  return { ...edit, score: cleanTies(edit.score, instrument) };
}
export function setDuration(score: Score, cursor: EditCursor, duration: Duration): Edit {
  durationValue(duration);
  return replace(score, cursor, (e) => ({ ...e, duration: { ...duration } }));
}
export const toggleDot = (s: Score, c: EditCursor): Edit =>
  replace(s, c, (e) => ({ ...e, duration: { ...e.duration, dots: e.duration.dots ? 0 : 1 } }));
export const toggleTriplet = (s: Score, c: EditCursor): Edit =>
  replace(s, c, (e) => ({ ...e, duration: { ...e.duration, triplet: !e.duration.triplet } }));
export function toggleTie(s: Score, c: EditCursor): Edit {
  const edit = replace(s, c, (e) => ({ ...e, tie: !e.tie }));
  return { ...edit, score: cleanTies(edit.score) };
}
export function setTechnique(s: Score, c: EditCursor, technique: Technique | null): Edit {
  if (technique !== null && !['hammer', 'pull', 'slide', 'dead', 'staccato'].includes(technique))
    throw new RangeError('Técnica no válida.');
  return replace(s, c, (e) => (e.note ? { ...e, technique: technique ?? undefined } : e));
}
export function deleteEvent(score: Score, cursor: EditCursor): Edit {
  cursor = clampCursor(score, cursor);
  const result = {
    ...score,
    measures: score.measures.map((m, i) =>
      i !== cursor.measure ? m : { ...m, events: m.events.filter((_, j) => j !== cursor.event) },
    ),
  };
  return { score: cleanTies(result), cursor: clampCursor(result, cursor) };
}
export function moveCursor(
  score: Score,
  cursor: EditCursor,
  move: 'left' | 'right' | 'up' | 'down' | 'nextMeasure' | 'prevMeasure',
  instrument: Instrument,
): EditCursor {
  validateInstrument(instrument);
  const c = clampCursor(score, cursor),
    len = score.measures[c.measure]!.events.length;
  c.string = Math.min(c.string, instrument.strings.length - 1);
  if (move === 'up') c.string = Math.min(c.string + 1, instrument.strings.length - 1);
  if (move === 'down') c.string = Math.max(0, c.string - 1);
  if (move === 'nextMeasure' || move === 'prevMeasure') {
    c.measure += move === 'nextMeasure' ? 1 : -1;
    c.measure = Math.max(0, Math.min(score.measures.length - 1, c.measure));
    c.event = 0;
  }
  if (move === 'left') {
    if (c.event) c.event--;
    else if (c.measure) {
      c.measure--;
      c.event = score.measures[c.measure]!.events.length;
    }
  }
  if (move === 'right') {
    if (c.event < len) c.event++;
    else if (c.measure < score.measures.length - 1) {
      c.measure++;
      c.event = 0;
    }
  }
  return c;
}
export function retune(score: Score, from: Instrument, to: Instrument): Score {
  validateInstrument(from);
  validateInstrument(to);
  return cleanTies(
    {
      ...score,
      measures: score.measures.map((m) => ({
        ...m,
        events: m.events.map((e) => {
          if (!e.note) return e;
          const pitch = noteAt(from, e.note.string, e.note.fret);
          const positions = to.strings
            .map((open, string) => ({ string, fret: pitch - open }))
            .filter((p) => p.fret >= 0 && p.fret <= to.frets)
            .sort((a, b) => a.fret - b.fret || a.string - b.string);
          const { note: _, tie: __, technique: ___, ...rest } = e;
          return positions[0] ? { ...e, note: positions[0] } : rest;
        }),
      })),
    },
    to,
  );
}
export type History<T = Score> = { past: T[]; present: T; future: T[] };
export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });
export const commit = <T>(h: History<T>, present: T): History<T> =>
  present === h.present ? h : { past: [...h.past, h.present].slice(-100), present, future: [] };
export const undo = <T>(h: History<T>): History<T> =>
  !h.past.length
    ? h
    : { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] };
export const redo = <T>(h: History<T>): History<T> =>
  !h.future.length
    ? h
    : {
        past: [...h.past, h.present].slice(-100),
        present: h.future[0]!,
        future: h.future.slice(1),
      };
export const MAX_SCORE_MEASURES = 10000;

export function parseScore(value: unknown): Score | null {
  try {
    if (!value || typeof value !== 'object') return null;
    const s = value as Score;
    if (
      s.version !== 1 ||
      !validMeter(s.meter) ||
      !integer(s.keyFifths) ||
      Math.abs(s.keyFifths) > 7 ||
      !Array.isArray(s.measures) ||
      !s.measures.length ||
      s.measures.length > MAX_SCORE_MEASURES
    )
      return null;
    const ids = new Set<string>();
    const id = (v: string) => {
      if (typeof v !== 'string' || !v.length || ids.has(v)) throw new Error();
      ids.add(v);
      return v;
    };
    const parsed: Score = {
      version: 1,
      meter: { beats: s.meter.beats, unit: s.meter.unit },
      keyFifths: s.keyFifths,
      measures: s.measures.map((m) => {
        if (!m || (m.meter !== undefined && !validMeter(m.meter)) || !Array.isArray(m.events))
          throw new Error();
        return {
          id: id(m.id),
          ...(m.meter ? { meter: { beats: m.meter.beats, unit: m.meter.unit } } : {}),
          events: m.events.map((e) => {
            if (
              !e ||
              !validDuration(e.duration) ||
              (e.tie !== undefined && typeof e.tie !== 'boolean') ||
              (e.technique !== undefined &&
                !['hammer', 'pull', 'slide', 'dead', 'staccato'].includes(e.technique))
            )
              throw new Error();
            if (
              e.note &&
              (!integer(e.note.string) ||
                e.note.string < 0 ||
                e.note.string > 127 ||
                !integer(e.note.fret) ||
                e.note.fret < 0 ||
                e.note.fret > 127)
            )
              throw new Error();
            if (e.note !== undefined && (!e.note || typeof e.note !== 'object')) throw new Error();
            return {
              id: id(e.id),
              duration: {
                base: e.duration.base,
                dots: e.duration.dots,
                ...(e.duration.triplet !== undefined ? { triplet: e.duration.triplet } : {}),
              },
              ...(e.note ? { note: { string: e.note.string, fret: e.note.fret } } : {}),
              ...(e.tie !== undefined ? { tie: e.tie } : {}),
              ...(e.technique ? { technique: e.technique } : {}),
            };
          }),
        };
      }),
    };
    const events = parsed.measures.flatMap((m) => m.events);
    if (
      events.some((e, i) => {
        const next = events[i + 1];
        return (
          (e.technique !== undefined && !e.note) ||
          (e.tie &&
            (!e.note ||
              !next?.note ||
              e.note.string !== next.note.string ||
              e.note.fret !== next.note.fret))
        );
      })
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}
