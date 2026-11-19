import type { Lesson } from '../../core/course';
import type { LessonDiagram } from '../../core/diagrams';
import { HARMONY_COURSE_ID } from '../../core/course';

/**
 * El contenido del curso de teoría no se publica en este repositorio: el temario
 * propio está pendiente (REQUISITOS §curso). Sustituir estas listas al añadirlo.
 */
export const harmonyLessons: Lesson[] = [];
export const lessonDiagrams: Record<number, LessonDiagram[]> = {};
export const harmonyCourse = {
  id: HARMONY_COURSE_ID,
  title: 'Teoría',
  description: 'Temario propio en preparación.',
  source: '',
  editionNote: '',
  groups: [] as string[],
  lessons: harmonyLessons,
};
