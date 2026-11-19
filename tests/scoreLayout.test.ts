import test from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutScore,
  hitTest,
  positionPoint,
  cursorPoint,
  spellPitch,
} from '../src/core/scoreLayout';
import { emptyScore } from '../src/core/score';
import type { BaseValue, Meter, Score } from '../src/core/scoreTypes';
import { tunings } from '../src/core/instrument';
const instrument = tunings.standard4;
function scoreOf(
  pitches: number[],
  base: BaseValue = 4,
  meter: Meter = { beats: 4, unit: 4 },
  count = 1,
): Score {
  const score = emptyScore(meter, count);
  return {
    ...score,
    measures: score.measures.map((m, i) => ({
      ...m,
      events: pitches.map((pitch, j) => ({
        id: `e${i}-${j}`,
        duration: { base, dots: 0 },
        note: { string: 0, fret: pitch - 28 },
      })),
    })),
  };
}
test('bass is written one octave above sounding pitch; G2 bottom line, D3 middle', () => {
  const layout = layoutScore(scoreOf([31, 38, 40]), instrument, 'both', 350);
  const m = layout.lines[0]!.measures[0]!,
    [g, d, e] = m.events;
  assert.equal(g!.step, 0);
  assert.equal(g!.y, m.staffBottom);
  assert.equal(g!.stem, 'up');
  assert.equal(d!.step, 4);
  assert.equal(d!.stem, 'down');
  assert.equal(e!.stem, 'down');
  assert.equal(g!.tabY, m.tabTop! + 42);
  assert.ok(m.primitives.some((p) => p.kind === 'text' && p.text === '3'));
});
test('beam groups stay in beats in 4/4 and groups of three eighths in 6/8', () => {
  const simple = layoutScore(scoreOf(Array(8).fill(31), 8), instrument, 'both', 1200).lines[0]!
    .measures[0]!;
  assert.deepEqual(
    simple.beams.map((g) => g.events),
    [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
    ],
  );
  const sixteenths = layoutScore(scoreOf(Array(16).fill(31), 16), instrument, 'both', 350).lines[0]!
    .measures[0]!;
  assert.deepEqual(
    sixteenths.beams.map((g) => g.events),
    [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9, 10, 11],
      [12, 13, 14, 15],
    ],
  );
  assert.ok(sixteenths.beams.every((g) => g.levels === 2));
  const compound = layoutScore(
    scoreOf(Array(6).fill(31), 8, { beats: 6, unit: 8 }),
    instrument,
    'both',
    350,
  ).lines[0]!.measures[0]!;
  assert.deepEqual(
    compound.beams.map((g) => g.events),
    [
      [0, 1, 2],
      [3, 4, 5],
    ],
  );
  const rest = scoreOf(Array(8).fill(31), 8);
  delete rest.measures[0]!.events[1]!.note;
  assert.deepEqual(
    layoutScore(rest, instrument, 'both', 1200).lines[0]!.measures[0]!.beams.map((g) => g.events),
    [
      [2, 3],
      [4, 5],
      [6, 7],
    ],
  );
});
test('accidentals follow key, cancel within measure and reset at barline', () => {
  const score = scoreOf([30, 30, 29, 30], 4, undefined, 2); // F#, F#, F, F# sounding
  score.keyFifths = 1;
  const layout = layoutScore(score, instrument, 'staff', 1200);
  assert.deepEqual(
    layout.lines[0]!.measures[0]!.events.map((e) => e.accidental),
    [undefined, undefined, '♮', '♯'],
  );
  assert.equal(layout.lines[0]!.measures[1]!.events[0]!.accidental, undefined);
  assert.equal(spellPitch(34, 0).name, 'Si♭');
  assert.equal(spellPitch(39, 0).name, 'Mi♭');
  assert.equal(spellPitch(37, 0).name, 'Do♯');
  assert.equal(spellPitch(37, -3).name, 'Re♭');
  assert.equal(spellPitch(29, 7).name, 'Mi♯');
  assert.equal(spellPitch(35, -7).name, 'Do♭');
});
test('mobile fits one or two measures; desktop fits more; dense sixteenths fit', () => {
  const score = scoreOf([31, 31, 31, 31], 4, undefined, 8);
  const mobile = layoutScore(score, instrument, 'both', 350),
    desktop = layoutScore(score, instrument, 'both', 1200);
  assert.ok(mobile.lines.every((l) => l.measures.length >= 1 && l.measures.length <= 2));
  assert.ok(desktop.lines[0]!.measures.length > mobile.lines[0]!.measures.length);
  assert.equal(mobile.width, 350);
  assert.equal(layoutScore(scoreOf(Array(16).fill(31), 16), instrument, 'both', 350).width, 350);
  const denseKey = scoreOf(Array(16).fill(31), 16);
  denseKey.keyFifths = -7;
  const long = layoutScore(denseKey, instrument, 'both', 350);
  assert.ok(long.width >= 350); // signatures never squeeze notes below readable spacing
});
test('hitTest returns notes, rests, string and final insertion slot on any system', () => {
  const layout = layoutScore(scoreOf([31, 33, 35, 36], 4, undefined, 6), instrument, 'both', 350);
  for (const l of layout.lines)
    for (const m of l.measures) {
      assert.deepEqual(hitTest(layout, m.events[1]!.x, l.y + m.tabTop!), {
        measure: m.measure,
        event: 1,
        string: 3,
      });
      assert.deepEqual(hitTest(layout, m.events[0]!.x, l.y + m.tabTop! + 42), {
        measure: m.measure,
        event: 0,
        string: 0,
      });
      assert.equal(hitTest(layout, m.endX + 2, l.y + m.tabTop!)!.event, 4);
      assert.ok(cursorPoint(layout, { measure: m.measure, event: 4, string: 0 }));
    }
  assert.equal(hitTest(layout, -1, -1), null);
  assert.equal(positionPoint(layout, { measure: 99, beat: 0 }), null);
  const m = layout.lines[0]!.measures[0]!;
  assert.equal(positionPoint(layout, { measure: 0, beat: 0 })!.x, m.events[0]!.x);
  assert.equal(
    positionPoint(layout, { measure: 0, beat: 0.5 })!.x,
    (m.events[0]!.x + m.events[0]!.endX) / 2,
  );
});
test('rests, dots, triplets, techniques and cross-system ties produce geometry', () => {
  const score = scoreOf([31, 31, 31], 8, undefined, 2);
  score.measures[0]!.events.forEach((e) => {
    e.duration.triplet = true;
  });
  score.measures[0]!.events[0]!.duration.dots = 1;
  score.measures[0]!.events[0]!.technique = 'hammer';
  score.measures[0]!.events[1]!.technique = 'dead';
  score.measures[0]!.events[2]!.tie = true;
  const layout = layoutScore(score, instrument, 'both', 230);
  assert.equal(layout.lines.length, 2);
  assert.ok(layout.lines.every((l) => l.primitives.some((p) => p.kind === 'path')));
  const shapes = layout.lines[0]!.measures[0]!.primitives;
  for (const txt of ['3', 'h', 'x'])
    assert.ok(shapes.some((p) => p.kind === 'text' && p.text === txt));
  const rest = layoutScore(emptyScore(), instrument, 'staff', 350);
  assert.ok(rest.lines[0]!.measures[0]!.primitives.some((p) => p.kind === 'rect'));
  const tab = layoutScore(score, instrument, 'tab', 350);
  assert.equal(tab.lines[0]!.measures[0]!.staffBottom, undefined);
  assert.ok(tab.lines[0]!.measures[0]!.beams.every((g) => g.stem === 'down'));
});
test('64 measures of sixteenths: repeatable layout benchmark', () => {
  const score = scoreOf(
    Array.from({ length: 16 }, (_, i) => 28 + (i % 12)),
    16,
    undefined,
    64,
  );
  // Timing is diagnostic, not a platform-dependent pass/fail threshold.
  const samples: number[] = [];
  for (let i = 0; i < 12; i++) {
    const start = performance.now();
    const layout = layoutScore(score, instrument, 'both', 350);
    samples.push(performance.now() - start);
    assert.equal(layout.lines.flatMap((l) => l.measures).length, 64);
    assert.equal(layout.lines.flatMap((l) => l.measures.flatMap((m) => m.events)).length, 1024);
  }
  samples.sort((a, b) => a - b);
  console.log(
    `ScoreLayout 64 × 16, 350px: median=${samples[6]!.toFixed(2)}ms, max=${samples.at(-1)!.toFixed(2)}ms (Node, geometry only)`,
  );
});

