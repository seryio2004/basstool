import type { Module } from './types';

export type TheorySection = { title: string; text: string };
export type TheoryQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
};
export type PracticalExercise = {
  id: string;
  title: string;
  steps: string[];
  criteria: string[];
  reference: string;
  module?: Module;
};
export type LessonExample = {
  title: string;
  explanation: string;
  notes?: number[][];
  labels?: string[];
  beats?: number[];
};
export type Lesson = {
  id: string;
  number: number;
  title: string;
  group: string;
  pages: [number, number];
  sections: TheorySection[];
  example: LessonExample;
  questions: TheoryQuestion[];
  practical: PracticalExercise[];
};
export type PracticalResponse = { text: string; checks: string[]; selfAssessed: boolean };
export type LessonProgress = {
  userId: string;
  courseId: string;
  lessonId: string;
  quizAnswers: Record<string, string>;
  quizSubmitted: boolean;
  practical: Record<string, PracticalResponse>;
  updatedAt: string;
};
export const HARMONY_COURSE_ID = 'harmony-1';
export const lessonId = (number: number) => `harmony-${String(number).padStart(2, '0')}`;
export function exampleTimeline(example: LessonExample, secondsPerBeat = 0.75) {
  let elapsed = 0;
  return (example.notes || []).map((notes, index) => {
    const duration = (example.beats?.[index] || 1) * secondsPerBeat;
    const event = { notes, at: elapsed, duration };
    elapsed += duration;
    return event;
  });
}
export function blankProgress(userId: string, id: string): LessonProgress {
  return {
    userId,
    courseId: HARMONY_COURSE_ID,
    lessonId: id,
    quizAnswers: {},
    quizSubmitted: false,
    practical: {},
    updatedAt: '',
  };
}
export function quizScore(lesson: Lesson, answers: Record<string, string>) {
  return lesson.questions.filter((q) => answers[q.id] === q.answer).length;
}
export function lessonCompleted(lesson: Lesson, progress?: LessonProgress) {
  return (
    !!progress?.quizSubmitted &&
    lesson.questions.every((q) => !!progress.quizAnswers[q.id]) &&
    lesson.practical.every((p) => {
      const response = progress.practical[p.id];
      return (
        !!response?.selfAssessed &&
        response.text.trim().length >= 20 &&
        p.criteria.every((_, index) => response.checks.includes(String(index)))
      );
    })
  );
}
export function validateLessonProgress(lesson: Lesson, progress: LessonProgress) {
  if (progress.courseId !== HARMONY_COURSE_ID || progress.lessonId !== lesson.id)
    throw new Error('El tema no pertenece a este curso.');
  for (const [id, answer] of Object.entries(progress.quizAnswers)) {
    const question = lesson.questions.find((q) => q.id === id);
    if (!question || !question.options.includes(answer))
      throw new Error('Una respuesta del cuestionario no es válida.');
  }
  if (progress.quizSubmitted && !lesson.questions.every((q) => progress.quizAnswers[q.id]))
    throw new Error('Responde todas las preguntas antes de corregir.');
  for (const [id, response] of Object.entries(progress.practical)) {
    const exercise = lesson.practical.find((p) => p.id === id);
    if (
      !exercise ||
      typeof response.text !== 'string' ||
      response.text.length > 10000 ||
      typeof response.selfAssessed !== 'boolean' ||
      !Array.isArray(response.checks) ||
      new Set(response.checks).size !== response.checks.length ||
      response.checks.some((c) => !exercise.criteria.map((_, i) => String(i)).includes(c))
    )
      throw new Error('La práctica contiene datos no válidos.');
    if (
      response.selfAssessed &&
      (response.text.trim().length < 20 ||
        !exercise.criteria.every((_, index) => response.checks.includes(String(index))))
    )
      throw new Error(
        'Escribe tu trabajo y revisa todos los criterios antes de registrar la autoevaluación.',
      );
  }
}
