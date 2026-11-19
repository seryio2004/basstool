import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Fretboard } from '../components/Fretboard';
import { ScoreView } from '../components/ScoreView';
import {
  Badge,
  Button,
  Chips,
  Heading,
  Label,
  Toggle,
  moduleTone,
  styles,
  useTheme,
} from '../components/ui';
import { tunings } from '../core/instrument';
import {
  gradeListenPhrase,
  listenCycle,
  listenGenres,
  listenLevelOrder,
  listenRepeatLevels,
  makeListenPhrase,
  type ListenAttack,
  type ListenPhrase,
  type ListenRepeatPreset,
} from '../core/listenRepeat';
import { pitchFromSamples } from '../core/music';
import { levels } from '../core/profile';
import { eventNotes } from '../core/score';
import { uid, type AttemptInput } from '../core/types';
import { NoteEditor } from './PracticeNote';
import { useStore } from '../data/Store';
import { openListenRepeatAudio, type ListenRepeatAudio } from '../platform/listenRepeatAudio';
import { openRhythmMic, rhythmMicAvailable } from '../platform/rhythmMic';
import type { RhythmMic } from '../platform/rhythmMicTypes';

type Phase = 'idle' | 'listen' | 'repeat' | 'passed';
type Run = {
  audio?: ListenRepeatAudio;
  mic?: RhythmMic;
  timer?: ReturnType<typeof setInterval>;
  start: number;
  cycle: number;
  responseStart?: number;
  ratedResponseStart?: number;
  attacks: ListenAttack[];
};
const lookAhead = 0.045;
const revealViews = [
  { value: 'tab', label: 'Tablatura' },
  { value: 'staff', label: 'Partitura' },
  { value: 'fretboard', label: 'Mástil' },
] as const;
type RevealView = (typeof revealViews)[number]['value'];

