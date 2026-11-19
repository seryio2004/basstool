import { DEAD_NOTE_SECONDS } from '../core/scoreAudio';
import type { BassAttack } from './playerTypes';

type Note = {
  midi: number;
  when: number;
  until: number;
  dead?: boolean;
  attack: BassAttack;
};

type Voice = { stop: () => void };

/** A sampler can use the same score events, context times and mix bus. */
export interface Instrument {
  play(note: Note, onEnded: () => void): Voice;
  disconnect(): void;
}

function softClip() {
  const curve = new Float32Array(2049);
  for (let i = 0; i < curve.length; i++) {
    const x = (2 * i) / (curve.length - 1) - 1;
    curve[i] = Math.tanh(x * 1.25);
  }
  return curve;
}

function pluckNoise(context: BaseAudioContext) {
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * DEAD_NOTE_SECONDS),
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  return buffer;
}

export function createBassInstrument(context: BaseAudioContext, output: AudioNode): Instrument {
  const saturation = context.createWaveShaper();
  saturation.curve = softClip();
  saturation.oversample = '2x';
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -15;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.12;
  saturation.connect(compressor).connect(output);
  const noise = pluckNoise(context);

  return {
    disconnect() {
      saturation.disconnect();
      compressor.disconnect();
    },
    play(note, onEnded) {
      const { midi, when, dead, attack } = note;
      const until = dead ? Math.min(note.until, when + DEAD_NOTE_SECONDS) : note.until;
      const duration = until - when;
      const attackEnd = when + Math.min(attack === 'pick' || dead ? 0.003 : 0.009, duration * 0.22);
      const decayEnd = Math.min(attackEnd + 0.11, when + duration * 0.65);
      const releaseStart = Math.max(decayEnd, until - 0.045);
      const frequency = 440 * 2 ** ((midi - 69) / 12);
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.65;
      const cutoff = Math.max(350, frequency * 4);
      filter.frequency.setValueAtTime(dead ? 1200 : cutoff * (attack === 'pick' ? 5 : 3.2), when);
      filter.frequency.exponentialRampToValueAtTime(dead ? 250 : cutoff, decayEnd);
      const envelope = context.createGain();
      const peak = dead ? 0.75 : 0.72;
      const sustain = dead ? 0.035 : 0.48;
      envelope.gain.setValueAtTime(0, when);
      envelope.gain.linearRampToValueAtTime(peak, attackEnd);
      envelope.gain.exponentialRampToValueAtTime(sustain, decayEnd);
      envelope.gain.setValueAtTime(sustain, releaseStart);
      envelope.gain.exponentialRampToValueAtTime(0.001, until);
      const cutoffGain = context.createGain();
      filter.connect(envelope).connect(cutoffGain).connect(saturation);

      const sources: AudioScheduledSourceNode[] = [];
      const levels: GainNode[] = [];
      const addSource = (source: AudioScheduledSourceNode, level: number) => {
        const gain = context.createGain();
        gain.gain.value = level;
        source.connect(gain).connect(filter);
        sources.push(source);
        levels.push(gain);
        return gain;
      };
      if (!dead) {
        const body = context.createOscillator();
        body.type = 'sawtooth';
        body.frequency.value = frequency;
        addSource(body, 0.72);
        const octave = context.createOscillator();
        octave.type = 'triangle';
        octave.frequency.value = frequency * 2;
        addSource(octave, 0.18);
      }
      if (dead || attack !== 'none') {
        const transient = context.createBufferSource();
        transient.buffer = noise;
        const transientLevel = addSource(transient, dead ? 1 : attack === 'pick' ? 0.32 : 0.16);
        transientLevel.gain.setValueAtTime(transientLevel.gain.value, when);
        transientLevel.gain.exponentialRampToValueAtTime(
          dead ? 0.12 : 0.001,
          Math.min(until, when + (dead ? 0.05 : 0.028)),
        );
      }

      let remaining = sources.length;
      for (const source of sources) {
        source.onended = () => {
          source.disconnect();
          if (--remaining > 0) return;
          for (const level of levels) level.disconnect();
          filter.disconnect();
          envelope.disconnect();
          cutoffGain.disconnect();
          onEnded();
        };
        source.start(when);
        source.stop(until);
      }
      return {
        stop() {
          const now = context.currentTime;
          // Cancel queued attacks immediately and give sounding notes a short fade.
          const stopAt = now < when ? now : Math.min(until, now + 0.009);
          if (stopAt <= now) {
            for (const source of sources) source.stop(now);
            return;
          }
          cutoffGain.gain.setValueAtTime(1, now);
          cutoffGain.gain.linearRampToValueAtTime(0, stopAt);
          for (const source of sources) source.stop(stopAt);
        },
      };
    },
  };
}

/** RMS of audible 50 ms windows, so intros and silence don't shrink the bass. */
export function activeRms(samples: Float32Array, sampleRate: number) {
  const block = Math.round(sampleRate * 0.05);
  let power = 0;
  let count = 0;
  for (let offset = 0; offset < samples.length; offset += block) {
    const end = Math.min(samples.length, offset + block);
    let sum = 0;
    for (let i = offset; i < end; i++) sum += samples[i]! ** 2;
    if (sum / (end - offset) < 0.0001) continue;
    power += sum;
    count += end - offset;
  }
  return count ? Math.sqrt(power / count) : 0;
}
