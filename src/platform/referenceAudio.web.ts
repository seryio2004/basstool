import { rhythmAudioContext } from './audio.web';
import { createBassInstrument, createLimiter } from './bassInstrument.web';
import type { ReferenceNote, ReferenceOptions } from './referenceAudio';

export async function playReference(
  notes: readonly ReferenceNote[],
  { referenceHz, loopSeconds, onEnd }: ReferenceOptions,
): Promise<() => void> {
  const context = await rhythmAudioContext();
  const limiter = createLimiter(context);
  limiter.connect(context.destination);
  const instrument = createBassInstrument(context, limiter);
  const voices = new Set<ReturnType<typeof instrument.play>>();
  let next = context.currentTime + 0.02;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    for (const voice of voices) voice.stop();
    if (!voices.size) disconnect();
  }

  function disconnect() {
    instrument.disconnect();
    limiter.disconnect();
  }

  function schedule(when: number) {
    for (const { midi, at, seconds } of notes) {
      const voice = instrument.play(
        { midi, when: when + at, until: when + at + seconds, attack: 'finger', referenceHz },
        () => {
          voices.delete(voice);
          if (voices.size) return;
          if (stopped) disconnect();
          else if (!loopSeconds) {
            stop();
            onEnd();
          }
        },
      );
      voices.add(voice);
    }
  }

  schedule(next);
  if (loopSeconds) {
    next += loopSeconds;
    timer = setInterval(() => {
      const now = context.currentTime;
      if (next < now) next += Math.ceil((now - next) / loopSeconds) * loopSeconds;
      if (next > now + 0.12) return;
      schedule(next);
      next += loopSeconds;
    }, 50);
  }
  return stop;
}
