import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overallPractice, parsePractice } from '../src/core/dailyPractice';
import {
  advanceSpeed,
  speedPracticeSession,
  startSpeed,
  validSpeedSettings,
  type SpeedSettings,
} from '../src/core/speedTrainer';

const settings: SpeedSettings = {
  start: 80,
  target: 91,
  step: 5,
  repetitions: 2,
  mode: 'auto',
  lowerOnFailure: true,
};

test('automatic speed increases after completed bars, clips its final step and holds the target', () => {
  let state = startSpeed(settings);
  state = advanceSpeed(settings, state, 'success');
  assert.deepEqual(state, { bpm: 80, repetitions: 0 });
  const tempos = Array.from({ length: 8 }, () => {
    state = advanceSpeed(settings, state, 'bar');
    return state.bpm;
  });
  assert.deepEqual(tempos, [80, 85, 85, 90, 90, 91, 91, 91]);
});

test('manual progression requires consecutive confirmations and can reduce the speed', () => {
  const manual = { ...settings, mode: 'manual' } as const;
  const start = startSpeed(manual);
  const events = ['bar', 'success', 'failure', 'success', 'success', 'failure', 'failure'] as const;
  let state = start;
  const history = events.map((event) => (state = advanceSpeed(manual, state, event)));
  assert.deepEqual(history, [
    start,
    { bpm: 80, repetitions: 1 },
    start,
    { bpm: 80, repetitions: 1 },
    { bpm: 85, repetitions: 0 },
    start,
    start,
  ]);
  const noDecrease = { ...manual, lowerOnFailure: false };
  assert.deepEqual(advanceSpeed(noDecrease, { bpm: 85, repetitions: 1 }, 'failure'), {
    bpm: 85,
    repetitions: 0,
  });
});

test('limits reject invalid speed settings while allowing a fixed tempo', () => {
  assert.ok(validSpeedSettings({ ...settings, start: 240, target: 240 }));
  for (const patch of [
    { start: 39 },
    { target: 79 },
    { target: 241 },
    { repetitions: 0 },
    { repetitions: 100 },
    { step: 0 },
    { step: 1.5 },
    { step: Infinity },
  ])
    assert.equal(validSpeedSettings({ ...settings, ...patch }), false);
});

test('the diary preserves maximum tempo and total duration, including long sessions', () => {
  const session = speedPracticeSession('123', 'beginner', new Date(2026, 10, 19, 23), 3700, 137);
  const roundTrip = parsePractice(JSON.parse(JSON.stringify({ sessions: [session] })));
  const [saved] = roundTrip.sessions;
  assert.equal(saved?.id, 'speed-trainer:123');
  assert.equal(saved?.blocks[0]?.title, 'Velocidad');
  assert.equal(saved?.blocks[0]?.bpm, 137);
  assert.deepEqual(
    saved?.blocks.map(({ seconds }) => seconds),
    [1800, 1800, 100],
  );
  assert.deepEqual(overallPractice(roundTrip.sessions, []).get('2026-11-19'), {
    seconds: 3700,
    challenge: false,
  });
});
