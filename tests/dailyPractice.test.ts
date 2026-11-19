import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blockCredit,
  completedPlanDays,
  dailyChallenge,
  defaultPracticeSettings,
  emptyPractice,
  guidedRoutine,
  localDay,
  overallPractice,
  parsePractice,
  planSession,
  practiceAccess,
  practiceBpm,
  practiceGoals,
  practiceMinutes,
  seededPractice,
  shiftDay,
  songLoop,
  songRate,
  streakFor,
  weeklyPractice,
  weekStart,
  type PracticeSession,
} from '../src/core/dailyPractice';
import { levels, type Level } from '../src/core/profile';
import { manualTrainChords } from '../src/core/chordTrain';
import { makeListenPhrase } from '../src/core/listenRepeat';
import { tunings } from '../src/core/instrument';
import { buildQuestion } from '../src/core/exercises';
import type { Attempt } from '../src/core/types';

const today = '2026-11-19';
const record = (
  day: string,
  seconds = 300,
  overrides: Partial<PracticeSession> = {},
): PracticeSession => ({
  id: day,
  kind: 'routine',
  level: 'beginner',
  day,
  startedAt: `${day}T12:00:00.000Z`,
  completed: true,
  blocks: [{ id: day, title: 'Práctica', seconds }],
  ...overrides,
});

test('local calendar identifiers survive DST weekends, leap days and year boundaries', () => {
  assert.equal(localDay(new Date(2026, 0, 1, 0, 1)), '2026-01-01');
  assert.equal(shiftDay('2026-03-28', 2), '2026-03-30');
  assert.equal(shiftDay('2026-10-26', -2), '2026-10-24');
  assert.equal(shiftDay('2024-03-01', -1), '2024-02-29');
  assert.equal(weekStart('2026-01-01'), '2025-12-29');
});

test('challenge presets are deterministic and playable across local dates and levels', () => {
  const covered = new Set<string>();
  for (const { value: level } of levels) {
    for (let d = 0; d < 110; d++) {
      const day = shiftDay(today, d);
      const blocks = dailyChallenge(day, level);
      assert.deepEqual(blocks, dailyChallenge(day, level));
      const duration = blocks.reduce((sum, b) => sum + b.seconds, 0);
      assert.ok(duration >= 180 && duration <= 300);
      for (const b of blocks) {
        covered.add(b.kind === 'exercise' ? b.module : b.kind);
        if (b.kind !== 'exercise') continue;
        if (b.module === 'chord-train') {
          const chords = b.preset.chords!;
          assert.ok(chords.length === 16 || chords.length === 48);
          assert.ok(manualTrainChords(chords.join(' '), chords.length));
          assert.equal(b.preset.chordLine?.resolvedDifficulty, level);
          assert.equal(b.preset.chordLine?.wagons.length, chords.length / 4);
        } else if (b.module === 'listen-repeat') {
          for (const tuning of Object.values(tunings)) {
            const phrase = makeListenPhrase(b.preset.listenRepeat!, tuning);
            assert.deepEqual(phrase, makeListenPhrase(b.preset.listenRepeat!, tuning));
          }
        } else if (b.module === 'groove') {
          assert.equal(b.preset.pattern?.length, 16);
          assert.ok(b.preset.bpm > 0);
        } else {
          const seed = b.preset.practiceSeed!;
          assert.deepEqual(
            buildQuestion(b.module, { modality: b.preset.modality }, seededPractice(seed)),
            buildQuestion(b.module, { modality: b.preset.modality }, seededPractice(seed)),
          );
        }
      }
    }
  }
  assert.deepEqual([...covered].sort(), [
    'chord-train',
    'groove',
    'intervals',
    'listen-repeat',
    'notes',
    'reading',
    'scale',
  ]);
  assert.notDeepEqual(
    dailyChallenge(today, 'beginner'),
    dailyChallenge(shiftDay(today, 1), 'beginner'),
  );
  assert.notDeepEqual(dailyChallenge(today, 'beginner'), dailyChallenge(today, 'intermediate'));
  assert.equal(practiceAccess.challenge, 'free');
  assert.equal(practiceAccess.streak, 'free');
});

