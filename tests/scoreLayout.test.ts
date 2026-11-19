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
