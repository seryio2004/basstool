import assert from 'node:assert/strict';
import test from 'node:test';
import { techniques, techniqueTab, type TechniqueId } from '../src/content/technique';
import { defaultPracticeSettings, guidedRoutine, parsePractice } from '../src/core/dailyPractice';
import { tunings } from '../src/core/instrument';
import { tabPositions } from '../src/core/notation';
import { techniquePracticeSession } from '../src/core/techniquePractice';

test('the technique library generates a full, playable bar in every supported tuning', () => {
  for (const instrument of Object.values(tunings)) {
    for (const id of Object.keys(techniques) as TechniqueId[]) {
      const tab = techniqueTab(id, instrument);
      assert.equal(tabPositions(tab, instrument).length, 8);
    }
    for (const id of ['slap', 'octaves'] as const) {
      const tab = techniqueTab(id, instrument);
      for (let i = 0; i < tab.length; i += 2) {
        assert.equal(tab[i + 1]!.midi - tab[i]!.midi, 12);
        if (id === 'slap')
          assert.deepEqual(
            tab.slice(i, i + 2).map((note) => note.articulation),
            ['T', 'P'],
          );
      }
    }
    assert.ok(techniqueTab('rake', instrument).some((note) => note.articulation === '×'));
    assert.ok(techniqueTab('ghosts', instrument).some((note) => note.articulation === '×'));
  }
});

test('guided warmups change with the week and use the selected exercise tempo', () => {
  const current = guidedRoutine('2026-11-19', 'intermediate', defaultPracticeSettings)[0];
  const next = guidedRoutine('2026-11-26', 'intermediate', defaultPracticeSettings)[0];
  assert.ok(current?.kind === 'technique' && next?.kind === 'technique');
  assert.notEqual(current.id, next.id);
  assert.equal(current.bpm, techniques[current.id].bpm);
  assert.ok(current.title.includes(techniques[current.id].title));
});

test('standalone and speed technique sessions round-trip through the existing diary', () => {
  const started = new Date(2026, 10, 19, 20, 30);
  const normal = techniquePracticeSession('test', 'slap', 'intermediate', started, 1905, 83);
  const speed = techniquePracticeSession('test', 'slap', 'intermediate', started, 60, 98, true);
  const { sessions } = parsePractice({ sessions: [normal, speed] });
  const get = (id: string) => sessions.find((session) => session.id === id)!;
  assert.notEqual(normal.id, speed.id);
  assert.deepEqual(
    get(normal.id).blocks.map(({ seconds }) => seconds),
    [1800, 105],
  );
  assert.equal(get(normal.id).blocks[0]?.bpm, 83);
  assert.equal(get(speed.id).blocks[0]?.bpm, 98);
  assert.equal(get(speed.id).blocks[0]?.title, 'Slap básico · Velocidad');
});