test('incomplete bars reserve remaining time and the playhead traverses the empty part', () => {
  const layout = layoutScore(scoreOf([31]), instrument, 'both', 350);
  const m = layout.lines[0]!.measures[0]!;
  const note = m.events[0]!;
  assert.ok(note.endX < m.endX);
  assert.equal(cursorPoint(layout, { measure: 0, event: 1, string: 0 })!.x, note.endX);
  assert.equal(positionPoint(layout, { measure: 0, beat: 1 })!.x, note.endX);
  assert.ok(positionPoint(layout, { measure: 0, beat: 2 })!.x > note.endX);
  assert.equal(positionPoint(layout, { measure: 0, beat: 4 })!.x, m.endX);
});

test('triplets and accidentals remain legible in incomplete mobile bars', () => {
  const score = scoreOf([35, 36, 37], 8, { beats: 6, unit: 8 }, 4);
  score.measures.forEach((m) =>
    m.events.forEach((e) => {
      e.duration.triplet = true;
    }),
  );
  const layout = layoutScore(score, instrument, 'both', 350, -2);
  for (const l of layout.lines)
    for (const m of l.measures)
      for (let i = 1; i < m.events.length; i++) {
        assert.ok(m.events[i]!.x - m.events[i - 1]!.x >= 14);
      }
});

