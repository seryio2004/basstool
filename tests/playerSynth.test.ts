import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { tunings } from '../src/core/instrument';
import { emptyScore, insertNote, type Edit } from '../src/core/score';
import { scoreTimeline, synthTones } from '../src/core/scoreAudio';
import type { TimeMap } from '../src/core/scoreTypes';
import { createPlayer } from '../src/platform/player.web';
import type { MixMode } from '../src/platform/playerTypes';

/*
 * Reproduce la transcripción de punta a punta con un Web Audio simulado:
 * elegir canción → setTones → setMix → play. Comprueba que cada nota crea
 * fuentes que llegan al destino con ganancia audible en su instante.
 */

type Event = { kind: 'set' | 'linear' | 'exp'; value: number; time: number };
class Param {
  events: Event[] = [];
  constructor(public value = 1) {}
  setValueAtTime(value: number, time: number) {
    this.events.push({ kind: 'set', value, time });
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ kind: 'linear', value, time });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    assert.ok(value > 0 && Number.isFinite(value), `rampa exponencial a ${value}`);
    this.events.push({ kind: 'exp', value, time });
    return this;
  }
  /** Valor según el modelo de automatización de Web Audio (suficiente para la prueba). */
  at(t: number) {
    let value = this.value;
    let from = { value: this.value, time: 0 };
    for (const e of this.events) {
      assert.ok(Number.isFinite(e.time) && Number.isFinite(e.value), 'automatización con NaN');
      if (e.time <= t) {
        value = e.value;
        from = { value, time: e.time };
        continue;
      }
      if (e.kind === 'set') break;
      const k = (t - from.time) / (e.time - from.time);
      return e.kind === 'linear'
        ? from.value + (e.value - from.value) * k
        : from.value * (e.value / from.value) ** k;
    }
    return value;
  }
}

