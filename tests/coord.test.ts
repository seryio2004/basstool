import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { overlaps } from '../scripts/coord.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '../scripts/coord.mjs');
const run = (cwd: string, ...args: string[]) =>
  spawnSync('node', [script, ...args], { cwd, encoding: 'utf8' });

test('paths overlap when equal or nested, not when they only share a prefix', () => {
  assert.ok(overlaps('src/core', 'src/core/music.ts'));
  assert.ok(overlaps('./App.tsx', 'App.tsx'));
  assert.ok(!overlaps('src/core', 'src/components'));
  assert.ok(!overlaps('src/core/music.ts', 'src/core/music.test.ts'));
});

test('two worktrees share messages and claims through the common git dir', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'coord-'));
  try {
    const main = path.join(root, 'main'),
      other = path.join(root, 'codex');
    const git = (cwd: string, ...args: string[]) =>
      execFileSync('git', args, { cwd, encoding: 'utf8' });
    execFileSync('git', ['init', '-q', '-b', 'main', main]);
    git(
      main,
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@t',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'x',
    );
    git(main, 'worktree', 'add', '-q', '-b', 'codex/t', other);

    assert.equal(run(main, 'claim', 'claude', 'tarea-4', 'src/components').status, 0);
    const clash = run(other, 'claim', 'codex', 'tarea-5', 'src/components/ui.tsx');
    assert.equal(clash.status, 1);
    assert.match(clash.stderr, /claude · tarea-4/);
    assert.equal(run(other, 'claim', 'codex', 'tarea-5', 'src/core/music.ts').status, 0);

    run(other, 'send', 'codex', 'claude', '¿Puedo', 'tocar', 'Staff?');
    run(main, 'send', 'claude', 'all', 'Integrada tarea 4');
    const inbox = run(main, 'inbox', 'claude');
    assert.match(inbox.stdout, /codex → claude \(codex\/t\)/);
    assert.doesNotMatch(inbox.stdout, /Integrada/); // own messages are not unread
    assert.match(run(main, 'inbox', 'claude').stdout, /Sin mensajes nuevos/);
    assert.match(run(other, 'inbox', 'codex', '--peek').stdout, /Integrada tarea 4/);
    assert.match(run(other, 'inbox', 'codex').stdout, /Integrada tarea 4/);

    assert.equal(run(main, 'release', 'claude', 'tarea-4').status, 0);
    assert.match(run(other, 'who', 'src/components/ui.tsx').stdout, /Libre/);
    assert.equal(run(other, 'send', 'Codex!', 'claude', 'x').status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
