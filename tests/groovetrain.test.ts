import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  manualTrainChords,
  parseTrainChord,
  scoreTrain,
  tonalTrainChords,
  trainTargets,
} from '../src/core/chordTrain';
import { fifthsCircle } from '../src/core/notation';
import { expectedHits, frequency, makePattern, pitchFromSamples } from '../src/core/music';
import { OnsetDetector } from '../src/core/rhythm';
import { majorProgressions } from '../src/core/theory';
import { openRhythmMic } from '../src/platform/rhythmMic.web';

test('all ten levels use the original weights and historical figure indices', () => {
  const bags = [
    '00000055555',
    '000000555566677',
    '0000011122225667789',
    '00011122222335667789',
    '0011222333344445667789',
  ];
  const byLevel = [0, 1, 2, 2, 3, 3, 4, 4, 4, 4];
  for (let level = 1; level <= 10; level++) {
    const bag = bags[byLevel[level - 1]!]!;
    let draw = 0;
    assert.equal(makePattern(level, bag.length, () => (draw++ + 0.5) / bag.length).join(''), bag);
  }
  assert.deepEqual(
    expectedHits([8, 9, 7], 60).map(({ t }) => t),
    [0.5, 1, 2, 2.5, 2.75],
  );
});

test('sustained low notes count once and a new pluck over the decay counts again', () => {
  for (const rate of [44100, 48000]) {
    for (const midi of [23, 28, 33, 40]) {
      const detector = new OnsetDetector(rate);
      const hits: number[] = [];
      for (let frame = 0; frame < rate; frame += 128) {
        const samples = Float32Array.from({ length: 128 }, (_, offset) => {
          const time = (frame + offset) / rate;
          const attack = time >= 0.55 ? 0.55 : 0.1;
          const amplitude =
            time >= attack ? (attack === 0.1 ? 0.16 : 0.2) * Math.exp(-3 * (time - attack)) : 0;
          return amplitude * Math.sin(2 * Math.PI * frequency(midi) * time);
        });
        if (detector.process(samples, frame / rate).hit) hits.push(frame / rate);
      }
      assert.equal(hits.length, 2, `${rate} Hz, MIDI ${midi}: ${hits}`);
      assert.ok(Math.abs(hits[0]! - 0.1) < 0.02);
      assert.ok(Math.abs(hits[1]! - 0.55) < 0.02);
    }
  }
});

test('tonal progressions retain diatonic spelling and manual input assigns an individual chord to each cell', () => {
  for (const { major } of fifthsCircle) {
    for (const { value } of majorProgressions)
      assert.equal(tonalTrainChords(major, value).length, 16);
  }
  assert.deepEqual(
    tonalTrainChords('F#', majorProgressions[0]!.value)
      .filter((_, i) => i % 4 === 0)
      .map(({ symbol }) => symbol),
    ['F#', 'C#', 'D#m', 'B'],
  );
  const manual = manualTrainChords('Sibmaj7 | Mib7, F♯m7b5')!;
  assert.equal(manual.length, 16);
  assert.deepEqual(
    manual.slice(0, 4).map(({ symbol }) => symbol),
    ['Bbmaj7', 'Eb7', 'F#m7b5', 'Bbmaj7'],
  );
  assert.equal(manualTrainChords('C H7'), null);
  assert.equal(manualTrainChords(''), null);
  assert.equal(manualTrainChords(Array(17).fill('C').join(' ')), null);
});

test('levels validate the next chord tone, with free order only at the final level', () => {
  const chords = ['C7', 'C7', 'Ddim'].map((symbol) => parseTrainChord(symbol)!);
  const first = [0, 0, 0];
  const selected = (level: number) =>
    trainTargets(first, 60, chords, level).map(({ pitches }) => pitches);
  assert.deepEqual(selected(1), [[0], [0], [0], [0], [2], [2]]);
  assert.deepEqual(selected(2), [[0], [7], [0], [7], [2], [8]]);
  assert.deepEqual(selected(3), [[0], [4], [7], [10], [2], [5]]);
  assert.deepEqual(selected(4)[0], [0, 4, 7, 10]);
});

