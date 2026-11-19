import { chordArpeggios } from './theory';

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
const quality = (key: keyof typeof chordArpeggios, label: string = key): [string, number[]] => [
  label,
  chordArpeggios[key].tones.map(({ semitones }) => semitones % 12),
];
const qualities: [string, number[]][] = [
  quality(''),
  quality('m'),
  quality('dim'),
  quality('aug'),
  quality('sus2'),
  quality('sus4'),
  quality('7'),
  quality('maj7'),
  quality('m7'),
  quality('m7b5', 'm7♭5'),
  quality('dim7'),
  quality('mMaj7', 'm(maj7)'),
  quality('6'),
  quality('m6'),
  quality('add9'),
  ['6/9', [0, 4, 7, 9, 2]],
  quality('maj9'),
  quality('9'),
  quality('m9'),
  ['m(maj9)', [0, 3, 7, 11, 2]],
  ['7(♭9)', [0, 4, 7, 10, 1]],
  ['7(♯9)', [0, 4, 7, 10, 3]],
  ['7(♯11)', [0, 4, 7, 10, 6]],
  ['maj7(♯11)', [0, 4, 7, 11, 6]],
  ['11', [0, 4, 7, 10, 2, 5]],
  ['m11', [0, 3, 7, 10, 2, 5]],
  ['13', [0, 4, 7, 10, 2, 9]],
  ['m13', [0, 3, 7, 10, 2, 9]],
  ['13', [0, 4, 7, 10, 2, 5, 9]],
  ['m13', [0, 3, 7, 10, 2, 5, 9]],
];
// Full spellings first, then voicings with common omissions.
const templates: [string, number[]][] = [...qualities];
for (const [suffix, tones] of qualities) {
  if (tones.length < 5) continue;
  templates.push([suffix, tones.filter((n) => n !== 7)]);
  if (suffix === '13' || suffix === 'm13') {
    templates.push(
      [suffix, tones.filter((n) => n !== 2)],
      [suffix, tones.filter((n) => n !== 2 && n !== 7)],
    );
  }
  if (suffix === '11') {
    templates.push(
      [suffix, tones.filter((n) => n !== 4)],
      [suffix, tones.filter((n) => n !== 4 && n !== 7)],
    );
  }
}
const roots = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export type ChordGuess = { symbol: string; confidence: number };

/** Match complete pitch-class sets, using the lowest sounding note to break ties. */
export function inferChord(notes: readonly number[]): string | null {
  const midi = notes.filter(Number.isInteger);
  const pitchClass = (note: number) => ((note % 12) + 12) % 12;
  const pitches = new Set(midi.map(pitchClass));
  if (pitches.size < 3 || pitches.size > 7) return null;
  const bass = pitchClass(midi.reduce((low, n) => Math.min(low, n), Infinity));
  const candidates = [bass, ...[...pitches].filter((pc) => pc !== bass).sort((a, b) => a - b)];
  let best: { symbol: string; rank: number } | undefined;
  for (const root of candidates) {
    const index = templates.findIndex(
      ([, intervals]) =>
        intervals.length === pitches.size && intervals.every((n) => pitches.has((root + n) % 12)),
    );
    if (index < 0) continue;
    const symbol = roots[root] + templates[index]![0] + (root === bass ? '' : '/' + roots[bass]);
    if (root === bass) return symbol;
    if (!best || index < best.rank) best = { symbol, rank: index };
  }
  return best?.symbol ?? null;
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
  const energies = Array<number>(85).fill(0);
  const frames = Math.min(10, Math.ceil((b - a) / size));
  for (let k = 0; k < frames; k++) {
    const offset = a + Math.floor((k * (b - a - size)) / Math.max(1, frames - 1));
    const window = Float32Array.from(
      pcm.subarray(offset, offset + size),
      (x, i) => x * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1))),
    );
    // Remove each resolved sinusoid before measuring its neighbours. This
    // separates adjacent chromatic extensions that share a peak in the window.
    let strongest = 0;
    for (let voice = 0; voice < 12; voice++) {
      let peak = 0,
        midi = 0,
        real = 0,
        imaginary = 0;
      for (let n = 23; n <= 84; n++) {
        const omega = (2 * Math.PI * 440 * 2 ** ((n - 69) / 12)) / rate;
        const cos = Math.cos(omega),
          sin = Math.sin(omega);
        let p = 0,
          q = 0;
        for (const x of window) {
          const value = x + 2 * cos * p - q;
          q = p;
          p = value;
        }
        const re = p - q * cos,
          im = q * sin;
        const magnitude = Math.hypot(re, im) / size;
        if (magnitude > peak) {
          peak = magnitude;
          midi = n;
          real = re;
          imaginary = im;
        }
      }
      if (!voice) strongest = peak;
      if (peak < Math.max(0.00005, strongest * 0.14)) break;
      energies[midi]! += peak;
      chroma[midi % 12]! += peak;
      const omega = (2 * Math.PI * 440 * 2 ** ((midi - 69) / 12)) / rate;
      for (let i = 0; i < size; i++) {
        const angle = omega * (size - 1 - i);
        const weight = 1 - Math.cos((2 * Math.PI * i) / (size - 1));
        window[i]! -=
          (weight * 2 * (real * Math.cos(angle) + imaginary * Math.sin(angle))) / (size - 1);
      }
    }
  }
  const norm = Math.hypot(...chroma);
  if (norm < frames * 0.0001) return null;
  const bassThreshold = Math.max(...energies) * 0.16;
  const bass = energies.findIndex((v) => v > bassThreshold) % 12;
  let best: ChordGuess | null = null;
  let bestRank = 0;
  for (let root = 0; root < 12; root++)
    for (const [suffix, intervals] of templates) {
      const values = intervals.map((n) => chroma[(root + n) % 12]!);
      const confidence = values.reduce((a, b) => a + b, 0) / (norm * Math.sqrt(values.length));
      const rank = confidence + (root === bass ? 0.012 : 0);
      if (Math.min(...values) > norm * 0.09 && rank > bestRank + 1e-9) {
        bestRank = rank;
        best = {
          symbol:
            roots[root] +
            suffix +
            (root !== bass && intervals.includes((bass - root + 12) % 12) ? '/' + roots[bass] : ''),
          confidence: Math.min(1, confidence),
        };
      }
    }
  return best;
}