test('editable note and append targets reserve 44 px with accidentals', () => {
  const score = scoreOf([29, 30, 29, 31, 35, 36], 16, undefined, 2);
  for (const width of [390, 1200]) {
    const layout = layoutScore(score, instrument, 'both', width, 0, true);
    for (const line of layout.lines) {
      for (const measure of line.measures) {
        let left = measure.x;
        for (const [i, event] of measure.events.entries()) {
          const right = (event.x + (measure.events[i + 1]?.x ?? event.endX)) / 2;
          assert.ok(right - left >= 44);
          left = right;
        }
        assert.ok(measure.x + measure.width - left >= 44);
      }
    }
  }
});

type Shape = ReturnType<typeof layoutScore>['lines'][number]['primitives'][number];
function engraving(pitches: number[], bases: number[], extra?: (s: Score) => void) {
  const score = scoreOf(pitches);
  score.measures[0]!.events.forEach((e, i) => {
    e.duration = { base: bases[i] as BaseValue, dots: 0 };
  });
  extra?.(score);
  const m = layoutScore(score, instrument, 'staff', 1200).lines[0]!.measures[0]!;
  const stems = m.primitives
    .filter((p): p is Extract<Shape, { kind: 'line' }> => p.kind === 'line' && p.width === 1.3)
    .sort((a, b) => a.x1 - b.x1);
  const fills = m.primitives.filter(
    (p): p is Extract<Shape, { kind: 'path' }> => p.kind === 'path' && !!p.fill,
  );
  const beams = fills
    .filter((p) => p.d.includes(' L '))
    .map((p) => {
      const n = p.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      return {
        x1: n[0]!,
        y1: n[1]!,
        x2: n[2]!,
        y2: n[3]!,
        thickness: Math.round(Math.abs(n[5]! - n[3]!) * 100) / 100,
      };
    });
  const flags = fills.filter((p) => p.d.includes(' C '));
  return { m, stems, beams, flags };
}
test('beamed groups share the majority stem direction and a gentle, bounded slope', () => {
  // G2 A2 up, D3 E3 down: tie broken by the note farthest from the middle line (G2).
  const tie = engraving([31, 33, 38, 40], [16, 16, 16, 16]);
  assert.deepEqual(
    tie.m.events.map((e) => e.stem),
    ['up', 'up', 'up', 'up'],
  );
  const majority = engraving([38, 40, 43, 31], [16, 16, 16, 16]);
  assert.deepEqual(majority.m.beams[0]!.stem, 'down');
  assert.ok(majority.m.events.every((e) => e.stem === 'down'));
  // Rising scale: beam follows it, but by at most one space, with stems ≥ 3.2 spaces.
  const rising = engraving([28, 31, 35, 40], [16, 16, 16, 16]);
  const [primary, secondary] = rising.beams;
  assert.equal(rising.beams.length, 2);
  assert.ok(primary!.y2 < primary!.y1 && primary!.y1 - primary!.y2 <= 10.1);
  assert.equal(primary!.thickness, 5);
  assert.equal(secondary!.thickness, 5);
  assert.ok(Math.abs(secondary!.y1 - primary!.y1 - 7.5) < 0.02); // 0.25-space gap between beams
  const lengths = rising.stems.map((s) => Math.abs(s.y2 - s.y1));
  assert.ok(Math.min(...lengths) >= 32 && Math.min(...lengths) <= 38);
  // The beam ends meet the outer edge of the first and last stems.
  assert.ok(Math.abs(primary!.x1 - (rising.stems[0]!.x1 - 0.65)) < 0.01);
  assert.ok(Math.abs(primary!.x2 - (rising.stems.at(-1)!.x1 + 0.65)) < 0.01);
  // A contour that turns back keeps the beam horizontal.
  const turn = engraving([31, 40, 31, 33], [16, 16, 16, 16]);
  assert.equal(turn.beams[0]!.y1, turn.beams[0]!.y2);
});
test('stems are 3.5 spaces, flush with the head and reach the middle line', () => {
  const { m, stems, flags } = engraving([31, 33, 40, 52], [8, 4, 8, 4]);
  // Eighths separated by a quarter that crosses the beat are flagged, not beamed.
  assert.equal(m.beams.length, 0);
  assert.equal(flags.length, 2);
  const [g, , e] = m.events;
  assert.equal(stems[0]!.x1, g!.x + 6 - 0.65);
  assert.equal(Math.abs(stems[0]!.y2 - g!.y), 35);
  assert.equal(stems[2]!.x1, e!.x - 6 + 0.65);
  assert.equal(Math.abs(stems[2]!.y2 - e!.y), 35);
  // High E (three ledger lines) stretches its stem down to the middle line.
  assert.equal(stems[3]!.y2, m.staffBottom! - 20);
  const sixteenth = engraving([31], [16]);
  assert.equal(sixteenth.flags.length, 2);
});
test('a lone sixteenth gets a partial beam toward its own beat subdivision', () => {
  const dotted = engraving([31, 33], [8, 16], (s) => {
    s.measures[0]!.events[0]!.duration.dots = 1;
  });
  const [primary, partial] = dotted.beams;
  assert.equal(dotted.beams.length, 2);
  assert.ok(partial!.x2 - partial!.x1 <= 11 + 0.65 + 1e-6);
  assert.ok(Math.abs(partial!.x2 - primary!.x2) < 1e-6); // hangs to the left from the last stem
  const snap = engraving([31, 33], [16, 8], (s) => {
    s.measures[0]!.events[1]!.duration.dots = 1;
  });
  assert.ok(Math.abs(snap.beams[1]!.x1 - snap.beams[0]!.x1) < 1e-6); // points right
});
test('tuplet brackets clear beams; spacing grows by about √2 per value', () => {
  const triplet = engraving([31, 33, 35], [8, 8, 8], (s) =>
    s.measures[0]!.events.forEach((e) => {
      e.duration.triplet = true;
    }),
  );
  const bracket = triplet.m.primitives.find(
    (p) => p.kind === 'line' && p.y1 === p.y2 && p.width === 1 && !p.color && p.x2 - p.x1 < 400,
  ) as Extract<Shape, { kind: 'line' }>;
  assert.ok(bracket);
  assert.ok(bracket.y1 < Math.min(...triplet.beams.map((b) => Math.min(b.y1, b.y2))) - 5);
  const mixed = engraving([31, 31, 31, 31, 31, 31, 31], [4, 8, 8, 16, 16, 16, 16]);
  const xs = mixed.m.events.map((e) => e.x);
  const quarter = xs[1]! - xs[0]!,
    eighth = xs[2]! - xs[1]!,
    sixteenth = xs[4]! - xs[3]!;
  assert.ok(quarter > eighth && eighth > sixteenth);
  assert.ok(quarter / eighth < 1.6 && eighth / sixteenth < 1.6);
});
