import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Badge,
  Button,
  Chips,
  Empty,
  Field,
  Heading,
  Icon,
  Label,
  colors,
  styles,
} from '../components/ui';
import { harmonyCourse, harmonyLessons } from '../content/harmony';
import { lessonDiagrams } from '../content/harmony';
import { diagramTimeline } from '../core/diagrams';
import { DiagramCard, initialStep } from '../components/harmony/DiagramCard';
import {
  Lesson,
  LessonProgress,
  PracticalResponse,
  blankProgress,
  lessonCompleted,
  quizScore,
  validateLessonProgress,
  exampleTimeline,
} from '../core/course';
import { Module } from '../core/types';
import { useStore } from '../data/Store';
import { audio } from '../platform/audio';
import { radioKeyboard } from '../platform/radioKeyboard';

type Props = {
  practice: (module: Module) => void;
  scrollToTop: () => void;
};
export function HarmonyCourse({ practice, scrollToTop }: Props) {
  const { profile, db } = useStore();
  const [selected, setSelected] = useState<string | null>(null),
    [group, setGroup] = useState('Todos'),
    [search, setSearch] = useState('');
  const progress = (db.lessonProgress || []).filter(
    (p) => p.userId === profile!.id && p.courseId === harmonyCourse.id,
  );
  const completed = harmonyLessons.filter((l) =>
    lessonCompleted(
      l,
      progress.find((p) => p.lessonId === l.id),
    ),
  ).length;
  const lesson = harmonyLessons.find((l) => l.id === selected);
  function select(id: string | null) {
    setSelected(id);
    requestAnimationFrame(scrollToTop);
  }
  if (lesson)
    return (
      <LessonReader
        key={`${profile!.id}-${lesson.id}`}
        lesson={lesson}
        progress={progress.find((p) => p.lessonId === lesson.id)}
        onSelect={select}
        practice={practice}
      />
    );
  const visible = harmonyLessons.filter(
    (l) =>
      (group === 'Todos' || l.group === group) &&
      `${l.number} ${l.title} ${l.sections.map((s) => s.title).join(' ')}`
        .toLocaleLowerCase('es')
        .includes(search.toLocaleLowerCase('es')),
  );
  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 10 }}>
        <Heading level={1} style={styles.title}>
          Armonía I
        </Heading>
        <Label muted>{harmonyCourse.description}</Label>
        <Label muted>{harmonyCourse.source}</Label>
      </View>
      <View style={[styles.panel, { gap: 14 }]}>
        <View style={styles.between}>
          <Heading level={2} style={styles.h2}>
            Tu recorrido
          </Heading>
          <Badge>
            {completed} de {harmonyLessons.length} temas completados
          </Badge>
        </View>
        <View style={{ height: 6, backgroundColor: colors.sunken, borderRadius: 5 }}>
          <View
            style={{
              height: 6,
              backgroundColor: colors.accent,
              width: `${(completed / harmonyLessons.length) * 100}%`,
              borderRadius: 5,
            }}
          />
        </View>
        <Label muted>
          32 temas · 96 preguntas con explicación · 64 prácticas guiadas. Completar un tema registra
          el cuestionario y la autoevaluación de sus dos prácticas.
        </Label>
        <Button
          icon="arrow"
          onPress={() =>
            select(
              (harmonyLessons.find(
                (l) =>
                  !lessonCompleted(
                    l,
                    progress.find((p) => p.lessonId === l.id),
                  ),
              ) || harmonyLessons[0])!.id,
            )
          }
          style={{ alignSelf: 'flex-start' }}
        >
          {progress.length ? 'Continuar el curso' : 'Empezar por el tema 1'}
        </Button>
      </View>
      <Field
        label="Buscar en los temas"
        value={search}
        onChangeText={setSearch}
        placeholder="Ej. intervalos, cadencias o modo menor"
      />
      <Chips
        options={['Todos', ...harmonyCourse.groups].map((value) => ({ value, label: value }))}
        value={group}
        onChange={setGroup}
      />
      {visible.length ? (
        <View style={styles.panel}>
          {visible.map((l) => {
            const saved = progress.find((p) => p.lessonId === l.id),
              done = lessonCompleted(l, saved);
            return (
              <Pressable
                key={l.id}
                accessibilityRole="button"
                accessibilityLabel={`Tema ${l.number}. ${l.title}. ${done ? 'Completado' : saved ? 'En curso' : 'Sin empezar'}`}
                onPress={() => select(l.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  gap: 14,
                  alignItems: 'center',
                  paddingVertical: 17,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.line,
                  opacity: pressed ? 0.65 : 1,
                })}
              >
                <View style={{ width: 35, alignItems: 'center' }}>
                  {done ? (
                    <Icon name="check" color={colors.accentText} />
                  ) : (
                    <Text style={{ fontSize: 17, fontWeight: '600', color: colors.muted }}>
                      {l.number}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.h3}>{l.title}</Text>
                  <Label muted>{l.group} · 3 preguntas · 2 prácticas</Label>
                  {saved ? (
                    <Label muted>
                      {saved.quizSubmitted
                        ? `Cuestionario: ${quizScore(l, saved.quizAnswers)}/${l.questions.length}`
                        : 'Borrador guardado'}{' '}
                      · {done ? 'Completado con autoevaluación' : 'En curso'}
                    </Label>
                  ) : null}
                </View>
                <Icon name="arrow" size={18} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.panel}>
          <Empty
            title="No hay temas con esa búsqueda"
            detail="Prueba otro término o selecciona Todos."
          />
        </View>
      )}
      <View style={{ gap: 7 }}>
        <Label muted>{harmonyCourse.editionNote}</Label>
        <Label muted>
          La teoría sigue los capítulos I–XXXII del libro añadido al proyecto. Cada lección indica
          sus páginas de referencia. Puedes explorar los temas sin desbloqueos.
        </Label>
      </View>
    </View>
  );
}

function LessonReader({
  lesson,
  progress,
  onSelect,
  practice,
}: {
  lesson: Lesson;
  progress?: LessonProgress;
  onSelect: (id: string | null) => void;
  practice: Props['practice'];
}) {
  const store = useStore(),
    profile = store.profile!;
  const initial = progress || blankProgress(profile.id, lesson.id);
  const [draft, setDraft] = useState<LessonProgress>(initial),
    [hydrated, setHydrated] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(!!progress),
    [revealed, setRevealed] = useState<string[]>([]),
    [playing, setPlaying] = useState(false);
  const diagrams = lessonDiagrams[lesson.number] || [],
    primary = diagrams[0];
  const timeline = primary ? diagramTimeline(primary, lesson.example) : null;
  const [step, setStep] = useState(() => (primary ? initialStep(primary) : 0)),
    [sweep, setSweep] = useState<{ step: number; ms: number; key: number } | null>(null);
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const latest = useRef(initial),
    editVersion = useRef(0),
    ready = useRef(false),
    mounted = useRef(true),
    generation = useRef(0),
    soundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = `clasro.course-draft.v1:${store.mode}:${profile.id}:${lesson.id}`;
  useEffect(() => {
    mounted.current = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!mounted.current) return;
        if (raw) {
          try {
            const cached = JSON.parse(raw) as LessonProgress;
            validateLessonProgress(lesson, cached);
            if (
              cached.userId === profile.id &&
              (!progress || Date.parse(cached.updatedAt) > Date.parse(progress.updatedAt))
            ) {
              latest.current = cached;
              setDraft(cached);
              setSaved(false);
            }
          } catch {
            /* Ignore a stale or malformed device draft and retain saved progress. */
          }
        }
      })
      .catch(() => {
        if (mounted.current)
          setError(
            'No se pudo recuperar el borrador de este dispositivo. El progreso guardado sigue disponible.',
          );
      })
      .finally(() => {
        if (mounted.current) {
          ready.current = true;
          setHydrated(true);
        }
      });
    return () => {
      mounted.current = false;
      generation.current++;
      if (soundTimer.current) clearTimeout(soundTimer.current);
      stepTimers.current.forEach(clearTimeout);
      audio.stop();
      if (ready.current)
        void AsyncStorage.setItem(key, JSON.stringify(latest.current)).catch(() => {});
    };
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(key, JSON.stringify(draft)).catch(() => {
        if (mounted.current)
          setError('No se pudo guardar el borrador local. Usa Guardar progreso para reintentarlo.');
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, hydrated, key]);
  function update(next: LessonProgress) {
    const value = { ...next, updatedAt: new Date().toISOString() };
    editVersion.current++;
    latest.current = value;
    setDraft(value);
    setSaved(false);
    setError('');
  }
  async function save(next: LessonProgress = latest.current) {
    if (saving) return false;
    setSaving(true);
    setError('');
    const version = editVersion.current;
    try {
      validateLessonProgress(lesson, next);
      await store.saveLessonProgress(next);
      if (mounted.current && version === editVersion.current) {
        latest.current = next;
        setDraft(next);
        setSaved(true);
      }
      return true;
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
      return false;
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  async function correctQuiz() {
    const next = { ...latest.current, quizSubmitted: true, updatedAt: new Date().toISOString() };
    if (lesson.questions.some((q) => !next.quizAnswers[q.id])) {
      setError('Responde las tres preguntas antes de corregir.');
      return;
    }
    update(next);
    await save(next);
  }
  function changePractice(id: string, value: Partial<PracticalResponse>) {
    const current = latest.current.practical[id] || { text: '', checks: [], selfAssessed: false };
    update({
      ...latest.current,
      practical: {
        ...latest.current.practical,
        [id]: { ...current, ...value, selfAssessed: false },
      },
    });
  }
  async function assess(id: string) {
    const response = latest.current.practical[id];
    if (!response) return;
    const next = {
      ...latest.current,
      practical: { ...latest.current.practical, [id]: { ...response, selfAssessed: true } },
      updatedAt: new Date().toISOString(),
    };
    try {
      validateLessonProgress(lesson, next);
      update(next);
      await save(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function stopPlayback() {
    generation.current++;
    audio.stop();
    if (soundTimer.current) clearTimeout(soundTimer.current);
    stepTimers.current.forEach(clearTimeout);
    stepTimers.current = [];
    setSweep(null);
    setPlaying(false);
  }
  async function listen() {
    if (playing) return stopPlayback();
    const token = ++generation.current;
    try {
      const audible = timeline ? timeline.audible : !!lesson.example.notes;
      if (audible) await audio.ready();
      if (!mounted.current || token !== generation.current) return;
      audio.stop();
      const lead = 0.1,
        t = audio.now() + lead;
      let total: number;
      if (timeline) {
        // The diagram follows the sound: each step lights up as it is heard.
        timeline.events.forEach((event) =>
          event.notes.forEach((note) =>
            audio.tone(
              note,
              t + event.at,
              event.duration * 0.85,
              (0.2 * event.volume) / Math.sqrt(event.notes.length),
            ),
          ),
        );
        timeline.clicks.forEach((c) => audio.click(t + c.at, c.accent));
        stepTimers.current = timeline.steps.map((s, i) =>
          setTimeout(
            () => {
              if (!mounted.current || token !== generation.current) return;
              setStep(i);
              setSweep({ step: i, ms: s.duration * 1000, key: token * 1000 + i });
            },
            (lead + s.at) * 1000,
          ),
        );
        total = timeline.total;
      } else {
        const events = exampleTimeline(lesson.example);
        events.forEach((event) =>
          event.notes.forEach((note) =>
            audio.tone(
              note,
              t + event.at,
              event.duration * 0.85,
              0.2 / Math.sqrt(event.notes.length),
            ),
          ),
        );
        total = events.reduce((sum, event) => sum + event.duration, 0);
      }
      setPlaying(true);
      soundTimer.current = setTimeout(
        () => {
          if (!mounted.current) return;
          setSweep(null);
          setPlaying(false);
        },
        total * 1000 + 100,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const playLabel = timeline
    ? timeline.audible
      ? playing
        ? 'Detener ejemplo'
        : 'Escuchar ejemplo'
      : playing
        ? 'Detener recorrido'
        : 'Recorrer paso a paso'
    : playing
      ? 'Detener ejemplo'
      : 'Escuchar ejemplo';
  const playButton =
    (timeline && timeline.events.length) || (!timeline && lesson.example.notes) ? (
      <Button
        variant="secondary"
        icon={playing ? 'pause' : 'play'}
        onPress={() => void listen()}
        style={{ alignSelf: 'flex-start' }}
      >
        {playLabel}
      </Button>
    ) : null;
  const complete = lessonCompleted(lesson, draft),
    allAnswered = lesson.questions.every((q) => draft.quizAnswers[q.id]);
  if (!hydrated)
    return (
      <View style={{ padding: 40, gap: 16, alignItems: 'center' }}>
        <ActivityIndicator color={colors.accentText} />
        <Label muted>Recuperando el tema y tu borrador…</Label>
      </View>
    );
  return (
    <View style={{ gap: 26 }}>
      <View style={styles.between}>
        <Button variant="ghost" icon="back" onPress={() => onSelect(null)}>
          Índice de Armonía I
        </Button>
        <Badge>{complete ? 'Completado con autoevaluación' : `Tema ${lesson.number} de 32`}</Badge>
      </View>
      <View style={{ gap: 10 }}>
        <Heading level={1} style={styles.title}>
          {lesson.title}
        </Heading>
        <Label muted>
          {lesson.group} ·{' '}
          {saved ? 'Progreso guardado' : 'Borrador local; guarda para registrar tu progreso'}
        </Label>
      </View>
      <View style={[styles.panel, { gap: 28 }]}>
        {lesson.sections.map((section) => (
          <View key={section.title} style={{ gap: 10, maxWidth: 660 }}>
            <Heading level={2} style={styles.h2}>
              {section.title}
            </Heading>
            <Text selectable style={[styles.text, { fontSize: 16, lineHeight: 27 }]}>
              {section.text}
            </Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={{ gap: 12, maxWidth: 660 }}>
          <Heading level={2} style={styles.h2}>
            Ejemplo: {lesson.example.title}
          </Heading>
          <Text selectable style={[styles.text, { fontSize: 16, lineHeight: 27 }]}>
            {lesson.example.explanation}
          </Text>
          {primary ? null : (
            <>
              {lesson.example.labels ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {lesson.example.labels.map((label, i) => (
                    <Badge key={`${label}-${i}`}>{label}</Badge>
                  ))}
                </View>
              ) : null}
              {playButton}
            </>
          )}
        </View>
        {primary ? (
          <View style={{ gap: 30, maxWidth: 660 }}>
            <DiagramCard
              diagram={primary}
              step={step}
              onStep={(next) => {
                if (playing) stopPlayback();
                setStep(next);
              }}
              sweep={playing ? sweep : null}
              action={playButton}
            />
            {diagrams.slice(1).map((diagram) => (
              <DiagramCard key={diagram.title} diagram={diagram} />
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.panel}>
        <Heading level={2} style={styles.h2}>
          Ejercicios teóricos
        </Heading>
        <Label muted>
          Responde las tres preguntas y corrige el cuestionario. Cada respuesta incluye su
          explicación.
        </Label>
        {lesson.questions.map((question, i) => (
          <View
            key={question.id}
            accessibilityRole="radiogroup"
            accessibilityLabel={question.prompt}
            style={{
              gap: 11,
              paddingVertical: 12,
              borderTopWidth: i ? 1 : 0,
              borderColor: colors.line,
            }}
          >
            <Heading level={3} style={styles.h3}>
              {i + 1}. {question.prompt}
            </Heading>
            {question.options.map((option, optionIndex) => {
              const selected = draft.quizAnswers[question.id] === option;
              const isCorrect = draft.quizSubmitted && question.answer === option;
              return (
                <Pressable
                  key={option}
                  {...radioKeyboard(
                    optionIndex,
                    question.options.indexOf(draft.quizAnswers[question.id] || ''),
                    question.options.length,
                    draft.quizSubmitted || saving,
                    (next) =>
                      update({
                        ...latest.current,
                        quizAnswers: {
                          ...latest.current.quizAnswers,
                          [question.id]: question.options[next]!,
                        },
                      }),
                  )}
                  accessibilityRole="radio"
                  aria-checked={selected}
                  accessibilityState={{
                    checked: selected,
                    disabled: draft.quizSubmitted || saving,
                  }}
                  disabled={draft.quizSubmitted || saving}
                  onPress={() =>
                    update({
                      ...latest.current,
                      quizAnswers: { ...latest.current.quizAnswers, [question.id]: option },
                    })
                  }
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    padding: 13,
                    borderRadius: 8,
                    backgroundColor: isCorrect
                      ? colors.accentSoft
                      : selected
                        ? colors.raised
                        : colors.surface,
                    borderWidth: 1,
                    borderColor: selected || isCorrect ? colors.accent : colors.line,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: selected ? colors.accent : colors.lineStrong,
                      backgroundColor: selected ? colors.accent : 'transparent',
                    }}
                  >
                    {selected ? <Icon name="check" color={colors.onAccent} size={16} /> : null}
                  </View>
                  <Text style={[styles.text, { flex: 1 }]}>{option}</Text>
                </Pressable>
              );
            })}
            {draft.quizSubmitted ? (
              <View accessibilityLiveRegion="polite" style={{ gap: 6 }}>
                <Label
                  style={{
                    color:
                      draft.quizAnswers[question.id] === question.answer
                        ? colors.accentText
                        : colors.error,
                  }}
                >
                  {draft.quizAnswers[question.id] === question.answer
                    ? 'Respuesta correcta.'
                    : `Respuesta correcta: ${question.answer}.`}
                </Label>
                <Label muted>{question.explanation}</Label>
              </View>
            ) : null}
          </View>
        ))}
        {draft.quizSubmitted ? (
          <View style={styles.between}>
            <Badge>
              {quizScore(lesson, draft.quizAnswers)} de {lesson.questions.length} respuestas
              correctas
            </Badge>
            <Button
              variant="secondary"
              disabled={saving}
              onPress={() => update({ ...latest.current, quizAnswers: {}, quizSubmitted: false })}
            >
              Reintentar cuestionario
            </Button>
          </View>
        ) : (
          <Button
            busy={saving}
            disabled={!allAnswered}
            onPress={() => void correctQuiz()}
            style={{ alignSelf: 'flex-start' }}
          >
            Corregir y guardar cuestionario
          </Button>
        )}
      </View>
      <View style={{ gap: 9 }}>
        <Heading level={2} style={styles.h2}>
          Ejercicios prácticos
        </Heading>
        <Label muted>
          Realiza las actividades con tu voz, instrumento o papel. Registra tu trabajo y revisa los
          criterios. La práctica se guarda como autoevaluación, sin calificación automática de la
          interpretación.
        </Label>
      </View>
      {lesson.practical.map((exercise, index) => {
        const response = draft.practical[exercise.id] || {
          text: '',
          checks: [],
          selfAssessed: false,
        };
        return (
          <View key={exercise.id} style={styles.panel}>
            <Heading level={3} style={styles.h3}>
              {index + 1}. {exercise.title}
            </Heading>
            {exercise.steps.map((step, i) => (
              <Label key={step}>
                {i + 1}. {step}
              </Label>
            ))}
            {exercise.module ? (
              <Button
                small
                variant="secondary"
                icon="practice"
                disabled={saving}
                onPress={() => {
                  void save().then((ok) => {
                    if (ok) practice(exercise.module!);
                  });
                }}
                style={{ alignSelf: 'flex-start' }}
              >
                Abrir práctica interactiva de apoyo
              </Button>
            ) : null}
            <Field
              label={`Mi trabajo: ${exercise.title}`}
              value={response.text}
              onChangeText={(text) => changePractice(exercise.id, { text: text.slice(0, 10000) })}
              multiline
              placeholder="Escribe las notas, el cifrado o el ritmo que has creado y explica qué has tocado y observado."
            />
            <Button
              small
              variant="ghost"
              onPress={() =>
                setRevealed((ids) =>
                  ids.includes(exercise.id)
                    ? ids.filter((id) => id !== exercise.id)
                    : [...ids, exercise.id],
                )
              }
              style={{ alignSelf: 'flex-start' }}
            >
              {revealed.includes(exercise.id)
                ? 'Ocultar solución orientativa'
                : 'Ver solución orientativa'}
            </Button>
            {revealed.includes(exercise.id) ? (
              <View style={{ gap: 8, paddingVertical: 10 }}>
                <Label style={{ fontWeight: '600' }}>Solución orientativa</Label>
                <Text selectable style={styles.text}>
                  {exercise.reference}
                </Text>
              </View>
            ) : null}
            <Label style={{ fontWeight: '600' }}>Comprueba tu trabajo</Label>
            {exercise.criteria.map((criterion, i) => {
              const checked = response.checks.includes(String(i));
              return (
                <Pressable
                  key={criterion}
                  accessibilityRole="checkbox"
                  aria-checked={checked}
                  accessibilityState={{ checked, disabled: saving }}
                  disabled={saving}
                  onPress={() =>
                    changePractice(exercise.id, {
                      checks: checked
                        ? response.checks.filter((c) => c !== String(i))
                        : [...response.checks, String(i)],
                    })
                  }
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 10,
                    paddingVertical: 5,
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderWidth: 1,
                      borderColor: checked ? colors.accent : colors.lineStrong,
                      borderRadius: 4,
                      backgroundColor: checked ? colors.accent : colors.sunken,
                      marginTop: 1,
                    }}
                  >
                    {checked ? <Icon name="check" size={18} color={colors.onAccent} /> : null}
                  </View>
                  <Text style={[styles.text, { flex: 1 }]}>{criterion}</Text>
                </Pressable>
              );
            })}
            <View style={styles.between}>
              <Button
                busy={saving}
                disabled={
                  response.selfAssessed ||
                  response.text.trim().length < 20 ||
                  !exercise.criteria.every((_, i) => response.checks.includes(String(i)))
                }
                onPress={() => void assess(exercise.id)}
              >
                {response.selfAssessed ? 'Autoevaluación registrada' : 'Registrar autoevaluación'}
              </Button>
              <Label muted>
                {response.selfAssessed
                  ? 'Trabajo y criterios guardados'
                  : 'Escribe al menos 20 caracteres y revisa los tres criterios'}
              </Label>
            </View>
          </View>
        );
      })}
      <View accessibilityLiveRegion="polite" style={{ gap: 12 }}>
        {error ? (
          <Label style={{ color: colors.error }}>
            {error} Tu trabajo se conserva en este dispositivo para reintentarlo.
          </Label>
        ) : null}
        <View style={styles.between}>
          <Button busy={saving} icon="check" onPress={() => void save()}>
            Guardar progreso
          </Button>
          <Label muted>
            {complete
              ? 'Tema completado: cuestionario y dos prácticas autoevaluadas.'
              : 'Puedes guardar un tema incompleto y retomarlo más tarde.'}
          </Label>
        </View>
      </View>
      <View style={styles.divider} />
      <Label muted>
        Referencia: {harmonyCourse.source}, capítulo {lesson.number}, páginas impresas{' '}
        {lesson.pages[0]}–{lesson.pages[1]} (páginas {lesson.pages[0] - 4}–{lesson.pages[1] - 4} del
        PDF del proyecto). {harmonyCourse.editionNote}
      </Label>
      <View style={styles.between}>
        <Button
          variant="secondary"
          disabled={lesson.number === 1 || saving}
          icon="back"
          onPress={() => onSelect(harmonyLessons[lesson.number - 2]!.id)}
        >
          Tema anterior
        </Button>
        {lesson.number < harmonyLessons.length ? (
          <Button
            disabled={saving}
            icon="arrow"
            onPress={() => onSelect(harmonyLessons[lesson.number]!.id)}
          >
            Siguiente tema
          </Button>
        ) : (
          <Button disabled={saving} onPress={() => onSelect(null)}>
            Volver al índice
          </Button>
        )}
      </View>
    </View>
  );
}