export function ListenRepeat({
  onBack,
  preset,
  onPracticeResult,
  onActivity,
}: {
  onBack: () => void;
  preset?: ListenRepeatPreset;
  onPracticeResult?: (result: AttemptInput) => void;
  onActivity?: (active: boolean) => void;
}) {
  const { colors } = useTheme();
  const tone = moduleTone('listen-repeat');
  const { profile, saveAttempt, daily } = useStore();
  const instrument = tunings[profile!.tuning];
  const [settings, setSettings] = useState<ListenRepeatPreset>(
    () =>
      preset ?? {
        genre: 'rock',
        difficulty: profile!.level,
        chords: false,
      },
  );
  const [phrase, setPhrase] = useState(() => makeListenPhrase(settings, instrument));
  const [useMic, setUseMic] = useState(false);
  const [opening, setOpening] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [canRate, setCanRate] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [failed, setFailed] = useState<AttemptInput[]>([]);
  const [retrying, setRetrying] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>();
  const [view, setView] = useState<RevealView | null>(null);
  const [step, setStep] = useState(0);
  const [scoreWidth, setScoreWidth] = useState(0);
  const run = useRef<Run | null>(null);
  const active = useRef(true);

  function close() {
    const current = run.current;
    run.current = null;
    if (!current) return;
    clearInterval(current.timer);
    current.mic?.stop();
    current.audio?.stop();
  }

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      close();
    };
  }, []);

  function stop(next: Phase = 'idle') {
    close();
    setOpening(false);
    setCanRate(false);
    setPhase(next);
  }

  function changePhrase(next: ListenRepeatPreset, distinctFrom?: ListenPhrase) {
    stop();
    let generated = makeListenPhrase(next, instrument);
    if (distinctFrom) {
      const signature = (p: ListenPhrase) => p.tones.map((t) => (t.dead ? 'x' : t.midi)).join(',');
      for (let retry = 0; retry < 8 && signature(generated) === signature(distinctFrom); retry++)
        generated = makeListenPhrase(next, instrument);
    }
    setSettings(next);
    setPhrase(generated);
    setView(null);
    setStep(0);
    setFeedback('');
    setError('');
  }

  function storeResult(
    input: 'mic' | 'manual',
    current: Run,
    correct: number,
    total: number,
    detail: string,
    startedAt = current.start,
  ) {
    const attempt: AttemptInput = {
      id: uid(),
      module: 'listen-repeat',
      correct,
      total,
      duration: Math.max(0, Math.round(current.audio!.now() - startedAt)),
      config: {
        bpm: phrase.bpm,
        level: listenLevelOrder.indexOf(phrase.difficulty) + 1,
        instrument,
        listenRepeat: { ...settings, seed: phrase.seed, input },
      },
      detail,
    };
    if (onPracticeResult) {
      onPracticeResult(attempt);
      return;
    }
    void saveAttempt(attempt)
      .then(() => {
        if (active.current) setLastSaved(attempt.id);
      })
      .catch(() => {
        if (active.current) setFailed((items) => [...items, attempt]);
      });
  }

  async function retrySave() {
    setRetrying(true);
    try {
      for (const attempt of failed) {
        await saveAttempt(attempt);
        if (active.current) {
          setFailed((items) => items.filter((item) => item.id !== attempt.id));
          setLastSaved(attempt.id);
        }
      }
    } catch {
      // Keep the failed attempt and the remaining queue available for retry.
    } finally {
      if (active.current) setRetrying(false);
    }
  }

  async function start() {
    const target = phrase;
    if (run.current) return;
    const current: Run = { start: 0, cycle: 0, attacks: [] };
    const plan = listenCycle(target, settings.chords);
    run.current = current;
    setOpening(true);
    setFeedback('');
    setError('');
    try {
      const audio = await openListenRepeatAudio();
      if (run.current !== current) {
        audio.stop();
        return;
      }
      current.audio = audio;
      if (useMic) {
        let opened: RhythmMic | undefined;
        try {
          opened = await openRhythmMic({
            onAttack: ({ time, samples, sampleRate }) => {
              if (run.current !== current || !current.mic || !current.cycle) return;
              const relative = time - current.start - plan.repeatStart;
              if (
                relative < -listenRepeatLevels[target.difficulty].timing ||
                time >= current.start + plan.repeatEnd
              )
                return;
              current.attacks.push({
                time: relative,
                hz: samples ? pitchFromSamples(samples, sampleRate) : null,
              });
            },
            onLevel: () => {},
            onDisconnect: () => {
              if (run.current !== current) return;
              current.mic = undefined;
              current.attacks = [];
              setUseMic(false);
              setError('El micrófono se ha desconectado. Puedes seguir con la autoevaluación.');
            },
          });
          if (run.current !== current) {
            opened.stop();
            return;
          }
          current.mic = opened;
          opened.configure(35, true);
        } catch {
          opened?.stop();
          if (run.current !== current) return;
          current.mic = undefined;
          setUseMic(false);
          setError('No se pudo abrir el micrófono. Puedes seguir con la autoevaluación.');
        }
      }

      current.start = audio.now() + 0.1;
      current.cycle = 1;
      audio.schedule(plan, current.start);
      setOpening(false);
      setPhase('listen');
      current.timer = setInterval(() => {
        try {
          const now = audio.now();
          const end = current.start + plan.repeatEnd;
          if (now >= end - lookAhead) {
            // All expected attacks have a capture margin before this point.
            // Submit the next cycle against the same audio clock to preserve the pulse.
            if (current.mic && current.attacks.length) {
              const result = gradeListenPhrase(target, current.attacks);
              const extras = result.extra ? ` · ${result.extra} ataques adicionales` : '';
              const detail = `${result.correct}/${result.total} ataques a tiempo y con la altura esperada${extras}.`;
              storeResult('mic', current, result.correct, result.total + result.extra, detail);
              setFeedback(detail);
              if (result.passed) {
                stop('passed');
                return;
              }
            } else if (current.mic) {
              setFeedback('No se detectaron ataques. Vuelve a intentarlo.');
            }
            current.start = now < end ? end : now + 0.06;
            current.attacks = [];
            current.cycle++;
            audio.schedule(plan, current.start);
            // Stay in the response phase until the scheduled model starts.
          }
          const repeating = now >= current.start + plan.repeatStart;
          if (now >= current.start) setPhase(repeating ? 'repeat' : 'listen');
          if (repeating && !current.mic && current.responseStart !== current.start) {
            current.responseStart = current.start;
            setCanRate(true);
          }
        } catch {
          stop();
          setError('La reproducción se ha interrumpido. Pulsa «Escuchar» para reanudarla.');
        }
      }, 20);
    } catch (e) {
      if (run.current === current) {
        stop();
        setError((e as Error).message || 'No se pudo iniciar el audio.');
      }
    }
  }

  function rate(passed: boolean) {
    const current = run.current;
    if (
      !current ||
      current.mic ||
      current.responseStart === undefined ||
      current.responseStart === current.ratedResponseStart
    )
      return;
    current.ratedResponseStart = current.responseStart;
    setCanRate(false);
    const detail = passed
      ? 'Autoevaluación: frase conseguida.'
      : 'Autoevaluación: otra repetición.';
    storeResult('manual', current, Number(passed), 1, detail, current.responseStart);
    setFeedback(detail);
    if (passed) stop('passed');
  }

  const playing = phase === 'listen' || phase === 'repeat';
  useEffect(() => {
    onActivity?.(playing);
    return () => onActivity?.(false);
  }, [onActivity, playing]);
  const configurable = !playing && !opening;
  const steps =
    view === 'fretboard'
      ? phrase.score.measures.flatMap((bar) =>
          bar.events.flatMap((event, index) => {
            const position = eventNotes(event)[0];
            return position && !bar.events[index - 1]?.tie
              ? [{ ...position, label: event.technique === 'dead' ? '×' : String(position.fret) }]
              : [];
          }),
        )
      : [];
  const mark = steps[step];

  return (
    <View style={{ gap: 24 }}>
      {!onPracticeResult ? (
        <Button onPress={onBack} variant="ghost" icon="back" style={{ alignSelf: 'flex-start' }}>
          Volver a practicar
        </Button>
      ) : null}
      <View style={{ gap: 8, alignItems: 'flex-start' }}>
        <Heading level={1} style={styles.title}>
          Escucha y repite
        </Heading>
        <Badge color={tone.ink} background={tone.bg}>
          Entrenamiento auditivo
        </Badge>
      </View>
      <View style={[styles.panel, { gap: 16 }]}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Text accessibilityLiveRegion="polite" style={[styles.h2, { color: tone.ink }]}>
            {phase === 'listen'
              ? 'Escucha'
              : phase === 'repeat'
                ? 'Tu turno'
                : phase === 'passed'
                  ? 'Frase conseguida'
                  : 'Escucha la frase'}
          </Text>
          <Text style={styles.data}>{phrase.bpm} BPM</Text>
        </View>
        <Label muted>
          {phase === 'repeat'
            ? 'Toca la frase sobre la batería.'
            : `${phrase.bars === 1 ? 'Un compás de frase' : 'Dos compases de frase'} y dos para responder.`}
        </Label>
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {phase === 'passed' ? (
            <Button
              onPress={() =>
                onPracticeResult ? stop() : changePhrase({ ...settings, seed: undefined }, phrase)
              }
            >
              {onPracticeResult ? 'Repetir frase' : 'Nueva frase'}
            </Button>
          ) : playing ? (
            <Button onPress={() => stop()} variant="secondary">
              Parar
            </Button>
          ) : (
            <Button onPress={() => void start()} busy={opening}>
              Escuchar
            </Button>
          )}
          {!useMic && playing ? (
            <>
              <Button onPress={() => rate(true)} disabled={!canRate}>
                Lo tengo
              </Button>
              <Button onPress={() => rate(false)} disabled={!canRate} variant="secondary">
                Otra vez
              </Button>
            </>
          ) : null}
          <Button
            variant="ghost"
            onPress={() => {
              setView(view ? null : 'tab');
              setStep(0);
            }}
          >
            {view ? 'Ocultar' : 'Revelar'}
          </Button>
        </View>
        {feedback ? (
          <Text accessibilityLiveRegion="polite" style={styles.text}>
            {feedback}
          </Text>
        ) : null}
        {!playing && lastSaved ? (
          <NoteEditor key={lastSaved} id={lastSaved} note={daily.attemptNotes[lastSaved]} attempt />
        ) : null}
        {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
        {failed.length > 0 ? (
          <View style={{ gap: 8, alignItems: 'flex-start' }}>
            <Label style={{ color: colors.error }}>Hay resultados pendientes de guardar.</Label>
            <Button variant="secondary" busy={retrying} onPress={() => void retrySave()}>
              Reintentar guardado
            </Button>
          </View>
        ) : null}
      </View>

      {view ? (
        <View style={{ gap: 12 }}>
          <Chips<RevealView>
            label="Vista de la frase"
            minHeight={44}
            options={[...revealViews]}
            value={view}
            onChange={setView}
          />
          <View onLayout={(event) => setScoreWidth(event.nativeEvent.layout.width)}>
            {view === 'fretboard' && mark ? (
              <View style={{ gap: 8 }}>
                <Fretboard
                  key={Math.max(0, mark.fret - 1)}
                  instrument={instrument}
                  nomenclature={profile!.nomenclature}
                  leftHanded={profile!.leftHanded}
                  firstVisibleFret={Math.max(0, mark.fret - 1)}
                  marks={[mark]}
                />
                <View style={[styles.row, { flexWrap: 'wrap' }]}>
                  <Button
                    variant="secondary"
                    disabled={step === 0}
                    onPress={() => setStep(step - 1)}
                  >
                    Anterior
                  </Button>
                  <Label>
                    {step + 1} de {steps.length}
                    {mark.label === '×' ? ' · Nota muerta' : ''}
                  </Label>
                  <Button
                    variant="secondary"
                    disabled={step + 1 >= steps.length}
                    onPress={() => setStep(step + 1)}
                  >
                    Siguiente
                  </Button>
                </View>
              </View>
            ) : view !== 'fretboard' && scoreWidth > 0 ? (
              <ScoreView
                score={phrase.score}
                instrument={instrument}
                display={view}
                width={scoreWidth}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      {configurable ? (
        <View style={{ gap: 16 }}>
          {!onPracticeResult ? (
            <>
              <View style={{ gap: 8 }}>
                <Label>Género</Label>
                <Chips
                  label="Género"
                  minHeight={44}
                  options={[...listenGenres]}
                  value={settings.genre}
                  onChange={(genre) => {
                    if (genre !== settings.genre)
                      changePhrase({ ...settings, genre, seed: undefined });
                  }}
                />
              </View>
              <View style={{ gap: 8 }}>
                <Label>Dificultad</Label>
                <Chips
                  label="Dificultad"
                  minHeight={44}
                  options={levels}
                  value={settings.difficulty}
                  onChange={(difficulty) => {
                    if (difficulty !== settings.difficulty)
                      changePhrase({ ...settings, difficulty, seed: undefined });
                  }}
                />
              </View>
              <Toggle
                label="Acordes de acompañamiento"
                value={settings.chords}
                onChange={(chords) => setSettings({ ...settings, chords })}
              />
            </>
          ) : null}
          {rhythmMicAvailable ? (
            <Toggle
              label="Comprobar con micrófono"
              value={useMic}
              onChange={setUseMic}
              detail="Usa auriculares para que la batería no entre por el micrófono."
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
