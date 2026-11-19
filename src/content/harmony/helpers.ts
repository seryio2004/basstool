import {
  Lesson,
  LessonExample,
  PracticalExercise,
  TheoryQuestion,
  TheorySection,
  lessonId,
} from '../../core/course';
import type { Module } from '../../core/types';
export const section = (title: string, text: string): TheorySection => ({ title, text });
export function question(
  prompt: string,
  answer: string,
  distractors: [string, string],
  explanation: string,
): Omit<TheoryQuestion, 'id'> {
  const options = [answer, ...distractors];
  const rotation = [...prompt].reduce((sum, c) => sum + c.charCodeAt(0), 0) % options.length;
  return {
    prompt,
    answer,
    explanation,
    options: [...options.slice(rotation), ...options.slice(0, rotation)],
  };
}
export const practice = (
  title: string,
  steps: string[],
  criteria: string[],
  reference: string,
  module?: Module,
): Omit<PracticalExercise, 'id'> => ({ title, steps, criteria, reference, module });
export function topic(
  number: number,
  title: string,
  pages: [number, number],
  sections: TheorySection[],
  example: LessonExample,
  questions: Omit<TheoryQuestion, 'id'>[],
  practical: Omit<PracticalExercise, 'id'>[],
): Lesson {
  return {
    id: lessonId(number),
    number,
    title,
    pages,
    group:
      number <= 7
        ? 'Lectura y ritmo'
        : number <= 18
          ? 'Bases de la armonía'
          : number <= 28
            ? 'Desarrollo armónico'
            : 'Armonía menor e intercambio',
    sections,
    example,
    questions: questions.map((q, i) => ({ ...q, id: `${lessonId(number)}-q${i + 1}` })),
    practical: practical.map((p, i) => ({ ...p, id: `${lessonId(number)}-p${i + 1}` })),
  };
}
