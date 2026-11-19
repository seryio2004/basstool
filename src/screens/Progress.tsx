import { Heading } from '../components/ui';
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useStore } from '../data/Store';
import { modules } from '../core/types';
import { Badge, Button, Chips, Empty, Label, colors, styles } from '../components/ui';
import { harmonyCourse, harmonyLessons } from '../content/harmony';
import { lessonCompleted, quizScore } from '../core/course';
export function Progress({ openCourse }: { openCourse: () => void }) {
  const { db, profile } = useStore(),
    [filter, setFilter] = useState('all');
  const attempts = db.attempts.filter(
    (a) => a.userId === profile!.id && (filter === 'all' || a.module === filter),
  );
  const average = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length)
    : 0;
  const courseProgress = (db.lessonProgress || []).filter(
    (p) => p.userId === profile!.id && p.courseId === harmonyCourse.id,
  );
  const courseCompleted = harmonyLessons.filter((l) =>
    lessonCompleted(
      l,
      courseProgress.find((p) => p.lessonId === l.id),
    ),
  ).length;
  const quizzes = courseProgress.filter((p) => p.quizSubmitted);
  const theoryCorrect = quizzes.reduce((sum, p) => {
    const lesson = harmonyLessons.find((l) => l.id === p.lessonId);
    return sum + (lesson ? quizScore(lesson, p.quizAnswers) : 0);
  }, 0);
  return (
    <View style={{ gap: 25 }}>
      <View style={{ gap: 8 }}>
        <Heading level={1} style={styles.title}>
          Mi progreso
        </Heading>
        <Label muted>Resultados de tus sesiones guardadas. Cada intento cuenta por separado.</Label>
      </View>
      <View style={styles.panel}>
        <View style={styles.between}>
          <Heading level={2} style={styles.h2}>
            Curso Armonía I
          </Heading>
          <Badge>{courseCompleted} de 32 temas</Badge>
        </View>
        <Label muted>
          {quizzes.length
            ? `${theoryCorrect} respuestas correctas en ${quizzes.length * 3} preguntas corregidas. Las prácticas se registran por autoevaluación.`
            : 'Empieza por la teoría y completa los cuestionarios y prácticas de cada tema.'}
        </Label>
        <Label muted>
          {courseProgress.length}{' '}
          {courseProgress.length === 1
            ? 'tema con progreso guardado'
            : 'temas con progreso guardado'}
          . Completar no equivale a dominar: puedes repasar y reintentar.
        </Label>
        <Button
          variant="secondary"
          icon="library"
          onPress={openCourse}
          style={{ alignSelf: 'flex-start' }}
        >
          Abrir Armonía I
        </Button>
      </View>
      <View style={[styles.panel, { flexDirection: 'row', flexWrap: 'wrap', gap: 32 }]}>
        {[
          { name: 'Sesiones', value: String(attempts.length) },
          {
            name: 'Tiempo de práctica',
            value: `${Math.round(attempts.reduce((s, a) => s + a.duration, 0) / 60)} min`,
          },
          { name: 'Resultado medio', value: attempts.length ? `${average}%` : '—' },
        ].map((s) => (
          <View key={s.name} style={{ gap: 4, minWidth: 120 }}>
            <Text style={styles.legend}>{s.name}</Text>
            <Text style={[styles.data, { fontSize: 28, lineHeight: 34 }]}>{s.value}</Text>
          </View>
        ))}
      </View>
      <Chips
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Todas las sesiones' },
          ...modules.map((m) => ({ value: m.id, label: m.title })),
        ]}
      />
      <View style={styles.panel}>
        <Heading level={2} style={styles.h2}>
          Historial de práctica
        </Heading>
        {attempts.length ? (
          attempts.map((a) => (
            <View
              key={a.id}
              style={{
                gap: 9,
                paddingVertical: 15,
                borderBottomColor: colors.line,
                borderBottomWidth: 1,
              }}
            >
              <View style={styles.between}>
                <View style={{ gap: 5 }}>
                  <Text style={styles.h3}>{modules.find((m) => m.id === a.module)?.title}</Text>
                  <Label muted>
                    {new Date(a.createdAt).toLocaleString('es-ES', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Label>
                </View>
                <Badge>
                  {a.score}% · {a.correct}/{a.total}
                </Badge>
              </View>
              <Label muted>{a.detail}</Label>
            </View>
          ))
        ) : (
          <Empty
            title="Tu historial empieza con la primera práctica"
            detail="Completa un ejercicio y pulsa Guardar resultado. Tus sesiones se mostrarán aquí."
          />
        )}
      </View>
      <Label muted>
        Los porcentajes describen cada sesión; no certifican dominio ni comparan dificultades
        diferentes.
      </Label>
    </View>
  );
}
