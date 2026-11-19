/**
 * Contrato del reproductor de transcripción (tarea 7). Lo implementan
 * player.web.ts (Web Audio) y player.ts (nativo, pendiente de la tarea 6) y lo
 * consume src/screens/Transcribe.tsx. El audio del usuario nunca sale del dispositivo.
 */

/** Archivo elegido y ya decodificado lo justo para dibujarlo. */
export type PickedAudio = {
  /** Identificador estable para recuperar la sesión: nombre, tamaño y duración. */
  id: string;
  name: string;
  size: number;
  /** Segundos. */
  duration: number;
  /** Envolvente para la forma de onda: valores 0–1, normalizados al pico máximo. */
  peaks: number[];
};

export type BassMode = 'off' | 'boost' | 'solo';
export type Loop = { a: number; b: number };

export interface Player {
  /** Abre el selector de archivos (MP3, M4A/AAC, WAV) y carga el elegido. null si se cancela. */
  pick(): Promise<PickedAudio | null>;
  play(): Promise<void>;
  pause(): void;
  /** Segundos, acotado a la duración. */
  seek(time: number): void;
  /** 0,25–1,5. Cambia la velocidad sin cambiar el tono. */
  setRate(rate: number): void;
  /** Con bucle, la reproducción vuelve a `a` al llegar a `b`. */
  setLoop(loop: Loop | null): void;
  setBass(mode: BassMode): void;
  /** false mientras no haya transporte de tono en esta plataforma. */
  readonly canTranspose: boolean;
  setTranspose(semitones: number): void;
  /** Se llama varias veces por segundo mientras suena y en cada cambio de estado. Devuelve la baja. */
  onTime(listener: (time: number, playing: boolean) => void): () => void;
  /** Libera el audio y la memoria del archivo. */
  unload(): void;
}
