import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tunings } from '../src/core/instrument';
import { bassScales, defaultProfile, parseProfile, tuningIds } from '../src/core/profile';

test('a new local profile works without an account and starts unconfigured', () => {
  const p = defaultProfile('local-1');
  assert.equal(p.email, null);
  assert.equal(p.tuning, 'standard4');
  assert.equal(p.configured, false);
  assert.deepEqual(tunings[p.tuning].strings, [28, 33, 38, 43]);
});

test('every tuning in the profile maps to an instrument preset', () => {
  assert.deepEqual(tuningIds.sort(), Object.keys(tunings).sort());
});

test('stored profiles are normalised instead of breaking the app', () => {
  assert.deepEqual(parseProfile(null, 'x'), defaultProfile('x'));
  assert.deepEqual(parseProfile('corrupt', 'x'), defaultProfile('x'));
  const p = parseProfile(
    {
      id: 'abc',
      email: 'bajista@example.com',
      tuning: 'standard5',
      level: 'advanced',
      nomenclature: 'english',
      leftHanded: true,
      configured: true,
    },
    'x',
  );
  assert.deepEqual(p, {
    id: 'abc',
    email: 'bajista@example.com',
    tuning: 'standard5',
    scale: 34,
    level: 'advanced',
    nomenclature: 'english',
    leftHanded: true,
    configured: true,
    theme: 'dark',
  });
  const unknown = parseProfile(
    { id: 'abc', tuning: 'guitar', level: 'pro', nomenclature: 'german', leftHanded: 'yes' },
    'x',
  );
  assert.equal(unknown.tuning, 'standard4');
  assert.equal(unknown.level, 'beginner');
  assert.equal(unknown.nomenclature, 'latin');
  assert.equal(unknown.leftHanded, false);
});

test('theme preference defaults to dark and survives a round trip', () => {
  assert.equal(defaultProfile('x').theme, 'dark');
  // Perfiles guardados antes de existir el campo.
  assert.equal(parseProfile({ id: 'a', configured: true }, 'x').theme, 'dark');
  assert.equal(parseProfile({ id: 'a', theme: 'light' }, 'x').theme, 'light');
  assert.equal(parseProfile({ id: 'a', theme: 'system' }, 'x').theme, 'system');
  assert.equal(parseProfile({ id: 'a', theme: 'sepia' }, 'x').theme, 'dark');
});

test('bass scale defaults to 34 inches for new and legacy profiles', () => {
  assert.equal(defaultProfile('x').scale, 34);
  assert.equal(parseProfile({ id: 'a', configured: true }, 'x').scale, 34);
  for (const scale of [28, 32.5, '32', null]) {
    assert.equal(parseProfile({ id: 'a', scale }, 'x').scale, 34);
  }
});

test('each supported bass scale survives a storage round trip', () => {
  assert.deepEqual(bassScales, [30, 32, 34, 35]);
  for (const scale of bassScales) {
    const profile = { ...defaultProfile('x'), configured: true, scale };
    assert.deepEqual(parseProfile(JSON.parse(JSON.stringify(profile)), 'x'), profile);
  }
});
