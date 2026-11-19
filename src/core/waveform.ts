import { MIN_LOOP } from './transcription';

/** Envolvente simétrica de una ventana [from, to) en segundos: un valor 0–1 por columna. */
export function envelope(
  peaks: readonly number[],
  duration: number,
  from: number,
  to: number,
  columns: number,
) {
  const out = new Array<number>(columns).fill(0);
  if (!peaks.length || duration <= 0 || to <= from) return out;
  const perSecond = peaks.length / duration;
  for (let c = 0; c < columns; c++) {
    const a = from + ((to - from) * c) / columns;
    const b = from + ((to - from) * (c + 1)) / columns;
    if (b <= 0 || a >= duration) continue;
    // Corrige el redondeo en los límites exactos de los cubos [inicio, fin).
    const i0 = Math.max(0, Math.floor(a * perSecond + 1e-9));
    const i1 = Math.min(peaks.length, Math.ceil(b * perSecond - 1e-9));
    let max = 0;
    for (let i = i0; i < i1; i++) if (peaks[i]! > max) max = peaks[i]!;
    // Curva suave para que los pasajes flojos se lean sin saturar los fuertes.
    out[c] = Math.pow(max, 0.8);
  }
  return out;
}

/** Un único trazo relleno (arriba y abajo en espejo): mucho más ligero que miles de rectángulos. */
export function wavePath(levels: readonly number[], height: number, columnWidth: number) {
  if (!levels.length) return '';
  const mid = height / 2;
  const amp = mid - 4;
  const top = [`M0 ${mid}`];
  const bottom: string[] = [];
  levels.forEach((level, i) => {
    const x = (i + 0.5) * columnWidth;
    const h = Math.max(0.6, level * amp);
    top.push(`L${x.toFixed(1)} ${(mid - h).toFixed(1)}`);
    bottom.push(`L${x.toFixed(1)} ${(mid + h).toFixed(1)}`);
  });
  top.push(`L${(levels.length * columnWidth).toFixed(1)} ${mid}`);
  return [...top, ...bottom.reverse(), 'Z'].join(' ');
}

export function loopFromTimes(t0: number, t1: number) {
  const a = Math.min(t0, t1);
  const b = Math.max(t0, t1);
  return b - a >= MIN_LOOP - 1e-9 ? { a, b } : null;
}