test('routine honors the time budget and goals and always sets time aside for songs', () => {
  const maxGoals = practiceGoals.map((g) => g.value);
  for (const { value: level } of levels) {
    for (const minutes of practiceMinutes) {
      for (const goals of [[], maxGoals]) {
        const blocks = guidedRoutine(today, level, { ...defaultPracticeSettings, minutes, goals });
        assert.equal(
          blocks.reduce((sum, b) => sum + b.seconds, 0),
          minutes * 60,
        );
        assert.ok(blocks.every((b) => b.seconds >= 30));
        assert.equal(blocks.at(-1)?.kind, 'song');
        assert.ok(blocks.at(-1)!.seconds >= 60);
        assert.equal(blocks[0]?.kind, 'scale');
        if (goals.length) assert.equal(blocks.length, 5);
      }
    }
  }
  const beginner = guidedRoutine(today, 'beginner', defaultPracticeSettings);
  assert.ok(beginner.some((b) => b.kind === 'exercise' && b.module === 'notes'));
  const intermediate = (day: string) => guidedRoutine(day, 'intermediate', defaultPracticeSettings);
  const thisWeek = intermediate('2026-11-16')[0];
  assert.deepEqual(thisWeek, intermediate('2026-11-22')[0]);
  assert.notDeepEqual(thisWeek, intermediate('2026-11-23')[0]);
  const groove = guidedRoutine(today, 'intermediate', defaultPracticeSettings, [
    { module: 'groove', bpm: 88, correct: 17, total: 20 },
  ]).find((b) => b.kind === 'exercise' && b.module === 'groove');
  assert.equal(groove?.kind === 'exercise' && groove.preset.bpm, 92);
  assert.equal(practiceBpm('beginner', { bpm: 64, total: 20, correct: 9 }), 58);
  assert.equal(practiceBpm('advanced', { bpm: 170, total: 5, correct: 5 }), 128);
});

test('each provisional plan contains 21 distinct objectives and progresses per level in order', () => {
  for (const { value: level } of levels) {
    const days = Array.from({ length: 21 }, (_, i) => planSession(level, i + 1)!);
    assert.equal(new Set(days.map((d) => d.objective)).size, 21);
    assert.equal(new Set(days.map((d) => d.milestone)).size, 1);
    assert.ok(days.every((d) => d.blocks[0]!.seconds >= 180 && d.blocks[0]!.seconds <= 300));
    assert.equal(planSession(level, 22), null);
  }
  const planDay = (planDay: number, level: Level, completed = true) =>
    record(today, 240, { kind: 'plan', planDay, level, completed });
  assert.equal(
    completedPlanDays(
      [
        planDay(1, 'beginner'),
        planDay(2, 'beginner', false),
        planDay(3, 'beginner'),
        planDay(2, 'intermediate'),
        planDay(1, 'beginner'),
      ],
      'beginner',
    ),
    1,
  );
});

test('partial sessions count by actual duration and a short completed challenge qualifies', () => {
  const attempt = {
    id: 'old',
    createdAt: new Date(2026, 10, 19, 12).toISOString(),
    duration: 100,
  } as Attempt;
  const days = overallPractice(
    [
      record(today, 199, { completed: false }),
      record(shiftDay(today, -1), 180, { kind: 'challenge' }),
      record(shiftDay(today, -2), 180, { kind: 'challenge', completed: false }),
    ],
    [attempt],
  );
  assert.equal(days.get(today)?.seconds, 299);
  assert.equal(streakFor(today, days, false).count, 1);
  assert.equal(streakFor(today, overallPractice([record(today, 200)], [attempt]), false).count, 1);
  assert.ok(
    blockCredit({ id: 'block', seconds: 90, title: 'Groove', correct: 0, total: 8 }, 90, true),
  );
  assert.ok(!blockCredit({ id: 'block', seconds: 90, title: 'Groove' }, 90, true));
  assert.ok(
    !blockCredit({ id: 'block', seconds: 90, title: 'Groove', skipped: true, total: 8 }, 90, true),
  );
});

