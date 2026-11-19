import { chordLineLevels, chordLineWagons } from './chordLine';
import { listenGenres } from './listenRepeat';
import { makePattern } from './music';
import { availableTrainProgressions, progressionChords } from './trainProgressions';
import { studyPlans, warmups, type StudyExercise, type StudyFocus } from '../content/dailyPractice';
import type { Level } from './profile';
import type { Attempt, ExerciseConfig, Module } from './types';
import type { Session } from './transcription';
import type { Loop } from '../platform/playerTypes';

export const practiceMinutes = [5, 10, 20, 30] as const;
export const practiceGoals = [
  { value: 'technique', label: 'Técnica' },
  { value: 'groove', label: 'Groove' },
  { value: 'theory', label: 'Mástil y teoría' },
  { value: 'ear', label: 'Oído y lectura' },
  { value: 'song', label: 'Canciones' },
] as const;
export const weekDays = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
] as const;
export const streakMilestones = [3, 7, 14, 21];
export const practiceAccess = {
  challenge: 'free',
  streak: 'free',
  routine: 'free',
  plan: 'free',
  week: 'free',
  journal: 'free',
} as const satisfies Record<string, 'free' | 'premium'>;

export type PracticeSettings = {
  minutes: (typeof practiceMinutes)[number];
  goals: StudyFocus[];
  days: number[];
  weeklyMinutes: number;
  restDay: boolean;
};
export const defaultPracticeSettings: PracticeSettings = {
  minutes: 10,
  goals: [],
  days: [1, 3, 5],
  weeklyMinutes: 30,
  restDay: true,
};

export type ScalePreset = {
  tonic: 'C' | 'A' | 'G' | 'D' | 'E';
  scale: 'major' | 'minorPentatonic' | 'mixolydian' | 'dorian';
};
type BlockBase = { seconds: number; title: string; instruction?: string };
export type PracticeBlock = BlockBase &
  (
    | { kind: 'exercise'; module: Module; preset: ExerciseConfig }
    | { kind: 'scale'; preset: ScalePreset; bpm: number }
    | { kind: 'song' }
  );
export type PracticeKind = 'challenge' | 'routine' | 'plan';
export type PracticeResult = {
  id: string;
  title: string;
  seconds: number;
  module?: Module;
  correct?: number;
  total?: number;
  bpm?: number;
  rate?: number;
  skipped?: boolean;
};
export type PracticeSession = {
  id: string;
  level: Level;
  day: string;
  startedAt: string;
  kind: PracticeKind;
  completed: boolean;
  planDay?: number;
  blocks: PracticeResult[];
  note?: string;
};
export type PracticeData = {
  settings: PracticeSettings;
  sessions: PracticeSession[];
  attemptNotes: Record<string, string>;
};
export const emptyPractice = (): PracticeData => ({
  settings: defaultPracticeSettings,
  sessions: [],
  attemptNotes: {},
});

const levels: Level[] = ['beginner', 'intermediate', 'advanced'];
const modules: Module[] = [
  'groove',
  'chord-train',
  'notes',
  'intervals',
  'reading',
  'listen-repeat',
];
const moduleNames: Record<Module, string> = {
  groove: 'GrooveTrain',
  'chord-train': 'ChordLine',
  notes: 'Notas en el mástil',
  intervals: 'Intervalos',
  reading: 'Lectura',
  'listen-repeat': 'Escucha y repite',
};
export const attemptTitle = (module: Module) =>
  module === 'notes' ? 'Reconocimiento de notas' : moduleNames[module];

