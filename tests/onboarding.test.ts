import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  defaultPracticeSettings,
  parseFavoriteSongs,
  parsePractice,
  parsePracticeSettings,
  shiftDay,
  songOfTheDay,
} from '../src/core/dailyPractice';
import {
  onboardingDraft,
  onboardingGoalLimit,
  onboardingResult,
  toggleGoal,
} from '../src/core/onboarding';
import { defaultProfile, parseProfile } from '../src/core/profile';

test('favorite songs are trimmed, deduplicated and capped at five', () => {
  assert.deepEqual(parseFavoriteSongs(undefined), []);
  assert.deepEqual(parseFavoriteSongs('Billie Jean'), []);
  assert.deepEqual(
    parseFavoriteSongs([
      '  Billie Jean —   Michael Jackson ',
      '',
      7,
      'billie jean — michael jackson',
      'Come Together — The Beatles',
      'A',
      'B',
      'C',
      'D',
    ]),
    ['Billie Jean — Michael Jackson', 'Come Together — The Beatles', 'A', 'B', 'C'],
  );
  assert.equal(parseFavoriteSongs(['x'.repeat(200)])[0]!.length, 80);
});

test('saved practice settings from before favorite songs migrate to an empty list', () => {
  const legacy = { minutes: 20, goals: ['groove'], days: [2, 4], weeklyMinutes: 40, restDay: true };
  assert.deepEqual(parsePracticeSettings(legacy).favoriteSongs, []);
  assert.deepEqual(parsePractice({ settings: legacy }).settings, {
    ...legacy,
    goals: ['groove'],
    favoriteSongs: [],
  });
  assert.deepEqual(
    parsePracticeSettings({ ...legacy, favoriteSongs: ['Teen Town — Weather Report', null] })
      .favoriteSongs,
    ['Teen Town — Weather Report'],
  );
});

test('the song of the day rotates through the favorites, one per local day', () => {
  const songs = ['A', 'B', 'C'];
  assert.equal(songOfTheDay('2026-11-19', []), undefined);
  const week = Array.from({ length: 6 }, (_, i) => songOfTheDay(shiftDay('2026-11-19', i), songs));
  assert.deepEqual(new Set(week.slice(0, 3)), new Set(songs));
  assert.deepEqual(week.slice(3), week.slice(0, 3));
  assert.equal(songOfTheDay('2026-11-19', songs), songOfTheDay('2026-11-19', songs));
  assert.equal(songOfTheDay('no es fecha', songs), 'A');
});

test('goals stop at three in the first-run setup', () => {
  let goals = toggleGoal([], 'groove');
  goals = toggleGoal(goals, 'ear');
  goals = toggleGoal(goals, 'song');
  assert.equal(goals.length, onboardingGoalLimit);
  assert.deepEqual(toggleGoal(goals, 'technique'), goals);
  assert.deepEqual(toggleGoal(goals, 'ear'), ['groove', 'song']);
});

test('skipping at once leaves a valid configured profile with the default practice', () => {
  const profile = defaultProfile('local');
  const { profile: patch, practice } = onboardingResult(
    onboardingDraft(profile, defaultPracticeSettings),
  );
  const saved = { ...profile, ...patch };
  assert.equal(saved.configured, true);
  assert.deepEqual(parseProfile(saved, 'local'), saved);
  assert.deepEqual(practice, defaultPracticeSettings);
  assert.deepEqual(parsePracticeSettings(practice), practice);
});

test('finishing stores the choices and derives the weekly minutes', () => {
  const draft = onboardingDraft(defaultProfile('local'), defaultPracticeSettings);
  draft.profile = { ...draft.profile, level: 'intermediate', leftHanded: true, scale: 35 };
  draft.practice = { minutes: 20, goals: ['groove', 'song'], days: [1, 2, 4, 6], restDay: false };
  draft.songs = ['Rio — Duran Duran', '', '  ', 'Hysteria — Muse', ''];
  const { profile, practice } = onboardingResult(draft);
  assert.equal(profile.level, 'intermediate');
  assert.equal(profile.leftHanded, true);
  assert.deepEqual(practice, {
    minutes: 20,
    goals: ['groove', 'song'],
    days: [1, 2, 4, 6],
    weeklyMinutes: 80,
    restDay: false,
    favoriteSongs: ['Rio — Duran Duran', 'Hysteria — Muse'],
  });
  draft.practice = { ...draft.practice, days: [] };
  assert.equal(onboardingResult(draft).practice.weeklyMinutes, 20);
});
