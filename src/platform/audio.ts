import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { tuning } from '../core/music';
import { TunerError } from './tunerErrors';
const pending = new Set<ReturnType<typeof setTimeout>>();
const players = new Set<ReturnType<typeof createAudioPlayer>>();
const samples = [
  { midi: 48, source: require('../../assets/audio/c3.wav') },
  { midi: 60, source: require('../../assets/audio/c4.wav') },
  { midi: 72, source: require('../../assets/audio/c5.wav') },
  { midi: 84, source: require('../../assets/audio/c6.wav') },
  { midi: 96, source: require('../../assets/audio/c7.wav') },
];
export const audio = {
  async ready() {
    await setAudioModeAsync({ playsInSilentMode: true });
  },
  now() {
    return performance.now() / 1000;
  },
  tone(midi: number, when: number, duration = 0.35, volume = 0.16) {
    const timer = setTimeout(
      () => {
        pending.delete(timer);
        const sample = samples.reduce((best, candidate) =>
          Math.abs(candidate.midi - midi) < Math.abs(best.midi - midi) ? candidate : best,
        );
        const player = createAudioPlayer(sample.source);
        players.add(player);
        player.volume = volume * 3;
        player.shouldCorrectPitch = false;
        player.setPlaybackRate(2 ** ((midi - sample.midi) / 12));
        player.play();
        const release = setTimeout(
          () => {
            pending.delete(release);
            player.remove();
            players.delete(player);
          },
          (duration + 0.1) * 1000,
        );
        pending.add(release);
      },
      Math.max(0, (when - audio.now()) * 1000),
    );
    pending.add(timer);
  },
  click(when: number, accent = false) {
    audio.tone(accent ? 84 : 79, when, 0.045, accent ? 0.14 : 0.08);
  },
  stop() {
    pending.forEach(clearTimeout);
    pending.clear();
    players.forEach((p) => p.remove());
    players.clear();
  },
};
export type TuningValue = ReturnType<typeof tuning>;
export async function startTuner(
  _onPitch: (value: TuningValue | null) => void,
  _onError?: (error: TunerError) => void,
): Promise<() => void> {
  throw new TunerError(
    'unsupported',
    'El afinador de esta fase está disponible en la web. El análisis de micrófono nativo se implementará en su adaptador específico.',
  );
}