test('scoring checks pitch against the time-matched cell and falls back to rhythm with manual input', () => {
  const expected = trainTargets([5, 5, 5, 5], 60, manualTrainChords('C7 Db C7 Db'), 4);
  const samples = Float32Array.from(
    { length: 4096 },
    (_, i) => 0.2 * Math.sin((2 * Math.PI * frequency(34) * i) / 48000),
  );
  const hz = pitchFromSamples(samples, 48000)!;
  const hits = [
    { t: 0.05, midi: Math.round(69 + 12 * Math.log2(hz / 440)) },
    { t: 0.94, midi: 36 }, // C is in the first chord, outside the second.
    { t: 3.01, midi: null },
    { t: 3.6, midi: 37 },
  ];
  assert.deepEqual(scoreTrain(expected, hits, 0.1, 1, true), {
    correct: 1,
    total: 4,
    missed: 1,
    extras: 1,
    wrongPitch: 2,
    bias: 0,
  });
  assert.equal(scoreTrain(expected, hits, 0.1, 1, false).correct, 3);
});

test('the worklet reports onset time and post-attack bass samples without playing input', async (t) => {
  let clock = 0;
  let processor: {
    port: { onmessage: (event: { data: unknown }) => void };
    process: (inputs: Float32Array[][]) => boolean;
  };
  const messages: { time?: number; sampleRate?: number; samples?: Float32Array }[] = [];
  const connections: unknown[][] = [];
  let stopped = 0;
  const track = { onended: null, stop: () => stopped++ };
  const source = { connect: (...args: unknown[]) => connections.push(args), disconnect() {} };
  class Context {
    destination = {};
    audioWorklet = {
      async addModule(url: string) {
        const source = await (await fetch(url)).text();
        runInNewContext(source, {
          sampleRate: 48000,
          get currentTime() {
            return clock;
          },
          AudioWorkletProcessor: class {
            port = { postMessage: (data: (typeof messages)[number]) => messages.push(data) };
          },
          registerProcessor: (_: string, Processor: new () => typeof processor) => {
            processor = new Processor();
          },
        });
      },
    };
    async resume() {}
    createMediaStreamSource() {
      return source;
    }
    createBiquadFilter() {
      return { ...source, frequency: { value: 0 } };
    }
  }
  class Worklet {
    port = {
      onmessage: null,
      close() {},
      postMessage(data: unknown) {
        processor.port.onmessage({ data });
      },
    };
    connect() {}
    disconnect() {}
  }
  for (const [key, value] of Object.entries({
    window: { AudioContext: Context },
    navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track] }) } },
    AudioWorkletNode: Worklet,
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() =>
      original
        ? Object.defineProperty(globalThis, key, original)
        : Reflect.deleteProperty(globalThis, key),
    );
  }
  const mic = await openRhythmMic({ onAttack() {}, onLevel() {}, onDisconnect() {} });
  assert.equal(connections.length, 3);
  mic.configure(35, true);
  for (let frame = 0; frame < 16000; frame += 128) {
    clock = frame / 48000;
    const samples = Float32Array.from({ length: 128 }, (_, i) => {
      const time = (frame + i) / 48000;
      return time < 0.1 ? 0 : 0.18 * Math.sin(2 * Math.PI * frequency(23) * time);
    });
    // The registered processor consumes input and produces silent (untouched) output.
    assert.equal(processor!.process([[samples], [samples]]), true);
  }
  const attacks = messages.filter(({ time }) => time !== undefined);
  assert.equal(attacks.length, 1);
  assert.ok(Math.abs(attacks[0]!.time! - 0.1) < 0.02);
  assert.ok(
    Math.abs(pitchFromSamples(attacks[0]!.samples!, attacks[0]!.sampleRate!)! - frequency(23)) <
      0.1,
  );
  mic.stop();
  mic.stop();
  assert.equal(stopped, 1);
});
