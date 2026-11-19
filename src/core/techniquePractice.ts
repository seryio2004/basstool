import { techniques, type TechniqueId } from '../content/technique';
import { localDay, type PracticeSession } from './dailyPractice';

export function techniquePracticeSession(
  id: string,
  technique: TechniqueId,
  level: PracticeSession['level'],
  startedAt: Date,
  seconds: number,
  bpm: number,
  speed = false,
): PracticeSession {
  const prefix = `technique:${technique}${speed ? ':speed' : ''}`;
  const title = `${techniques[technique].title}${speed ? ' · Velocidad' : ''}`;
  return {
    id: `${prefix}:${id}`,
    day: localDay(startedAt),
    startedAt: startedAt.toISOString(),
    level,
    kind: 'routine',
    completed: true,
    blocks: Array.from({ length: Math.max(1, Math.ceil(seconds / 1800)) }, (_, i) => ({
      id: `${prefix}:${i + 1}`,
      title,
      seconds: Math.min(1800, seconds - i * 1800),
      ...(i === 0 ? { bpm } : {}),
    })),
  };
}
