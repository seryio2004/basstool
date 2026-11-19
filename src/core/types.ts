import type { LessonProgress } from './course';
export type Module = 'groove' | 'notes' | 'intervals' | 'reading';
export type Page = 'tools' | 'transcribe' | 'learn' | 'practice' | 'progress' | 'settings';
export type { Profile } from './profile';
export type ExerciseConfig = {
  bpm: number;
  level: number;
  pattern?: number[];
  modality?: import('./exercises').ExerciseModality;
  clef?: import('./notation').Clef;
  instrument?: import('./instrument').Instrument;
  nomenclature?: import('./notation').Nomenclature;
  register?: { min: number; max: number };
  reading?: 'notes' | 'rhythm';
};
export type Attempt = {
  id: string;
  userId: string;
  module: Module;
  correct: number;
  total: number;
  score: number;
  duration: number;
  createdAt: string;
  config: ExerciseConfig;
  detail: string;
};
/** Datos de estudio de una persona: sus intentos y su progreso en los cursos. */
export type Database = {
  attempts: Attempt[];
  lessonProgress: LessonProgress[];
};
export type AttemptInput = Omit<Attempt, 'id' | 'userId' | 'createdAt' | 'score'> & { id: string };
export const modules: {
  id: Module;
  title: string;
  subtitle: string;
  category: string;
  color: string;
  background: string;
  minutes: number;
}[] = [
  {
    id: 'groove',
    title: 'GrooveTrain',
    subtitle: 'Escucha, siente el pulso y reproduce el patrón.',
    category: 'Ritmo',
    color: '#305C47',
    background: '#E7EFE8',
    minutes: 4,
  },
  {
    id: 'notes',
    title: 'Reconocimiento de notas',
    subtitle: 'Conecta cada sonido con su nombre.',
    category: 'Oído y notas',
    color: '#745437',
    background: '#F3EBDF',
    minutes: 3,
  },
  {
    id: 'intervals',
    title: 'Intervalos',
    subtitle: 'Reconoce la distancia entre dos notas.',
    category: 'Entrenamiento auditivo',
    color: '#5B547E',
    background: '#EDEAF5',
    minutes: 4,
  },
  {
    id: 'reading',
    title: 'Lectura musical',
    subtitle: 'Lee las notas y encuentra su ritmo.',
    category: 'Lenguaje musical',
    color: '#375B76',
    background: '#E7EFF5',
    minutes: 5,
  },
];
export const initialConfig: ExerciseConfig = {
  bpm: 90,
  level: 1,
  modality: 'visual',
  reading: 'notes',
};
// Identifiers are not secrets; access is always enforced by the authenticated user.
export const uid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
export function scoreAttempt(correct: number, total: number) {
  if (
    !Number.isInteger(total) ||
    total <= 0 ||
    !Number.isInteger(correct) ||
    correct < 0 ||
    correct > total
  )
    throw new Error('Resultado de ejercicio inválido.');
  return Math.round((correct / total) * 100);
}
