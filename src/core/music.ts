export const noteNames = [
  'Do',
  'Do♯',
  'Re',
  'Re♯',
  'Mi',
  'Fa',
  'Fa♯',
  'Sol',
  'Sol♯',
  'La',
  'La♯',
  'Si',
];
export const naturals = [60, 62, 64, 65, 67, 69, 71, 72];
export const frequency = (midi: number, reference = 440) => reference * 2 ** ((midi - 69) / 12);
export const noteName = (midi: number) => noteNames[((midi % 12) + 12) % 12]!;
export const octave = (midi: number) => Math.floor(midi / 12) - 1;
export const intervals = [
  { semitones: 2, name: '2.ª mayor' },
  { semitones: 4, name: '3.ª mayor' },
  { semitones: 5, name: '4.ª justa' },
  { semitones: 7, name: '5.ª justa' },
  { semitones: 9, name: '6.ª mayor' },
  { semitones: 12, name: '8.ª justa' },
];
/** Lowest supported fundamental. Web capture must contain at least two periods. */
export const minTunerHz = 28;
export const tunerWindowSize = 4096;

export function pitchFromSamples(samples: Float32Array, sampleRate: number): number | null {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || samples.length < 4) return null;
  // Remove DC before measuring silence and correlation.
  let mean = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample)) return null;
    mean += sample;
  }
  mean /= samples.length;
  const centered = Float32Array.from(samples, (value) => value - mean);
  const rms = Math.sqrt(centered.reduce((sum, value) => sum + value * value, 0) / samples.length);
  if (rms < 0.012) return null;
  const min = Math.max(2, Math.floor(sampleRate / 1200));
  const max = Math.min(Math.ceil(sampleRate / minTunerHz) + 1, Math.floor(samples.length / 2));
  if (max <= min + 1) return null;
  const length = samples.length - max;
  const correlations = new Float64Array(max + 1);
  for (let lag = min - 1; lag <= max; lag++) {
    let cross = 0,
      left = 0,
      right = 0;
    for (let i = 0; i < length; i++) {
      const a = centered[i]!,
        b = centered[i + lag]!;
      cross += a * b;
      left += a * a;
      right += b * b;
    }
    correlations[lag] = cross / Math.sqrt(left * right || 1);
  }
  const peaks: { lag: number; strength: number }[] = [];
  for (let lag = min; lag < max; lag++) {
    const a = correlations[lag - 1]!,
      b = correlations[lag]!,
      c = correlations[lag + 1]!;
    if (b < 0.9 || b <= a || b < c) continue;
    const curvature = a - 2 * b + c;
    const offset = curvature ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / curvature)) : 0;
    // Compare interpolated maxima, not integer-sample heights (which favor subharmonics).
    peaks.push({ lag: lag + offset, strength: b - 0.25 * (a - c) * offset });
  }
  if (!peaks.length) return null;
  const strongest = Math.max(...peaks.map((peak) => peak.strength));
  // Examine the full window before choosing: a dominant second harmonic can
  // create an early peak. Among equally strong periods take the shortest one.
  const peak = peaks.find((candidate) => candidate.strength >= strongest - 0.0005)!;
  const hz = sampleRate / peak.lag;
  return hz >= minTunerHz - 0.01 && hz <= 1200 ? hz : null;
}

export function validateTuningReference(reference: number): void {
  if (!Number.isFinite(reference) || reference < 415 || reference > 466) {
    throw new RangeError('La referencia de La4 debe estar entre 415 y 466 Hz.');
  }
}

export function tuning(hz: number, reference = 440) {
  validateTuningReference(reference);
  if (!Number.isFinite(hz) || hz <= 0) throw new RangeError('La frecuencia debe ser positiva.');
  const exact = 69 + 12 * Math.log2(hz / reference),
    midi = Math.round(exact);
  return {
    name: noteName(midi),
    octave: octave(midi),
    cents: Math.round((exact - midi) * 100),
    hz,
  };
}
export const figurePool = [
  { name: 'Dos corcheas', notes: [0, 0.5], beams: 1 },
  { name: 'Cuatro semicorcheas', notes: [0, 0.25, 0.5, 0.75], beams: 2 },
  { name: 'Tresillo', notes: [0, 1 / 3, 2 / 3], beams: 1, tuplet: 3 },
  { name: 'Quintillo', notes: [0, 0.2, 0.4, 0.6, 0.8], beams: 2, tuplet: 5 },
  { name: 'Seisillo', notes: [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6], beams: 2, tuplet: 6 },
  { name: 'Negra', notes: [0], beams: 0 },
  { name: 'Dos semicorcheas y corchea', notes: [0, 0.25, 0.5], beams: 1 },
  { name: 'Corchea y dos semicorcheas', notes: [0, 0.5, 0.75], beams: 1 },
  { name: 'Silencio de corchea y corchea', notes: [0.5], beams: 0 },
  { name: 'Corchea y silencio', notes: [0], beams: 0 },
];
// Figure definitions and difficulty pools adapted from seryio2004/grooveTrain/js/{figures,app}.js.
export function makePattern(level = 1, length = 16, random = Math.random) {
  const pool =
    level <= 1
      ? [0, 5]
      : level <= 2
        ? [0, 5, 6, 7]
        : level <= 4
          ? [0, 1, 2, 5, 6, 7, 8, 9]
          : level <= 6
            ? [0, 1, 2, 3, 5, 6, 7, 8, 9]
            : figurePool.map((_, i) => i);
  return Array.from({ length }, () => pool[Math.floor(random() * pool.length)]!);
}
export function expectedHits(pattern: number[], bpm: number) {
  return pattern.flatMap((id, block) =>
    figurePool[id]!.notes.map((offset) => ({ t: ((block + offset) * 60) / bpm, block })),
  );
}

export function buildQuestion(module: 'notes' | 'intervals' | 'reading', random = Math.random) {
  const root = naturals[Math.floor(random() * (module === 'intervals' ? 4 : naturals.length))]!;
  if (module === 'intervals') {
    const interval = intervals[Math.floor(random() * intervals.length)]!;
    return {
      notes: [root, root + interval.semitones],
      answer: interval.name,
      choices: intervals.map((i) => i.name),
    };
  }
  const notes =
    module === 'reading'
      ? Array.from({ length: 4 }, () => naturals[Math.floor(random() * naturals.length)]!)
      : [root];
  return {
    notes,
    answer: noteName(notes[0]!),
    choices: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'],
  };
}
