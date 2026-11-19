import { type listenCycle } from '../core/listenRepeat';
import { audio } from './audio';

export type ListenRepeatAudio = {
  now: () => number;
  schedule: (cycle: ReturnType<typeof listenCycle>, start: number) => void;
  stop: () => void;
};

export async function openListenRepeatAudio(): Promise<ListenRepeatAudio> {
  await audio.ready();
  return {
    now: audio.now,
    schedule(cycle, start) {
      for (const note of cycle.bass)
        audio.tone(note.dead ? 36 : note.midi, start + note.start, note.end - note.start, 0.18);
      for (const chord of cycle.chords)
        audio.tone(chord.midi, start + chord.start, chord.end - chord.start, 0.04);
      for (const { drum, start: at, accent } of cycle.drums)
        audio.tone(
          drum === 'kick' ? 32 : drum === 'snare' ? 69 : 93,
          start + at,
          0.06,
          accent ? 0.075 : 0.04,
        );
    },
    stop: audio.stop,
  };
}
