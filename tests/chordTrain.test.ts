import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { inferChord } from '../src/core/chroma';
import {
  manualTrainChords,
  parseTrainChord,
  pitchTrainTargets,
  scoreTrain,
  trainTargets,
} from '../src/core/chordTrain';
import {
  chordLineAttacks,
  chordLineLevels,
  chordLineMeasure,
  chordLineRhythmOptions,
  chordLineTolerance,
  chordLineWagons,
  createChordLineSettingsStorage,
  resolveChordLineDifficulty,
} from '../src/core/chordLine';
import { fifthsCircle } from '../src/core/notation';
import {
  availableTrainProgressions,
  progressionChords,
  randomTrainProgression,
  trainChordAllowed,
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
    for (const difficulty of difficulties) {
      const presets = availableTrainProgressions(mode, difficulty);
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

test('ChordLine difficulty controls allowed chords, progressions, tempo and generated rhythms', () => {
  const levels = ['beginner', 'intermediate', 'advanced'] as const;
  const chords = ['C', 'C7', 'C6', 'Cadd9', 'C9'].map((symbol) => parseTrainChord(symbol)!);
  const limits = [1, 2, 5];
  for (const [index, level] of levels.entries()) {
    const { bpm, harmony } = chordLineLevels[level];
    assert.equal(
      resolveChordLineDifficulty('random', () => (index + 0.5) / 3),
      level,
    );
    assert.equal(
      resolveChordLineDifficulty(level, () => 0),
      level,
    );
    assert.equal(bpm, [72, 92, 112][index]);
    assert.deepEqual(
      chords.filter((chord) => trainChordAllowed(chord, harmony)),
      chords.slice(0, limits[index]),
    );
    const progressions = availableTrainProgressions('major', harmony);
    assert.equal(
      progressions.some(({ value }) => value === 'major-blues'),
      index >= 1,
    );
    assert.equal(
      progressions.some(({ value }) => value === 'major-funk'),
      index === 2,
    );
    const choices = chordLineRhythmOptions(level);
    const generated = chordLineWagons(48, level, 'varied', () => 0);
    assert.equal(generated.length, 12);
    assert.ok(
      generated.every(
        (id, i) => choices.some(({ value }) => value === id) && id !== generated[i - 1],
      ),
    );
    assert.equal(chordLineMeasure(generated[0]!).level, level);
  }
  assert.deepEqual(chordLineWagons(16, 'advanced', 'shuffle'), Array(4).fill('shuffle'));
  assert.deepEqual(
    chordLineWagons(16, 'beginner', 'shuffle', () => 0),
    ['quarters', 'halves', 'quarters', 'halves'],
  );
});

test('every ChordLine rhythm fills four beats with positive, contiguous durations', () => {
  const ids = chordLineRhythmOptions('advanced').map(({ value }) => value);
  for (const id of ids) {
    const { events } = chordLineMeasure(id);
    let end = 0;
    for (const { tick, duration } of events) {
      assert.equal(tick, end, id);
      assert.ok(Number.isInteger(duration) && duration > 0, id);
      end += duration;
    }
    assert.equal(end, 48, id);
    const attacks = chordLineAttacks([id, id], 60);
    assert.equal(attacks.length, 2 * events.filter(({ kind }) => kind !== 'rest').length);
    assert.ok(
      attacks.every(
        ({ t, duration, block }) => t >= 0 && t + duration! <= 8 && block === Math.floor(t),
      ),
    );
  }
  assert.equal(chordLineAttacks(['reggae'], 60)[0]!.t, 1);
  assert.deepEqual(
    chordLineAttacks(['shuffle'], 60)
      .slice(0, 3)
      .map(({ t }) => t),
    [0, 2 / 3, 1],
  );
});

test('sustained syncopations and triplets score their written onsets and chord tones', () => {
  const chords = [...Array(4).fill(parseTrainChord('C')), ...Array(4).fill(parseTrainChord('G7'))];
  const attacks = pitchTrainTargets(chordLineAttacks(['syncopation', 'triplets'], 60), chords, 3);
  assert.deepEqual(
    attacks.slice(0, 6).map(({ t, pitches }) => [t, pitches]),
    [
      [0, [0]],
      [0.5, [4]],
      [1.5, [7]],
      [2, [0]],
      [2.5, [4]],
      [3.5, [7]],
    ],
  );
  assert.deepEqual(
    attacks.slice(6, 9).map(({ t, pitches }) => [Math.round(t * 12), pitches]),
    [
      [48, [7]],
      [52, [11]],
      [56, [2]],
    ],
  );
  const tolerance = chordLineTolerance(attacks, 1);
  const hits = attacks.map(({ t, pitches }) => ({ t: t + 0.025, midi: 36 + pitches![0]! }));
  assert.equal(scoreTrain(attacks, hits, tolerance, 1, true).correct, 18);
  hits[2]!.t = 1;
  hits[7]!.midi = 36;
  assert.deepEqual(scoreTrain(attacks, hits, tolerance, 1, true), {
    correct: 16,
    total: 18,
    missed: 1,
    extras: 1,
    wrongPitch: 1,
    bias: 25,
  });
  assert.equal(scoreTrain(attacks, hits, tolerance, 1, false).correct, 17);
});

test('dead notes require a timed attack and do not advance the arpeggio', () => {
  const attacks = pitchTrainTargets(
    chordLineAttacks(['funk'], 60),
    Array(4).fill(parseTrainChord('Am')),
    3,
  );
  assert.deepEqual(
    attacks.slice(0, 3).map(({ t, dead, pitches }) => [t, dead, pitches]),
    [
      [0, false, [9]],
      [0.25, true, undefined],
      [0.5, false, [0]],
    ],
  );
  const hits = attacks.map(({ t, pitches }) => ({ t, midi: pitches ? 36 + pitches[0]! : null }));
  assert.equal(
    scoreTrain(attacks, hits, chordLineTolerance(attacks, 1), 1, true).correct,
    attacks.length,
  );
});

test('ChordLine selector defaults to the profile and persists the latest choice across sessions', async () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const settings = createChordLineSettingsStorage(storage);
  assert.deepEqual(await settings.load('one', 'intermediate'), {
    difficulty: 'intermediate',
    rhythm: 'varied',
  });
  const writes = [
    settings.save('one', { difficulty: 'beginner', rhythm: 'halves' }),
    settings.save('one', { difficulty: 'random', rhythm: 'shuffle' }),
  ];
  assert.deepEqual(await settings.load('one', 'advanced'), {
    difficulty: 'random',
    rhythm: 'shuffle',
  });
  await Promise.all(writes);
  const reopened = createChordLineSettingsStorage(storage);
  assert.deepEqual(await reopened.load('one', 'beginner'), {
    difficulty: 'random',
    rhythm: 'shuffle',
  });
  assert.deepEqual(await reopened.load('two', 'beginner'), {
    difficulty: 'beginner',
    rhythm: 'quarters',
  });
  await storage.setItem('clasro.chordline.v1.one', '{broken');
  assert.deepEqual(await reopened.load('one', 'advanced'), {
    difficulty: 'advanced',
    rhythm: 'varied',
  });
});

test('database accepts legacy attempts and validates ChordLine rhythm snapshots', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text not null, raw_user_meta_data jsonb not null default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    `);
    for (const name of [
      '001_initial',
      '002_bass_exercises',
      '003_chord_train',
      '004_chord_train_v2',
      '005_chord_line_rhythm',
    ]) {
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/202611190${name}.sql`, import.meta.url),
          'utf8',
        ),
      );
    }
    const base = { bpm: 112, level: 3, chords: Array(16).fill('C9'), rhythmInput: 'mic' };
    const valid = async (config: object) =>
      (
        await db.query<{ ok: boolean }>('select public.valid_chord_train_config($1::jsonb) as ok', [
          config,
        ])
      ).rows[0]?.ok;
    assert.equal(await valid({ ...base, pattern: Array(16).fill(5) }), true);
    assert.equal(await valid({ ...base, pattern: Array(16).fill(10) }), false);
    const chordLine = {
      difficulty: 'random',
      resolvedDifficulty: 'advanced',
      rhythm: 'varied',
      wagons: ['funk', 'quarters', 'triplets', 'tumbao'],
    };
    assert.equal(await valid({ ...base, chordLine }), true);
    assert.equal(
      await valid({
        ...base,
        chords: Array(48).fill('C7'),
        chordLine: {
          ...chordLine,
          wagons: Array(12).fill('triplets'),
        },
      }),
      true,
    );
    assert.equal(await valid({ ...base, chordLine: { ...chordLine, wagons: ['funk'] } }), false);
    assert.equal(
      await valid({ ...base, chordLine: { ...chordLine, resolvedDifficulty: 'beginner' } }),
      false,
    );
    assert.equal(await valid({ ...base, chordLine: { ...chordLine, rhythm: 'funk' } }), false);
  } finally {
    await db.close();
  }
});
