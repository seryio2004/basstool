import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { positionsOf, tunings } from '../src/core/instrument';
import {
  gradeListenPhrase,
  listenCycle,
  listenGenres,
  listenLevelOrder,
  listenRepeatLevels,
  makeListenPhrase,
} from '../src/core/listenRepeat';
import { frequency, pitchFromSamples } from '../src/core/music';
import { measureFill } from '../src/core/score';

test('every genre and level fills its measures with playable notes in every profile tuning', () => {
  for (const instrument of Object.values(tunings))
    for (const { value: genre } of listenGenres)
      for (const difficulty of listenLevelOrder)
        for (const seed of [0, 101, 16384, 925316718, 0xffffffff]) {
          const preset = { genre, difficulty, seed, chords: true };
          const phrase = makeListenPhrase(preset, instrument);
          assert.deepEqual(phrase, makeListenPhrase(preset, instrument));
          assert.equal(phrase.score.measures.length, listenRepeatLevels[difficulty].bars);
          assert.equal(phrase.bpm, listenRepeatLevels[difficulty].bpm);
          phrase.score.measures.forEach((_, i) =>
            assert.equal(measureFill(phrase.score, i).status, 'full'),
          );
          assert.ok(phrase.tones.length >= 3);
          for (const tone of phrase.tones) {
            assert.ok(positionsOf(instrument, tone.midi).length > 0);
            assert.ok(tone.start >= 0 && tone.end > tone.start && tone.end <= phrase.duration);
          }
        }
});

test('the style markers survive generation and difficulty changes', () => {
  const phrase = (
    genre: (typeof listenGenres)[number]['value'],
    difficulty: (typeof listenLevelOrder)[number],
  ) => makeListenPhrase({ genre, difficulty, seed: 42, chords: false }, tunings.standard4);
  assert.ok(
    phrase('reggae', 'advanced').tones[0]!.start >= phrase('reggae', 'advanced').beatSeconds,
  );
  assert.ok(phrase('funk', 'advanced').tones.some((tone) => tone.dead));
  const blues = phrase('blues', 'intermediate');
  assert.ok(blues.tones.some((tone) => tone.midi === blues.tones[0]!.midi + 6));
  const rock = phrase('rock', 'beginner');
  assert.equal(rock.tones[2]!.midi - rock.tones[0]!.midi, 7);
  assert.ok(
    phrase('latin', 'beginner').tones.some((tone) => tone.start === 1.5 * rock.beatSeconds),
  );
  const jazz = phrase('jazz', 'beginner');
  assert.equal(jazz.tones.length, 4);
  assert.ok(jazz.tones.every((tone, i) => Math.abs(tone.start - i * jazz.beatSeconds) < 1e-9));
  for (const { value: genre } of listenGenres) {
    const [beginner, intermediate, advanced] = listenLevelOrder.map((level) =>
      phrase(genre, level),
    );
    assert.ok(
      intermediate!.tones.length / intermediate!.bars > beginner!.tones.length / beginner!.bars,
    );
    assert.ok(
      advanced!.tones.length / advanced!.bars > intermediate!.tones.length / intermediate!.bars,
    );
  }
  assert.notDeepEqual(
    rock.tones,
    makeListenPhrase(
      { genre: 'rock', difficulty: 'beginner', chords: false, seed: 925316718 },
      tunings.standard4,
    ).tones,
  );
});

test('every cycle contains exactly two drum-only response bars and optional chord stabs', () => {
  for (const { value: genre } of listenGenres) {
    const phrase = makeListenPhrase(
      { genre, difficulty: 'intermediate', seed: 42, chords: true },
      tunings.standard5,
    );
    const plan = listenCycle(phrase, true);
    assert.equal(plan.repeatStart, phrase.duration);
    assert.equal(plan.repeatEnd - plan.repeatStart, 8 * phrase.beatSeconds);
    assert.ok(plan.chords.length);
    assert.ok([...plan.bass, ...plan.chords].every((note) => note.end <= plan.repeatStart));
    assert.equal(listenCycle(phrase, false).chords.length, 0);
    for (const drum of ['kick', 'snare', 'hat']) {
      assert.ok(plan.drums.some((hit) => hit.drum === drum && hit.start >= plan.repeatStart));
      assert.ok(plan.drums.every((hit) => hit.start < plan.repeatEnd));
    }
  }
});

test('grading accepts detected bass pitch and ghosts, and rejects octave, time and extra attacks', () => {
  const phrase = makeListenPhrase(
    { genre: 'funk', difficulty: 'advanced', seed: 2, chords: false },
    tunings.standard5,
  );
  const rate = 48000;
  const hits = phrase.tones.map((tone) => ({
    time: tone.start + 0.025,
    hz: tone.dead
      ? null
      : pitchFromSamples(
          Float32Array.from(
            { length: 4096 },
            (_, i) => 0.25 * Math.sin((2 * Math.PI * frequency(tone.midi) * i) / rate),
          ),
          rate,
        ),
  }));
  assert.equal(gradeListenPhrase(phrase, [...hits].reverse()).passed, true);
  assert.equal(
    gradeListenPhrase(phrase, [{ time: hits[0]!.time, hz: hits[0]!.hz! * 2 }, ...hits.slice(1)])
      .correct,
    hits.length - 1,
  );
  assert.equal(
    gradeListenPhrase(phrase, [{ ...hits[0]!, time: -0.2 }, ...hits.slice(1)]).correct,
    hits.length - 1,
  );
  assert.deepEqual(gradeListenPhrase(phrase, [...hits, hits[0]!]), {
    correct: hits.length,
    total: hits.length,
    extra: 1,
    passed: false,
  });
  assert.equal(gradeListenPhrase(phrase, []).passed, false);
  for (const difficulty of listenLevelOrder) {
    const rock = makeListenPhrase(
      { genre: 'rock', difficulty, seed: 3, chords: false },
      tunings.standard4,
    );
    const outside = rock.tones.map((tone) => ({
      time: tone.start + 0.12,
      hz: frequency(tone.midi),
    }));
    assert.equal(gradeListenPhrase(rock, outside).passed, difficulty === 'beginner');
  }
});

test('attempt migration accepts the module snapshot while preserving older modules', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    `);
    for (const migration of [
      'initial',
      'bass_exercises',
      'chord_train',
      'chord_train_v2',
      'chord_line_rhythm',
      'listen_repeat',
    ].map((file, i) => `20261119000${i + 1}_${file}.sql`))
      await db.exec(
        await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'),
      );
    const userId = '00000000-0000-4000-8000-000000000001';
    await db.query("insert into auth.users values ($1, 'bassist@example.test', '{}')", [userId]);
    const save = (module: string, config: object) =>
      db.query(
        'insert into public.attempts (user_id,module,correct,total,score,duration,config) values ($1,$2,1,1,100,6,$3)',
        [userId, module, config],
      );
    const listenRepeat = {
      genre: 'jazz',
      difficulty: 'beginner',
      seed: 0xffffffff,
      chords: false,
      input: 'manual',
    };
    await save('notes', { bpm: 90, level: 1 });
    await save('listen-repeat', { bpm: 68, level: 1, listenRepeat });
    for (const invalid of [
      undefined,
      {},
      { ...listenRepeat, seed: 1.5 },
      { ...listenRepeat, chords: 'true' },
    ])
      await assert.rejects(
        save('listen-repeat', { bpm: 68, level: 1, listenRepeat: invalid }),
        /constraint/,
      );
  } finally {
    await db.close();
  }
});
