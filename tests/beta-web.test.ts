import assert from 'node:assert/strict';
import { test } from 'node:test';
import { learnTabs, showHarmonyProgress } from '../src/content/visibility';

test('the beta keeps the original notes visible and hides the harmony course in both sections', () => {
  assert.deepEqual(learnTabs(), [{ value: 'notes', label: 'Apuntes' }]);
  assert.equal(showHarmonyProgress(), false);
});

test('enabling the course restores the course tab and its progress without removing notes', () => {
  assert.deepEqual(
    learnTabs(true).map(({ value }) => value),
    ['course', 'notes'],
  );
  assert.equal(showHarmonyProgress(true), true);
});