test('streak protects at most one isolated day per Monday-to-Sunday week without counting it', () => {
  const sessions = [0, -1, -3, -5, -6, -8, -9].map((n) => record(shiftDay(today, n)));
  const days = overallPractice(sessions, []);
  assert.deepEqual(streakFor(today, days, true), {
    count: 5,
    restUsedThisWeek: true,
    milestone: 3,
    next: 7,
  });
  assert.equal(streakFor(today, days, false).count, 2);
  const twoGaps = overallPractice(
    [0, -2, -4].map((n) => record(shiftDay(today, n))),
    [],
  );
  assert.equal(streakFor(today, twoGaps, true).count, 2);
  assert.equal(streakFor(today, overallPractice([record(shiftDay(today, -2))], []), true).count, 1);
  assert.equal(streakFor(today, overallPractice([record(shiftDay(today, -3))], []), true).count, 0);
  const streak21 = Array.from({ length: 21 }, (_, n) => record(shiftDay(today, -n)));
  assert.equal(streakFor(today, overallPractice(streak21, []), true).milestone, 21);
});

test('weekly minutes include unplanned practice and ignore sessions outside the current week', () => {
  const sessions = [0, -3, -4, 1].map((d) => record(shiftDay(today, d)));
  const week = weeklyPractice(today, overallPractice(sessions, []), defaultPracticeSettings);
  assert.equal(week.seconds, 600);
  assert.deepEqual(
    week.entries.filter((e) => e.planned).map((e) => e.label),
    ['Lun', 'Mié', 'Vie'],
  );
  assert.deepEqual(
    week.entries.filter((e) => e.practiced).map((e) => e.label),
    ['Lun', 'Jue'],
  );
});

test('legacy data receives defaults and invalid practice rows do not poison the diary', () => {
  assert.deepEqual(parsePractice(undefined), emptyPractice());
  const session = record(today);
  const data = parsePractice({
    settings: {
      days: [1, 1, 3, 12],
      goals: ['song', 'unknown'],
      minutes: 900,
      weeklyMinutes: 0,
      restDay: false,
    },
    sessions: [
      session,
      { ...session, day: '2026-02-30' },
      { ...session, id: 'bad', blocks: ['malformed'] },
    ],
    attemptNotes: { 'id-1': '  Pulso estable.  ' },
  });
  assert.deepEqual(data.settings, {
    ...defaultPracticeSettings,
    days: [1, 3],
    goals: ['song'],
    restDay: false,
  });
  assert.equal(data.sessions.length, 1);
  assert.deepEqual(data.attemptNotes, { 'id-1': 'Pulso estable.' });
});

test('song practice reuses a saved loop or a playable excerpt and ramps every three passes', () => {
  const saved = { a: 2, b: 4.5 };
  assert.deepEqual(songLoop({ loop: saved, duration: 38, position: 20 }), saved);
  assert.deepEqual(songLoop({ loop: null, duration: 38, position: 37 }), { a: 26, b: 38 });
  assert.deepEqual(songLoop({ loop: null, duration: 3, position: 2 }), { a: 0, b: 3 });
  assert.equal(songLoop({ loop: null, duration: 0.1, position: 0 }), null);
  assert.equal(songRate(1.25, 0), 0.75);
  assert.equal(songRate(0.5, 2), 0.5);
  assert.equal(songRate(0.5, 3), 0.55);
  assert.equal(songRate(0.75, 100), 1);
});
