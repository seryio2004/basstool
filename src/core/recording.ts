export const MAX_COMPENSATION_MS = 200;

export function clampCompensation(ms: number) {
  return Number.isFinite(ms)
    ? Math.round(Math.max(-MAX_COMPENSATION_MS, Math.min(MAX_COMPENSATION_MS, ms)))
    : 0;
}

/** A positive measured delay advances the take against the base. */
export function takeAlignment(ms: number) {
  const seconds = clampCompensation(ms) / 1000;
  return { skip: Math.max(0, seconds), delay: Math.max(0, -seconds) };
}

/** Detect a repeatable onset in the recording of several spaced metronome clicks. */
export function estimateLatency(
  samples: Float32Array,
  sampleRate: number,
  clicks: readonly number[],
): number | null {
  if (!Number.isFinite(sampleRate) || sampleRate < 1000 || clicks.length < 3) return null;
  const bin = Math.round(sampleRate * 0.002);
  const count = Math.ceil((sampleRate * (MAX_COMPENSATION_MS + 40)) / (1000 * bin));
  const windows = clicks.map((seconds) => {
    const start = Math.round(seconds * sampleRate);
    if (!Number.isFinite(start) || start < bin * 12 || start + count * bin > samples.length)
      return null;
    const envelope: number[] = [];
    // First differences suppress DC and low-frequency room noise.
    for (let offset = -12; offset < count; offset++) {
      let energy = 0;
      const frame = start + offset * bin;
      for (let i = frame; i < frame + bin; i++) {
        const difference = samples[i]! - (samples[i - 1] ?? 0);
        energy += difference * difference;
      }
      envelope.push(Math.sqrt(energy / bin));
    }
    const floor = envelope.slice(0, 12).sort((a, b) => a - b)[6]!;
    const peak = Math.max(...envelope.slice(12));
    if (peak < Math.max(0.0005, floor * 5)) return null;
    const threshold = Math.max(floor * 4, peak * 0.16, 0.0004);
    const onset = envelope.findIndex(
      (level, i) => i >= 12 && level >= threshold && envelope[i + 1]! >= threshold,
    );
    return onset < 12 ? null : ((onset - 12) * bin * 1000) / sampleRate;
  });
  const delays = windows.filter((ms): ms is number => ms !== null).sort((a, b) => a - b);
  const median = delays[Math.floor(delays.length / 2)];
  // The rising click envelope can cross the threshold one or two bins late.
  if (median === undefined || median > MAX_COMPENSATION_MS + 4) return null;
  const agreeing = delays.filter((ms) => Math.abs(ms - median) <= 8);
  return agreeing.length >= Math.max(3, Math.ceil(clicks.length * 0.75))
    ? clampCompensation(agreeing.reduce((sum, ms) => sum + ms, 0) / agreeing.length)
    : null;
}

export type PcmBlock = readonly Float32Array[];

/** RIFF/WAVE, signed 16-bit little-endian PCM with interleaved channels. */
export function encodeWav(blocks: readonly PcmBlock[], sampleRate: number): ArrayBuffer {
  const channels = blocks[0]?.length ?? 1;
  const bytesPerFrame = channels * 2;
  const frames = blocks.reduce((total, block) => {
    const length = block[0]?.length ?? 0;
    if (block.length !== channels || block.some((samples) => samples.length !== length))
      throw new RangeError('Los canales de la grabación no coinciden.');
    return total + length;
  }, 0);
  const bytes = frames * bytesPerFrame;
  if (
    !channels ||
    bytesPerFrame > 0xffff ||
    !Number.isInteger(sampleRate) ||
    sampleRate <= 0 ||
    sampleRate * bytesPerFrame > 0xffffffff ||
    bytes > 0xffffffff - 36
  )
    throw new RangeError('La grabación no cabe en un archivo WAV.');

  const buffer = new ArrayBuffer(44 + bytes);
  const view = new DataView(buffer);
  view.setUint32(0, 0x52494646); // RIFF
  view.setUint32(4, 36 + bytes, true);
  view.setUint32(8, 0x57415645); // WAVE
  view.setUint32(12, 0x666d7420); // fmt
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerFrame, true);
  view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461); // data
  view.setUint32(40, bytes, true);

  let offset = 44;
  for (const block of blocks) {
    for (let frame = 0; frame < block[0]!.length; frame++) {
      for (const channel of block) {
        const value = channel[frame]!;
        const sample = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
        view.setInt16(offset, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
        offset += 2;
      }
    }
  }
  return buffer;
}
