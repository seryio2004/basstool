#!/usr/bin/env node
/**
 * Coordinación entre agentes (Claude Code, Codex…) que trabajan a la vez en
 * worktrees distintos de este repositorio. Ver docs/COORDINACION.md.
 *
 * El estado vive en <git-common-dir>/coord: todos los worktrees comparten el
 * mismo directorio .git, así que ven los mismos mensajes y reservas, y nada de
 * esto entra en los commits. Sin dependencias.
 */
import fs from 'node:fs';
import path from 'node:path';

const NAME = /^[a-z0-9][a-z0-9-]{0,30}$/;

/**
 * Localiza el directorio git de este worktree y el común leyendo archivos, sin
 * lanzar `git`: algunos sandboxes de agentes (Codex) no permiten subprocesos.
 * En un worktree, `.git` es un archivo «gitdir: …» y ese directorio contiene
 * `commondir`, que apunta al .git compartido.
 */
function gitDirs() {
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    const dotGit = path.join(dir, '.git');
    if (fs.existsSync(dotGit)) {
      let gitDir = dotGit;
      if (fs.statSync(dotGit).isFile()) {
        const target = fs
          .readFileSync(dotGit, 'utf8')
          .match(/^gitdir:\s*(.+)$/m)?.[1]
          ?.trim();
        if (!target) fail(`No se entiende ${dotGit}.`);
        gitDir = path.resolve(dir, target);
      }
      const commonFile = path.join(gitDir, 'commondir');
      const common = fs.existsSync(commonFile)
        ? path.resolve(gitDir, fs.readFileSync(commonFile, 'utf8').trim())
        : gitDir;
      return { gitDir, common };
    }
    if (path.dirname(dir) === dir) fail('No estás dentro de un repositorio git.');
  }
}

function coordDir() {
  const dir = path.join(gitDirs().common, 'coord');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function currentBranch() {
  try {
    const head = fs.readFileSync(path.join(gitDirs().gitDir, 'HEAD'), 'utf8').trim();
    return head.startsWith('ref: refs/heads/') ? head.slice(16) : head.slice(0, 7);
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
  inbox <agente> [--peek|--hook]  Mensajes nuevos (--peek no los marca; --hook: silencio si no hay)
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
      // --hook: modo para hooks de agentes. Silencio si no hay nada; si hay
      // mensajes, se entregan con cabecera y se marcan como leídos.
      if (!unread.length) {
        if (flag !== '--hook') console.log(`Sin mensajes nuevos para ${agent}.`);
        return;
      }
      if (flag === '--hook')
        console.log(
          `Buzón de coordinación: mensajes nuevos para ${agent} (ver docs/COORDINACION.md). Tenlos en cuenta antes de seguir y responde con \`npm run coord -- send ${agent} <destinatario> "…"\` si hace falta.`,
        );
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
