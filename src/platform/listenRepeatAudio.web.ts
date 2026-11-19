import { frequency } from '../core/music';
import { rhythmAudioContext } from './audio.web';
import { createBassInstrument } from './bassInstrument.web';
import { createDrumVoices, createVoices } from './drumMachine.web';
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
  const drums = createDrumVoices(context, mix);
  const chords = createVoices(context, mix);

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
      for (const { drum, start: at, accent } of cycle.drums) drums.hit(drum, start + at, accent);
      for (const chord of cycle.chords) {
        const oscillator = context.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.value = frequency(chord.midi);
        chords.play(oscillator, start + chord.start, start + chord.end, 0.046, 0.025);
      }
    },
    stop() {
      mix.disconnect();
      bass.disconnect();
      bassBus.disconnect();
      stopBass.forEach((stop) => stop());
      drums.stop();
      chords.stop();
    },
  };
}