export function localDay(date = new Date()) {
  const part = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`;
}

function calendarDate(day: string) {
  return new Date(`${day}T12:00:00Z`);
}
export function shiftDay(day: string, delta: number) {
  const date = calendarDate(day);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}
export function weekStart(day: string) {
  return shiftDay(day, -((calendarDate(day).getUTCDay() + 6) % 7));
}
function validDay(day: unknown): day is string {
  return (
    typeof day === 'string' &&
    /^\d{4}-\d\d-\d\d$/.test(day) &&
    Number.isFinite(+calendarDate(day)) &&
    shiftDay(day, 0) === day
  );
}

export function seededPractice(seed: string) {
  let state = 2166136261;
  for (const c of seed) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]!;
}

const tempos: Record<Level, number> = { beginner: 64, intermediate: 88, advanced: 108 };

function makeBlock(
  type: StudyExercise,
  level: Level,
  seconds: number,
  seed: string,
  week = 0,
  bpm = tempos[level],
): PracticeBlock {
  const random = seededPractice(seed);
  const rank = levels.indexOf(level);
  if (type === 'song')
    return {
      kind: 'song',
      title: 'Tu canción',
      seconds,
      instruction:
        level === 'beginner'
          ? 'Elige un fragmento fácil y repítelo despacio.'
          : 'Repite un fragmento y sube el tempo poco a poco.',
    };
  if (type === 'warmup') {
    const preset = warmups[week % warmups.length]!;
    return {
      kind: 'scale',
      title: 'Calentamiento',
      seconds,
      preset,
      bpm,
      instruction: preset.instruction,
    };
  }
  if (type === 'scale') {
    const scale = pick(
      level === 'advanced'
        ? (['dorian', 'mixolydian'] as const)
        : (['major', 'minorPentatonic'] as const),
      random,
    );
    const tonic = pick(['C', 'A', 'G', 'D', 'E'] as const, random);
    return {
      kind: 'scale',
      title: 'Escalas en el mástil',
      seconds,
      preset: { tonic, scale },
      bpm,
      instruction: 'Toca la escala despacio y vuelve a la tónica siguiendo el pulso.',
    };
  }

  const preset: ExerciseConfig = { bpm, level: rank + 1, practiceSeed: seed };
  if (type === 'groove') {
    preset.level = [2, 5, 8][rank]!;
    preset.pattern = makePattern(preset.level, 16, random);
    preset.rhythmMode = 'levels';
  }
  if (type === 'chord-train') {
    const mode = pick(['major', 'minor'] as const, random);
    const recipe = pick(availableTrainProgressions(mode, chordLineLevels[level].harmony), random);
    const tonic = mode === 'major' ? pick(['C', 'F', 'G'], random) : pick(['A', 'D', 'E'], random);
    preset.chords = progressionChords(tonic, recipe).map(({ symbol }) => symbol);
    preset.chordLine = {
      difficulty: level,
      resolvedDifficulty: level,
      rhythm: 'varied',
      wagons: chordLineWagons(preset.chords.length, level, 'varied', random),
    };
  }
  if (type === 'notes') preset.modality = 'fretboard';
  if (type === 'intervals') preset.modality = 'ear';
  if (type === 'reading') {
    preset.modality = rank ? pick(['visual', 'tab'] as const, random) : 'visual';
    preset.reading = 'notes';
  }
  if (type === 'listen-repeat')
    preset.listenRepeat = {
      genre: pick(listenGenres, random).value,
      difficulty: level,
      chords: rank > 0,
      seed: Math.floor(random() * 0x100000000),
    };
  return { kind: 'exercise', title: moduleNames[type], seconds, module: type, preset };
}

export function dailyChallenge(day: string, level: Level): PracticeBlock[] {
  const seed = `${day}/${level}/challenge-v1`;
  const random = seededPractice(seed);
  const rhythm = level === 'beginner' ? 'groove' : pick(['groove', 'chord-train'] as const, random);
  const study = pick(['notes', 'intervals', 'reading', 'listen-repeat', 'scale'] as const, random);
  const seconds = pick([90, 120, 150], random);
  return [
    makeBlock(rhythm, level, seconds, `${seed}/0`),
    makeBlock(study, level, seconds, `${seed}/1`),
  ];
}

function routineType(focus: StudyFocus, level: Level, random: () => number): StudyExercise {
  switch (focus) {
    case 'technique':
      return 'warmup';
    case 'groove':
      return 'groove';
    case 'theory':
      return level === 'beginner' ? 'notes' : pick(['scale', 'chord-train'] as const, random);
    case 'ear':
      return pick(['intervals', 'reading', 'listen-repeat'] as const, random);
    case 'song':
      return 'song';
  }
}

export function practiceBpm(
  level: Level,
  result?: { bpm?: number; correct?: number; total?: number },
) {
  if (!result?.bpm || !result.total || result.correct === undefined) return tempos[level];
  const ratio = result.correct / result.total;
  const tempo = result.bpm + (ratio >= 0.85 ? 4 : ratio < 0.6 ? -6 : 0);
  return Math.max(tempos[level] - 16, Math.min(tempos[level] + 20, tempo));
}

export function guidedRoutine(
  day: string,
  level: Level,
  settings: PracticeSettings,
  history: Pick<PracticeResult, 'module' | 'correct' | 'total' | 'bpm'>[] = [],
): PracticeBlock[] {
  const seed = `${day}/${level}/routine-v1`;
  const random = seededPractice(seed);
  const base: StudyFocus[] =
    level === 'beginner' ? ['technique', 'theory'] : ['technique', 'groove', 'theory'];
  const goals = [
    ...new Set([
      ...base,
      ...practiceGoals.filter((g) => settings.goals.includes(g.value)).map((g) => g.value),
    ]),
  ].filter((goal) => goal !== 'song');
  const total = settings.minutes * 60;
  const songSeconds = Math.round(total * (settings.goals.includes('song') ? 0.4 : 0.3));
  const weights = goals.map((goal) => (settings.goals.includes(goal) ? 2 : 1));
  const available = total - songSeconds - goals.length * 30;
  const weight = weights.reduce((sum, n) => sum + n, 0);
  let allocated = 0;
  const week = Math.round((+calendarDate(weekStart(day)) - Date.UTC(1970, 0, 5, 12)) / 604800000);
  const blocks = goals.map((goal, i) => {
    const seconds =
      i === goals.length - 1
        ? total - songSeconds - allocated
        : 30 + Math.floor((available * weights[i]!) / weight);
    allocated += seconds;
    const type = routineType(goal, level, random);
    const previous = history.find((r) => r.module === type);
    return makeBlock(
      type,
      level,
      seconds,
      `${seed}/${goal}`,
      ((week % 3) + 3) % 3,
      practiceBpm(level, previous),
    );
  });
  return [...blocks, makeBlock('song', level, songSeconds, seed)];
}

export function planSession(level: Level, day: number) {
  const plan = studyPlans[level];
  const entry = plan.days[day - 1];
  if (!entry) return null;
  const [type, objective, seconds] = entry;
  const seed = `${level}/plan-v1/${day}`;
  const duration = seconds ?? (type === 'song' ? 300 : pick([180, 240, 300], seededPractice(seed)));
  const block = makeBlock(type, level, duration, seed, Math.floor((day - 1) / 7));
  return {
    day,
    objective,
    milestone: plan.milestone,
    blocks: [{ ...block, instruction: objective }],
  };
}

export function completedPlanDays(sessions: PracticeSession[], level: Level) {
  const completed = new Set(
    sessions
      .filter((s) => s.kind === 'plan' && s.level === level && s.completed)
      .map((s) => s.planDay),
  );
  let day = 1;
  while (completed.has(day) && day <= 21) day++;
  return day - 1;
}

export function blockCredit(result: PracticeResult, targetSeconds: number, assessed: boolean) {
  return (
    !result.skipped && result.seconds >= targetSeconds && (!assessed || (result.total ?? 0) > 0)
  );
}

export function attemptBpm(attempt: Pick<Attempt, 'module' | 'config'>) {
  return attempt.module === 'groove' ||
    attempt.module === 'chord-train' ||
    attempt.module === 'listen-repeat' ||
    attempt.config.reading === 'rhythm'
    ? attempt.config.bpm
    : undefined;
}

export function overallPractice(sessions: PracticeSession[], attempts: Attempt[]) {
  const days = new Map<string, { seconds: number; challenge: boolean }>();
  const add = (day: string, seconds: number, challenge = false) => {
    const previous = days.get(day);
    days.set(day, {
      seconds: (previous?.seconds ?? 0) + seconds,
      challenge: challenge || !!previous?.challenge,
    });
  };
  for (const s of sessions)
    add(
      s.day,
      s.blocks.reduce((sum, b) => sum + b.seconds, 0),
      s.kind === 'challenge' && s.completed,
    );
  for (const a of attempts) {
    const date = new Date(a.createdAt);
    if (Number.isFinite(+date)) add(localDay(date), Math.max(0, a.duration));
  }
  return days;
}

export function streakFor(
  today: string,
  days: ReturnType<typeof overallPractice>,
  protect: boolean,
) {
  const practiced = (day: string) => {
    const entry = days.get(day);
    return !!entry && (entry.challenge || entry.seconds >= 300);
  };
  // Hoy sigue abierto. Si ayer fue descanso, se puede retomar la racha hoy.
  let day = practiced(today) ? today : shiftDay(today, -1);
  let count = 0;
  const used = new Set<string>();
  while (true) {
    if (practiced(day)) count++;
    else {
      const week = weekStart(day);
      const before = shiftDay(day, -1);
      if (!protect || used.has(week) || !practiced(before)) break;
      used.add(week);
    }
    day = shiftDay(day, -1);
  }
  return {
    count,
    restUsedThisWeek: used.has(weekStart(today)),
    milestone: [...streakMilestones].reverse().find((n) => n <= count),
    next: streakMilestones.find((n) => n > count),
  };
}

export function weeklyPractice(
  today: string,
  days: ReturnType<typeof overallPractice>,
  settings: PracticeSettings,
) {
  const monday = weekStart(today);
  const entries = weekDays.map(({ value, label }, i) => {
    const day = shiftDay(monday, i);
    const entry = day <= today ? days.get(day) : undefined;
    return {
      day,
      label,
      planned: settings.days.includes(value),
      seconds: entry?.seconds ?? 0,
      practiced: !!entry && (entry.challenge || entry.seconds >= 300),
    };
  });
  return { entries, seconds: entries.reduce((total, day) => total + day.seconds, 0) };
}

export function songLoop(session: Pick<Session, 'loop' | 'duration' | 'position'>): Loop | null {
  if (session.loop) return session.loop;
  if (session.duration < 0.2) return null;
  const a = Math.min(session.position, Math.max(0, session.duration - 12));
  return { a, b: Math.min(session.duration, a + 12) };
}
export function songRate(start: number, completedLoops: number) {
  const initial = Math.max(25, Math.min(75, Math.round(start * 20) * 5));
  return Math.min(100, initial + Math.floor(Math.max(0, completedLoops) / 3) * 5) / 100;
}

const object = (x: unknown): Record<string, unknown> =>
  x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const integer = (x: unknown, min: number, max = Number.MAX_SAFE_INTEGER): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
export const practiceNoteLimit = 240;
export const practiceNote = (note: string) => note.trim().slice(0, practiceNoteLimit);

export function parsePracticeSettings(value: unknown): PracticeSettings {
  const data = object(value);
  return {
    minutes: practiceMinutes.find((n) => n === data.minutes) ?? defaultPracticeSettings.minutes,
    goals: practiceGoals.map((g) => g.value).filter((g) => list(data.goals).includes(g)),
    days: Array.isArray(data.days)
      ? weekDays.map((d) => d.value).filter((d) => list(data.days).includes(d))
      : defaultPracticeSettings.days,
    weeklyMinutes: integer(data.weeklyMinutes, 5, 600)
      ? data.weeklyMinutes
      : defaultPracticeSettings.weeklyMinutes,
    restDay: typeof data.restDay === 'boolean' ? data.restDay : defaultPracticeSettings.restDay,
  };
}

export function parsePractice(value: unknown): PracticeData {
  const data = object(value);
  const sessions = new Map<string, PracticeSession>();
  for (const item of list(data.sessions)) {
    const s = object(item);
    const level = levels.find((l) => l === s.level);
    const kind = (['challenge', 'routine', 'plan'] as const).find((k) => k === s.kind);
    if (
      typeof s.id !== 'string' ||
      !s.id ||
      !level ||
      !kind ||
      !validDay(s.day) ||
      typeof s.startedAt !== 'string' ||
      !Number.isFinite(Date.parse(s.startedAt)) ||
      (kind === 'plan' && !integer(s.planDay, 1, 21))
    )
      continue;
    const blocks = list(s.blocks).flatMap((raw): PracticeResult[] => {
      const b = object(raw);
      if (typeof b.id !== 'string' || typeof b.title !== 'string' || !integer(b.seconds, 0, 1800))
        return [];
      const rated = integer(b.total, 1) && integer(b.correct, 0, b.total);
      return [
        {
          id: b.id,
          title: b.title,
          seconds: b.seconds,
          module: modules.find((m) => m === b.module),
          ...(rated ? { total: b.total as number, correct: b.correct as number } : {}),
          ...(integer(b.bpm, 1, 300) ? { bpm: b.bpm } : {}),
          ...(typeof b.rate === 'number' && b.rate >= 0.25 && b.rate <= 1 ? { rate: b.rate } : {}),
          ...(b.skipped === true ? { skipped: true } : {}),
        },
      ];
    });
    if (blocks.length === 0) continue;
    sessions.set(s.id, {
      id: s.id,
      level,
      kind,
      day: s.day,
      startedAt: s.startedAt,
      completed: s.completed === true,
      blocks,
      ...(integer(s.planDay, 1, 21) ? { planDay: s.planDay } : {}),
      ...(typeof s.note === 'string' ? { note: practiceNote(s.note) } : {}),
    });
  }
  return {
    settings: parsePracticeSettings(data.settings),
    sessions: [...sessions.values()],
    attemptNotes: Object.fromEntries(
      Object.entries(object(data.attemptNotes)).flatMap(([id, note]) =>
        typeof note === 'string' ? [[id, practiceNote(note)]] : [],
      ),
    ),
  };
}
