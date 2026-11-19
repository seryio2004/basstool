import { SHOW_HARMONY_COURSE } from './flags.json';

export const learnTabs = (showCourse = SHOW_HARMONY_COURSE) => [
  ...(showCourse ? [{ value: 'course', label: 'Curso de armonía' } as const] : []),
  { value: 'notes', label: 'Apuntes' } as const,
];

export const showHarmonyProgress = (showCourse = SHOW_HARMONY_COURSE) =>
  learnTabs(showCourse).some(({ value }) => value === 'course');
