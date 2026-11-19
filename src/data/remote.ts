import { supabase } from './supabase';
import { Database } from '../core/types';
import { Profile, parseProfile } from '../core/profile';

/** Columnas de `profiles` que el propio usuario puede modificar. */
export function profileToRow(p: Profile) {
  return {
    tuning: p.tuning,
    level: p.level,
    nomenclature: p.nomenclature,
    left_handed: p.leftHanded,
    configured: p.configured,
  };
}

export async function loadRemote(userId: string): Promise<{ db: Database; profile: Profile }> {
  const client = supabase!;
  const [profileRes, attemptsRes, progressRes] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).maybeSingle(),
    client.from('attempts').select('*').order('created_at', { ascending: false }),
    client.from('lesson_progress').select('*'),
  ]);
  for (const r of [profileRes, attemptsRes, progressRes])
    if (r.error) throw new Error(`No se pudieron cargar tus datos: ${r.error.message}`);
  const row = profileRes.data;
  if (!row)
    throw new Error(
      'Tu perfil todavía no está preparado. Comprueba que se ha aplicado la migración de Supabase.',
    );
  const profile = parseProfile(
    {
      id: row.id,
      email: row.email,
      tuning: row.tuning,
      level: row.level,
      nomenclature: row.nomenclature,
      leftHanded: row.left_handed,
      configured: row.configured,
    },
    userId,
  );
  const db: Database = {
    attempts: (attemptsRes.data || []).map((x) => ({
      id: x.id,
      userId: x.user_id,
      module: x.module,
      correct: x.correct,
      total: x.total,
      score: x.score,
      duration: x.duration,
      createdAt: x.created_at,
      config: x.config,
      detail: x.detail,
    })),
    lessonProgress: (progressRes.data || []).map((x) => ({
      userId: x.user_id,
      courseId: x.course_id,
      lessonId: x.lesson_id,
      quizAnswers: x.quiz_answers,
      quizSubmitted: x.quiz_submitted,
      practical: x.practical,
      updatedAt: x.updated_at,
    })),
  };
  return { db, profile };
}
