import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inferChord } from '../src/core/chroma';
import {
  manualTrainChords,
  parseTrainChord,
  scoreTrain,
  trainTargets,
} from '../src/core/chordTrain';
import { fifthsCircle } from '../src/core/notation';
import {
  progressionChords,
  randomTrainProgression,
  trainProgressions,
  type TrainDifficulty,
} from '../src/core/trainProgressions';

const byBar = <T>(beats: T[]) => beats.filter((_, index) => index % 4 === 0);

test('every named progression has the expected chords and completes whole measures', () => {
  const examples: Record<string, string> = {
    pop: 'C G Am F',
    fifties: 'C Am F G',
    'major-cadence': 'Dm7 G7 Cmaj7 Cmaj7',
    'minor-cadence': 'Bm7b5 E7 Am Am',
    'major-blues': 'C7 C7 C7 C7 F7 F7 C7 C7 G7 F7 C7 G7',
    'minor-blues': 'Am7 Am7 Am7 Am7 Dm7 Dm7 Am7 Am7 F7 E7 Am7 E7',
    dorian: 'Am7 D7 Am7 D7',
    mixolydian: 'C7 Bb C7 Bb',
    'major-funk': 'C9 C9 C9 C9',
    'minor-funk': 'Am9 Am9 Am9 Am9',
    'minor-pop': 'Am F C G',
  };
  assert.equal(trainProgressions.length, Object.keys(examples).length);
  for (const progression of trainProgressions) {
    const chords = progressionChords(progression.mode === 'major' ? 'C' : 'A', progression);
    const symbols = examples[progression.value]!.split(' ');
    assert.equal(chords.length, 4 * symbols.length, progression.value);
    assert.deepEqual(
      chords.map(({ symbol }) => symbol),
      symbols.flatMap((symbol) => Array(4).fill(symbol)),
    );
    assert.ok(chords.every(({ role }) => role));
  }
});

test('transposition follows diatonic spelling in every selectable key', () => {
  for (const progression of trainProgressions) {
    for (const { major, minor } of fifthsCircle) {
      const tonic = progression.mode === 'major' ? major : parseTrainChord(minor)!.tonic;
      const chords = progressionChords(tonic, progression);
      assert.ok(chords.every(({ symbol, root }) => parseTrainChord(symbol)?.root === root));
    }
  }
  const minor = trainProgressions.find(({ value }) => value === 'minor-cadence')!;
  assert.deepEqual(
    byBar(progressionChords('D#', minor)).map(({ symbol }) => symbol),
    ['E#m7b5', 'A#7', 'D#m', 'D#m'],
  );
  const mixolydian = trainProgressions.find(({ value }) => value === 'mixolydian')!;
  assert.deepEqual(
    byBar(progressionChords('Db', mixolydian)).map(({ symbol, role }) => [symbol, role]),
    [
      ['Db7', 'tonic'],
      ['Cb', 'subdominant'],
      ['Db7', 'tonic'],
      ['Cb', 'subdominant'],
    ],
  );
});

test('random progressions follow the selected mode and difficulty and keep recurring chords stable', () => {
  const difficulties: TrainDifficulty[] = ['triads', 'sevenths', 'extensions'];
  for (const mode of ['major', 'minor'] as const) {
    const presets = trainProgressions.filter((p) => p.mode === mode);
    for (const difficulty of difficulties) {
      presets.forEach((preset, index) => {
        const draw = (index + 0.5) / presets.length;
        const recipe = randomTrainProgression(mode, difficulty, () => draw);
        assert.equal(recipe.value, preset.value);
        assert.equal(recipe.mode, mode);
        const chords = progressionChords('F#', recipe);
        const repeated = new Map<string, string>();
        byBar(chords).forEach(({ arpeggio, symbol, role }, bar) => {
          const used = arpeggio.tones.length;
          if (difficulty === 'triads') assert.equal(used, 3);
          if (difficulty === 'sevenths') assert.equal(used, 4);
          if (difficulty === 'extensions') assert.ok(used >= 4);
          if (role === 'dominant' && difficulty !== 'triads') {
            assert.ok(
              arpeggio.tones.some(({ semitones, degree }) => semitones === 10 && degree === 7),
            );
          }
          const original = preset.bars[bar]!.slice(0, 2).join(':');
          assert.equal(symbol, repeated.get(original) ?? symbol);
          repeated.set(original, symbol);
        });
      });
    }
  }
});

