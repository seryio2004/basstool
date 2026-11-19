import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as core from '../src/core/transcription';
import { listSessions, loadSession, saveSession } from '../src/data/transcriptions';
import { createPlayer } from '../src/platform/player.web';
import { createPlayer as nativePlayer } from '../src/platform/player';

const session = () => core.newSession({ id: 'song', name: 'Bajo.wav', duration: 65.3 });
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('sessions start with neutral settings; rate and transpose clamp and round immutably', () => {
  const s = session();
  assert.deepEqual(
    { ...s, updatedAt: '' },
    {
      id: 'song',
      name: 'Bajo.wav',
      duration: 65.3,
      position: 0,
      rate: 1,
      transpose: 0,
      bass: 'off',
      loop: null,
      markers: [],
      updatedAt: '',
    },
  );
  for (const [input, expected] of [
    [-1, 0.25],
    [2, 1.5],
    [0.83, 0.85],
    [0.81, 0.8],
  ]) {
    assert.equal(core.setRate(s, input!).rate, expected);
  }
  assert.equal(core.setTranspose(s, -20).transpose, -12);
  assert.equal(core.setTranspose(s, 20).transpose, 12);
  assert.equal(core.setTranspose(s, 3.7).transpose, 4);
  assert.equal(s.rate, 1);
  assert.equal(s.transpose, 0);
  assert.notEqual(core.clearLoop(s), s);
});

test('A–B defaults, bounds and fine adjustments preserve a useful loop', () => {
  const s = session();
  const a = core.setLoopStart(s, 10);
  assert.deepEqual(a.loop, { a: 10, b: 14 });
  assert.deepEqual(core.setLoopEnd(a, 20).loop, { a: 10, b: 20 });
  for (const b of [-10, 10, 10 + core.MIN_LOOP])
    assert.deepEqual(core.setLoopEnd(a, b).loop, a.loop);
  assert.deepEqual(core.setLoopEnd(s, 5).loop, { a: 0, b: 5 });
  assert.deepEqual(core.setLoopStart(a, 11).loop, { a: 11, b: 14 });
  assert.deepEqual(core.setLoopStart(a, 20).loop, { a: 20, b: 24 });
  assert.deepEqual(core.setLoopStart(s, -10).loop, { a: 0, b: 4 });
  const end = core.setLoopStart(s, 1000).loop!;
  near(end.b - end.a, core.MIN_LOOP);
  assert.equal(end.b, s.duration);
  const moved = core.nudgeLoop(a, 'a', 0.05);
  near(moved.loop!.a, 10.05);
  assert.equal(moved.loop!.b, 14);
  near(core.nudgeLoop(a, 'b', -0.1).loop!.b, 13.9);
  near(core.nudgeLoop(a, 'a', 99).loop!.a, 13.8);
  near(core.nudgeLoop(a, 'b', -99).loop!.b, 10.2);
  assert.equal(core.nudgeLoop(a, 'a', -99).loop!.a, 0);
  assert.equal(core.nudgeLoop(a, 'b', 999).loop!.b, s.duration);
  assert.equal(core.nudgeLoop(s, 'a', 1).loop, null);
  assert.equal(core.clearLoop(a).loop, null);
  assert.equal(s.loop, null);
  for (const duration of [0, 0.1, 0.2]) {
    assert.equal(
      core.setLoopStart(core.newSession({ id: 'x', name: 'x', duration }), 0).loop,
      null,
    );
  }
});

test('markers are ordered, uniquely identified, renamed and removed without mutation', () => {
  const s = session();
  const first = core.addMarker(s, 50);
  const second = core.addMarker(first, 10, ' Estrofa ');
  const third = core.addMarker(second, -10);
  assert.deepEqual(
    third.markers.map((m) => [m.time, m.name]),
    [
      [0, 'Marca 3'],
      [10, 'Estrofa'],
      [50, 'Marca 1'],
    ],
  );
  assert.equal(new Set(third.markers.map((m) => m.id)).size, 3);
  const id = first.markers[0]!.id;
  const renamed = core.renameMarker(third, id, 'A'.repeat(40));
  assert.equal(renamed.markers[2]!.name.length, 40);
  assert.equal(third.markers[2]!.name, 'Marca 1');
  assert.equal(core.removeMarker(third, id).markers.length, 2);
  assert.equal(core.addMarker(third, 999).markers.at(-1)!.time, s.duration);
  for (const name of ['', ' ', 'a'.repeat(41)]) {
    assert.throws(() => core.renameMarker(third, id, name));
    assert.throws(() => core.addMarker(s, 0, name));
  }
  assert.equal(s.markers.length, 0);
});

