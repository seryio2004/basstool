import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyScore,
  eventNotes,
  measureFill,
  parseScore,
  retune,
  setChordNote,
  setDuration,
  tiedStrings,
  toggleTie,
  undo,
  redo,
} from '../src/core/score';
import { createScoreEditor, editScore, restoreScore } from '../src/core/scoreEditor';
import { analysisAudio, detectChord, inferChord } from '../src/core/chroma';
import { tunings } from '../src/core/instrument';
import { chordSegment, scheduleTones, scoreTimeline, synthTones } from '../src/core/scoreAudio';
import { layoutScore } from '../src/core/scoreLayout';
import { musicXml, tabText } from '../src/core/scoreExport';
import { printDocument } from '../src/core/tabPrint';

const bass = tunings.standard4;
const quarter = { base: 4, dots: 0 } as const;
const cursor = { measure: 0, event: 0, string: 0 };
const notes = [
  { string: 0, fret: 8 },
  { string: 1, fret: 7 },
  { string: 2, fret: 5 },
  { string: 3, fret: 5 },
];
function chord() {
  const score = emptyScore({ beats: 2, unit: 4 }, 1);
  score.measures[0]!.events = [0, 1].map((i) => ({ id: 'e' + i, duration: quarter, notes }));
  return score;
}

test('legacy notes migrate and chords persist in string order with no duplicates', () => {
  const s = chord();
  s.measures[0]!.events[0] = { id: 'old', duration: quarter, note: notes[1] };
  s.measures[0]!.events[1]!.notes = [...notes].reverse();
  const parsed = parseScore(s)!;
  assert.deepEqual(parsed.measures[0]!.events.map(eventNotes), [[notes[1]], notes]);
  s.measures[0]!.events[1]!.notes = [notes[0]!, notes[0]!];
  assert.equal(parseScore(s), null);
});

test('stack, replace and erase one string without advancing; undo and redo restore the voicing', () => {
  let editor = createScoreEditor(emptyScore({ beats: 1, unit: 4 }, 1));
  const put = (string: number, fret: number | null) => {
    editor = editScore(editor, (s, c) => setChordNote(s, { ...c, string }, fret, quarter, bass));
  };
  for (const n of [...notes].reverse()) put(n.string, n.fret);
  const current = () => editor.history.present.score.measures[0]!.events[0]!;
  assert.deepEqual(eventNotes(current()), notes);
  assert.deepEqual(editor.history.present.cursor, cursor);
  assert.equal(measureFill(editor.history.present.score, 0).status, 'full');
  put(2, 10);
  put(1, null);
  assert.deepEqual(
    eventNotes(current()).map((n) => n.fret),
    [8, 10, 5],
  );
  editor = restoreScore(editor, undo);
  assert.deepEqual(
    eventNotes(current()).map((n) => n.fret),
    [8, 7, 10, 5],
  );
  editor = restoreScore(editor, redo);
  for (const string of [0, 2, 3]) put(string, null);
  assert.deepEqual(eventNotes(current()), []);
  assert.deepEqual(current().duration, quarter);
});

test('meter split ties all voices and independent ties survive edits, playback, seek and persistence', () => {
  const score = chord();
  const split = setDuration(score, { ...cursor, event: 1 }, { base: 2, dots: 0 });
  assert.equal(split.notice, 'split');
  assert.deepEqual(tiedStrings(split.score.measures[0]!.events[1]!), [0, 1, 2, 3]);
  assert.deepEqual(eventNotes(split.score.measures[1]!.events[0]), notes);
  assert.equal(measureFill(split.score, 0).status, 'full');
  const partial = toggleTie(score, cursor).score;
  const edited = setChordNote(partial, { ...cursor, event: 1, string: 1 }, 8, quarter, bass).score;
  assert.deepEqual(tiedStrings(parseScore(edited)!.measures[0]!.events[0]!), [0]);
  const timeline = scoreTimeline(edited, { measures: [0], beats: [] }, 2, bass, 60);
  const tones = synthTones(timeline);
  assert.equal(tones.length, 7);
  assert.equal(tones[0]!.end, 2);
  assert.deepEqual(
    scheduleTones(tones, 1.25, 2, 1, 0, 2).map((t) => t.midi),
    [36, 41, 43, 48],
  );
  assert.equal(inferChord(chordSegment(score.measures[0]!, score.meter, 0, bass).notes), 'C');
  assert.deepEqual(
    tiedStrings(
      setChordNote(edited, { ...cursor, event: 1 }, 9, quarter, bass).score.measures[0]!.events[0]!,
    ),
    [],
  );
});

