import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseScore } from '../core/score';
import { parseTimeMap } from '../core/timeMap';
import type { Score, ScoreDisplay, TimeMap } from '../core/scoreTypes';
export type ScoreDoc = {
  score: Score;
  timeMap: TimeMap;
  display: ScoreDisplay;
  updatedAt: string;
  /** BPM elegido a mano (20–300). Ausente en partituras antiguas. */
  bpm?: number;
};
const KEY = 'clasro.scores.v1';
function parse(value: unknown): ScoreDoc | null {
  if (!value || typeof value !== 'object') return null;
  const d = value as ScoreDoc,
    score = parseScore(d.score),
    timeMap = parseTimeMap(d.timeMap);
  return score &&
    timeMap &&
    ['both', 'tab', 'staff'].includes(d.display) &&
    typeof d.updatedAt === 'string' &&
    Number.isFinite(Date.parse(d.updatedAt))
    ? {
        score,
        timeMap,
        display: d.display,
        updatedAt: d.updatedAt,
        ...(typeof d.bpm === 'number' && d.bpm >= 20 && d.bpm <= 300 ? { bpm: d.bpm } : {}),
      }
    : null;
}
async function read(): Promise<Record<string, ScoreDoc>> {
  try {
    const value: unknown = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
    const result: Record<string, ScoreDoc> = Object.create(null);
    if (value && typeof value === 'object' && !Array.isArray(value))
      for (const [id, doc] of Object.entries(value)) {
        const valid = parse(doc);
        if (valid) result[id] = valid;
      }
    return result;
  } catch {
    return Object.create(null);
  }
}
let writes: Promise<void> = Promise.resolve();
export async function loadScoreDoc(sessionId: string): Promise<ScoreDoc | null> {
  await writes;
  return (await read())[sessionId] ?? null;
}
export function saveScoreDoc(sessionId: string, doc: ScoreDoc): Promise<void> {
  const snapshot = parse(doc);
  if (!sessionId.trim() || !snapshot) return Promise.reject(new Error('Partitura no válida.'));
  const operation = writes.then(async () => {
    const docs = await read();
    docs[sessionId] = snapshot;
    await AsyncStorage.setItem(KEY, JSON.stringify(docs));
  });
  writes = operation.catch(() => {});
  return operation;
}
