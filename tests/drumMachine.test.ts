import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultGroove } from '../src/core/drums';
import { createDrumVoices, startGroove, startMetronome } from '../src/platform/drumMachine.web';

class Param {
  value = 1;
  changes: [string, number, number][] = [];
  setValueAtTime(value: number, at: number) {
    this.changes.push(['set', value, at]);
  }
  linearRampToValueAtTime(value: number, at: number) {
    this.changes.push(['linear', value, at]);
  }
  exponentialRampToValueAtTime(value: number, at: number) {
    this.changes.push(['exp', value, at]);
  }
  setTargetAtTime(value: number, at: number) {
    this.changes.push(['target', value, at]);
  }
}

class Node extends EventTarget {
  type = 'sine';
  frequency = new Param();
  gain = new Param();
  Q = new Param();
  starts: number[] = [];
  stops: (number | undefined)[] = [];
  target?: Node;
  disconnected = false;
  connect(node: Node) {
    this.target = node;
  }
  disconnect() {
    this.disconnected = true;
  }
  start(when: number) {
    this.starts.push(when);
  }
  stop(when?: number) {
    this.stops.push(when);
  }
}

class Context {
  sampleRate = 48000;
  currentTime = 0;
  destination = new Node();
  oscillators: Node[] = [];
  buffers: Node[] = [];
  filters: Node[] = [];
  gains: Node[] = [];
  resume() {
    return Promise.resolve();
  }
  createGain() {
    return this.gains[this.gains.push(new Node()) - 1]!;
  }
  createOscillator() {
    return this.oscillators[this.oscillators.push(new Node()) - 1]!;
  }
  createBufferSource() {
    return this.buffers[this.buffers.push(new Node()) - 1]!;
  }
  createBiquadFilter() {
    return this.filters[this.filters.push(new Node()) - 1]!;
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
}

test('legacy drum synthesis preserves frequencies, accents, filters and envelopes', () => {
  const ctx = new Context();
  const drums = createDrumVoices(
    ctx as unknown as AudioContext,
    ctx.destination as unknown as AudioNode,
  );
  drums.hit('kick', 1, true);
  drums.hit('snare', 2, true);
  drums.hit('hat', 3, true);
  drums.hit('hat', 4, false);
  const [kick, snareBody] = ctx.oscillators;
  assert.deepEqual(kick?.frequency.changes, [
    ['set', 140, 1],
    ['exp', 48, 1.09],
  ]);
  assert.deepEqual(snareBody?.frequency.changes, [
    ['set', 190, 2],
    ['exp', 125, 2.05],
  ]);
  assert.deepEqual(
    ctx.filters.map((n) => [n.type, n.frequency.value, n.Q.value]),
    [
      ['bandpass', 1700, 0.7],
      ['highpass', 6800, 0.7],
      ['highpass', 6800, 0.7],
    ],
  );
  const envelope = (source: Node | undefined, filter = false) =>
    (filter ? source?.target?.target : source?.target)?.gain.changes;
  assert.deepEqual(envelope(kick), [
    ['set', 0.0001, 1],
    ['linear', 0.21, 1.003],
    ['exp', 0.0001, 1 + 0.14],
  ]);
  assert.deepEqual(envelope(snareBody), [
    ['set', 0.0001, 2],
    ['linear', 0.055, 2.002],
    ['exp', 0.0001, 2.067],
  ]);
  assert.deepEqual(
    ctx.buffers.map((source) => envelope(source, true)),
    [
      [
        ['set', 0.0001, 2],
        ['linear', 0.14, 2.002],
        ['exp', 0.0001, 2.12],
      ],
      [
        ['set', 0.0001, 3],
        ['linear', 0.068, 3.002],
        ['exp', 0.0001, 3.045],
      ],
      [
        ['set', 0.0001, 4],
        ['linear', 0.039, 4.002],
        ['exp', 0.0001, 4.045],
      ],
    ],
  );
  drums.setLevels({ kick: 0, snare: 0.5, cymbal: 0.8 });
  assert.deepEqual(
    ctx.gains.slice(0, 3).map((n) => n.gain.changes),
    [[['target', 0, 0]], [['target', 0.5, 0]], [['target', 0.8, 0]]],
  );
  drums.stop();
  assert.ok([...ctx.oscillators, ...ctx.buffers].every((n) => n.stops.at(-1) === undefined));
  assert.ok(ctx.gains.slice(0, 3).every((n) => n.disconnected));
});

test('the Web Audio transport schedules ahead, changes tempo at the bar and cancels its own sources', async (t) => {
  const ctx = new Context();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      AudioContext: function () {
        return ctx;
      },
    },
  });
  t.after(() => Reflect.deleteProperty(globalThis, 'window'));
  t.mock.timers.enable({ apis: ['setInterval'] });
  function to(ms: number) {
    while (ctx.currentTime * 1000 < ms - 1) {
      ctx.currentTime = (Math.round(ctx.currentTime * 1000) + 25) / 1000;
      t.mock.timers.tick(25);
    }
  }
  const heard: number[][] = [];
  const metronome = await startMetronome(120, 4, {
    bpmForBar: (bar) => (bar === 0 ? 120 : 240),
    onStep: ({ bar, step, bpm }) => heard.push([bar, step, bpm]),
  });
  t.after(() => metronome.stop());
  to(25);
  assert.equal(ctx.oscillators[0]?.starts[0], 0.1);
  assert.deepEqual(heard, []);
  to(2400);
  assert.deepEqual(
    ctx.oscillators.map(({ starts }) => starts[0]),
    [0.1, 0.6, 1.1, 1.6, 2.1, 2.35],
  );
  assert.deepEqual(heard, [
    [0, 0, 120],
    [0, 1, 120],
    [0, 2, 120],
    [0, 3, 120],
    [1, 0, 240],
    [1, 1, 240],
  ]);
  const fills: number[] = [];
  const drum = await startGroove(
    { ...defaultGroove, bpm: 240, fillEvery: 4 },
    {
      onStep: ({ bar, step, variation }) => {
        if (step === 0 && variation === 'fill') fills.push(bar);
      },
    },
  );
  t.after(() => drum.stop());
  metronome.stop();
  const hitsBeforeStop = ctx.oscillators.length;
  to(5600);
  assert.ok(ctx.oscillators.length > hitsBeforeStop);
  assert.deepEqual(fills, [3]);
  drum.stop();
  const stopped = ctx.oscillators.length;
  to(6500);
  assert.equal(ctx.oscillators.length, stopped);
});