test('transport clamps to duration; time formatting carries tenths and minutes', () => {
  const s = { ...session(), position: 10 };
  assert.equal(core.clampTime(s, -1), 0);
  assert.equal(core.clampTime(s, 1000), 65.3);
  assert.equal(core.step(s, -30), 0);
  assert.equal(core.step(s, 100), 65.3);
  assert.equal(core.step(s, 2), 12);
  for (const [seconds, label] of [
    [0, '0:00.0'],
    [-1, '0:00.0'],
    [65.3, '1:05.3'],
    [59.99, '1:00.0'],
    [3600, '60:00.0'],
  ] as const) {
    assert.equal(core.formatTime(seconds), label);
  }
});

test('peak envelope handles silence, all samples, sparse buckets and normalization', () => {
  assert.deepEqual(core.peaksFrom(new Float32Array(10), 3), [0, 0, 0]);
  assert.deepEqual(core.peaksFrom(new Float32Array(), 3), [0, 0, 0]);
  assert.deepEqual(core.peaksFrom(new Float32Array([0, -0.5, 1, 0.25, -2]), 2), [0.25, 1]);
  assert.deepEqual(core.peaksFrom(new Float32Array([-0.5, 1]), 4), [0.5, 0.5, 1, 1]);
  assert.deepEqual(core.peaksFrom(new Float32Array([0.5]), 3), [1, 1, 1]);
  assert.deepEqual(core.peaksFrom(new Float32Array([0, 1, 0]), 1), [1]);
  for (const n of [0, -1, 1.5]) assert.throws(() => core.peaksFrom(new Float32Array(), n));
});

test('nonfinite numeric input is rejected throughout the core', () => {
  const s = session();
  for (const value of [NaN, Infinity, -Infinity]) {
    for (const operation of [
      () => core.newSession({ id: 'x', name: 'x', duration: value }),
      () => core.clampTime(s, value),
      () => core.setRate(s, value),
      () => core.setTranspose(s, value),
      () => core.setLoopStart(s, value),
      () => core.setLoopEnd(s, value),
      () => core.nudgeLoop(s, 'a', value),
      () => core.addMarker(s, value),
      () => core.step(s, value),
      () => core.formatTime(value),
      () => core.peaksFrom(new Float32Array([value]), 1),
      () => core.peaksFrom(new Float32Array(), value),
    ])
      assert.throws(operation, RangeError);
  }
  assert.throws(() => core.newSession({ id: 'x', name: 'x', duration: -1 }));
});

test('AsyncStorage sessions recover from corrupt data, retain metadata only and serialize concurrent saves', async (t) => {
  let stored: string | null = null;
  t.mock.method(AsyncStorage, 'getItem', async (key: string) => {
    assert.equal(key, 'clasro.transcriptions.v1');
    return stored;
  });
  t.mock.method(AsyncStorage, 'setItem', async (key: string, value: string) => {
    assert.equal(key, 'clasro.transcriptions.v1');
    stored = value;
  });
  assert.deepEqual(await listSessions(), []);
  assert.equal(await loadSession('missing'), null);
  for (const value of ['{invalid', '{}', 'null', '[null,12,{}, {"id":"x"}]']) {
    stored = value;
    assert.deepEqual(await listSessions(), []);
  }
  const s = core.addMarker(core.setLoopStart(session(), 10), 4);
  await saveSession({ ...s, audio: 'DO NOT STORE', peaks: [1] } as core.Session);
  assert.deepEqual(await loadSession(s.id), s);
  assert.ok(!stored!.includes('DO NOT STORE') && !stored!.includes('peaks'));
  const newer = { ...s, position: 20, updatedAt: '2030-01-01T00:00:00.000Z' };
  await saveSession(newer);
  assert.equal((await listSessions()).length, 1);
  assert.equal((await loadSession(s.id))!.position, 20);
  stored = JSON.stringify([
    s,
    null,
    { ...s, id: 'bad', position: -1 },
    newer,
    { ...s, id: 'bad2', markers: [null] },
  ]);
  assert.deepEqual(await listSessions(), [newer]);
  stored = null;
  await Promise.all(
    Array.from({ length: 55 }, (_, i) =>
      saveSession({ ...s, id: `song-${i}`, updatedAt: new Date(2026, 0, i + 1).toISOString() }),
    ),
  );
  const all = await listSessions();
  assert.equal(all.length, 50);
  assert.equal(all[0]!.id, 'song-54');
  assert.equal(all[49]!.id, 'song-5');
  await assert.rejects(saveSession({ ...s, rate: Infinity }));
  t.mock.method(AsyncStorage, 'setItem', async () => {
    throw new Error('quota');
  });
  await assert.rejects(saveSession(s), /quota/);
  t.mock.method(AsyncStorage, 'setItem', async (_: string, value: string) => {
    stored = value;
  });
  await saveSession(newer); // A failed write does not poison the queue.
  assert.deepEqual(await loadSession(s.id), newer);
  t.mock.method(AsyncStorage, 'getItem', async () => {
    throw new Error('unavailable');
  });
  assert.deepEqual(await listSessions(), []);
});

