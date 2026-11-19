import { tunings } from './instrument';
import type { Nomenclature } from './notation';

export type TuningId = keyof typeof tunings;
export type Level = 'beginner' | 'intermediate' | 'advanced';

/** Ajustes personales del bajista. No hay roles: cada perfil es una persona que estudia. */
export type Profile = {
  id: string;
  /** Correo de la cuenta; null cuando se usa la app sin cuenta. */
  email: string | null;
  tuning: TuningId;
  level: Level;
  nomenclature: Nomenclature;
  leftHanded: boolean;
  /** false hasta completar u omitir la configuración inicial. */
  configured: boolean;
};

export const levels: { value: Level; label: string }[] = [
  { value: 'beginner', label: 'Iniciación' },
  { value: 'intermediate', label: 'Intermedio' },
  { value: 'advanced', label: 'Avanzado' },
];

export const tuningIds = Object.keys(tunings) as TuningId[];

export function defaultProfile(id: string): Profile {
  return {
    id,
    email: null,
    tuning: 'standard4',
    level: 'beginner',
    nomenclature: 'latin',
    leftHanded: false,
    configured: false,
  };
}

/**
 * Normaliza un perfil leído del almacenamiento o del servidor. Los valores
 * desconocidos vuelven al valor por defecto en lugar de romper la app.
 */
export function parseProfile(value: unknown, fallbackId: string): Profile {
  const base = defaultProfile(fallbackId);
  if (!value || typeof value !== 'object') return base;
  const v = value as Record<string, unknown>;
  return {
    id: typeof v.id === 'string' && v.id ? v.id : base.id,
    email: typeof v.email === 'string' ? v.email : null,
    tuning: tuningIds.includes(v.tuning as TuningId) ? (v.tuning as TuningId) : base.tuning,
    level: levels.some((l) => l.value === v.level) ? (v.level as Level) : base.level,
    nomenclature: v.nomenclature === 'english' ? 'english' : 'latin',
    leftHanded: v.leftHanded === true,
    configured: v.configured === true,
  };
}
