/** Pure engraving geometry. All durations/onsets remain fractions until projected
 * into pixel coordinates; no rounding feeds back into the score. */
import type { Instrument } from './instrument';
import { noteAt } from './instrument';
import { addF, durationValue, fraction, measureFill, measureMeter } from './score';
import type {
  EditCursor,
  Fraction,
  MeasureFill,
  Meter,
  MusicalPosition,
  Score,
  ScoreDisplay,
  ScoreEvent,
} from './scoreTypes';
export type Primitive =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; width?: number; color?: string }
  | {
      kind: 'text';
      x: number;
      y: number;
      text: string;
      size: number;
      color?: string;
      anchor?: 'start' | 'middle';
    }
  | { kind: 'ellipse'; x: number; y: number; rx: number; ry: number; hollow?: boolean }
  | { kind: 'path'; d: string; width?: number; fill?: boolean }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; color?: string };
export type EventGeometry = {
  event: number;
  source: ScoreEvent;
  x: number;
  endX: number;
  beat: number;
  endBeat: number;
  y: number;
  tabY?: number;
  step?: number;
  stem?: 'up' | 'down';
  accidental?: string;
  name: string;
  label: string;
};
export type BeamGeometry = { events: number[]; levels: number; stem: 'up' | 'down' };
export type MeasureGeometry = {
  measure: number;
  x: number;
  width: number;
  contentX: number;
  endX: number;
  top: number;
  bottom: number;
  staffBottom?: number;
  tabTop?: number;
  meter: Meter;
  fill: MeasureFill;
  events: EventGeometry[];
  beams: BeamGeometry[];
  primitives: Primitive[];
};
export type ScoreLine = {
  index: number;
  y: number;
  height: number;
  measures: MeasureGeometry[];
  primitives: Primitive[];
};
export type ScoreLayout = {
  width: number;
  height: number;
  lines: ScoreLine[];
  strings: number;
  display: ScoreDisplay;
};
const ratio = (f: Fraction) => f.n / f.d;
const naturals = [0, 2, 4, 5, 7, 9, 11];
const names = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
const sharpOrder = [3, 0, 4, 1, 5, 2, 6],
  flatOrder = [6, 2, 5, 1, 4, 0, 3];
