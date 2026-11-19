import { localDay, type PracticeSession } from './dailyPractice';

export type SpeedMode = 'auto' | 'manual';
export type SpeedSettings = {
  start: number;
  target: number;
  step: number;
  repetitions: number;
  mode: SpeedMode;
  lowerOnFailure: boolean;
};

export type SpeedProgress = {
  bpm: number;
  repetitions: number;
};

export function validSpeedSettings(settings: SpeedSettings) {
  const integer = (n: number, min: number, max: number) =>
    Number.isInteger(n) && n >= min && n <= max;
  return (
    integer(settings.start, 40, 240) &&
    integer(settings.target, settings.start, 240) &&
    integer(settings.step, 1, 200) &&
    integer(settings.repetitions, 1, 99)
  );
}

export const startSpeed = (settings: SpeedSettings): SpeedProgress => ({
  bpm: settings.start,
  repetitions: 0,
});

export function advanceSpeed(
  settings: SpeedSettings,
  progress: SpeedProgress,
  event: 'bar' | 'success' | 'failure',
): SpeedProgress {
  if (event === 'failure') {
    return {
      bpm: settings.lowerOnFailure
        ? Math.max(settings.start, progress.bpm - settings.step)
        : progress.bpm,
      repetitions: 0,
    };
  }
  if (
    (settings.mode === 'auto' ? event !== 'bar' : event !== 'success') ||
    progress.bpm >= settings.target
  )
    return progress;
  const repetitions = progress.repetitions + 1;
  return repetitions < settings.repetitions
    ? { ...progress, repetitions }
    : { bpm: Math.min(settings.target, progress.bpm + settings.step), repetitions: 0 };
}

/** Persist as a standalone session in the existing diary schema. */
export function speedPracticeSession(
  id: string,
  level: PracticeSession['level'],
  startedAt: Date,
  seconds: number,
  maxBpm: number,
): PracticeSession {
  // The diary parser accepts up to 30 minutes per result block.
  const blocks = Array.from({ length: Math.max(1, Math.ceil(seconds / 1800)) }, (_, i) => ({
    id: `speed-trainer-${i + 1}`,
    title: 'Velocidad',
    seconds: Math.min(1800, seconds - 1800 * i),
    ...(i === 0 ? { bpm: maxBpm } : {}),
  }));
  return {
    id: `speed-trainer:${id}`,
    day: localDay(startedAt),
    startedAt: startedAt.toISOString(),
    level,
    kind: 'routine',
    completed: true,
    blocks,
  };
}
