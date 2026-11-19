import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AttemptInput, Database, scoreAttempt, uid } from '../core/types';
import { Profile, defaultProfile, parseProfile } from '../core/profile';
import { LessonProgress, validateLessonProgress } from '../core/course';
import { harmonyLessons } from '../content/harmony';
import { supabase } from './supabase';
import { loadRemote, profileToRow } from './remote';

/**
 * La app funciona sin cuenta: perfil y datos se guardan en el dispositivo.
 * Con Supabase configurado, iniciar sesión es opcional y usa los datos de la
 * cuenta. Fusionar los datos locales con la cuenta está pendiente (REQUISITOS §10).
 */
const KEY = 'clasro.local.v2';
const LEGACY_KEYS = ['clasro.demo.v1'];

type Mode = 'local' | 'remote';
type State = { profile: Profile; db: Database; mode: Mode };
type ProfilePatch = Partial<Omit<Profile, 'id' | 'email'>>;
type Store = State & {
  loading: boolean;
  error: string;
  message: string;
  accountsAvailable: boolean;
  clearMessage: () => void;
  refresh: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearLocalData: () => Promise<void>;
  saveAttempt: (input: AttemptInput) => Promise<void>;
  saveLessonProgress: (input: LessonProgress) => Promise<void>;
};

const Context = createContext<Store | null>(null);
const emptyDb = (): Database => ({ attempts: [], lessonProgress: [] });
const freshLocal = (): State => ({ profile: defaultProfile(uid()), db: emptyDb(), mode: 'local' });

function parseLocal(raw: string | null): State | null {
  if (!raw) return null;
  try {
    const x = JSON.parse(raw);
    if (x?.version !== 2 || !x.profile?.id) return null;
    const profile = parseProfile(x.profile, x.profile.id);
    return {
      profile,
      mode: 'local',
      db: {
        attempts: Array.isArray(x.db?.attempts) ? x.db.attempts : [],
        lessonProgress: Array.isArray(x.db?.lessonProgress) ? x.db.lessonProgress : [],
      },
    };
  } catch {
    return null;
  }
}

