import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTuner, TuningValue } from '../src/platform/audio.web';
import { TunerError } from '../src/platform/tunerErrors';

function browser(sampleRate = 48000) {
  const track = {
    stops: 0,
    onended: null as null | (() => void),
    stop() {
      this.stops++;
    },
  };
  const stream = { getTracks: () => [track] };
  const source = {
    disconnects: 0,
    connect() {},
    disconnect() {
      this.disconnects++;
    },
  };
  const analyser = {
    fftSize: 0,
    getFloatTimeDomainData(samples: Float32Array) {
      samples.forEach((_, i) => {
        samples[i] = 0.2 * Math.sin((2 * Math.PI * 30.867706 * i) / sampleRate);
      });
    },
  };
  class Context {
    state = 'running';
    sampleRate = sampleRate;
    closes = 0;
    async resume() {}
    async close() {
      this.state = 'closed';
      this.closes++;
    }
    createMediaStreamSource() {
      return source;
    }
    createAnalyser() {
      return analyser;
    }
  }
  const ctx = new Context();
  const windowMock = {
    AudioContext: class {
      constructor() {
        return ctx;
      }
    },
  };
  const navigatorMock = { mediaDevices: { getUserMedia: async (_constraints: unknown) => stream } };
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowMock });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigatorMock });
  return {
    track,
    source,
    analyser,
    ctx,
    windowMock,
    navigatorMock,
    restore() {
      if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
      else Reflect.deleteProperty(globalThis, 'window');
      if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator);
      else Reflect.deleteProperty(globalThis, 'navigator');
    },
  };
}

test('unsupported browsers fail before requesting microphone access', async (t) => {
  const fake = browser();
  t.after(fake.restore);
  Object.assign(fake.windowMock, { AudioContext: undefined });
  await assert.rejects(
    startTuner(() => {}),
    (e: unknown) => e instanceof TunerError && e.code === 'unsupported',
  );
  assert.equal(fake.track.stops, 0);
});

test('denied permission closes context and has a distinct error code', async (t) => {
  const fake = browser();
  t.after(fake.restore);
  fake.navigatorMock.mediaDevices.getUserMedia = async () => {
    throw new DOMException('Denied', 'NotAllowedError');
  };
  await assert.rejects(
    startTuner(() => {}),
    (e: unknown) => e instanceof TunerError && e.code === 'permission-denied',
  );
  assert.equal(fake.ctx.closes, 1);
});

test('failure after permission releases the stream and context', async (t) => {
  const fake = browser();
  t.after(fake.restore);
  fake.ctx.createAnalyser = () => {
    throw new Error('Failed setup');
  };
  await assert.rejects(
    startTuner(() => {}),
    (e: unknown) => e instanceof TunerError && e.code === 'unavailable',
  );
  assert.equal(fake.track.stops, 1);
  assert.equal(fake.source.disconnects, 1);
  assert.equal(fake.ctx.closes, 1);
});

for (const rate of [44100, 48000, 96000]) {
  test(`web adapter supplies a sufficient window at ${rate} Hz and stops idempotently`, async (t) => {
    const fake = browser(rate);
    t.after(fake.restore);
    let value: TuningValue | null = null;
    let frames = 0;
    const stop = await startTuner((pitch) => {
      value = pitch;
      frames++;
    });
    t.after(stop);
    assert.ok(fake.analyser.fftSize >= (2 * rate) / 28);
    await new Promise((resolve) => setTimeout(resolve, 125));
    assert.ok(value);
    assert.ok(Math.abs((value as TuningValue).hz - 30.867706) < 0.05);
    stop();
    stop();
    const before = frames;
    await new Promise((resolve) => setTimeout(resolve, 125));
    assert.equal(frames, before);
    assert.equal(fake.track.stops, 1);
    assert.equal(fake.source.disconnects, 1);
    assert.equal(fake.ctx.closes, 1);
  });
}

test('disconnected microphone stops capture and reports a recoverable error', async (t) => {
  const fake = browser();
  t.after(fake.restore);
  let failure: TunerError | undefined;
  let last: TuningValue | null | undefined;
  const stop = await startTuner(
    (pitch) => {
      last = pitch;
    },
    (error) => {
      failure = error;
    },
  );
  t.after(stop);
  fake.track.onended?.();
  assert.equal(failure?.code, 'unavailable');
  assert.equal(last, null);
  assert.equal(fake.track.stops, 1);
  assert.equal(fake.ctx.closes, 1);
});