class Node {
  outputs: Node[] = [];
  constructor(public context: Context) {
    context.nodes.push(this);
  }
  connect<T extends Node>(target: T) {
    assert.equal(target.context, this.context, 'conexión entre contextos distintos');
    this.outputs.push(target);
    return target;
  }
  disconnect() {
    this.outputs = [];
  }
}
class Gain extends Node {
  gain = new Param(1);
}
class Source extends Node {
  startAt: number | null = null;
  stopAt = Infinity;
  frequency = new Param(440);
  type = 'sine';
  buffer: unknown = null;
  onended: (() => void) | null = null;
  start(when = 0) {
    assert.equal(this.startAt, null, 'start() dos veces');
    this.startAt = when;
  }
  stop(when = 0) {
    this.stopAt = when;
  }
}
class Context {
  nodes: Node[] = [];
  songs: Node[] = [];
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 0;
  sampleRate = 8000;
  destination = new Node(this);
  sources: Source[] = [];
  createGain() {
    return new Gain(this);
  }
  createOscillator() {
    const s = new Source(this);
    this.sources.push(s);
    return s;
  }
  createBufferSource() {
    const s = new Source(this);
    this.sources.push(s);
    return s;
  }
  createBiquadFilter() {
    return Object.assign(new Node(this), {
      type: 'lowpass',
      frequency: new Param(350),
      Q: new Param(1),
      gain: new Param(0),
    });
  }
  createWaveShaper() {
    return Object.assign(new Node(this), { curve: null, oversample: 'none' });
  }
  createDynamicsCompressor() {
    return Object.assign(new Node(this), {
      threshold: new Param(),
      knee: new Param(),
      ratio: new Param(),
      attack: new Param(),
      release: new Param(),
    });
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createMediaElementSource() {
    const song = new Node(this);
    this.songs.push(song);
    return song;
  }
  async decodeAudioData() {
    const samples = new Float32Array(this.sampleRate * DURATION);
    for (let i = 0; i < samples.length; i++)
      samples[i] = songAmplitude * Math.sin((2 * Math.PI * 55 * i) / this.sampleRate);
    return {
      duration: DURATION,
      numberOfChannels: 1,
      sampleRate: this.sampleRate,
      getChannelData: () => samples,
    };
  }
  async resume() {
    this.state = 'running';
  }
  async close() {
    this.state = 'closed';
  }
  /** Mayor ganancia con la que la fuente llega al destino en el instante t. */
  level(from: Node, t: number): number {
    if (from === this.destination) return 1;
    const own = from instanceof Gain ? from.gain.at(t) : 1;
    return own * Math.max(0, ...from.outputs.map((next) => this.level(next, t)));
  }
  /**
   * Cota del pico que llega al destino en t si cada fuente activa da `amplitude(n)`:
   * suma las entradas, multiplica ganancias, recorta en el saturador y en un limitador
   * (ratio ≥ 20, sin rodilla). Un compresor suave deja pasar el pico.
   */
  peak(t: number, amplitude: (n: Node) => number) {
    const inputs = new Map<Node, Node[]>();
    for (const n of this.nodes)
      for (const next of n.outputs) inputs.set(next, [...(inputs.get(next) ?? []), n]);
    const memo = new Map<Node, number>();
    const out = (n: Node): number => {
      if (memo.has(n)) return memo.get(n)!;
      let x = amplitude(n);
      for (const p of inputs.get(n) ?? []) x += out(p);
      if (n instanceof Gain) x *= Math.abs(n.gain.at(t));
      const shaper = n as Partial<{ curve: Float32Array | null }>;
      if (shaper.curve) x = Math.min(x, Math.max(...Array.from(shaper.curve, Math.abs)));
      const dyn = n as Partial<{ ratio: Param; knee: Param; threshold: Param }>;
      if (dyn.ratio && dyn.ratio.value >= 20 && dyn.knee!.value === 0)
        x = Math.min(x, 10 ** (dyn.threshold!.value / 20));
      memo.set(n, x);
      return x;
    };
    return out(this.destination);
  }
}

const DURATION = 8;
let songAmplitude = 0.3;
class FakeAudio {
  paused = true;
  ended = false;
  seeking = false;
  readyState = 4;
  currentTime = 0;
  playbackRate = 1;
  preservesPitch = true;
  preload = '';
  src = '';
  listeners = new Map<string, Set<() => void>>();
  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }
  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
  async play() {
    this.paused = false;
    this.emit('play');
    this.emit('playing');
  }
  pause() {
    this.paused = true;
    this.emit('pause');
  }
  load() {}
  removeAttribute() {}
}

let contexts: Context[] = [];
let element: FakeAudio | null = null;
const g = globalThis as Record<string, unknown>;
const saved = ['window', 'document', 'Audio', 'requestAnimationFrame', 'cancelAnimationFrame'].map(
  (k) => [k, g[k]] as const,
);
const createObjectURL = URL.createObjectURL;
const revokeObjectURL = URL.revokeObjectURL;
function installBrowser() {
  contexts = [];
  g.window = {
    AudioContext: class extends Context {
      constructor() {
        super();
        contexts.push(this);
      }
    },
    addEventListener() {},
    removeEventListener() {},
  };
  g.document = {
    createElement: () => {
      const listeners = new Map<string, () => void>();
      const input = {
        files: null as unknown[] | null,
        addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
        removeEventListener: (type: string) => listeners.delete(type),
        remove() {},
        click() {
          input.files = [
            { name: 'cancion.wav', size: 1000, arrayBuffer: async () => new ArrayBuffer(8) },
          ];
          queueMicrotask(() => listeners.get('change')?.());
        },
      };
      return input;
    },
  };
  g.Audio = function () {
    element = new FakeAudio();
    return element;
  };
  g.requestAnimationFrame = () => 0;
  g.cancelAnimationFrame = () => {};
  URL.createObjectURL = () => 'blob:prueba';
  URL.revokeObjectURL = () => {};
}
afterEach(() => {
  for (const [k, v] of saved) g[k] = v;
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
});

const bass = tunings.standard4;
function written(): Edit {
  let edit: Edit = { score: emptyScore(), cursor: { measure: 0, event: 0, string: 0 } };
  for (const fret of [3, 5, 7, 0])
    edit = insertNote(edit.score, edit.cursor, fret, { base: 4, dots: 0 }, bass);
  return edit;
}

