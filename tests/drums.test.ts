import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  defaultGroove,
  defaultSwing,
  drumBar,
  drumGenres,
  drumMeters,
  grooveVariation,
  pulsesPerBar,
  tapTempo,
} from '../src/core/drums';

test('each genre has distinct variations and fills within all offered meters', () => {
  for (const { value: genre } of drumGenres) {
    for (const meter of drumMeters(genre)) {
      const groove = { ...defaultGroove, genre, meter, swing: defaultSwing(genre, meter) };
      const variations = (['A', 'B', 'fill'] as const).map((variation) =>
        drumBar({ ...groove, variation }),
      );
      assert.equal(new Set(variations.map((bar) => JSON.stringify(bar))).size, 3);
      for (const bar of variations) {
        assert.equal(bar.length, { '4/4': 16, '3/4': 12, '6/8': 12, '12/8': 24 }[meter]);
        assert.equal(bar[0]?.pulse, 0);
        assert.ok(bar.at(-1)!.pulse < pulsesPerBar(meter));
        assert.ok(bar.every(({ pulse }, i) => i === 0 || pulse > bar[i - 1]!.pulse));
        const cymbals = bar
          .flatMap(({ hits }) => hits)
          .filter(({ drum }) => drum === 'hat' || drum === 'ride');
        assert.ok(cymbals.length > 0);
        assert.ok(cymbals.every(({ drum }) => drum === (genre === 'jazz' ? 'ride' : 'hat')));
      }
    }
  }
  assert.throws(() => drumBar({ ...defaultGroove, genre: 'reggae', meter: '3/4' }), /Compás/);
});

test('shuffle, compound meters and one drop retain their defining accents', () => {
  const reggae = drumBar({ ...defaultGroove, genre: 'reggae' });
  assert.deepEqual(
    reggae.flatMap(({ pulse, hits }) =>
      hits.filter(({ drum }) => drum !== 'hat').map(({ drum }) => [pulse, drum]),
    ),
    [
      [2, 'kick'],
      [2, 'snare'],
    ],
  );
  const blues = drumBar({ ...defaultGroove, genre: 'blues', swing: 60 });
  assert.equal(blues[2]?.pulse, 2 / 3);
  assert.equal(blues[4]?.pulse, 1);
  const compound = drumBar({ ...defaultGroove, genre: 'blues', meter: '12/8' });
  assert.equal(compound[4]?.pulse, 2 / 3);
  assert.equal(compound[6]?.pulse, 1);
  const funk = drumBar({ ...defaultGroove, genre: 'funk', swing: 60 });
  assert.equal(funk[1]?.pulse, 1 / 3);
  assert.equal(funk[2]?.pulse, 1 / 2);
});

test('fills occur on the last bar of each requested group', () => {
  for (const fillEvery of [0, 4, 8] as const) {
    const fills = Array.from({ length: 16 }, (_, i) =>
      grooveVariation({ variation: 'B', fillEvery }, i),
    );
    assert.deepEqual(
      fills.flatMap((v, i) => (v === 'fill' ? [i + 1] : [])),
      fillEvery === 4 ? [4, 8, 12, 16] : fillEvery === 8 ? [8, 16] : [],
    );
  }
});

test('tap tempo averages recent intervals, clamps extremes and restarts after a pause', () => {
  assert.deepEqual(tapTempo([], 0), { taps: [0], bpm: undefined });
  assert.deepEqual(tapTempo([0, 480], 1000), { taps: [0, 480, 1000], bpm: 120 });
  assert.deepEqual(tapTempo([0, 490, 1000, 1500, 2000], 2490), {
    taps: [490, 1000, 1500, 2000, 2490],
    bpm: 120,
  });
  assert.equal(tapTempo([0], 100).bpm, 240);
  assert.equal(tapTempo([0], 1500).bpm, 40);
  assert.deepEqual(tapTempo([0, 500], 2001), { taps: [2001], bpm: undefined });
});