// The browser fake only provides local File / blob APIs. Network entry points throw.
function browser(t: TestContext) {
  const windows = new EventTarget();
  const inputs: Input[] = [];
  const elements: Element[] = [];
  const contexts: Context[] = [];
  const revoked: string[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0,
    urlId = 0,
    network = 0;
  class Input extends EventTarget {
    type = '';
    accept = '';
    files: File[] = [];
    click() {}
    remove() {}
  }
  class Element extends EventTarget {
    src = '';
    preload = '';
    preservesPitch = false;
    playbackRate = 1;
    currentTime = 0;
    paused = true;
    ended = false;
    constructor() {
      super();
      elements.push(this);
    }
    async play() {
      this.paused = false;
      this.ended = false;
      this.dispatchEvent(new Event('play'));
    }
    pause() {
      this.paused = true;
      this.dispatchEvent(new Event('pause'));
    }
    removeAttribute() {
      this.src = '';
    }
    load() {}
  }
  class Node {
    connections: unknown[] = [];
    disconnected = false;
    connect(node: unknown) {
      this.connections.push(node);
    }
    disconnect() {
      this.disconnected = true;
    }
  }
  class Filter extends Node {
    type = '';
    frequency = { value: 0 };
    Q = { value: 0 };
    gain = { value: 0 };
  }
  class Context {
    state = 'suspended';
    destination = {};
    closes = 0;
    source = new Node();
    filter = new Filter();
    fail = false;
    constructor() {
      contexts.push(this);
    }
    async resume() {
      this.state = 'running';
    }
    async close() {
      this.state = 'closed';
      this.closes++;
    }
    async decodeAudioData(_bytes: ArrayBuffer) {
      if (this.fail) throw new Error('decode');
      return {
        duration: 10,
        numberOfChannels: 2,
        getChannelData(c: number) {
          return new Float32Array(c === 0 ? [0, 0.5, 0, -1] : [0, -0.5, 0, 1]);
        },
      };
    }
    createMediaElementSource() {
      return this.source;
    }
    createBiquadFilter() {
      return this.filter;
    }
  }
  const replace = (name: string, value: unknown) => {
    const old = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (old) Object.defineProperty(globalThis, name, old);
      else Reflect.deleteProperty(globalThis, name);
    });
  };
  replace('window', Object.assign(windows, { AudioContext: Context }));
  replace('document', {
    createElement(tag: string) {
      assert.equal(tag, 'input');
      const input = new Input();
      inputs.push(input);
      return input;
    },
  });
  replace('Audio', Element);
  replace('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  replace('cancelAnimationFrame', (id: number) => frames.delete(id));
  replace('fetch', () => {
    network++;
    throw new Error('Network forbidden');
  });
  replace(
    'XMLHttpRequest',
    class {
      constructor() {
        network++;
        throw new Error('Network forbidden');
      }
    },
  );
  t.mock.method(URL, 'createObjectURL', () => `blob:local-${++urlId}`);
  t.mock.method(URL, 'revokeObjectURL', (url: string) => {
    revoked.push(url);
  });
  return {
    inputs,
    elements,
    contexts,
    revoked,
    frames,
    network: () => network,
    select() {
      const input = inputs.at(-1)!;
      input.files = [new File([new Uint8Array([0, 1, 2])], 'Bajo.wav', { type: 'audio/wav' })];
      input.dispatchEvent(new Event('change'));
    },
    frame() {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((cb) => cb(0));
    },
  };
}

