import {
  drumBar,
  drumPiece,
  drumPieces,
  grooveVariation,
  pulsesPerBar,
  type Drum,
  type DrumLevels,
  type Groove,
} from '../core/drums';
import { rhythmAudioContext, scheduleClick } from './audio.web';
import type { GrooveOptions, RhythmOptions, RhythmPosition } from './drumMachine';

export function createVoices(context: AudioContext, output: AudioNode) {
  const sources = new Set<AudioScheduledSourceNode>();
  function track(source: AudioScheduledSourceNode) {
    sources.add(source);
    source.addEventListener('ended', () => sources.delete(source), { once: true });
  }

  function play(
    source: AudioScheduledSourceNode,
    when: number,
    end: number,
    peak: number,
    attack: number,
    filter?: BiquadFilterNode,
    destination = output,
  ) {
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.linearRampToValueAtTime(peak, when + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(filter ?? envelope);
    filter?.connect(envelope);
    envelope.connect(destination);
    track(source);
    source.onended = () => {
      source.disconnect();
      filter?.disconnect();
      envelope.disconnect();
    };
    source.start(when);
    source.stop(end);
  }

  return {
    play,
    track,
    stop() {
      for (const source of sources) source.stop();
      sources.clear();
    },
  };
}

export function createDrumVoices(context: AudioContext, mix: AudioNode) {
  const { play, stop } = createVoices(context, mix);
  const buses = {
    kick: context.createGain(),
    snare: context.createGain(),
    cymbal: context.createGain(),
  };
  for (const bus of Object.values(buses)) bus.connect(mix);
  const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.15), context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

  return {
    hit(kind: Drum, when: number, accented: boolean, velocity = 1) {
      const output = buses[drumPiece(kind)];
      if (kind === 'kick') {
        const oscillator = context.createOscillator();
        oscillator.frequency.setValueAtTime(140, when);
        oscillator.frequency.exponentialRampToValueAtTime(48, when + 0.09);
        play(oscillator, when, when + 0.14, 0.21 * velocity, 0.003, undefined, output);
        return;
      }
      const snare = kind === 'snare';
      const ride = kind === 'ride';
      const source = context.createBufferSource();
      source.buffer = noise;
      const filter = context.createBiquadFilter();
      filter.type = snare || ride ? 'bandpass' : 'highpass';
      filter.frequency.value = snare ? 1700 : ride ? 5200 : 6800;
      filter.Q.value = ride ? 1.5 : 0.7;
      play(
        source,
        when,
        when + (snare ? 0.12 : ride ? 0.15 : 0.045),
        (snare ? 0.14 : accented ? 0.068 : 0.039) * velocity,
        0.002,
        filter,
        output,
      );
      if (snare || ride) {
        const body = context.createOscillator();
        if (ride) body.type = 'triangle';
        body.frequency.setValueAtTime(snare ? 190 : 3789, when);
        if (snare) body.frequency.exponentialRampToValueAtTime(125, when + 0.05);
        play(
          body,
          when,
          when + (snare ? 0.067 : 0.14),
          (snare ? 0.055 : 0.018) * velocity,
          0.002,
          undefined,
          output,
        );
      }
    },
    setLevels(levels: DrumLevels) {
      for (const piece of drumPieces)
        buses[piece].gain.setTargetAtTime(levels[piece], context.currentTime, 0.008);
    },
    stop() {
      for (const bus of Object.values(buses)) bus.disconnect();
      stop();
    },
  };
}

type ScheduledStep<Position> = {
  pulse: number;
  schedule: (when: number) => void;
  position: Position;
};
type Bar<Position> = { bpm: number; pulses: number; steps: ScheduledStep<Position>[] };

