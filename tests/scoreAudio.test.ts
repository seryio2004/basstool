import assert from 'node:assert/strict';
import test from 'node:test';
import { analysisAudio, detectChord } from '../src/core/chroma';
import { tunings } from '../src/core/instrument';
import {
  changeMeasureMeter,
  emptyScore,
  insertNote,
  measureFill,
  parseScore,
  type Edit,
} from '../src/core/score';
import { layoutScore } from '../src/core/scoreLayout';
import { scoreTimeline, pianoPosition, synthTones, scheduleTones } from '../src/core/scoreAudio';
import { printDocument } from '../src/core/tabPrint';
import { positionAt } from '../src/core/timeMap';
const bass = tunings.standard4;
const cursor = { measure: 0, event: 0, string: 1 };
test('piano resolves sounding octave, instrument limits and preferred fret', () => {
  assert.deepEqual(pianoPosition(bass, 43, 'low'), { string: 3, fret: 0 });
  assert.deepEqual(pianoPosition(bass, 43, 'high'), { string: 0, fret: 15 });
  assert.equal(pianoPosition(bass, 27, 'low'), undefined);
  assert.deepEqual(pianoPosition(bass, 67, 'low'), { string: 3, fret: 24 });
});
test('quintuplets fill exactly, split and retain brackets after persistence', () => {
  let edit: Edit = { score: emptyScore({ beats: 1, unit: 4 }, 1), cursor };
  for (let i = 0; i < 5; i++)
    edit = insertNote(edit.score, edit.cursor, 0, { base: 16, tuplet: 5, dots: 0 }, bass);
  assert.equal(measureFill(edit.score, 0).status, 'full');
  assert.deepEqual(parseScore(edit.score), edit.score);
  assert.ok(
    layoutScore(edit.score, bass, 'tab', 600).lines[0]!.measures[0]!.primitives.some(
      (p) => p.kind === 'text' && p.text === '5',
    ),
  );
  let mix: Edit = { score: emptyScore({ beats: 1, unit: 4 }, 1), cursor };
  for (const duration of [
    { base: 16, tuplet: 5, dots: 0 },
    { base: 8, triplet: true, dots: 0 },
    { base: 4, dots: 0 },
  ] as const)
    mix = insertNote(mix.score, mix.cursor, 0, duration, bass);
  assert.equal(mix.notice, 'split');
  assert.equal(measureFill(mix.score, 0).status, 'full');
  assert.ok(parseScore(mix.score));
});
test('event boundaries use marked beats, silence and score gaps', () => {
  let e: Edit = { score: emptyScore(), cursor };
  for (let i = 0; i < 3; i++) e = insertNote(e.score, e.cursor, i, { base: 4, dots: 0 }, bass);
  const map = { measures: [2, 6], beats: [2.6, 4.2, 5] };
  const notes = scoreTimeline(e.score, map, 8, bass);
  assert.deepEqual(
    notes.slice(0, 3).map((n) => [n.start, n.end]),
    [
      [2, 2.6],
      [2.6, 4.2],
      [4.2, 5],
    ],
  );
  assert.deepEqual(positionAt(map, e.score, 2.6, 8), { measure: 0, beat: 1 });
  assert.equal(notes[3]!.midi, undefined);
  assert.equal(scoreTimeline(e.score, { measures: [], beats: [] }, 8, bass).length, 0);
});
test('synth schedules tied notes across bars, partial seek, speed and loop end', () => {
  const events = [0, 1, 2].map((i) => ({
    id: String(i),
    measure: i,
    event: 0,
    start: i,
    end: i + 1,
    midi: 40 + (i % 2),
    tie: false,
  }));
  events[0]!.tie = true;
  events[1]!.midi = 40;
  const tones = synthTones(events);
  assert.deepEqual(tones, [
    { start: 0, end: 2, midi: 40 },
    { start: 2, end: 3, midi: 40 },
  ]);
  assert.deepEqual(scheduleTones(tones, 1.5, 3, 0.5, 10, 2.25), [
    { id: 0, midi: 40, when: 10, until: 11 },
    { id: 1, midi: 40, when: 11, until: 11.5 },
  ]);
});
test('chroma detects local major, minor and seventh segments and silence', () => {
  const rate = 44100;
  const chords = [[60, 64, 67], [57, 60, 64], [55, 59, 62, 65], []];
  const samples = Float32Array.from({ length: rate * 4 }, (_, i) =>
    chords[Math.floor(i / rate)]!.reduce(
      (s, m) => s + 0.15 * Math.sin((2 * Math.PI * 440 * 2 ** ((m - 69) / 12) * i) / rate),
      0,
    ),
  );
  const audio = analysisAudio(samples, rate);
  assert.ok(audio.pcm.length < samples.length / 8);
  ['C', 'Am', 'G7'].forEach((symbol, i) => {
    const guess = detectChord(audio, i, i + 1);
    assert.equal(guess?.symbol, symbol);
    assert.ok(guess.confidence > 0.85);
  });
  assert.equal(detectChord(audio, 3, 4), null);
});
test('print paginates by notation system, escapes user text and includes chords', () => {
  const score = emptyScore({ beats: 4, unit: 4 }, 24);
  score.measures[0]!.chords = [
    { beat: 0, symbol: 'G7' },
    { beat: 2, symbol: '<Am>' },
  ];
  assert.deepEqual(parseScore(score)?.measures[0]?.chords, score.measures[0]!.chords);
  const html = printDocument('A & B <live>', score, bass);
  assert.ok(html.includes('<h1>A &amp; B &lt;live&gt;</h1>'));
  assert.ok(html.includes('>G7</text>') && html.includes('&lt;Am&gt;'));
  assert.ok((html.match(/<svg /g) ?? []).length > 1);
  assert.ok(html.includes('break-inside:avoid'));
});

test('shorter inherited meter preserves manual chords in following bars', () => {
  const score = emptyScore();
  score.measures[1]!.chords = [{ beat: 3, symbol: 'Dm7' }];
  const edit = changeMeasureMeter(score, cursor, { beats: 3, unit: 4 });
  assert.equal(edit.score, score);
  assert.equal(edit.notice, 'chordOutside');
});
