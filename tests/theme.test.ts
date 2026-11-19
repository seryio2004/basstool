import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastChecks, contrastRatio, palettes } from '../src/theme/palette';

test('contrast ratio matches the WCAG reference values', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(contrastRatio('#777777', '#FFFFFF').toFixed(2), '4.48');
});

for (const [name, palette] of Object.entries(palettes)) {
  test(`${name} theme meets AA on every documented pair`, () => {
    const failures = contrastChecks
      .map((c) => ({ use: c.use, ratio: contrastRatio(c.fg(palette), c.bg(palette)), min: c.min }))
      .filter((c) => c.ratio < c.min)
      .map((c) => `${c.use}: ${c.ratio.toFixed(2)} < ${c.min}`);
    assert.deepEqual(failures, []);
  });
}

test('both themes define the same tokens', () => {
  assert.deepEqual(Object.keys(palettes.dark).sort(), Object.keys(palettes.light).sort());
});

test('content surfaces keep their text within the intended contrast ranges', () => {
  for (const palette of Object.values(palettes)) {
    for (const background of [palette.bg, palette.surface, palette.raised]) {
      const main = contrastRatio(palette.ink, background);
      const secondary = contrastRatio(palette.muted, background);
      assert.ok(main >= 8 && main <= 11, `Texto principal: ${main.toFixed(2)}`);
      assert.ok(secondary >= 5 && secondary <= 6.2, `Texto secundario: ${secondary.toFixed(2)}`);
    }
  }
});
