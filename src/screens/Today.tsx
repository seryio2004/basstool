import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, Chips, Heading, Label, moduleTone, styles } from '../components/ui';
import { useTheme } from '../components/theme';
import {
  attemptBpm,
  attemptTitle,
  completedPlanDays,
  dailyChallenge,
  guidedRoutine,
  localDay,
  overallPractice,
  planSession,
  practiceMinutes,
  songOfTheDay,
  streakFor,
  weeklyPractice,
  type PracticeBlock,
  type PracticeKind,
  type PracticeResult,
} from '../core/dailyPractice';
import { levels } from '../core/profile';
/** Minutos:segundos sin décimas (la de Transcribir muestra décimas). */
const formatTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
import { useStore } from '../data/Store';
import { listSessions } from '../data/transcriptions';
import { NoteEditor } from './PracticeNote';

const titles = { challenge: 'Reto del día', routine: 'Rutina guiada', plan: 'Plan de 21 días' };

type Props = {
  onStart: (kind: PracticeKind, blocks: PracticeBlock[], planDay?: number) => void;
  onSettings: () => void;
  finished?: string;
  onDismiss: () => void;
  /** Recién terminada la configuración inicial. */
  welcome?: boolean;
  onDismissWelcome?: () => void;
};

export function Today({
  onStart,
  onSettings,
  finished,
  onDismiss,
  welcome = false,
  onDismissWelcome,
}: Props) {
  const { colors } = useTheme();
  const { daily, db, profile, error } = useStore();
  const [date, setDate] = useState(localDay);
  const [selectedMinutes, setSelectedMinutes] = useState(daily.settings.minutes);
  const [recentSong, setRecentSong] = useState<string>();
  const [journal, setJournal] = useState(false);
  const [visibleDays, setVisibleDays] = useState(7);

  useEffect(() => {
    const timer = setInterval(() => setDate(localDay()), 1000);
    let mounted = true;
    void listSessions().then((sessions) => {
      if (mounted) setRecentSong(sessions[0]?.name);
    });
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const { attempts } = db;
  const { sessions, settings } = daily;
  const level = levels.find((l) => l.value === profile.level)!;
  const days = useMemo(() => overallPractice(sessions, attempts), [sessions, attempts]);
  const streak = streakFor(date, days, settings.restDay);
  const week = weeklyPractice(date, days, settings);
  const challenge = dailyChallenge(date, level.value);
  const challengeDone = sessions.some(
    (s) => s.kind === 'challenge' && s.completed && s.day === date && s.level === level.value,
  );
  const history = useMemo(
    () =>
      [
        ...sessions.flatMap((s) => s.blocks.map((b) => ({ ...b, when: s.startedAt }))),
        ...attempts.map((a) => ({
          module: a.module,
          bpm: attemptBpm(a),
          correct: a.correct,
          total: a.total,
          when: a.createdAt,
        })),
      ]
        .filter((b) => b.bpm && b.total)
        .sort((a, b) => b.when.localeCompare(a.when)),
    [sessions, attempts],
  );
  const routine = guidedRoutine(
    date,
    level.value,
    { ...settings, minutes: selectedMinutes },
    history,
  );
  const done = completedPlanDays(sessions, level.value);
  const plan = planSession(level.value, Math.min(21, done + 1))!;
  const studiedToday = sessions.some(
    (s) => s.kind === 'plan' && s.level === level.value && s.completed && s.day === date,
  );
  const latest = sessions.find((s) => s.id === finished);
  const favorite = songOfTheDay(date, settings.favoriteSongs);

  return (
    <View style={{ gap: 28, maxWidth: 820 }}>
      <Heading level={1} style={styles.title}>
        Hoy
      </Heading>
      {welcome ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.panel,
            { backgroundColor: colors.accentSoft, borderColor: colors.accent, gap: 8 },
          ]}
        >
          <View style={[styles.between, { alignItems: 'flex-start' }]}>
            <Heading level={2} style={[styles.h2, { flex: 1 }]}>
              Tu rutina de hoy está lista
            </Heading>
            <Button
              variant="ghost"
              accessibilityLabel="Cerrar aviso"
              onPress={() => onDismissWelcome?.()}
              style={{ marginTop: -10, marginRight: -12 }}
            >
              Cerrar
            </Button>
          </View>
          <Label>
            {settings.minutes} minutos para tu nivel y tus objetivos. Empieza por el reto del día o
            ve directo a la rutina.
          </Label>
        </View>
      ) : null}
      <View style={styles.panel}>
        <View style={styles.between}>
          <View style={{ gap: 4 }}>
            <Text style={styles.legend}>Racha</Text>
            <Text style={[styles.data, { fontSize: 28, color: colors.accentText }]}>
              {streak.count} {streak.count === 1 ? 'día' : 'días'}
            </Text>
          </View>
          <View style={{ gap: 4 }}>
            {streak.milestone ? <Label>Hito alcanzado · {streak.milestone} días</Label> : null}
            {streak.next ? <Label muted>Próximo hito · {streak.next} días</Label> : null}
            {streak.restUsedThisWeek ? <Label muted>Descanso protegido esta semana</Label> : null}
          </View>
        </View>
        <View style={styles.divider} />
        <View style={{ gap: 6 }}>
          <Heading level={2} style={styles.h2}>
            Reto del día
          </Heading>
          <Label muted>
            {level.label} · {challenge.reduce((total, block) => total + block.seconds, 0) / 60} min
          </Label>
          <Label>{challenge.map((block) => block.title).join(' · ')}</Label>
        </View>
        <Button
          style={{ alignSelf: 'flex-start' }}
          icon={challengeDone ? 'check' : 'play'}
          variant={challengeDone ? 'secondary' : 'primary'}
          onPress={() => onStart('challenge', challenge)}
        >
          {challengeDone ? 'Repetir reto completado' : 'Empezar reto'}
        </Button>
      </View>

      {latest ? (
        <View style={styles.panel}>
          <View style={styles.between}>
            <Heading level={2} style={styles.h2}>
              {latest.completed ? 'Sesión completada' : 'Práctica guardada'}
            </Heading>
            <Button small variant="ghost" onPress={onDismiss}>
              Cerrar resumen
            </Button>
          </View>
          <Label muted>
            {titles[latest.kind]} · {formatTime(latest.blocks.reduce((n, b) => n + b.seconds, 0))}
          </Label>
          <NoteEditor key={latest.id} id={latest.id} note={latest.note} />
        </View>
      ) : null}

      <View style={styles.panel}>
        <Heading level={2} style={styles.h2}>
          Rutina de hoy
        </Heading>
        {level.value === 'advanced' ? (
          <Label muted>Pendiente de validar con profesores.</Label>
        ) : null}
        <Chips
          label="Tiempo disponible"
          segmentOnMobile
          minHeight={44}
          value={selectedMinutes}
          options={practiceMinutes.map((value) => ({ value, label: `${value} min` }))}
          onChange={setSelectedMinutes}
        />
        <View>
          {routine.map((block, index) => {
            const tone = block.kind === 'exercise' ? moduleTone(block.module) : undefined;
            return (
              <View
                key={index}
                style={[
                  styles.between,
                  { paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.line },
                ]}
              >
                <View style={{ gap: 4, flex: 1 }}>
                  <Text style={[styles.h3, { color: tone?.ink ?? colors.ink }]}>{block.title}</Text>
                  {block.kind === 'song' ? (
                    <Label muted>
                      {recentSong
                        ? `Última sesión · ${recentSong}`
                        : favorite
                          ? `Prueba con: ${favorite}`
                          : 'Importa una canción para practicar un fragmento.'}
                    </Label>
                  ) : null}
                </View>
                <Text style={styles.data}>{formatTime(block.seconds)}</Text>
              </View>
            );
          })}
        </View>
        <Button
          variant="secondary"
          icon="play"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => onStart('routine', routine)}
        >
          Empezar rutina
        </Button>
      </View>

      <View style={styles.panel}>
        <View style={styles.between}>
          <Heading level={2} style={styles.h2}>
            Plan de 21 días
          </Heading>
          <Text style={styles.data}>{done} / 21 días</Text>
        </View>
        <ProgressBar label="Días completados" now={done} max={21} />
        <Label muted>Contenido provisional · Pendiente de validar con profesores.</Label>
        {done < 21 ? (
          <View style={{ gap: 6 }}>
            {studiedToday ? (
              <Label muted>Ya has completado el día de hoy. Continúa mañana.</Label>
            ) : null}
            <Text style={styles.h3}>
              {studiedToday
                ? 'Siguiente objetivo'
                : `Día ${plan.day} · ${plan.blocks[0]!.seconds / 60} min`}
            </Text>
            <Label>{plan.objective}</Label>
          </View>
        ) : null}
        <Label muted>Hito final · {plan.milestone}</Label>
        {done === 21 ? (
          <Label style={{ color: colors.success }}>Plan completado</Label>
        ) : !studiedToday ? (
          <Button
            variant="secondary"
            style={{ alignSelf: 'flex-start' }}
            onPress={() => onStart('plan', plan.blocks, plan.day)}
          >
            Practicar día {plan.day}
          </Button>
        ) : null}
      </View>

      <View style={styles.panel}>
        <View style={styles.between}>
          <Heading level={2} style={styles.h2}>
            Esta semana
          </Heading>
          <Text style={styles.data}>
            {Math.floor(week.seconds / 60)} / {settings.weeklyMinutes} min
          </Text>
        </View>
        <ProgressBar
          label="Minutos esta semana"
          now={Math.floor(week.seconds / 60)}
          max={settings.weeklyMinutes}
        />
        <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>
          {week.entries.map((entry) => (
            <View
              key={entry.day}
              accessible
              accessibilityLabel={`${entry.label}${entry.planned ? ', previsto' : ''}${entry.practiced ? ', practicado' : ''}${entry.day === date ? ', hoy' : ''}`}
            >
              <Badge
                background={
                  entry.practiced
                    ? colors.successSoft
                    : entry.planned
                      ? colors.accentSoft
                      : colors.raised
                }
                color={
                  entry.practiced
                    ? colors.success
                    : entry.planned
                      ? colors.accentText
                      : colors.muted
                }
              >
                {entry.label}
                {entry.practiced ? ' ✓' : entry.planned ? ' ·' : ''}
              </Badge>
            </View>
          ))}
        </View>
        <Label muted>· previsto　✓ reto completado o 5 min</Label>
        <Button
          variant="ghost"
          icon="settings"
          style={{ alignSelf: 'flex-start' }}
          onPress={onSettings}
        >
          Ajustes de práctica
        </Button>
      </View>

      <View style={styles.panel}>
        <View style={styles.between}>
          <Heading level={2} style={styles.h2}>
            Diario de práctica
          </Heading>
          <Button variant="secondary" onPress={() => setJournal(!journal)}>
            {journal ? 'Cerrar diario' : 'Ver diario'}
          </Button>
        </View>
        {journal ? (
          <Journal limit={visibleDays} onMore={() => setVisibleDays(visibleDays + 7)} />
        ) : null}
      </View>
      {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
    </View>
  );
}

