// Box-filter before decimation. Keep one locally decoded channel at ~4 kHz.
export function analysisAudio(samples: Float32Array, rate: number) {
  const step = Math.max(1, Math.floor(rate / 4000));
  const pcm = new Float32Array(Math.floor(samples.length / step));
  for (let i = 0; i < pcm.length; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += samples[i * step + j]!;
    pcm[i] = sum / step;
  }
  return { pcm, rate: rate / step };
}
const qualities: [string, number[]][] = [
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['dim', [0, 3, 6]],
  ['aug', [0, 4, 8]],
  ['sus2', [0, 2, 7]],
  ['sus4', [0, 5, 7]],
  ['7', [0, 4, 7, 10]],
  ['maj7', [0, 4, 7, 11]],
  ['m7', [0, 3, 7, 10]],
  ['m7♭5', [0, 3, 6, 10]],
  ['dim7', [0, 3, 6, 9]],
];
const roots = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export type ChordGuess = { symbol: string; confidence: number };

/** Match complete pitch-class sets, using the lowest sounding note to break ties. */
export function inferChord(notes: readonly number[]): string | null {
  const midi = notes.filter(Number.isInteger);
  const pitchClass = (note: number) => ((note % 12) + 12) % 12;
  const pitches = new Set(midi.map(pitchClass));
  if (pitches.size < 3 || pitches.size > 4) return null;
  const bass = pitchClass(Math.min(...midi));
  for (const root of [
    bass,
    ...[...pitches].filter((pitch) => pitch !== bass).sort((a, b) => a - b),
  ]) {
    const quality = qualities.find(
      ([, intervals]) =>
        intervals.length === pitches.size &&
        intervals.every((interval) => pitches.has((root + interval) % 12)),
    );
    if (quality) return roots[root] + quality[0] + (root === bass ? '' : `/${roots[bass]}`);
  }
  return null;
}

export function detectChord(
  audio: ReturnType<typeof analysisAudio>,
  start: number,
  end: number,
): ChordGuess | null {
  const { rate, pcm } = audio;
  const a = Math.max(0, Math.floor(start * rate)),
    b = Math.min(pcm.length, Math.floor(end * rate));
  const size = Math.min(Math.round(rate * 0.25), b - a);
  if (size < rate * 0.08) return null;
  const chroma = Array<number>(12).fill(0);
  const frames = Math.min(10, Math.ceil((b - a) / size));
  for (let k = 0; k < frames; k++) {
    const offset = a + Math.floor((k * (b - a - size)) / Math.max(1, frames - 1));
    const window = Float32Array.from(
      pcm.subarray(offset, offset + size),
      (x, i) => x * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1))),
    );
    const spectrum: number[] = [];
    for (let midi = 35; midi <= 84; midi++) {
      const coeff = 2 * Math.cos((2 * Math.PI * 440 * 2 ** ((midi - 69) / 12)) / rate);
      let p = 0,
        q = 0;
      for (const x of window) {
        const v = x + coeff * p - q;
        q = p;
        p = v;
      }
      spectrum.push(Math.sqrt(Math.max(0, p * p + q * q - coeff * p * q)) / size);
    }
    spectrum.forEach((v, i) => {
      if (v > (spectrum[i - 1] ?? 0) && v >= (spectrum[i + 1] ?? 0)) chroma[(35 + i) % 12]! += v;
    });
  }
  const norm = Math.hypot(...chroma);
  if (norm < frames * 0.0001) return null;
  let best: ChordGuess | null = null;
  for (let root = 0; root < 12; root++)
    for (const [suffix, intervals] of qualities) {
      const values = intervals.map((n) => chroma[(root + n) % 12]!);
      const confidence = values.reduce((a, b) => a + b, 0) / (norm * Math.sqrt(values.length));
      if (Math.min(...values) > norm * 0.09 && confidence > (best?.confidence ?? 0))
        best = { symbol: roots[root] + suffix, confidence: Math.min(1, confidence) };
    }
  return best;
}