export function signatureAlter(letter: number, fifths: number): number {
  return (fifths >= 0 ? sharpOrder : flatOrder).slice(0, Math.abs(fifths)).includes(letter)
    ? Math.sign(fifths)
    : 0;
}
export function spellPitch(
  sounding: number,
  fifths: number,
): { letter: number; alter: number; octave: number; step: number; name: string } {
  const written = sounding + 12;
  const candidates: { letter: number; alter: number; octave: number; rank: number }[] = [];
  for (let letter = 0; letter < 7; letter++)
    for (const alter of [-1, 0, 1]) {
      const octave = (written - naturals[letter]! - alter) / 12 - 1;
      if (!Number.isInteger(octave)) continue;
      const preferred = fifths < 0 ? -1 : fifths > 0 ? 1 : [3, 10].includes(written % 12) ? -1 : 1;
      const rank =
        alter === signatureAlter(letter, fifths)
          ? 0
          : alter === 0
            ? 1
            : alter === preferred
              ? 2
              : 3;
      candidates.push({ letter, alter, octave, rank });
    }
  candidates.sort((a, b) => a.rank - b.rank);
  const p = candidates[0]!;
  return {
    ...p,
    step: p.octave * 7 + p.letter - (2 * 7 + 4),
    name: `${names[p.letter]}${p.alter < 0 ? '♭' : p.alter > 0 ? '♯' : ''}`,
  };
}
const durationNames: Record<number, string> = {
  1: 'redonda',
  2: 'blanca',
  4: 'negra',
  8: 'corchea',
  16: 'semicorchea',
};
const line = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width = 1,
  color?: string,
): Primitive => ({ kind: 'line', x1, y1, x2, y2, width, color });
const text = (
  x: number,
  y: number,
  value: string,
  size = 14,
  color?: string,
  anchor: 'start' | 'middle' = 'middle',
): Primitive => ({ kind: 'text', x, y, text: value, size, color, anchor });
function prefixWidth(
  score: Score,
  index: number,
  first: boolean,
  display: ScoreDisplay,
  fifths: number,
): number {
  return (
    (first ? (display === 'tab' ? 26 : 30 + Math.abs(fifths) * 9) : 0) +
    (first || score.measures[index]!.meter ? 26 : 0)
  );
}
function eventWidths(events: ScoreEvent[], instrument: Instrument, fifths: number): number[] {
  const state = new Map<number, number>();
  return events.map((e) => {
    let extra = 0;
    if (e.note) {
      const p = spellPitch(noteAt(instrument, e.note.string, e.note.fret), fifths);
      const key = p.octave * 7 + p.letter;
      if ((state.get(key) ?? signatureAlter(p.letter, fifths)) !== p.alter) extra = 12;
      state.set(key, p.alter);
    }
    return (
      Math.max(e.note && e.note.fret >= 10 ? 22 : 14, ratio(durationValue(e.duration)) * 96) +
      extra +
      (e.duration.dots ? 4 : 0)
    );
  });
}
export function layoutScore(
  score: Score,
  instrument: Instrument,
  display: ScoreDisplay,
  width: number,
  keyFifths = score.keyFifths,
): ScoreLayout {
  const usable = Math.max(180, Number.isFinite(width) ? width : 350);
  const lines: ScoreLine[] = [];
  let index = 0,
    y = 0;
  while (index < score.measures.length) {
    const batch: { index: number; min: number; prefix: number; widths: number[] }[] = [];
    let total = 0;
    while (index < score.measures.length) {
      const widths = eventWidths(score.measures[index]!.events, instrument, keyFifths);
      const prefix = prefixWidth(score, index, !batch.length, display, keyFifths);
      const fill = measureFill(score, index);
      const emptyWidth = Math.max(0, ratio(fill.expected) - ratio(fill.actual)) * 96;
      const min = Math.max(110, prefix + 28 + widths.reduce((a, b) => a + b, 0) + emptyWidth);
      if (batch.length && total + min > usable - 24) break;
      batch.push({ index, min, prefix, widths });
      total += min;
      index++;
    }
    const pitches = batch.flatMap((b) =>
      score.measures[b.index]!.events.flatMap((e) =>
        e.note ? [spellPitch(noteAt(instrument, e.note.string, e.note.fret), keyFifths).step] : [],
      ),
    );
    const high = Math.max(8, ...pitches),
      low = Math.min(0, ...pitches);
    const staffBottom = display === 'tab' ? undefined : 52 + high * 5;
    const tabTop =
      display === 'staff' ? undefined : staffBottom === undefined ? 42 : staffBottom - low * 5 + 54;
    const bottom =
      tabTop === undefined
        ? staffBottom! - low * 5 + 46
        : tabTop + (instrument.strings.length - 1) * 14 + (display === 'tab' ? 56 : 32);
    const height = bottom + 18;
    const measures: MeasureGeometry[] = [];
    const primitives: Primitive[] = [];
    const actualWidth = Math.max(usable, total + 24);
    let x = 12;
    batch.forEach((b, batchIndex) => {
      const m = score.measures[b.index]!,
        meter = measureMeter(score, b.index);
      const w = b.min + (actualWidth - 24 - total) / batch.length;
      const contentX = x + b.prefix + 12,
        endX = x + w - 14;
      const measureState = measureFill(score, b.index);
      const missingWeight =
        Math.max(0, ratio(measureState.expected) - ratio(measureState.actual)) * 96;
      const weights = b.widths.reduce((a, b) => a + b, 0) + missingWeight || 1;
      const shapes: Primitive[] = [];
      if (staffBottom !== undefined) {
        for (let l = 0; l < 5; l++)
          shapes.push(line(x, staffBottom - l * 10, x + w, staffBottom - l * 10, 1, '#A9B4A8'));
        shapes.push(line(x + w, staffBottom - 40, x + w, staffBottom));
      }
      if (tabTop !== undefined) {
        for (let s = 0; s < instrument.strings.length; s++)
          shapes.push(line(x, tabTop + s * 14, x + w, tabTop + s * 14, 1, '#A9B4A8'));
        shapes.push(line(x + w, tabTop, x + w, tabTop + (instrument.strings.length - 1) * 14));
      }
      if (batchIndex === 0) {
        if (staffBottom !== undefined) {
          // Vector bass clef: avoids relying on a platform music font.
          shapes.push({
            kind: 'path',
            d: `M ${x + 7} ${staffBottom - 27} C ${x + 3} ${staffBottom - 44}, ${x + 35} ${staffBottom - 45}, ${x + 17} ${staffBottom - 18} Q ${x + 12} ${staffBottom - 11} ${x + 5} ${staffBottom - 9}`,
            width: 2,
          });
          shapes.push(
            { kind: 'ellipse', x: x + 8, y: staffBottom - 30, rx: 3, ry: 3 },
            { kind: 'ellipse', x: x + 26, y: staffBottom - 35, rx: 1.5, ry: 1.5 },
            { kind: 'ellipse', x: x + 26, y: staffBottom - 25, rx: 1.5, ry: 1.5 },
          );
          const steps = keyFifths >= 0 ? [6, 3, 7, 4, 1, 5, 2] : [2, 5, 1, 4, 0, 3, -1];
          steps
            .slice(0, Math.abs(keyFifths))
            .forEach((step, i) =>
              shapes.push(
                text(x + 36 + i * 9, staffBottom - step * 5 + 5, keyFifths < 0 ? '♭' : '♯', 18),
              ),
            );
        } else shapes.push(text(x + 10, tabTop! + 20, 'TAB', 10));
      }
      if (batchIndex === 0 || m.meter) {
        const mx = contentX - 16;
        if (staffBottom !== undefined)
          shapes.push(
            text(mx, staffBottom - 22, String(meter.beats), 16),
            text(mx, staffBottom - 4, String(meter.unit), 16),
          );
        else
          shapes.push(
            text(mx, tabTop! + 12, `${meter.beats}`, 13),
            text(mx, tabTop! + 28, `${meter.unit}`, 13),
          );
      }
      const fill = measureState;
      if (batchIndex === 0 || fill.status !== 'full')
        shapes.push(
          text(
            x + 3,
            18,
            String(b.index + 1),
            12,
            fill.status === 'over' ? '#A33131' : fill.status === 'full' ? '#202E26' : '#8A5A2E',
            'start',
          ),
        );
      const accidentals = new Map<number, number>();
      let offset = fraction(0, 1),
        ex = contentX;
      const events: EventGeometry[] = m.events.map((e, event) => {
        const dur = durationValue(e.duration),
          onset = offset;
        offset = addF(offset, dur);
        const ew = (endX - contentX) * (b.widths[event]! / weights);
        const pitch = e.note
          ? spellPitch(noteAt(instrument, e.note.string, e.note.fret), keyFifths)
          : undefined;
        const step = pitch?.step;
        const ey =
          staffBottom !== undefined
            ? staffBottom - (step ?? 4) * 5
            : tabTop! + (instrument.strings.length - 1) * 14 + 18;
        let accidental: string | undefined;
        if (pitch) {
          const diatonic = pitch.octave * 7 + pitch.letter;
          const previous = accidentals.get(diatonic) ?? signatureAlter(pitch.letter, keyFifths);
          if (previous !== pitch.alter)
            accidental = pitch.alter < 0 ? '♭' : pitch.alter > 0 ? '♯' : '♮';
          accidentals.set(diatonic, pitch.alter);
        }
        const ty =
          e.note && tabTop !== undefined
            ? tabTop + (instrument.strings.length - 1 - e.note.string) * 14
            : undefined;
        const name = pitch?.name ?? 'Silencio';
        const label = `Compás ${b.index + 1}, ${name}${e.note ? `, cuerda ${spellPitch(instrument.strings[e.note.string]!, 0).name} traste ${e.note.fret}` : ''}, ${durationNames[e.duration.base]}${e.duration.dots ? ' con puntillo' : ''}${e.duration.triplet ? ', tresillo' : ''}`;
        const geom: EventGeometry = {
          event,
          source: e,
          x: ex + (accidental ? 12 : 0),
          endX: ex + ew,
          y: ey,
          tabY: ty,
          step,
          stem: e.note && e.duration.base !== 1 ? ((step ?? 0) >= 4 ? 'down' : 'up') : undefined,
          accidental,
          name,
          label,
          beat: ratio(onset) * meter.unit,
          endBeat: ratio(offset) * meter.unit,
        };
        ex += ew;
        return geom;
      });
      const beams: BeamGeometry[] = [];
      let run: EventGeometry[] = [];
      function flush() {
        if (run.length >= 2)
          beams.push({
            events: run.map((e) => e.event),
            levels: run.every((e) => e.source.duration.base === 16) ? 2 : 1,
            stem: display === 'tab' ? 'down' : run[0]!.stem!,
          });
        run = [];
      }
      let bucket = -1;
      events.forEach((e) => {
        const compound = meter.unit === 8 && [6, 9, 12].includes(meter.beats);
        const groupSize = compound ? 3 : meter.unit === 4 ? 1 : 1;
        const group = Math.floor((e.beat + 1e-9) / groupSize);
        const eligible =
          e.source.note &&
          e.source.duration.base >= 8 &&
          e.endBeat <= (group + 1) * groupSize + 1e-9;
        if (
          !eligible ||
          group !== bucket ||
          (display !== 'tab' && run.length && run[0]!.stem !== e.stem)
        )
          flush();
        if (eligible) {
          run.push(e);
          bucket = group;
        } else bucket = -1;
      });
      flush();
      const beamed = new Set(beams.flatMap((g) => g.events));
      const stemEnds = new Map<number, number>();
      const stemBase = (e: EventGeometry) =>
        display === 'tab' ? tabTop! + (instrument.strings.length - 1) * 14 + 13 : e.y;
      const stemDir = (e: EventGeometry) => (display === 'tab' ? 1 : e.stem === 'down' ? 1 : -1);
      const stemX = (e: EventGeometry) => e.x + (display === 'tab' ? 0 : stemDir(e) > 0 ? -5 : 5);
      beams.forEach((g) => {
        const es = g.events.map((i) => events[i]!);
        const dir = stemDir(es[0]!);
        const end =
          dir > 0 ? Math.max(...es.map(stemBase)) + 28 : Math.min(...es.map(stemBase)) - 28;
        es.forEach((e) => stemEnds.set(e.event, end));
        shapes.push(line(stemX(es[0]!), end, stemX(es.at(-1)!), end, 4));
        // Secondary beams form runs; a lone sixteenth gets an inward hook.
        let sixteenths: EventGeometry[] = [];
        const finish = () => {
          if (sixteenths.length) {
            const a = sixteenths[0]!,
              z = sixteenths.at(-1)!;
            const hook = a === z ? (a === es.at(-1) ? -7 : 7) : 0;
            shapes.push(line(stemX(a), end - dir * 7, stemX(z) + hook, end - dir * 7, 3));
          }
          sixteenths = [];
        };
        es.forEach((e) => {
          if (e.source.duration.base === 16) sixteenths.push(e);
          else finish();
        });
        finish();
      });
      events.forEach((e) => {
        const src = e.source;
        if (staffBottom !== undefined) {
          if (src.note) {
            const step = e.step!;
            for (let l = -2; l >= step; l -= 2)
              shapes.push(line(e.x - 9, staffBottom - l * 5, e.x + 9, staffBottom - l * 5));
            for (let l = 10; l <= step; l += 2)
              shapes.push(line(e.x - 9, staffBottom - l * 5, e.x + 9, staffBottom - l * 5));
            if (src.technique === 'dead')
              shapes.push(
                line(e.x - 4, e.y - 4, e.x + 4, e.y + 4, 2),
                line(e.x - 4, e.y + 4, e.x + 4, e.y - 4, 2),
              );
            else
              shapes.push({
                kind: 'ellipse',
                x: e.x,
                y: e.y,
                rx: src.duration.base === 1 ? 7 : 5,
                ry: 3.5,
                hollow: src.duration.base <= 2,
              });
            if (e.accidental) shapes.push(text(e.x - 12, e.y + 5, e.accidental, 18));
          } else drawRest(shapes, e.x, staffBottom - 20, src.duration.base);
        }
        if (tabTop !== undefined) {
          if (src.note) {
            const label = src.technique === 'dead' ? 'x' : String(src.note.fret);
            shapes.push(
              {
                kind: 'rect',
                x: e.x - (label.length > 1 ? 9 : 6),
                y: e.tabY! - 7,
                width: label.length > 1 ? 18 : 12,
                height: 14,
                color: '#FFFFFF',
              },
              text(e.x, e.tabY! + 4, label, 13),
            );
          } else if (display === 'tab') drawRest(shapes, e.x, e.y + 8, src.duration.base);
        }
        if (
          src.note &&
          src.duration.base !== 1 &&
          (staffBottom !== undefined || display === 'tab')
        ) {
          const dir = stemDir(e),
            base = stemBase(e),
            end = stemEnds.get(e.event) ?? base + dir * 28;
          shapes.push(line(stemX(e), base, stemX(e), end, 1.3));
          if (!beamed.has(e.event) && src.duration.base >= 8) {
            for (let f = 0; f < (src.duration.base === 16 ? 2 : 1); f++) {
              const fy = end - dir * f * 7;
              shapes.push({
                kind: 'path',
                d: `M ${stemX(e)} ${fy} Q ${stemX(e) + 14} ${fy + dir * 8} ${stemX(e) + 5} ${fy + dir * 18}`,
                width: 2,
              });
            }
          }
        }
        if (src.duration.dots) {
          if (staffBottom !== undefined || display === 'tab')
            shapes.push({
              kind: 'ellipse',
              x: e.x + 10,
              y: e.y - (e.step !== undefined && e.step % 2 === 0 ? 5 : 0),
              rx: 1.6,
              ry: 1.6,
            });
        }
        const techniqueY = tabTop !== undefined && src.note ? e.tabY! - 10 : e.y + 14;
        if (src.technique === 'staccato')
          shapes.push({ kind: 'ellipse', x: e.x, y: techniqueY, rx: 2, ry: 2 });
        if (['hammer', 'pull', 'slide'].includes(src.technique ?? ''))
          shapes.push(
            text(
              e.x + Math.min(12, (e.endX - e.x) / 2),
              techniqueY,
              src.technique === 'hammer' ? 'h' : src.technique === 'pull' ? 'p' : '/',
              11,
            ),
          );
      });
      // Consecutive triplet values form independent groups of three; incomplete
      // groups retain a bracket to make their meaning explicit while editing.
      for (let i = 0; i < events.length;) {
        if (!events[i]!.source.duration.triplet) {
          i++;
          continue;
        }
        const group: EventGeometry[] = [];
        const base = events[i]!.source.duration.base;
        while (
          i < events.length &&
          events[i]!.source.duration.triplet &&
          events[i]!.source.duration.base === base &&
          group.length < 3
        )
          group.push(events[i++]!);
        const a = group[0]!,
          z = group.at(-1)!;
        const ty =
          staffBottom !== undefined
            ? Math.min(staffBottom - 50, ...group.map((e) => e.y - 38))
            : 24;
        shapes.push(
          line(a.x - 5, ty + 4, a.x - 5, ty),
          line(a.x - 5, ty, z.x + 6, ty),
          line(z.x + 6, ty, z.x + 6, ty + 4),
          text((a.x + z.x) / 2, ty - 3, '3', 11),
        );
      }
      measures.push({
        measure: b.index,
        x,
        width: w,
        contentX,
        endX,
        top: 0,
        bottom,
        staffBottom,
        tabTop,
        meter,
        fill,
        events,
        beams,
        primitives: shapes,
      });
      x += w;
    });
    lines.push({ index: lines.length, y, height, measures, primitives });
    y += height;
  }
  // Ties may cross measures and systems. Split at the margin of a system;
  // only equal sounding pitches are engraved, including alternate fingerings.
  const all = lines.flatMap((l) => l.measures.flatMap((m) => m.events.map((e) => ({ l, m, e }))));
  all.forEach((a, i) => {
    const b = all[i + 1];
    if (
      !a.e.source.tie ||
      !a.e.source.note ||
      !b?.e.source.note ||
      noteAt(instrument, a.e.source.note.string, a.e.source.note.fret) !==
        noteAt(instrument, b.e.source.note.string, b.e.source.note.fret)
    )
      return;
    const ay = a.m.staffBottom !== undefined ? a.e.y + 8 : a.e.tabY! + 8;
    const by = b.m.staffBottom !== undefined ? b.e.y + 8 : b.e.tabY! + 8;
    const arc = (l: ScoreLine, x1: number, y1: number, x2: number, y2: number) =>
      l.primitives.push({
        kind: 'path',
        d: `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.max(y1, y2) + 10} ${x2} ${y2}`,
        width: 1.2,
      });
    if (a.l === b.l) arc(a.l, a.e.x + 3, ay, b.e.x - 3, by);
    else {
      arc(a.l, a.e.x + 3, ay, a.m.x + a.m.width - 2, ay);
      arc(b.l, b.m.x + 2, by, b.e.x - 3, by);
    }
  });
  return {
    width: Math.max(usable, ...lines.flatMap((l) => l.measures.map((m) => m.x + m.width + 12))),
    height: y,
    lines,
    strings: instrument.strings.length,
    display,
  };
}
function drawRest(shapes: Primitive[], x: number, y: number, base: number) {
  if (base <= 2)
    shapes.push({ kind: 'rect', x: x - 6, y: base === 1 ? y - 10 : y - 14, width: 12, height: 4 });
  else if (base === 4)
    shapes.push({
      kind: 'path',
      d: `M ${x - 3} ${y - 14} L ${x + 3} ${y - 7} L ${x - 2} ${y} L ${x + 3} ${y + 6} Q ${x - 8} ${y + 2} ${x - 1} ${y + 12}`,
      width: 2.5,
    });
  else {
    shapes.push(line(x + 4, y - 8, x - 2, y + 12, 1.6));
    for (let f = 0; f < (base === 16 ? 2 : 1); f++)
      shapes.push(
        { kind: 'ellipse', x: x - 2 - f * 2, y: y - 7 + f * 7, rx: 3, ry: 2.5 },
        {
          kind: 'path',
          d: `M ${x - 2 - f * 2} ${y - 5 + f * 7} Q ${x + 2} ${y - 1 + f * 7} ${x + 4 - f * 2} ${y - 8 + f * 7}`,
        },
      );
  }
}
export function hitTest(layout: ScoreLayout, x: number, y: number): EditCursor | null {
  const l = layout.lines.find((l) => y >= l.y && y < l.y + l.height);
  if (!l) return null;
  const m = l.measures.find((m) => x >= m.x && x <= m.x + m.width);
  if (!m) return null;
  const localY = y - l.y;
  const string =
    m.tabTop !== undefined
      ? Math.max(
          0,
          Math.min(layout.strings - 1, layout.strings - 1 - Math.round((localY - m.tabTop) / 14)),
        )
      : 0;
  if (x < m.contentX - 7) return { measure: m.measure, event: 0, string };
  // Half the trailing space belongs to the insertion point after the final event.
  const final = m.events.at(-1);
  if (!final || x >= (final.x + final.endX) / 2)
    return { measure: m.measure, event: m.events.length, string };
  let nearest = m.events[0]!;
  for (const e of m.events) if (Math.abs(e.x - x) < Math.abs(nearest.x - x)) nearest = e;
  return {
    measure: m.measure,
    event: nearest.event,
    string: m.tabTop === undefined ? (nearest.source.note?.string ?? 0) : string,
  };
}
export function positionPoint(
  layout: ScoreLayout,
  position: MusicalPosition,
): { x: number; y: number; height: number } | null {
  for (const l of layout.lines) {
    const m = l.measures.find((m) => m.measure === position.measure);
    if (!m) continue;
    if (!Number.isFinite(position.beat) || position.beat < 0) return null;
    const e = m.events.find((e) => position.beat >= e.beat && position.beat < e.endBeat);
    let x = e ? e.x + ((position.beat - e.beat) / (e.endBeat - e.beat)) * (e.endX - e.x) : m.endX;
    const last = m.events.at(-1);
    if (!e && (!last || last.endBeat < m.meter.beats)) {
      const fromBeat = last?.endBeat ?? 0,
        fromX = last?.endX ?? m.contentX;
      x =
        fromX +
        Math.max(0, Math.min(1, (position.beat - fromBeat) / (m.meter.beats - fromBeat))) *
          (m.endX - fromX);
    }
    return { x, y: l.y + 26, height: m.bottom - 20 };
  }
  return null;
}
export function cursorPoint(
  layout: ScoreLayout,
  cursor: EditCursor,
): { x: number; y: number; height: number } | null {
  for (const l of layout.lines) {
    const m = l.measures.find((m) => m.measure === cursor.measure);
    if (!m) continue;
    return {
      x: m.events[cursor.event]?.x ?? m.events.at(-1)?.endX ?? m.contentX,
      y:
        l.y +
        (m.tabTop !== undefined
          ? m.tabTop + (layout.strings - 1 - cursor.string) * 14 - 9
          : (m.events[cursor.event]?.y ?? m.staffBottom! - 20) - 9),
      height: 18,
    };
  }
  return null;
}
