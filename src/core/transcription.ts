import type { BassMode, Loop } from '../platform/playerTypes';

export type Marker = { id: string; time: number; name: string };
export type Session = {
  id: string;
  name: string;
  duration: number;
  position: number;
  rate: number;
  volume: number;
  transpose: number;
  bass: BassMode;
  loop: Loop | null;
  markers: Marker[];
  updatedAt: string;
};
export const RATE_MIN = 0.25,
  RATE_MAX = 1.5,
  MIN_LOOP = 0.2;

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('El valor debe ser finito.');
  return value;
}
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, finite(value)));
}
function update(session: Session, changes: Partial<Session>): Session {
  return { ...session, ...changes, updatedAt: new Date().toISOString() };
}
export function newSession(audio: { id: string; name: string; duration: number }): Session {
  if (finite(audio.duration) < 0) throw new RangeError('La duración no puede ser negativa.');
  return {
    id: audio.id,
    name: audio.name,
    duration: audio.duration,
    position: 0,
    rate: 1,
    volume: 1,
    transpose: 0,
    bass: 'off',
    loop: null,
    markers: [],
    updatedAt: new Date().toISOString(),
  };
}
export function clampTime(session: Session, time: number): number {
  return clamp(time, 0, Math.max(0, finite(session.duration)));
}
export function setRate(session: Session, rate: number): Session {
  return update(session, { rate: Math.round(clamp(rate, RATE_MIN, RATE_MAX) * 20) / 20 });
}
export function setVolume(session: Session, volume: number): Session {
  const next = clamp(volume, 0, 1);
  return next === session.volume ? session : update(session, { volume: next });
}
export function setTranspose(session: Session, semitones: number): Session {
  return update(session, { transpose: Math.round(clamp(semitones, -12, 12)) });
}
export function setLoopStart(session: Session, time: number): Session {
  const requested = clampTime(session, time);
  // A at the very end cannot form a useful loop: keep at least MIN_LOOP seconds.
  if (session.duration <= MIN_LOOP) return update(session, { loop: null });
  const a = Math.min(requested, session.duration - MIN_LOOP);
  const b =
    session.loop && session.loop.b > a + MIN_LOOP
      ? session.loop.b
      : Math.min(a + 4, session.duration);
  return update(session, { loop: { a, b } });
}
export function setLoopEnd(session: Session, time: number): Session {
  const b = clampTime(session, time);
  const a = session.loop?.a ?? 0;
  return update(session, b > a + MIN_LOOP ? { loop: { a, b } } : {});
}
export function nudgeLoop(session: Session, edge: 'a' | 'b', delta: number): Session {
  finite(delta);
  if (!session.loop) return update(session, {});
  const { a, b } = session.loop;
  const time = clampTime(session, (edge === 'a' ? a : b) + delta);
  // Moving an edge never moves the other edge or destroys the loop.
  if (edge === 'a') return update(session, { loop: { a: Math.min(time, b - MIN_LOOP), b } });
  return update(session, { loop: { a, b: Math.max(time, a + MIN_LOOP) } });
}
export function clearLoop(session: Session): Session {
  return update(session, { loop: null });
}
function markerName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 40)
    throw new RangeError('El nombre debe tener entre 1 y 40 caracteres.');
  return trimmed;
}
export function addMarker(session: Session, time: number, name?: string): Session {
  let n = 1;
  while (session.markers.some((m) => m.id === `marker-${n}` || m.name === `Marca ${n}`)) n++;
  const marker = {
    id: `marker-${n}`,
    time: clampTime(session, time),
    name: markerName(name ?? `Marca ${n}`),
  };
  return update(session, { markers: [...session.markers, marker].sort((a, b) => a.time - b.time) });
}
export function renameMarker(session: Session, id: string, name: string): Session {
  const valid = markerName(name);
  return update(session, {
    markers: session.markers.map((m) => (m.id === id ? { ...m, name: valid } : m)),
  });
}
export function removeMarker(session: Session, id: string): Session {
  return update(session, { markers: session.markers.filter((m) => m.id !== id) });
}
export function step(session: Session, delta: number): number {
  return clampTime(session, finite(session.position) + finite(delta));
}
export function formatTime(seconds: number): string {
  const tenths = Math.round(Math.max(0, finite(seconds)) * 10);
  return `${Math.floor(tenths / 600)}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`;
}
export function peaksFrom(samples: Float32Array, buckets: number): number[] {
  finite(buckets);
  if (!Number.isInteger(buckets) || buckets < 1)
    throw new RangeError('El número de cubos debe ser un entero positivo.');
  const peaks = Array<number>(buckets).fill(0);
  let max = 0;
  // When there are fewer samples than buckets, repeat the corresponding sample.
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor((b * samples.length) / buckets);
    const end = Math.min(
      samples.length,
      Math.max(start + 1, Math.floor(((b + 1) * samples.length) / buckets)),
    );
    let peak = 0;
    for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(finite(samples[i]!)));
    peaks[b] = peak;
    max = Math.max(max, peak);
  }
  return max ? peaks.map((p) => p / max) : peaks;
}