/** Like the original metronome, use JS to look ahead and Web Audio to place attacks. */
function transport<Position extends RhythmPosition>(
  context: AudioContext,
  makeBar: (bar: number) => Bar<Position>,
  options: RhythmOptions<Position>,
  dispose: () => void,
) {
  let number = 0;
  let index = 0;
  let start = context.currentTime + 0.1;
  let bar: Bar<Position> | undefined;
  const positions: { when: number; position: Position }[] = [];
  let stopped = false;
  function flush() {
    const now = context.currentTime;
    while (!stopped && positions[0] && positions[0].when <= now)
      options.onStep?.(positions.shift()!.position);
  }
  function schedule() {
    flush();
    while (!stopped) {
      const now = context.currentTime;
      if (!bar && start >= now + 0.12) return;
      bar ??= makeBar(number);
      const step = bar.steps[index]!;
      const secondsPerPulse = 60 / bar.bpm;
      let when = start + step.pulse * secondsPerPulse;
      // After a stalled timer, resume from this step instead of playing a burst of late hits.
      if (when < now) {
        start += now + 0.02 - when;
        when = now + 0.02;
      }
      if (when >= now + 0.12) return;
      step.schedule(when);
      if (options.onStep) positions.push({ when, position: step.position });
      index++;
      if (index === bar.steps.length) {
        start += bar.pulses * secondsPerPulse;
        bar = undefined;
        number++;
        index = 0;
      }
    }
  }
  const timer = setInterval(() => {
    try {
      schedule();
    } catch (failure) {
      stop();
      options.onError?.(failure instanceof Error ? failure : new Error(String(failure)));
    }
  }, 25);
  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    positions.length = 0;
    dispose();
  }
  return () => {
    try {
      flush();
    } finally {
      stop();
    }
  };
}

function checkTempo(bpm: number, min: number) {
  if (!Number.isFinite(bpm) || bpm < min || bpm > 240)
    throw new Error(`El tempo debe estar entre ${min} y 240 BPM.`);
}

export async function startGroove(initial: Groove, options: GrooveOptions = {}) {
  checkTempo(initial.bpm, 40);
  drumBar(initial);
  const context = await rhythmAudioContext();
  const mix = context.createGain();
  mix.connect(context.destination);
  const drums = createDrumVoices(context, mix);
  if (initial.levels) drums.setLevels(initial.levels);
  const stopTransport = transport(
    context,
    (bar) => {
      const groove = options.getGroove?.() ?? initial;
      const bpm = options.bpmForBar?.(bar) ?? groove.bpm;
      checkTempo(bpm, 40);
      const variation = grooveVariation(groove, bar);
      const pattern = drumBar({ ...groove, variation });
      return {
        bpm,
        pulses: pulsesPerBar(groove.meter),
        steps: pattern.map(({ pulse, hits }, step) => ({
          pulse,
          position: { bar, step, bpm, pattern, variation },
          schedule: (when) =>
            hits.forEach(({ drum, accent, velocity }) => drums.hit(drum, when, accent, velocity)),
        })),
      };
    },
    options,
    () => {
      mix.disconnect();
      drums.stop();
    },
  );
  return { setLevels: drums.setLevels, stop: stopTransport };
}

export async function startMetronome(bpm: number, pulses: number, options: RhythmOptions = {}) {
  checkTempo(bpm, 30);
  if (!Number.isInteger(pulses) || pulses < 1) throw new Error('Compás no válido.');
  const context = await rhythmAudioContext();
  const mix = context.createGain();
  mix.connect(context.destination);
  const voices = createVoices(context, mix);
  const stopTransport = transport(
    context,
    (bar) => {
      const tempo = options.bpmForBar?.(bar) ?? bpm;
      checkTempo(tempo, 30);
      return {
        bpm: tempo,
        pulses,
        steps: Array.from({ length: pulses }, (_, step) => ({
          pulse: step,
          position: { bar, step, bpm: tempo },
          schedule: (when) => voices.track(scheduleClick(context, mix, when, step === 0)),
        })),
      };
    },
    options,
    () => {
      mix.disconnect();
      voices.stop();
    },
  );
  return { stop: stopTransport };
}
