import { drumBar, grooveVariation, pulsesPerBar, type Groove } from '../core/drums';
import { encodeWav, estimateLatency, takeAlignment, type PcmBlock } from '../core/recording';
import { scheduleClick } from './audio.web';
import { createDrumVoices, createVoices } from './drumMachine.web';
import { scheduleTranscription, type TranscriptionBacking } from './player.web';
import type { connectInput } from './recordingCapture.web';

export type Backing =
  | { kind: 'none' }
  | { kind: 'metronome'; bpm: number; pulses: number }
  | { kind: 'drums'; groove: Groove }
  | { kind: 'transcription'; source: TranscriptionBacking };

export type Take = {
  id: string;
  name: string;
  createdAt: number;
  duration: number;
  compensation: number;
  wav: Blob;
  backing: Backing;
};

export async function decodeLocalAudio(context: AudioContext, file: Blob) {
  return context.decodeAudioData(await file.arrayBuffer());
}

export function countIn(context: AudioContext, start: number, bpm: number, pulses: number) {
  const bus = context.createGain();
  bus.connect(context.destination);
  const voices = createVoices(context, bus);
  const seconds = 60 / bpm;
  for (let i = 0; i < pulses; i++) {
    voices.track(scheduleClick(context, bus, start + i * seconds, i === 0));
  }
  return () => {
    voices.stop();
    bus.disconnect();
  };
}

export function scheduleBacking(
  context: AudioContext,
  output: AudioNode,
  backing: Backing,
  start: number,
  decoded?: AudioBuffer,
) {
  if (backing.kind === 'none') return () => {};
  if (backing.kind === 'transcription')
    return scheduleTranscription(context, output, start, backing.source, decoded);

  const drums = backing.kind === 'drums' ? createDrumVoices(context, output) : null;
  const clicks = drums ? null : createVoices(context, output);
  const bpm = backing.kind === 'drums' ? backing.groove.bpm : backing.bpm;
  const pulses = backing.kind === 'drums' ? pulsesPerBar(backing.groove.meter) : backing.pulses;
  const seconds = 60 / bpm;
  const patternByVariation =
    backing.kind === 'drums'
      ? Object.fromEntries(
          (['A', 'B', 'fill'] as const).map((variation) => [
            variation,
            drumBar({ ...backing.groove, variation }),
          ]),
        )
      : null;
  let next = start;
  function schedule() {
    const now = context.currentTime;
    const until = now + 0.18;
    if (next >= until) return;
    const first = Math.max(next, now, start);
    if (backing.kind === 'drums') {
      const barSeconds = seconds * pulses;
      for (
        let bar = Math.floor((first - start) / barSeconds);
        start + bar * barSeconds < until;
        bar++
      ) {
        const barStart = start + bar * barSeconds;
        const pattern = patternByVariation![grooveVariation(backing.groove, bar)]!;
        for (const { pulse, hits } of pattern) {
          const at = barStart + pulse * seconds;
          if (at < first || at >= until) continue;
          for (const hit of hits) drums!.hit(hit.drum, at, hit.accent, hit.velocity);
        }
      }
    } else {
      const pulse = Math.max(0, Math.floor((first - start) / seconds));
      for (let i = pulse; start + i * seconds < until; i++) {
        const at = start + i * seconds;
        if (at >= first) clicks!.track(scheduleClick(context, output, at, i % pulses === 0));
      }
    }
    next = until;
  }
  schedule();
  const timer = setInterval(schedule, 30);
  return () => {
    clearInterval(timer);
    drums?.stop();
    clicks?.stop();
  };
}

export function metricalPulses(beats: number, unit: number) {
  return unit === 8 && beats >= 6 && beats % 3 === 0 ? beats / 3 : beats;
}

export function makeTake(
  blocks: PcmBlock[],
  rate: number,
  backing: Backing,
  compensation: number,
): Take | null {
  const frames = blocks.reduce((sum, block) => sum + (block[0]?.length ?? 0), 0);
  if (!frames) return null;
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    name: `Toma del ${now.toLocaleDateString('es-ES')} · ${now.toLocaleTimeString('es-ES')}`,
    createdAt: now.getTime(),
    duration: frames / rate,
    compensation,
    wav: new Blob([encodeWav(blocks, rate)], { type: 'audio/wav' }),
    backing,
  };
}

export function calibrate(context: AudioContext, input: Awaited<ReturnType<typeof connectInput>>) {
  const start = context.currentTime + 0.18;
  const firstClick = 0.25;
  const clicks = Array.from({ length: 4 }, (_, i) => firstClick + i * 0.5);
  const job = input.capture(start, start + clicks.at(-1)! + 0.3);
  const stopClicks = countIn(context, start + firstClick, 120, clicks.length);
  return {
    cancel() {
      job.cancel();
      stopClicks();
    },
    async result() {
      try {
        const blocks = await job.samples;
        const estimates = [];
        for (let c = 0; c < (blocks[0]?.length ?? 0); c++) {
          const samples = new Float32Array(
            blocks.reduce((sum, block) => sum + block[c]!.length, 0),
          );
          let offset = 0;
          for (const block of blocks) {
            const channel = block[c]!;
            samples.set(channel, offset);
            offset += channel.length;
          }
          const estimate = estimateLatency(samples, context.sampleRate, clicks);
          if (estimate !== null) estimates.push(estimate);
        }
        return estimates.length ? Math.min(...estimates) : null;
      } finally {
        stopClicks();
      }
    },
  };
}

export async function playTake(
  context: AudioContext,
  take: Take,
  withBacking: boolean,
  signal: AbortSignal,
  onEnded: () => void,
) {
  const backing = withBacking ? take.backing : { kind: 'none' as const };
  const [pcm, decoded] = await Promise.all([
    decodeLocalAudio(context, take.wav),
    backing.kind === 'transcription' && backing.source.song
      ? decodeLocalAudio(context, backing.source.song)
      : undefined,
    context.resume(),
  ]);
  if (signal.aborted) return;
  const { skip, delay } = takeAlignment(withBacking ? take.compensation : 0);
  const output = context.createGain();
  output.gain.value = withBacking ? 0.5 : 1;
  output.connect(context.destination);
  const start = context.currentTime + 0.15;
  const source = context.createBufferSource();
  source.buffer = pcm;
  source.connect(output);
  const stopBacking = scheduleBacking(context, output, backing, start, decoded);
  const stop = () => {
    source.onended = null;
    stopBacking();
    source.disconnect();
    output.disconnect();
  };
  const abort = () => {
    source.stop();
    stop();
  };
  signal.addEventListener('abort', abort, { once: true });
  source.onended = () => {
    signal.removeEventListener('abort', abort);
    stop();
    onEnded();
  };
  source.start(start + delay, Math.min(skip, Math.max(0, pcm.duration - 1 / pcm.sampleRate)));
}

export function downloadTake(take: Take) {
  const url = URL.createObjectURL(take.wav);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${take.name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Toma'}.wav`;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
