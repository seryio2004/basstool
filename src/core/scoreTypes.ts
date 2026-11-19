/**
 * Contrato de la tarea 10: anotación en tablatura y partitura sincronizada con
 * el audio. Lo implementa Sol 6.1 (score.ts, timeMap.ts, scoreLayout.ts,
 * ScoreView) y lo consume el editor de Claude (Transcribe.tsx).
 *
 * Sincronización al estilo de los reproductores de transcripción (referencia
 * funcional: Transcribe!): el usuario coloca marcas de compás y, si quiere, de
 * pulso, tocando teclas mientras suena la canción. Cada compás de la partitura
 * corresponde al tramo de audio entre dos marcas de compás, aunque el tempo varíe.
 */

/** Fracción exacta de redonda: 1/4 = negra. Siempre reducida y con d > 0. */
export type Fraction = { n: number; d: number };

/** Denominador de la figura. Las fusas y semifusas se generan al dividir figuras. */
export type BaseValue = 1 | 2 | 4 | 8 | 16 | 32 | 64;

export type Duration = {
  base: BaseValue;
  dots: 0 | 1;
  /** Tresillo: tres figuras en el tiempo de dos. */
  triplet?: boolean;
};

export type Technique = 'hammer' | 'pull' | 'slide' | 'dead' | 'staccato';

/** Un evento de la línea de bajo: nota (cuerda y traste) o silencio. Una sola voz. */
export type ScoreEvent = {
  id: string;
  duration: Duration;
  /** Ausente = silencio. La altura sonora es instrument.strings[string] + fret. */
  note?: { string: number; fret: number };
  /** Ligada a la siguiente nota (misma altura). */
  tie?: boolean;
  /** Técnica hacia la nota siguiente (ligados, slide) o sobre esta (muerta, staccato). */
  technique?: Technique;
};

export type Meter = { beats: number; unit: 2 | 4 | 8 };

export type Measure = {
  id: string;
  /** Métrica de este compás; si falta, la del compás anterior o la de la partitura. */
  meter?: Meter;
  events: ScoreEvent[];
};

export type Score = {
  version: 1;
  meter: Meter;
  /** Armadura en quintas: −7 (7 bemoles) … 7 (7 sostenidos). */
  keyFifths: number;
  measures: Measure[];
};

/** Estado de un compás frente a su métrica. */
export type MeasureFill = {
  expected: Fraction;
  actual: Fraction;
  status: 'empty' | 'short' | 'full' | 'over';
};

/**
 * Marcas sobre el audio, en segundos y ordenadas. Las secciones con nombre son
 * las marcas que ya existen en la sesión de transcripción (`Session.markers`).
 */
export type TimeMap = {
  /** Inicio de cada compás. El compás i de la partitura empieza en measures[i]. */
  measures: number[];
  /** Pulsos marcados a mano (opcional). Sin ellos, los pulsos se reparten por igual dentro del compás. */
  beats: number[];
};

/** Posición musical: compás (índice desde 0) y pulso dentro del compás (desde 0, con decimales). */
export type MusicalPosition = { measure: number; beat: number };

/** Cursor de edición: compás, evento y cuerda sobre la que se escribe. */
export type EditCursor = { measure: number; event: number; string: number };

export type ScoreDisplay = 'both' | 'tab' | 'staff';
