import { frequency } from '../core/music';
import type { Drum } from '../core/listenRepeat';
import { rhythmAudioContext } from './audio.web';
import { createBassInstrument } from './bassInstrument.web';
import type { ListenRepeatAudio } from './listenRepeatAudio';

export async function openListenRepeatAudio(): Promise<ListenRepeatAudio> {
  const context = await rhythmAudioContext();
  const mix = context.createGain();
  mix.connect(context.destination);
  const bassBus = context.createGain();
  bassBus.gain.value = 0.34;
  bassBus.connect(mix);
  const bass = createBassInstrument(context, bassBus);
  const stopBass = new Set<() => void>();
  const sources = new Set<AudioScheduledSourceNode>();
  const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.15), context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

  function play(
    source: AudioScheduledSourceNode,
    when: number,
    end: number,
    peak: number,
    attack: number,
    filter?: BiquadFilterNode,
  ) {
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.linearRampToValueAtTime(peak, when + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(filter ?? envelope);
    filter?.connect(envelope);
    envelope.connect(mix);
    sources.add(source);
    source.onended = () => {
      sources.delete(source);
      source.disconnect();
      filter?.disconnect();
      envelope.disconnect();
    };
    source.start(when);
    source.stop(end);
  }

  function drumHit(kind: Drum, when: number, accented: boolean) {
    if (kind === 'kick') {
      const oscillator = context.createOscillator();
      oscillator.frequency.setValueAtTime(140, when);
      oscillator.frequency.exponentialRampToValueAtTime(48, when + 0.09);
      play(oscillator, when, when + 0.14, 0.21, 0.003);
      return;
    }
    const snare = kind === 'snare';
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = snare ? 'bandpass' : 'highpass';
    filter.frequency.value = snare ? 1700 : 6800;
    filter.Q.value = 0.7;
    play(
      source,
      when,
      when + (snare ? 0.12 : 0.045),
      snare ? 0.14 : accented ? 0.068 : 0.039,
      0.002,
      filter,
    );
    if (snare) {
      const body = context.createOscillator();
      body.frequency.setValueAtTime(190, when);
      body.frequency.exponentialRampToValueAtTime(125, when + 0.05);
      play(body, when, when + 0.067, 0.055, 0.002);
    }
  }

  return {
    now: () => context.currentTime,
    schedule(cycle, start) {
      for (const tone of cycle.bass) {
        const voice = bass.play(
          {
            midi: tone.midi,
            when: start + tone.start,
            until: start + tone.end,
            dead: tone.dead,
            attack: 'finger',
          },
          () => stopBass.delete(voice.stop),
        );
        stopBass.add(voice.stop);
      }
      for (const { drum, start: at, accent } of cycle.drums) drumHit(drum, start + at, accent);
      for (const chord of cycle.chords) {
        const oscillator = context.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.value = frequency(chord.midi);
        play(oscillator, start + chord.start, start + chord.end, 0.046, 0.025);
      }
    },
    stop() {
      mix.disconnect();
      bass.disconnect();
      bassBus.disconnect();
      stopBass.forEach((stop) => stop());
      sources.forEach((node) => node.stop());
    },
  };
}