const qualities: [string, number[]][] = [
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['dim', [0, 3, 6]],
  ['aug', [0, 4, 8]],
  ['sus2', [0, 2, 7]],
  ['sus4', [0, 5, 7]],
  ['7', [0, 4, 7, 10]],
  ['maj7', [0, 4, 7, 11]],
  ['m7', [0, 3, 7, 10]],
  ['m7♭5', [0, 3, 6, 10]],
  ['dim7', [0, 3, 6, 9]],
  ['m(maj7)', [0, 3, 7, 11]],
  ['6', [0, 4, 7, 9]],
  ['m6', [0, 3, 7, 9]],
  ['9', [0, 4, 7, 10, 14]],
  ['maj9', [0, 4, 7, 11, 14]],
  ['m9', [0, 3, 7, 10, 14]],
  ['add9', [0, 4, 7, 14]],
];

test('all requested chord qualities share recognition and work in each evaluation mode', () => {
  for (const [suffix, intervals] of qualities) {
    const symbol = 'C' + suffix;
    assert.equal(inferChord(intervals.map((n) => 48 + n)), symbol);
    const chords = manualTrainChords(symbol)!;
    const pattern = Array<number>(16).fill(5);
    const pitchClasses = intervals.map((n) => n % 12);
    const levelTones = [[0], [0, intervals[2]!], pitchClasses, pitchClasses];
    levelTones.forEach((tones, index) => {
      const level = index + 1;
      const targets = trainTargets(pattern, 60, chords, level);
      const hits = targets.map(({ t, pitches }, beat) => {
        const expected =
          tones[(level === 4 ? tones.length - 1 - (beat % tones.length) : beat) % tones.length]!;
        assert.deepEqual(pitches, level === 4 ? tones : [expected], symbol);
        return { t, midi: 48 + expected };
      });
      assert.equal(scoreTrain(targets, hits, 0.1, 1, true).correct, 16, symbol);
      const offChord = [0, 1, 2, 3, 4, 5].find((n) => !pitchClasses.includes(n))!;
      hits[0]!.midi = 48 + offChord;
      assert.equal(scoreTrain(targets, hits, 0.1, 1, true).wrongPitch, 1, symbol);
      assert.equal(scoreTrain(targets, hits, 0.1, 1, false).correct, 16, symbol);
    });
  }
  assert.equal(parseTrainChord('Sol♯m(maj7)')?.symbol, 'G#mMaj7');
  assert.equal(parseTrainChord('Si𝄫add9')?.symbol, 'Bbbadd9');
});

test('blues evaluation reaches the final turnaround and resets at chord changes', () => {
  const blues = trainProgressions.find(({ value }) => value === 'major-blues')!;
  const chords = progressionChords('C', blues);
  const targets = trainTargets(Array(48).fill(5), 120, chords, 3);
  assert.equal(targets.at(-1)?.t, 23.5);
  assert.deepEqual(
    [0, 15, 16, 32, 36, 40, 44, 47].map((i) => targets[i]!.pitches),
    [[0], [10], [5], [7], [5], [0], [7], [5]],
  );
  const hits = targets.map(({ t, pitches }) => ({ t, midi: 36 + pitches![0]! }));
  assert.equal(scoreTrain(targets, hits, 0.1, 0.5, true).correct, 48);
  assert.deepEqual(
    manualTrainChords(chords.map(({ symbol }) => symbol).join(' '), 48)?.map(
      ({ symbol }) => symbol,
    ),
    chords.map(({ symbol }) => symbol),
  );
});