for (const marks of [false, true])
  for (const mode of ['score', 'both'] as MixMode[])
    test(`la transcripción suena en modo ${mode} ${marks ? 'con' : 'sin'} marcas de compás`, async () => {
      installBrowser();
      const player = createPlayer();
      try {
        assert.ok(await player.pick());
        const context = contexts.at(-1)!;
        const map: TimeMap = marks
          ? { measures: [0.5, 2.5], beats: [] }
          : { measures: [], beats: [] };
        const tones = synthTones(scoreTimeline(written().score, map, DURATION, bass));
        assert.equal(tones.length, 4);
        player.setTones(tones);
        player.setMix(mode, 0.5);
        await player.play();
        assert.equal(context.state, 'running');
        // El transporte programa por ventanas: avanza los dos relojes juntos.
        for (let t = 0; t < 3; t += 0.04) {
          context.currentTime = t;
          element!.currentTime = t;
          element!.emit('timeupdate');
          element!.emit('playing');
        }
        const started = context.sources.filter((s) => s.startAt !== null);
        const pitched = started.filter((s) => s.frequency.value > 20 && s.buffer === null);
        // Dos osciladores por nota (cuerpo y octava): las cuatro notas, una vez cada una.
        assert.equal(pitched.length, 8, 'osciladores programados');
        for (const source of pitched) {
          const t = source.startAt! + 0.05;
          assert.ok(source.stopAt > t, 'la nota se para antes de sonar');
          const level = context.level(source, t);
          assert.ok(level > 0.02, `nivel en destino ${level.toFixed(4)} a ${t.toFixed(2)} s`);
        }
        const first = Math.min(...pitched.map((s) => s.startAt!));
        assert.ok(Math.abs(first - (marks ? 0.5 : 0)) < 0.05, `primera nota en ${first}`);
      } finally {
        player.unload();
      }
    });

test('una calibración alta no satura el bus ni deja la voz por encima de la canción', async () => {
  // Canción fuerte: el ajuste por RMS llega a su máximo.
  songAmplitude = 0.95;
  installBrowser();
  const player = createPlayer();
  try {
    assert.ok(await player.pick());
    const context = contexts.at(-1)!;
    // Acorde de cuatro cuerdas y redonda: todas las voces suenan a la vez.
    let edit: Edit = { score: emptyScore(), cursor: { measure: 0, event: 0, string: 0 } };
    edit = insertNote(edit.score, edit.cursor, 5, { base: 1, dots: 0 }, bass);
    const events = scoreTimeline(edit.score, { measures: [], beats: [] }, DURATION, bass).map(
      (e, i) =>
        i
          ? e
          : {
              ...e,
              voices: [0, 1, 2, 3].map((string) => ({ string, midi: 30 + 5 * string, tie: false })),
            },
    );
    player.setTones(synthTones(events));
    player.setVolume(1);
    for (const [mode, balance] of [
      ['score', 1],
      ['both', 0.5],
      ['both', 1],
    ] as const) {
      player.setMix(mode, balance);
      if (element!.paused) await player.play();
      element!.currentTime = 0;
      context.currentTime = 0;
      element!.emit('playing');
      const active = (n: Node) =>
        n instanceof Source && n.startAt !== null && n.startAt <= 0.05 && n.stopAt > 0.05 ? 1 : 0;
      const voice = context.peak(0.05, active);
      const song = context.peak(0.05, (n) => (context.songs.includes(n) ? songAmplitude : 0));
      assert.ok(voice > 0.02, `${mode}: la voz no suena (${voice})`);
      assert.ok(
        voice + song <= 1,
        `${mode} ${balance}: pico ${(voice + song).toFixed(2)} > 0 dBFS`,
      );
      if (mode === 'both' && balance === 0.5)
        assert.ok(
          voice <= song,
          `la voz (${voice.toFixed(2)}) supera a la canción (${song.toFixed(2)})`,
        );
      element!.emit('pause');
    }
  } finally {
    player.unload();
    songAmplitude = 0.3;
  }
});
