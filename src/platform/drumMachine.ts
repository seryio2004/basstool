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

export async function startMetronome(
  _bpm: number,
  _pulses: number,
  _options?: RhythmOptions,
): Promise<Transport> {
  throw new Error('Disponible en la versión web');
}