function ProgressBar({ label, now, max }: { label: string; now: number; max: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, now: Math.min(now, max), max }}
      style={{ backgroundColor: colors.sunken, height: 6, borderRadius: 3 }}
    >
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.accent,
          width: `${Math.min(100, (100 * now) / max)}%`,
        }}
      />
    </View>
  );
}

function Journal({ limit, onMore }: { limit: number; onMore: () => void }) {
  const { colors } = useTheme();
  const { daily, db } = useStore();
  const entries = [
    ...daily.sessions.map((s) => ({
      id: s.id,
      title: titles[s.kind] + (s.planDay ? ` · Día ${s.planDay}` : ''),
      day: s.day,
      started: s.startedAt,
      blocks: s.blocks,
      note: s.note,
      attempt: false,
    })),
    ...db.attempts.map((a) => ({
      id: a.id,
      title: attemptTitle(a.module),
      day: localDay(new Date(a.createdAt)),
      started: a.createdAt,
      note: daily.attemptNotes[a.id],
      attempt: true,
      blocks: [
        {
          id: a.id,
          title: attemptTitle(a.module),
          seconds: a.duration,
          bpm: attemptBpm(a),
          correct: a.correct,
          total: a.total,
        },
      ] as PracticeResult[],
    })),
  ].sort((a, b) => b.started.localeCompare(a.started));
  const dates = [...new Set(entries.map((e) => e.day))].sort().reverse();

  if (dates.length === 0) return <Label muted>Tus sesiones aparecerán aquí al practicar.</Label>;
  return (
    <View style={{ gap: 20 }}>
      {dates.slice(0, limit).map((day) => {
        const group = entries.filter((e) => e.day === day);
        return (
          <View key={day} style={{ gap: 12 }}>
            <Heading level={3} style={styles.h3}>
              {new Date(`${day}T12:00:00`).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              {' · '}
              {formatTime(
                group.reduce((n, e) => n + e.blocks.reduce((sum, b) => sum + b.seconds, 0), 0),
              )}
            </Heading>
            {group.map((entry) => (
              <View
                key={entry.id}
                style={{ gap: 6, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 }}
              >
                <Text style={styles.text}>{entry.title}</Text>
                {entry.blocks.map((b) => (
                  <Label key={b.id} muted>
                    {[
                      entry.attempt ? null : b.title,
                      formatTime(b.seconds),
                      b.bpm ? `${b.bpm} BPM` : null,
                      b.rate ? `${Math.round(b.rate * 100)} % del tempo original` : null,
                      b.total ? `${b.correct}/${b.total} aciertos` : null,
                      b.skipped ? 'interrumpido' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Label>
                ))}
                <NoteEditor id={entry.id} note={entry.note} attempt={entry.attempt} />
              </View>
            ))}
          </View>
        );
      })}
      {dates.length > limit ? (
        <Button variant="secondary" onPress={onMore}>
          Ver más días
        </Button>
      ) : null}
    </View>
  );
}
