import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '../core/transcription';

const KEY = 'clasro.transcriptions.v1';
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
function valid(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const s = value as Session;
  if (
    !text(s.id) ||
    !text(s.name) ||
    !number(s.duration) ||
    s.duration < 0 ||
    !number(s.position) ||
    s.position < 0 ||
    s.position > s.duration ||
    !number(s.rate) ||
    s.rate < 0.25 ||
    s.rate > 1.5 ||
    !number(s.transpose) ||
    !Number.isInteger(s.transpose) ||
    Math.abs(s.transpose) > 12 ||
    !['off', 'boost', 'solo'].includes(s.bass) ||
    !text(s.updatedAt) ||
    !Number.isFinite(Date.parse(s.updatedAt)) ||
    !Array.isArray(s.markers)
  )
    return false;
  if (
    s.loop !== null &&
    (!s.loop ||
      !number(s.loop.a) ||
      !number(s.loop.b) ||
      s.loop.a < 0 ||
      s.loop.b > s.duration ||
      s.loop.b - s.loop.a < 0.2 - 1e-9)
  )
    return false;
  const ids = new Set<string>();
  return s.markers.every((m) => {
    if (
      !m ||
      !text(m.id) ||
      ids.has(m.id) ||
      !text(m.name) ||
      m.name.length > 40 ||
      !number(m.time) ||
      m.time < 0 ||
      m.time > s.duration
    )
      return false;
    ids.add(m.id);
    return true;
  });
}
// Explicit projection prevents accidental persistence of File, blob URL or PCM properties.
function metadata(s: Session): Session {
  return {
    id: s.id,
    name: s.name,
    duration: s.duration,
    position: s.position,
    rate: s.rate,
    transpose: s.transpose,
    bass: s.bass,
    loop: s.loop ? { a: s.loop.a, b: s.loop.b } : null,
    markers: s.markers
      .map((m) => ({ id: m.id, time: m.time, name: m.name }))
      .sort((a, b) => a.time - b.time),
    updatedAt: s.updatedAt,
  };
}
async function read(): Promise<Session[]> {
  try {
    const data: unknown = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
    if (!Array.isArray(data)) return [];
    const unique = new Map<string, Session>();
    for (const s of data
      .filter(valid)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))) {
      if (!unique.has(s.id)) unique.set(s.id, metadata(s));
    }
    return [...unique.values()].slice(0, 50);
  } catch {
    return [];
  }
}
let writes: Promise<void> = Promise.resolve();
export async function listSessions(): Promise<Session[]> {
  await writes;
  return read();
}
export async function loadSession(id: string): Promise<Session | null> {
  return (await listSessions()).find((s) => s.id === id) ?? null;
}
export function saveSession(session: Session): Promise<void> {
  if (!valid(session)) return Promise.reject(new Error('La sesión de transcripción no es válida.'));
  const snapshot = metadata(session);
  const operation = writes.then(async () => {
    const sessions = (await read()).filter((s) => s.id !== snapshot.id);
    sessions.push(snapshot);
    sessions.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    await AsyncStorage.setItem(KEY, JSON.stringify(sessions.slice(0, 50)));
  });
  writes = operation.catch(() => {});
  return operation;
}
