import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clampCompensation,
  encodeWav,
  estimateLatency,
  takeAlignment,
} from '../src/core/recording';

const clicks = [0.25, 0.75, 1.25, 1.75];

function signal(rate: number, delays: (number | null)[], noise = 0.001) {
  let seed = 98374;
  const samples = Float32Array.from({ length: rate * 2.1 }, () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return noise * (seed / 2 ** 31 - 1);
  });
  for (let i = 0; i < clicks.length; i++) {
    const delay = delays[i];
    if (delay == null) continue;
    const start = Math.round(rate * (clicks[i]! + delay / 1000));
    const frequency = i === 0 ? 1760 : 1175;
    for (let j = 0; j < rate * 0.043; j++) {
      const time = j / rate;
      const gain = Math.min(time / 0.008, Math.exp(-time * 85) * 2);
      samples[start + j]! += gain * Math.sin(time * 2 * Math.PI * frequency) * 0.1;
    }
  }
  return samples;
}

test('finds the repeated click delay at 44.1 and 48 kHz with one missed click', () => {
  for (const rate of [44100, 48000]) {
    for (const delay of [0, 37, 114, 195, 200]) {
      const measured = estimateLatency(
        signal(rate, [delay, delay + 1, null, delay - 1]),
        rate,
        clicks,
      );
      assert.ok(
        measured !== null && Math.abs(measured - delay) <= 4,
        `${rate}: ${delay} → ${measured}`,
      );
    }
  }
});

test('rejects missing, inconsistent, out-of-range, and truncated clicks', () => {
  const rate = 48000;
  for (const delays of [
    [null, null, null, null],
    [20, 15, 70, 77],
    [220, 220, 220, 220],
  ]) {
    assert.equal(estimateLatency(signal(rate, delays), rate, clicks), null);
  }
  assert.equal(estimateLatency(signal(rate, [30, 30, 30, 30]).slice(0, rate), rate, clicks), null);
});

test('compensation is bounded and shifts the take in the requested direction', () => {
  assert.equal(clampCompensation(250), 200);
  assert.equal(clampCompensation(-250), -200);
  assert.equal(clampCompensation(Infinity), 0);
  assert.equal(clampCompensation(3.6), 4);
  assert.deepEqual(takeAlignment(63), { skip: 0.063, delay: 0 });
  assert.deepEqual(takeAlignment(-150), { skip: 0, delay: 0.15 });
});

test('writes PCM16 RIFF headers and interleaves stereo across blocks', () => {
  const pcm = encodeWav(
    [
      [Float32Array.of(-2, 0.5), Float32Array.of(2, -0.5)],
      [Float32Array.of(NaN), Float32Array.of(0)],
    ],
    48000,
  );
  const wav = new DataView(pcm);
  assert.equal(wav.getUint32(0), 0x52494646);
  assert.equal(wav.getUint32(4, true), wav.byteLength - 8);
  assert.equal(wav.getUint32(8), 0x57415645);
  assert.equal(wav.getUint16(20, true), 1);
  assert.equal(wav.getUint16(22, true), 2);
  assert.equal(wav.getUint32(24, true), 48000);
  assert.equal(wav.getUint32(28, true), 192000);
  assert.equal(wav.getUint16(32, true), 4);
  assert.equal(wav.getUint16(34, true), 16);
  assert.equal(wav.getUint32(36), 0x64617461);
  assert.equal(wav.getUint32(40, true), 12);
  assert.deepEqual(
    Array.from({ length: 6 }, (_, i) => wav.getInt16(44 + i * 2, true)),
    [-32768, 32767, 16384, -16384, 0, 0],
  );
});

test('supports mono and rejects inconsistent channel layouts', () => {
  const wav = new DataView(encodeWav([[Float32Array.of(0.25)]], 44100));
  assert.equal(wav.getUint16(22, true), 1);
  assert.equal(wav.getUint32(40, true), 2);
  assert.equal(wav.getInt16(44, true), 8192);
  assert.throws(() => encodeWav([[Float32Array.of(0), Float32Array.of(0, 0)]], 44100), RangeError);
  assert.throws(() => encodeWav([], 0), RangeError);
});