test('retuning assigns a separate playable string per pitch', () => {
  const score = retune(chord(), bass, tunings.dropD);
  const n = eventNotes(score.measures[0]!.events[0]);
  assert.equal(new Set(n.map((v) => v.string)).size, 4);
  assert.deepEqual(
    n.map((v) => tunings.dropD.strings[v.string]! + v.fret).sort(),
    [36, 40, 43, 48],
  );
});

test('seconds, accidentals, common stem, aligned tab and exported chord notes', () => {
  const score = chord();
  score.measures[0]!.events = [
    {
      id: 'second',
      duration: quarter,
      notes: [
        { string: 0, fret: 9 },
        { string: 1, fret: 6 },
      ],
    },
  ]; // C sharp and E flat
  const bar = layoutScore(score, bass, 'both', 350).lines[0]!.measures[0]!;
  const [a, b] = bar.events[0]!.heads;
  assert.notEqual(a!.accidentalX, b!.accidentalX);
  score.measures[0]!.events[0]!.notes![1]!.fret = 7; // replace with E
  score.measures[0]!.events[0]!.notes![0]!.fret = 10; // D and E
  const m = layoutScore(score, bass, 'both', 350).lines[0]!.measures[0]!;
  const e = m.events[0]!;
  assert.notEqual(e.heads[0]!.x, e.heads[1]!.x);
  assert.equal(m.primitives.filter((p) => p.kind === 'line' && p.width === 1.3).length, 1);
  assert.deepEqual(
    m.primitives
      .filter((p) => p.kind === 'text' && p.size === 13)
      .map((p) => p.kind === 'text' && p.x),
    [e.x, e.x],
  );
  assert.match(printDocument('test', score, bass), />10<\/text>/);
  assert.match(tabText(score, bass), /3 \|7--\|\n4 \|10-\|/);
  assert.equal(musicXml('test', chord(), bass).match(/<chord\/>/g)?.length, 6);
});

const extended: [string, number[]][] = [
  ['Cmaj9', [0, 4, 7, 11, 14]],
  ['C9', [0, 4, 7, 10, 14]],
  ['Cm9', [0, 3, 7, 10, 14]],
  ['Cm(maj9)', [0, 3, 7, 11, 14]],
  ['C7(♭9)', [0, 4, 7, 10, 13]],
  ['C7(♯9)', [0, 4, 7, 10, 15]],
  ['Cadd9', [0, 4, 7, 14]],
  ['C6/9', [0, 4, 7, 9, 14]],
  ['C11', [0, 5, 10, 14]],
  ['Cm11', [0, 3, 7, 10, 14, 17]],
  ['C7(♯11)', [0, 4, 7, 10, 18]],
  ['Cmaj7(♯11)', [0, 4, 7, 11, 18]],
  ['C13', [0, 4, 7, 10, 14, 21]],
  ['Cm13', [0, 3, 7, 10, 14, 21]],
  ['C13', [0, 4, 7, 10, 21]],
  ['Cmaj9', [0, 4, 11, 14]],
  ['Cm11', [0, 3, 10, 14, 17]],
  ['C13', [0, 4, 10, 14, 21]],
  ['Am7', [-3, 0, 4, 7]],
  ['C6', [0, 4, 7, 9]],
  ['C/E', [4, 7, 12]],
  ['Cmaj9/E', [4, 7, 11, 12, 14]],
];
test('extended spellings, conventional omissions and bass-dependent ambiguities', () => {
  for (const [symbol, tones] of extended)
    assert.equal(inferChord(tones.map((n) => 48 + n)), symbol, symbol);
});
test('synthetic five-note voicings retain extensions and inversions in chroma', () => {
  const rate = 12000;
  for (const [symbol, tones] of extended) {
    const pcm = Float32Array.from({ length: rate / 2 }, (_, i) =>
      tones.reduce(
        (a, n) => a + 0.12 * Math.sin((2 * Math.PI * 440 * 2 ** ((48 + n - 69) / 12) * i) / rate),
        0,
      ),
    );
    const guess = detectChord(analysisAudio(pcm, rate), 0, 0.5);
    assert.equal(guess?.symbol, symbol, symbol);
  }
});
