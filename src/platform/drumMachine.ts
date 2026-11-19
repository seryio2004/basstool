import { audio } from './audio';
import type { DrumLevels, DrumStep, DrumVariation, Groove } from '../core/drums';

export type RhythmPosition = { bar: number; step: number; bpm: number };
export type GroovePosition = RhythmPosition & { pattern: DrumStep[]; variation: DrumVariation };
export type RhythmOptions<Position = RhythmPosition> = {
  bpmForBar?: (bar: number) => number;
  onStep?: (position: Position) => void;
  onError?: (error: Error) => void;
};
export type GrooveOptions = RhythmOptions<GroovePosition> & { getGroove?: () => Groove };
export type Transport = { stop: () => void };
export type DrumTransport = Transport & { setLevels: (levels: DrumLevels) => void };

export async function startGroove(
  _groove: Groove,
  _options?: GrooveOptions,
): Promise<DrumTransport> {
  throw new Error('Disponible en la versión web');
}

/** Native click transport uses the bundled audio samples. */
export async function startMetronome(
  bpm: number,
  pulses: number,
  options: RhythmOptions = {},
): Promise<Transport> {
  if (!(bpm > 0) || !(pulses > 0)) throw new RangeError('Tempo o compás no válido.');
  await audio.ready();
  const pending = new Set<ReturnType<typeof setTimeout>>();
  let next = audio.now() + 0.08;
  let bar = 0;
  let step = 0;
  let tempo = bpm;

  function schedule() {
    const now = audio.now();
    if (next < now) next = now + 0.02;
    while (next < now + 0.12) {
      if (step === 0) tempo = options.bpmForBar?.(bar) ?? bpm;
      audio.click(next, step === 0);
      const position = { bar, step, bpm: tempo };
      const flash = setTimeout(
        () => {
          pending.delete(flash);
          options.onStep?.(position);
        },
        Math.max(0, (next - audio.now()) * 1000),
      );
      pending.add(flash);
      next += 60 / tempo;
      step++;
      if (step === pulses) {
        step = 0;
        bar++;
      }
    }
  }

  schedule();
  const timer = setInterval(schedule, 25);
  return {
    stop() {
      clearInterval(timer);
      pending.forEach(clearTimeout);
      pending.clear();
      audio.stop();
    },
  };
}
