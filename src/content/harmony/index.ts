import { fundamentals } from './fundamentals';
import { tonality } from './tonality';
import { development } from './development';
import { minor } from './minor';
import { HARMONY_COURSE_ID } from '../../core/course';

export const harmonyLessons = [...fundamentals, ...tonality, ...development, ...minor];
export const harmonyCourse = {
  id: HARMONY_COURSE_ID,
  title: 'Armonía I',
  description:
    'Teoría musical y armonía moderna: lectura, ritmo, acordes, funciones, cadencias y modos.',
  source: 'Enric Herrera · Teoría musical y armonía moderna, volumen I',
  editionNote:
    'Adaptación didáctica con explicaciones, ejemplos y ejercicios originales. No es una edición oficial ni una revisión acreditada por el autor.',
  sourceFile: 'Enric Herrera - Teoria Musical y Armonía Moderna Vol 1_text.pdf',
  groups: [
    'Lectura y ritmo',
    'Bases de la armonía',
    'Desarrollo armónico',
    'Armonía menor e intercambio',
  ],
  lessons: harmonyLessons,
};
