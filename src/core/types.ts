import type { ListenRepeatPreset } from './listenRepeat';
import { palettes } from '../theme/palette';
import type { LessonProgress } from './course';
import { grooveColors } from '../theme/groove';
import { harmonicColors } from '../theme/harmonic';
export const CHORD_TRAIN_TITLE = 'ChordLine';
export type Module = 'chord-train' | 'groove' | 'notes' | 'intervals' | 'reading' | 'listen-repeat';
export type Page =
  'today' | 'tools' | 'transcribe' | 'learn' | 'practice' | 'progress' | 'settings';
export type { Profile } from './profile';
export type ExerciseConfig = {
  bpm: number;
  practiceSeed?: string;
  chordLine?: import('./chordLine').ChordLineSnapshot;
  level: number;
  pattern?: number[];
  chords?: string[];
  rhythmInput?: import('./chordTrain').RhythmInput;
  rhythmVersion?: 1;
  rhythmMode?: 'levels' | 'random';
  micSensitivity?: number;
  micOffsetMs?: number;
  modality?: import('./exercises').ExerciseModality;
  clef?: import('./notation').Clef;
  instrument?: import('./instrument').Instrument;
  nomenclature?: import('./notation').Nomenclature;
  register?: { min: number; max: number };
  reading?: 'notes' | 'rhythm';
  listenRepeat?: ListenRepeatPreset & { input?: 'mic' | 'manual' };
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
    color: grooveColors.ink,
    background: grooveColors.yellow,
    minutes: 4,
  },
  {
    id: 'chord-train',
    title: CHORD_TRAIN_TITLE,
    subtitle: 'Toca una línea de bajo sobre los acordes de cada pulso.',
    category: 'Ritmo y armonía',
    color: harmonicColors.ink,
    background: harmonicColors.stage,
    minutes: 4,
  },
  {
    id: 'listen-repeat',
    title: 'Escucha y repite',
    subtitle: 'Escucha una frase de bajo y tócala de oído sobre la batería.',
    category: 'Entrenamiento auditivo',
    color: palettes.dark.modules['listen-repeat'].ink,
    background: palettes.dark.modules['listen-repeat'].bg,
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