async function readLocal(): Promise<State> {
  const saved = parseLocal(await AsyncStorage.getItem(KEY));
  if (saved) return saved;
  const next = freshLocal();
  await writeLocal(next);
  return next;
}
async function writeLocal(s: State) {
  await AsyncStorage.setItem(KEY, JSON.stringify({ version: 2, profile: s.profile, db: s.db }));
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(freshLocal);
  const current = useRef(state);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const queue = useRef(Promise.resolve());

  const apply = (next: State) => {
    current.current = next;
    setState(next);
  };

  const refresh = useCallback(async () => {
    if (supabase) {
      const { data, error: err } = await supabase.auth.getSession();
      if (err) throw err;
      if (data.session) {
        const remote = await loadRemote(data.session.user.id);
        // El tema es del dispositivo: se conserva el del perfil local.
        const theme = (await readLocal()).profile.theme;
        apply({ ...remote, profile: { ...remote.profile, theme }, mode: 'remote' });
        return;
      }
    }
    apply(await readLocal());
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await AsyncStorage.multiRemove(LEGACY_KEYS);
        await refresh();
      } catch (err) {
        if (mounted) setError((err as Error).message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const listener = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED')
        setTimeout(() => refresh().catch((e) => setError(e.message)), 0);
    });
    return () => {
      mounted = false;
      listener?.data.subscription.unsubscribe();
    };
  }, [refresh]);

  /** Serializa las escrituras para evitar duplicados al pulsar dos veces. */
  function mutate(change: (s: State) => Promise<State | null>, success: string) {
    const task = queue.current
      .catch(() => {})
      .then(async () => {
        setError('');
        try {
          const next = await change(current.current);
          if (next) {
            if (next.mode === 'local') await writeLocal(next);
            apply(next);
          } else await refresh();
          setMessage(success);
        } catch (e) {
          const text = (e as Error).message || 'No se pudo guardar. Vuelve a intentarlo.';
          setError(text);
          throw new Error(text);
        }
      });
    queue.current = task.then(
      () => {},
      () => {},
    );
    return task;
  }

  const requireAccounts = () => {
    if (!supabase)
      throw new Error('Las cuentas no están configuradas. Puedes seguir usando la app sin cuenta.');
    return supabase;
  };

  const store: Store = {
    ...state,
    loading,
    error,
    message,
    accountsAvailable: !!supabase,
    clearMessage: () => {
      setMessage('');
      setError('');
    },
    refresh,
    updateProfile: (patch) =>
      mutate(async (s) => {
        const profile = { ...s.profile, ...patch };
        if (patch.theme && s.mode === 'remote') {
          // El tema no tiene columna en el servidor: se guarda en el perfil local.
          const local = await readLocal();
          await writeLocal({ ...local, profile: { ...local.profile, theme: patch.theme } });
          if (Object.keys(patch).length === 1) return { ...s, profile };
        }
        if (s.mode === 'remote') {
          const { error } = await supabase!
            .from('profiles')
            .update(profileToRow(profile))
            .eq('id', profile.id);
          if (error) throw error;
          return null;
        }
        return { ...s, profile };
      }, 'Ajustes guardados.'),
    login: async (email, password) => {
      const client = requireAccounts();
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await refresh();
    },
    signup: async (email, password) => {
      const client = requireAccounts();
      if (!email.includes('@') || password.length < 8)
        throw new Error('Introduce un correo válido y una contraseña de al menos 8 caracteres.');
      const { data, error } = await client.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      if (data.session) await refresh();
      else setMessage('Revisa tu correo para confirmar la cuenta. Después podrás iniciar sesión.');
    },
    resetPassword: async (email) => {
      const client = requireAccounts();
      if (!email.includes('@')) throw new Error('Escribe tu correo para recuperar la contraseña.');
      const { error } = await client.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setMessage('Si la cuenta existe, recibirás un enlace de recuperación.');
    },
    logout: async () => {
      if (state.mode === 'remote') {
        const r = await supabase?.auth.signOut();
        if (r?.error) throw r.error;
      }
      apply(await readLocal());
      setError('');
      setMessage('');
    },
    deleteAccount: async () => {
      const client = requireAccounts();
      if (current.current.mode !== 'remote') throw new Error('No hay ninguna cuenta iniciada.');
      const { error } = await client.rpc('delete_own_account');
      if (error) throw error;
      await client.auth.signOut();
      apply(await readLocal());
      setMessage('Cuenta eliminada. Los datos de este dispositivo se conservan.');
    },
    clearLocalData: async () => {
      await AsyncStorage.removeItem(KEY);
      const next = await readLocal();
      if (current.current.mode === 'local') apply(next);
      setMessage('Datos de este dispositivo borrados.');
    },
    saveLessonProgress: (input) =>
      mutate(async (s) => {
        const lesson = harmonyLessons.find((l) => l.id === input.lessonId);
        if (!lesson) throw new Error('No se reconoce este tema.');
        const next: LessonProgress = {
          ...input,
          userId: s.profile.id,
          updatedAt: new Date().toISOString(),
        };
        validateLessonProgress(lesson, next);
        if (s.mode === 'remote') {
          const { error } = await supabase!.from('lesson_progress').upsert(
            {
              user_id: s.profile.id,
              course_id: next.courseId,
              lesson_id: next.lessonId,
              quiz_answers: next.quizAnswers,
              quiz_submitted: next.quizSubmitted,
              practical: next.practical,
            },
            { onConflict: 'user_id,course_id,lesson_id' },
          );
          if (error) throw error;
          return null;
        }
        return {
          ...s,
          db: {
            ...s.db,
            lessonProgress: [
              next,
              ...s.db.lessonProgress.filter(
                (p) => !(p.courseId === next.courseId && p.lessonId === next.lessonId),
              ),
            ],
          },
        };
      }, 'Progreso del tema guardado.'),
    saveAttempt: (input) =>
      mutate(async (s) => {
        const score = scoreAttempt(input.correct, input.total);
        if (s.mode === 'remote') {
          const { error } = await supabase!.from('attempts').upsert(
            {
              id: input.id,
              user_id: s.profile.id,
              module: input.module,
              correct: input.correct,
              total: input.total,
              score,
              duration: input.duration,
              config: input.config,
              detail: input.detail,
            },
            { onConflict: 'id', ignoreDuplicates: true },
          );
          if (error) throw error;
          return null;
        }
        if (s.db.attempts.some((a) => a.id === input.id)) return s;
        return {
          ...s,
          db: {
            ...s.db,
            attempts: [
              { ...input, score, userId: s.profile.id, createdAt: new Date().toISOString() },
              ...s.db.attempts,
            ],
          },
        };
      }, 'Resultado guardado en tu progreso.'),
  };
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error('StoreProvider no está disponible.');
  return value;
}
