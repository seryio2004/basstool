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
export const tupletCount = (d: Duration) => d.tuplet ?? (d.triplet ? 3 : 1);
const validDuration = (d: Duration) =>
  !!d &&
  (d.triplet === undefined || typeof d.triplet === 'boolean') &&
  (!d.triplet || !d.tuplet || d.tuplet === 3) &&
  (d.tuplet === undefined || [3, 5, 15].includes(d.tuplet)) &&
  (d.tuplet !== 15 || d.base === 256) &&
  (([1, 2, 4, 8, 16].includes(d.base) && [0, 1].includes(d.dots)) ||
    (d.base === 32 && d.dots === 0) ||
    (d.base === 64 && d.dots === 0 && tupletCount(d) === 3) ||
    (d.base === 256 && d.dots === 0 && d.tuplet === 15));
export function durationValue(d: Duration): Fraction {
  if (!validDuration(d)) throw new RangeError('Duración no válida.');
  return fraction(
    (d.dots ? 3 : 1) * 2 ** Math.floor(Math.log2(tupletCount(d))),
    d.base * (d.dots ? 2 : 1) * tupletCount(d),
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
  return changeMeasureMeter(score, { measure: index, event: 0, string: 0 }, meter).score;
}

export function changeMeasureMeter(score: Score, cursor: EditCursor, meter: Meter): Edit {
  checkMeter(meter);
  const index = cursor.measure;
  if (!score.measures[index]) return { score, cursor };
  const measures = score.measures.slice();
  measures[index] = { ...measures[index]!, meter: { ...meter } };
  let through = index;
  while (measures[through + 1] && !measures[through + 1]!.meter) through++;
  // Shortening an inherited meter must keep every hand-written chord reachable.
  if (
    measures
      .slice(index, through + 1)
      .some((bar) => bar.chords?.some((ch) => ch.beat >= meter.beats))
  )
    return { score, cursor, notice: 'chordOutside' };
  const current = measures[index]!;
  const events = isMeasurePlaceholder(current) ? rests(meter, current.id) : current.events;
  const fitted = fitMeasures({ ...score, measures }, index, events, through);
  if (!fitted) return { score, cursor, notice: 'limit' };
  const result = fitted.moved ? cleanTies(fitted.score) : fitted.score;
  return {
    score: result,
    cursor: clampCursor(result, cursor),
    notice: fitted.moved ? 'reflow' : undefined,
  };
}

export function repairMeasure(score: Score, cursor: EditCursor): Edit {
  const c = clampCursor(score, cursor);
  if (measureFill(score, c.measure).status !== 'over') return { score, cursor };
  const measure = score.measures[c.measure]!;
  if (isMeasurePlaceholder(measure)) {
    const measures = score.measures.slice();
    measures[c.measure] = { ...measure, events: rests(measureMeter(score, c.measure), measure.id) };
    return { score: { ...score, measures }, cursor: { ...c, event: 0 } };
  }
  const fitted = fitMeasures(score, c.measure, measure.events);
  if (!fitted) return { score, cursor, notice: 'limit' };
  return { score: cleanTies(fitted.score), cursor: clampCursor(fitted.score, c), notice: 'reflow' };
}
export function setKey(score: Score, fifths: number): Score {
  if (!integer(fifths) || Math.abs(fifths) > 7) throw new RangeError('Armadura no válida.');
  return { ...score, keyFifths: fifths };
}
export type Edit = {
  score: Score;
  cursor: EditCursor;
  notice?: 'split' | 'reflow' | 'limit' | 'chordOutside';
};
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
export function isMeasurePlaceholder(measure: Measure): boolean {
  return (
    measure.events.length > 0 &&
    measure.events.every((event, index) => !event.note && event.id === `${measure.id}-r${index}`)
  );
}
// Supported entry figures and bar capacities are all multiples of 1/480.
const BAR_TICKS = 480;
const ticks = (duration: Duration): number => {
  const value = durationValue(duration);
  return (value.n * BAR_TICKS) / value.d;
};
const fragments = (
  [
    ...([1, 2, 4, 8, 16] as const).flatMap((base): Duration[] => [
      { base, dots: 0 },
      { base, dots: 1 },
      { base, dots: 0, triplet: true },
      { base, dots: 0, tuplet: 5 },
    ]),
    { base: 256, dots: 0, tuplet: 15 },
    { base: 32, dots: 0 },
    { base: 32, dots: 0, triplet: true },
    { base: 32, dots: 0, tuplet: 5 },
    { base: 64, dots: 0, triplet: true },
  ] satisfies Duration[]
)
  .map((duration) => ({ duration, ticks: ticks(duration) }))
  .sort((a, b) => b.ticks - a.ticks);

// Prefer short, readable ties. A mixed-grid residual is only used when no
// combination of ordinary, triplet and quintuplet figures fits exactly.
const splitCosts = [0];
const splitParts: typeof fragments = [];
function decompose(length: number, original: Duration): Duration[] {
  if (length === ticks(original)) return [original];
  for (let n = splitCosts.length; n <= length; n++) {
    let best = Infinity;
    for (const part of fragments) {
      if (part.ticks > n) continue;
      const cost = splitCosts[n - part.ticks]! + (part.duration.tuplet === 15 ? BAR_TICKS * 2 : 1);
      if (cost < best) {
        best = cost;
        splitParts[n] = part;
      }
    }
    splitCosts[n] = best;
  }
  const durations: Duration[] = [];
  while (length > 0) {
    const part = splitParts[length]!;
    durations.push(part.duration);
    length -= part.ticks;
  }
  return durations;
}

/** Packs events in order, retaining downstream meter changes and existing measure IDs. */
function fitMeasures(
  score: Score,
  start: number,
  events: ScoreEvent[],
  through = start,
  followId?: string,
): { score: Score; moved: boolean; split: boolean; followId?: string } | null {
  const measures = score.measures.slice();
  let carried: ScoreEvent[] = [];
  let meter = measureMeter(score, start);
  let eventIds: Set<string> | undefined;
  let suffix = 0;
  const usedIds = () =>
    (eventIds ??= new Set([
      ...score.measures.flatMap((m) => [m.id, ...m.events.map((e) => e.id)]),
      ...events.map((e) => e.id),
    ]));
  const fragmentId = (id: string) => {
    const ids = usedIds();
    let next: string;
    do {
      next = `${id}-part${++suffix}`;
    } while (ids.has(next));
    ids.add(next);
    return next;
  };
  let measureId = 0;
  const nextMeasureId = () => {
    const ids = usedIds();
    let id: string;
    do {
      id = `m${++measureId}`;
    } while (ids.has(id));
    ids.add(id);
    return id;
  };
  let moved = false;
  let split = false;
  for (let index = start; index <= through || carried.length; index++) {
    if (index >= MAX_SCORE_MEASURES) return null;
    const existing = measures[index];
    if (existing?.meter) meter = existing.meter;
    if (index !== start && existing && !carried.length && isMeasurePlaceholder(existing)) {
      measures[index] = { ...existing, events: rests(meter, existing.id) };
      continue;
    }
    const incoming = carried;
    carried = [];
    const queue =
      index === start
        ? events
        : [...incoming, ...(existing && !isMeasurePlaceholder(existing) ? existing.events : [])];
    let available = (meter.beats * BAR_TICKS) / meter.unit;
    const fitted: ScoreEvent[] = [];
    for (let i = 0; i < queue.length; i++) {
      const event = queue[i]!;
      const length = ticks(event.duration);
      if (length <= available) {
        fitted.push(event);
        available -= length;
        continue;
      }
      moved = true;
      if (available === 0) {
        carried = queue.slice(i);
      } else {
        split = true;
        const before = decompose(available, event.duration);
        const after = decompose(length - available, event.duration);
        const parts = [...before, ...after].map((duration, part, all): ScoreEvent => {
          const last = part === all.length - 1;
          const technique =
            event.technique === 'dead' || (event.technique === 'staccato' ? part === 0 : last)
              ? event.technique
              : undefined;
          return {
            ...event,
            id: part === 0 ? event.id : fragmentId(event.id),
            duration,
            technique,
            tie: event.note && (!last || event.tie) ? true : undefined,
          };
        });
        if (followId === event.id) followId = parts.at(-1)!.id;
        fitted.push(...parts.slice(0, before.length));
        carried = [...parts.slice(before.length), ...queue.slice(i + 1)];
      }
      break;
    }
    measures[index] = {
      ...(existing ?? { id: nextMeasureId() }),
      events: fitted,
    };
  }
  return { score: { ...score, measures }, moved, split, followId };
}

function insert(
  score: Score,
  cursor: EditCursor,
  duration: Duration,
  note?: ScoreEvent['note'],
): Edit {
  durationValue(duration);
  const original = score;
  cursor = clampCursor(score, cursor);
  let { measure, event: index } = cursor;
  let current = score.measures[measure]!;
  if (!isMeasurePlaceholder(current) && measureFill(score, measure).status === 'full') {
    if (measure + 1 >= MAX_SCORE_MEASURES) return { score, cursor, notice: 'limit' };
    if (!score.measures[measure + 1]) score = addMeasure(score, measure);
    current = score.measures[++measure]!;
    index = 0;
  }
  const event: ScoreEvent = {
    id: fresh(score, 'e'),
    duration: { ...duration },
    ...(note ? { note: { ...note } } : {}),
  };
  const events = isMeasurePlaceholder(current)
    ? [event]
    : [...current.events.slice(0, index), event, ...current.events.slice(index)];
  const fitted = fitMeasures(score, measure, events, measure, event.id);
  if (!fitted) return { score: original, cursor, notice: 'limit' };
  const result = cleanTies(fitted.score);
  for (let m = measure; m < result.measures.length; m++) {
    const i = result.measures[m]!.events.findIndex((e) => e.id === fitted.followId);
    if (i >= 0)
      return {
        score: result,
        cursor: { ...cursor, measure: m, event: i + 1 },
        notice: fitted.split ? 'split' : fitted.moved ? 'reflow' : undefined,
      };
  }
  throw new Error('No se encuentra el evento insertado.');
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
  cursor = clampCursor(score, cursor);
  const measure = score.measures[cursor.measure]!;
  const event = measure.events[cursor.event];
  if (!event || isMeasurePlaceholder(measure)) return { score, cursor };
  const events = measure.events.slice();
  events[cursor.event] = { ...event, duration: { ...duration } };
  const fitted = fitMeasures(score, cursor.measure, events);
  if (!fitted) return { score, cursor, notice: 'limit' };
  return {
    score: fitted.moved ? cleanTies(fitted.score) : fitted.score,
    cursor,
    notice: fitted.split ? 'split' : fitted.moved ? 'reflow' : undefined,
  };
}
export function toggleDot(score: Score, cursor: EditCursor): Edit {
  const duration = score.measures[cursor.measure]?.events[cursor.event]?.duration;
  if (!duration || duration.base > 16) return { score, cursor };
  return setDuration(score, cursor, { ...duration, dots: duration.dots ? 0 : 1 });
}
export function toggleTriplet(score: Score, cursor: EditCursor): Edit {
  const duration = score.measures[cursor.measure]?.events[cursor.event]?.duration;
  if (!duration || duration.base >= 64) return { score, cursor };
  return setDuration(score, cursor, {
    ...duration,
    tuplet: undefined,
    triplet: tupletCount(duration) !== 3,
  });
}
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
          ...(m.chords === undefined
            ? {}
            : {
                chords: m.chords.map(({ beat, symbol }) => {
                  if (
                    !Number.isFinite(beat) ||
                    beat < 0 ||
                    typeof symbol !== 'string' ||
                    !symbol.trim()
                  )
                    throw new Error();
                  return { beat, symbol };
                }),
              }),
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
                ...(e.duration.tuplet ? { tuplet: e.duration.tuplet } : {}),
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
