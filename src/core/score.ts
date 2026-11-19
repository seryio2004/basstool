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
  ScoreNote,
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
  ScoreNote,
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
export function eventNotes(event?: ScoreEvent): ScoreNote[] {
  return event?.notes ?? (event?.note ? [event.note] : []);
}

function positions(notes: ScoreNote[]) {
  notes.sort((a, b) => a.string - b.string);
  return notes.length ? { notes, note: notes[0] } : { notes: undefined, note: undefined };
}

export function tiedStrings(e: ScoreEvent): number[] {
  return e.tie ? (e.tieStrings ?? eventNotes(e).map((n) => n.string)) : [];
}

function withTies(e: ScoreEvent, strings: number[]): ScoreEvent {
  const { tie, tieStrings, ...rest } = e;
  if (!strings.length) return rest;
  return strings.length === eventNotes(e).length
    ? { ...rest, tie: true }
    : { ...rest, tie: true, tieStrings: strings.sort((a, b) => a - b) };
}

function cleanTies(score: Score): Score {
  const events = score.measures.flatMap((m) => m.events);
  let index = 0;
  return {
    ...score,
    measures: score.measures.map((m) => ({
      ...m,
      events: m.events.map((e) => {
        const next = events[++index];
        if (!e.tie) return e;
        const valid = eventNotes(e).filter(
          (n) =>
            tiedStrings(e).includes(n.string) &&
            eventNotes(next).some((m) => m.string === n.string && m.fret === n.fret),
        );
        return withTies(
          e,
          valid.map((n) => n.string),
        );
      }),
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
    measure.events.every(
      (event, index) => !eventNotes(event).length && event.id === `${measure.id}-r${index}`,
    )
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
            tieStrings: last ? event.tieStrings : undefined,
            tie: eventNotes(event).length && (!last || event.tie) ? true : undefined,
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
  stay = false,
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
    ...(note ? positions([{ ...note }]) : {}),
  };
  const events = isMeasurePlaceholder(current)
    ? [event]
    : [...current.events.slice(0, index), event, ...current.events.slice(index)];
  const fitted = fitMeasures(score, measure, events, measure, event.id);
  if (!fitted) return { score: original, cursor, notice: 'limit' };
  const result = cleanTies(fitted.score);
  for (let m = measure; m < result.measures.length; m++) {
    const i = result.measures[m]!.events.findIndex(
      (e) => e.id === (stay ? event.id : fitted.followId),
    );
    if (i >= 0)
      return {
        score: result,
        cursor: { ...cursor, measure: m, event: stay ? i : i + 1 },
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
  const event = score.measures[c.measure]!.events[c.event]!;
  if (eventNotes(event).length > 1) return setChordNote(score, c, fret, event.duration, instrument);
  const edit = replace(score, c, (e) => ({ ...e, ...positions([{ string: c.string, fret }]) }));
  return { ...edit, score: cleanTies(edit.score) };
}
/** Edit one string without consuming another rhythmic slot. */
export function setChordNote(
  score: Score,
  cursor: EditCursor,
  fret: number | null,
  duration: Duration,
  instrument: Instrument,
): Edit {
  const c = clampCursor(score, cursor);
  if (fret !== null) noteAt(instrument, c.string, fret);
  const bar = score.measures[c.measure]!;
  const current = bar.events[c.event];
  if (!current || isMeasurePlaceholder(bar)) {
    if (fret === null) return { score, cursor };
    return insert(score, c, duration, { string: c.string, fret }, true);
  }
  const previous = eventNotes(current).find((n) => n.string === c.string);
  if ((previous?.fret ?? null) === fret) return { score, cursor };
  const notes = eventNotes(current).filter((n) => n.string !== c.string);
  if (fret !== null) notes.push({ string: c.string, fret });
  const edit = replace(score, c, (e) =>
    withTies(
      { ...e, ...positions(notes), technique: notes.length ? e.technique : undefined },
      tiedStrings(e).filter((string) => string !== c.string),
    ),
  );
  return { ...edit, score: cleanTies(edit.score) };
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
  const edit = replace(s, c, (e) => {
    if (!eventNotes(e).some((n) => n.string === c.string)) return e;
    const strings = tiedStrings(e);
    return withTies(
      e,
      strings.includes(c.string) ? strings.filter((s) => s !== c.string) : [...strings, c.string],
    );
  });
  return { ...edit, score: cleanTies(edit.score) };
}
export function setTechnique(s: Score, c: EditCursor, technique: Technique | null): Edit {
  if (technique !== null && !['hammer', 'pull', 'slide', 'dead', 'staccato'].includes(technique))
    throw new RangeError('Técnica no válida.');
  return replace(s, c, (e) =>
    eventNotes(e).length ? { ...e, technique: technique ?? undefined } : e,
  );
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
  let sustained = new Map<number, ScoreNote>();
  return cleanTies({
    ...score,
    measures: score.measures.map((m) => ({
      ...m,
      events: m.events.map((e) => {
        const original = eventNotes(e);
        if (!original.length) {
          sustained.clear();
          return e;
        }
        // Augmenting paths keep the largest playable subset on distinct strings.
        const candidates = original.map((n) => {
          const pitch = noteAt(from, n.string, n.fret);
          return to.strings
            .map((open, string) => ({ string, fret: pitch - open }))
            .filter((p) => p.fret >= 0 && p.fret <= to.frets)
            .sort((a, b) => a.fret - b.fret);
        });
        const assigned = new Map<number, { index: number; note: ScoreNote }>();
        function assign(index: number, seen: Set<number>): boolean {
          for (const note of candidates[index]!) {
            if (seen.has(note.string)) continue;
            seen.add(note.string);
            const other = assigned.get(note.string);
            if (!other || assign(other.index, seen)) {
              assigned.set(note.string, { index, note });
              return true;
            }
          }
          return false;
        }
        // Retain the fingering of a held string if the new voicing permits it.
        const held = new Set<number>();
        original.forEach((source, index) => {
          const target = sustained.get(source.string);
          if (
            target &&
            candidates[index]!.some((n) => n.string === target.string && n.fret === target.fret)
          ) {
            assigned.set(target.string, { index, note: target });
            held.add(target.string);
          }
        });
        const pinned = new Set([...assigned.values()].map((v) => v.index));
        original.forEach((_, i) => {
          if (!pinned.has(i) && !assign(i, new Set(held))) assign(i, new Set());
        });
        const voices = [...assigned.values()];
        const continuing = voices.filter((v) => tiedStrings(e).includes(original[v.index]!.string));
        sustained = new Map(continuing.map((v) => [original[v.index]!.string, v.note]));
        return withTies(
          {
            ...e,
            ...positions(voices.map((v) => v.note)),
            technique: voices.length ? e.technique : undefined,
          },
          continuing.map((v) => v.note.string),
        );
      }),
    })),
  });
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
            if (e.notes !== undefined && !Array.isArray(e.notes)) throw new Error();
            const notes = eventNotes(e);
            const valid = (n: ScoreNote) =>
              n && [n.string, n.fret].every((v) => integer(v) && v >= 0 && v <= 127);
            if (
              (e.note !== undefined && !valid(e.note)) ||
              !notes.every(valid) ||
              new Set(notes.map((n) => n.string)).size !== notes.length
            )
              throw new Error();
            if (
              e.tieStrings !== undefined &&
              (!e.tie ||
                !Array.isArray(e.tieStrings) ||
                !e.tieStrings.length ||
                new Set(e.tieStrings).size !== e.tieStrings.length ||
                !e.tieStrings.every((s) => notes.some((n) => n.string === s)))
            )
              throw new Error();
            return {
              id: id(e.id),
              duration: {
                base: e.duration.base,
                dots: e.duration.dots,
                ...(e.duration.tuplet ? { tuplet: e.duration.tuplet } : {}),
                ...(e.duration.triplet !== undefined ? { triplet: e.duration.triplet } : {}),
              },
              ...(notes.length
                ? positions(notes.map(({ string, fret }) => ({ string, fret })))
                : {}),
              ...(e.tieStrings ? { tieStrings: [...e.tieStrings] } : {}),
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
              tiedStrings(e).some(
                (s) =>
                  !eventNotes(next).some(
                    (n) =>
                      n.string === s &&
                      n.fret === eventNotes(e).find((note) => note.string === s)?.fret,
                  ),
              )))
        );
      })
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}
