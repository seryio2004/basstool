#!/usr/bin/env node
/**
 * Coordinación entre agentes (Claude Code, Codex…) que trabajan a la vez en
 * worktrees distintos de este repositorio. Ver docs/COORDINACION.md.
 *
 * El estado vive en <git-common-dir>/coord: todos los worktrees comparten el
 * mismo directorio .git, así que ven los mismos mensajes y reservas, y nada de
 * esto entra en los commits. Sin dependencias.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const NAME = /^[a-z0-9][a-z0-9-]{0,30}$/;

function coordDir() {
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    encoding: 'utf8',
  }).trim();
  const dir = path.join(common, 'coord');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function currentBranch() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return '?';
  }
}

/** Bloqueo por mkdir: atómico en todos los sistemas de archivos locales. */
function withLock(dir, fn) {
  const lock = path.join(dir, '.lock');
  const start = Date.now();
  for (;;) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // Un bloqueo de más de 10 s procede de un proceso muerto.
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 10_000) fs.rmdirSync(lock);
      } catch {}
      if (Date.now() - start > 15_000) throw new Error('No se pudo obtener el bloqueo de coord.');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try {
    return fn();
  } finally {
    fs.rmdirSync(lock);
  }
}

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};
const writeJson = (file, value) => {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
};
const readMessages = (dir) => {
  const file = path.join(dir, 'messages.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
};

/** Dos rutas chocan si son iguales o una contiene a la otra. */
export function overlaps(a, b) {
  const norm = (p) => p.replace(/^\.\//, '').replace(/\/+$/, '');
  const x = norm(a),
    y = norm(b);
  return x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`) || x === '.' || y === '.';
}

function agentArg(value, label = 'agente') {
  if (!value || !NAME.test(value))
    fail(`Indica un ${label} válido (minúsculas, p. ej. claude, codex).`);
  return value;
}
function fail(message) {
  console.error(`coord: ${message}`);
  process.exit(1);
}
const time = (iso) =>
  new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
const show = (m) =>
  `#${m.id} ${time(m.ts)} ${m.from} → ${m.to}${m.branch ? ` (${m.branch})` : ''}\n   ${m.text.replace(/\n/g, '\n   ')}`;

function unreadFor(dir, agent) {
  const cursors = readJson(path.join(dir, 'cursors.json'), {});
  const last = cursors[agent] ?? 0;
  return readMessages(dir).filter(
    (m) => m.id > last && m.from !== agent && (m.to === agent || m.to === 'all'),
  );
}

const commands = {
  help() {
    console.log(`Uso: npm run coord -- <comando>

  status                          Reservas activas y mensajes sin leer
  inbox <agente> [--peek]         Mensajes nuevos para ti (--peek no los marca como leídos)
  send <de> <para|all> <texto>    Enviar un mensaje
  log [n]                         Últimos n mensajes (20 por defecto)
  claim <agente> <tarea> <ruta>…  Reservar rutas antes de editarlas
  release <agente> <tarea>        Liberar la reserva al terminar o al integrar
  who <ruta>                      Quién tiene reservada una ruta`);
  },

  status() {
    const dir = coordDir();
    const claims = readJson(path.join(dir, 'claims.json'), []);
    console.log(claims.length ? 'Reservas activas:' : 'Sin reservas activas.');
    for (const c of claims)
      console.log(
        `  ${c.agent} · ${c.task} · ${c.branch} · desde ${time(c.since)}\n    ${c.paths.join(', ')}`,
      );
    const agents = new Set([
      ...claims.map((c) => c.agent),
      ...readMessages(dir).flatMap((m) => [m.from, m.to]),
    ]);
    agents.delete('all');
    for (const a of [...agents].sort()) {
      const n = unreadFor(dir, a).length;
      if (n) console.log(`Sin leer para ${a}: ${n}`);
    }
  },

  inbox(agent, flag) {
    agentArg(agent);
    const dir = coordDir();
    withLock(dir, () => {
      const unread = unreadFor(dir, agent);
      if (!unread.length) {
        console.log(`Sin mensajes nuevos para ${agent}.`);
        return;
      }
      console.log(unread.map(show).join('\n'));
      if (flag !== '--peek') {
        const file = path.join(dir, 'cursors.json');
        const cursors = readJson(file, {});
        cursors[agent] = Math.max(cursors[agent] ?? 0, ...unread.map((m) => m.id));
        writeJson(file, cursors);
      }
    });
  },

  send(from, to, ...words) {
    agentArg(from, 'remitente');
    if (to !== 'all') agentArg(to, 'destinatario');
    const text = words.join(' ').trim();
    if (!text) fail('El mensaje está vacío.');
    const dir = coordDir();
    withLock(dir, () => {
      const id = (readMessages(dir).at(-1)?.id ?? 0) + 1;
      const message = { id, ts: new Date().toISOString(), from, to, branch: currentBranch(), text };
      fs.appendFileSync(path.join(dir, 'messages.jsonl'), `${JSON.stringify(message)}\n`);
      console.log(`Enviado #${id} a ${to}.`);
    });
  },

  log(n = '20') {
    const messages = readMessages(coordDir()).slice(-Number(n));
    console.log(messages.length ? messages.map(show).join('\n') : 'Sin mensajes.');
  },

  claim(agent, task, ...paths) {
    agentArg(agent);
    if (!task) fail('Indica la tarea (p. ej. tarea-5).');
    if (!paths.length) fail('Indica al menos una ruta que vas a editar.');
    const dir = coordDir();
    withLock(dir, () => {
      const file = path.join(dir, 'claims.json');
      const claims = readJson(file, []);
      const conflicts = claims.filter(
        (c) =>
          !(c.agent === agent && c.task === task) &&
          c.paths.some((p) => paths.some((q) => overlaps(p, q))),
      );
      if (conflicts.length) {
        for (const c of conflicts)
          console.error(
            `  Choca con ${c.agent} · ${c.task}: ${c.paths.filter((p) => paths.some((q) => overlaps(p, q))).join(', ')}`,
          );
        fail('Ruta ya reservada. Coordina con un mensaje antes de editarla.');
      }
      const existing = claims.find((c) => c.agent === agent && c.task === task);
      if (existing) existing.paths = [...new Set([...existing.paths, ...paths])];
      else
        claims.push({
          agent,
          task,
          branch: currentBranch(),
          paths,
          since: new Date().toISOString(),
        });
      writeJson(file, claims);
      console.log(`Reservado para ${agent} · ${task}: ${paths.join(', ')}`);
    });
  },

  release(agent, task) {
    agentArg(agent);
    const dir = coordDir();
    withLock(dir, () => {
      const file = path.join(dir, 'claims.json');
      const claims = readJson(file, []);
      const left = claims.filter((c) => !(c.agent === agent && (!task || c.task === task)));
      if (left.length === claims.length)
        fail(`${agent} no tiene reservas${task ? ` para ${task}` : ''}.`);
      writeJson(file, left);
      console.log(`Liberado: ${agent}${task ? ` · ${task}` : ''}.`);
    });
  },

  who(target) {
    if (!target) fail('Indica una ruta.');
    const claims = readJson(path.join(coordDir(), 'claims.json'), []).filter((c) =>
      c.paths.some((p) => overlaps(p, target)),
    );
    console.log(
      claims.length
        ? claims.map((c) => `${c.agent} · ${c.task} · ${c.branch}`).join('\n')
        : 'Libre.',
    );
  },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command = 'help', ...args] = process.argv.slice(2);
  (commands[command] ?? commands.help)(...args);
}