test('web player uses local blobs, preserves pitch, applies bass filters, loops and releases resources', async (t) => {
  const p = createPlayer();
  t.after(() => p.unload());
  const b = browser(t);
  const events: [number, boolean][] = [];
  const off = p.onTime((time, playing) => events.push([time, playing]));
  const picked = p.pick();
  assert.equal(b.inputs[0]!.type, 'file');
  assert.equal(
    b.inputs[0]!.accept,
    'audio/mpeg,audio/mp4,audio/aac,audio/x-m4a,audio/wav,.mp3,.m4a,.aac,.wav',
  );
  b.select();
  const file = (await picked)!;
  assert.equal(file.duration, 10);
  assert.equal(file.peaks.length, 16000);
  assert.equal(Math.max(...file.peaks), 1);
  const el = b.elements[0]!,
    ctx = b.contexts[0]!;
  assert.equal(el.src, 'blob:local-1');
  assert.equal(el.preservesPitch, true);
  assert.deepEqual(ctx.source.connections, [ctx.filter]);
  assert.deepEqual(ctx.filter.connections, [ctx.destination]);
  p.setRate(0.51);
  assert.equal(el.playbackRate, 0.5);
  p.setRate(3);
  assert.equal(el.playbackRate, 1.5);
  p.setRate(-1);
  assert.equal(el.playbackRate, 0.25);
  p.setRate(NaN);
  assert.equal(el.playbackRate, 0.25);
  p.setBass('boost');
  assert.deepEqual(
    [ctx.filter.type, ctx.filter.frequency.value, ctx.filter.Q.value, ctx.filter.gain.value],
    ['peaking', 90, 0.8, 9],
  );
  p.setBass('solo');
  assert.deepEqual(
    [ctx.filter.type, ctx.filter.frequency.value, ctx.filter.Q.value],
    ['lowpass', 300, 0.9],
  );
  p.setBass('off');
  assert.equal(ctx.filter.gain.value, 0);
  p.seek(100);
  assert.equal(el.currentTime, 10);
  p.seek(-1);
  assert.equal(el.currentTime, 0);
  p.seek(NaN);
  assert.equal(el.currentTime, 0);
  p.setLoop({ a: 2, b: 4 });
  await p.play();
  assert.equal(el.currentTime, 2);
  assert.equal(ctx.state, 'running');
  el.currentTime = 4.1;
  el.dispatchEvent(new Event('timeupdate'));
  assert.equal(el.currentTime, 2);
  el.currentTime = 4.1;
  b.frame();
  assert.equal(el.currentTime, 2);
  assert.equal(events.at(-1)![1], true);
  p.pause();
  assert.equal(b.frames.size, 0);
  p.seek(4.5);
  assert.equal(el.currentTime, 4.5);
  await p.play();
  assert.equal(el.currentTime, 2);
  p.setLoop(null);
  el.currentTime = 5;
  b.frame();
  assert.equal(el.currentTime, 5);
  assert.equal(p.canTranspose, false);
  p.setTranspose(12);
  assert.equal(el.playbackRate, 0.25);
  off();
  const count = events.length;
  const next = p.pick();
  b.select();
  assert.equal((await next)!.id, file.id);
  assert.deepEqual(b.revoked, ['blob:local-1']);
  assert.equal(ctx.closes, 1);
  assert.equal(ctx.source.disconnected, true);
  p.unload();
  p.unload();
  assert.deepEqual(b.revoked, ['blob:local-1', 'blob:local-2']);
  assert.equal(b.contexts[1]!.closes, 1);
  assert.equal(events.length, count);
  assert.equal(b.network(), 0);
});

test('web picker cancellation and stale decoding do not load or leak audio', async (t) => {
  const p = createPlayer();
  t.after(() => p.unload());
  const b = browser(t);
  const cancelled = p.pick();
  b.inputs[0]!.dispatchEvent(new Event('cancel'));
  assert.equal(await cancelled, null);
  const abandoned = p.pick();
  p.unload();
  assert.equal(await abandoned, null);
  const decoding = p.pick();
  b.select();
  await Promise.resolve(); // Decode is pending when unload changes its generation.
  p.unload();
  assert.equal(await decoding, null);
  assert.equal(b.elements.length, 0);
  assert.ok(b.contexts.every((c) => c.closes === 1));
  assert.equal(b.network(), 0);
});

test('native player clearly reports the unavailable engine and is otherwise harmless', async () => {
  const p = nativePlayer();
  await assert.rejects(p.pick(), /La transcripción en el móvil llegará.*tarea 6/);
  assert.equal(p.canTranspose, false);
  await p.play();
  p.pause();
  p.seek(1);
  p.setRate(1);
  p.setLoop(null);
  p.setBass('boost');
  p.setTranspose(1);
  p.onTime(() => {})();
  p.unload();
});

test('decoder errors close the failed context and leave the previous audio usable', async (t) => {
  const p = createPlayer();
  t.after(() => p.unload());
  const b = browser(t);
  const first = p.pick();
  b.select();
  await first;
  const old = b.elements[0]!;
  const invalid = p.pick();
  b.select();
  await Promise.resolve();
  b.contexts.at(-1)!.fail = true;
  await assert.rejects(invalid, /No se pudo abrir el audio/);
  assert.equal(b.contexts.at(-1)!.closes, 1);
  assert.equal(b.revoked.length, 0);
  await p.play();
  assert.equal(old.paused, false);
});
