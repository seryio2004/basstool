import {
  defaultPracticeSettings,
  parseFavoriteSongs,
  parsePracticeSettings,
  type PracticeSettings,
} from './dailyPractice';
import type { Profile } from './profile';
import type { StudyFocus } from '../content/dailyPractice';

/** Pasos de la primera experiencia, en orden. */
export const onboardingSteps = ['welcome', 'bass', 'level', 'goals', 'songs'] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];
/** Objetivos que se pueden marcar en la configuración inicial. */
export const onboardingGoalLimit = 3;

export type OnboardingDraft = {
  profile: Pick<Profile, 'tuning' | 'scale' | 'level' | 'nomenclature' | 'leftHanded'>;
  practice: Pick<PracticeSettings, 'minutes' | 'goals' | 'days' | 'restDay'>;
  /** Uno por campo, con los vacíos incluidos mientras se escribe. */
  songs: string[];
};

export function onboardingDraft(profile: Profile, settings: PracticeSettings): OnboardingDraft {
  const { tuning, scale, level, nomenclature, leftHanded } = profile;
  const { minutes, goals, days, restDay } = settings;
  return {
    profile: { tuning, scale, level, nomenclature, leftHanded },
    practice: { minutes, goals: goals.slice(0, onboardingGoalLimit), days, restDay },
    songs: settings.favoriteSongs,
  };
}

/** Marca o desmarca un objetivo sin pasar del límite. */
export function toggleGoal(goals: readonly StudyFocus[], goal: StudyFocus) {
  if (goals.includes(goal)) return goals.filter((g) => g !== goal);
  return goals.length >= onboardingGoalLimit ? [...goals] : [...goals, goal];
}

/**
 * Perfil y práctica que se guardan al terminar o al pulsar «Saltar». Los
 * minutos semanales se deducen del tiempo diario y de los días elegidos.
 */
export function onboardingResult(draft: OnboardingDraft) {
  const days = draft.practice.days.length;
  const practice = parsePracticeSettings({
    ...defaultPracticeSettings,
    ...draft.practice,
    goals: draft.practice.goals.slice(0, onboardingGoalLimit),
    weeklyMinutes: Math.min(600, Math.max(5, draft.practice.minutes * (days || 1))),
    favoriteSongs: parseFavoriteSongs(draft.songs),
  });
  return { profile: { ...draft.profile, configured: true as const }, practice };
}
