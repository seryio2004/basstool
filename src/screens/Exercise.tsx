import { Heading } from '../components/ui';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { AttemptInput, ExerciseConfig, Module, initialConfig, modules, uid } from '../core/types';
import { seededPractice } from '../core/dailyPractice';
import { type Level } from '../core/profile';
import { buildQuestion, groovePassScore } from '../core/music';
import { NoteEditor } from './PracticeNote';
import { ListenRepeat } from './ListenRepeat';
import { RhythmExercise, type RhythmResult } from './RhythmExercise';
import { tunings } from '../core/instrument';
import { Fretboard } from '../components/Fretboard';
import { type ExerciseModality, maxFretFor, registerFor } from '../core/exercises';
import { Tab } from '../components/Tab';
import { audio } from '../platform/audio';
import {
  Badge,
  Button,
  Chips,
  Icon,
  Label,
  Staff,
  colors,
  moduleTone,
  styles,
} from '../components/ui';
import { useStore } from '../data/Store';

type Result = RhythmResult;
type ExerciseProps = {
  module: Module;
  onBack: () => void;
  preset?: ExerciseConfig;
  onPracticeResult?: (result: AttemptInput) => void;
  onActivity?: (active: boolean) => void;
};
export function Exercise(props: ExerciseProps) {
  const { module, onBack, preset, onPracticeResult, onActivity } = props;
  return module === 'listen-repeat' ? (
    <ListenRepeat
      onBack={onBack}
      preset={preset?.listenRepeat}
      onPracticeResult={onPracticeResult}
      onActivity={onActivity}
    />
  ) : (
    <OtherExercise {...props} module={module} />
  );
}

function OtherExercise({
  module,
  onBack,
  preset,
  onPracticeResult,
  onActivity,
}: ExerciseProps & { module: Exclude<Module, 'listen-repeat'> }) {
  const [result, setResult] = useState<Result | null>(null),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const { saveAttempt, profile, daily } = useStore();
  const instrument = tunings[profile!.tuning];
  const config: ExerciseConfig = {
    ...initialConfig,
    instrument: { ...instrument, strings: [...instrument.strings] },
    nomenclature: profile!.nomenclature,
    clef: 'bass',
    // El nivel limita los trastes: iniciación en primera posición, intermedio hasta el 12.
    register: registerFor(instrument, maxFretFor(profile!.level, instrument)),
    ...preset,
  };
  const description = modules.find((m) => m.id === module)!;
  const [reading, setReading] = useState<'notes' | 'rhythm'>(preset?.reading ?? 'notes');
  const [session, setSession] = useState(0);
  const [retry, setRetry] = useState<ExerciseConfig>();
  const guided = !!onPracticeResult;
  const passedGroove =
    !guided &&
    module === 'groove' &&
    result &&
    result.config.rhythmMode !== 'random' &&
    Math.round((100 * result.correct) / result.total) >= groovePassScore;
  function restart(next?: ExerciseConfig) {
    attemptId.current = uid();
    setRetry(next);
    setResult(null);
    setSaved(false);
    setError('');
    setSession((value) => value + 1);
  }
  const attemptId = useRef(uid());
  function inputFor(outcome: Result): AttemptInput {
    return { ...outcome, id: attemptId.current, module };
  }

  async function save(outcome: Result) {
    setBusy(true);
    setError('');
    try {
      await saveAttempt(inputFor(outcome));
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function receive(outcome: Result) {
    setResult(outcome);
    if (onPracticeResult) onPracticeResult(inputFor(outcome));
    else void save(outcome);
  }
  return (
    <View style={{ gap: 24 }}>
      {!guided ? (
        <Button onPress={onBack} variant="ghost" icon="back" style={{ alignSelf: 'flex-start' }}>
          Volver a practicar
        </Button>
      ) : null}
      <View style={styles.between}>
        <View style={{ gap: 8 }}>
          <Heading level={1} style={styles.title}>
            {description.title}
          </Heading>
          <Label muted>{description.subtitle}</Label>
        </View>
        <Badge background={moduleTone(module).bg} color={moduleTone(module).ink}>
          {description.category}
        </Badge>
      </View>
      {result ? (
        <View style={[styles.panel, { alignItems: 'center', paddingVertical: 42, gap: 20 }]}>
          <Icon name="check" size={36} color={colors.accentText} />
          <Heading level={2} style={styles.h2}>
            Sesión completada
          </Heading>
          <Text style={[styles.data, { fontSize: 70, lineHeight: 80, color: colors.accentText }]}>
            {Math.round((result.correct / result.total) * 100)}
            <Text style={{ fontSize: 30 }}>%</Text>
          </Text>
          <Label>
            {result.correct} de {result.total} respuestas o golpes correctos
          </Label>
          <Label muted style={{ textAlign: 'center' }}>
            {result.detail}
          </Label>
          <View style={[styles.row, { flexWrap: 'wrap', justifyContent: 'center' }]}>
            {!guided ? (
              <Button onPress={() => void save(result)} disabled={saved} busy={busy} icon="check">
                {saved
                  ? 'Resultado guardado'
                  : busy
                    ? 'Guardando resultado'
                    : 'Reintentar guardado'}
              </Button>
            ) : null}
            <Button variant="secondary" disabled={busy} onPress={() => restart(result.config)}>
              Practicar otra vez
            </Button>
            {passedGroove && result.config.level < 10 ? (
              <Button
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  restart({
                    ...result.config,
                    level: result.config.level + 1,
                    pattern: undefined,
                  })
                }
              >
                Siguiente nivel
              </Button>
            ) : null}
          </View>
          {!guided && saved ? (
            <NoteEditor
              key={attemptId.current}
              id={attemptId.current}
              note={daily.attemptNotes[attemptId.current]}
              attempt
            />
          ) : null}
          {error ? (
            <Label style={{ color: colors.error }}>
              {error} El resultado se conserva aquí; puedes reintentar el guardado.
            </Label>
          ) : null}
        </View>
      ) : (
        <>
          {module === 'reading' && !guided ? (
            <Chips
              options={[
                { value: 'notes', label: 'Lectura de notas' },
                { value: 'rhythm', label: 'Lectura rítmica' },
              ]}
              value={reading}
              onChange={(v) => {
                setReading(v);
                setRetry(undefined);
                setSession((s) => s + 1);
              }}
            />
          ) : null}
          {module === 'groove' ||
          module === 'chord-train' ||
          (module === 'reading' && reading === 'rhythm') ? (
            <RhythmExercise
              key={`${session}-${reading}`}
              config={guided ? config : (retry ?? config)}
              fixed={guided}
              onActivity={onActivity}
              variant={module}
              leftHanded={profile!.leftHanded}
              onResult={receive}
            />
          ) : (
            <Quiz
              key={session}
              module={module as 'notes' | 'intervals' | 'reading'}
              config={config}
              onActivity={onActivity}
              onResult={receive}
            />
          )}
        </>
      )}
    </View>
  );
}
function Quiz({
  module,
  config,
  onResult,
  onActivity,
}: {
  module: 'notes' | 'intervals' | 'reading';
  config: ExerciseConfig;
  onResult: (r: Result) => void;
  onActivity?: (active: boolean) => void;
}) {
  const { profile } = useStore();
  const leftHanded = profile.leftHanded;
  const levelByRank: Level[] = ['beginner', 'intermediate', 'advanced'];
  const maxFret = maxFretFor(
    config.practiceSeed ? (levelByRank[config.level - 1] ?? profile.level) : profile.level,
    config.instrument!,
  );
  const [modality, setModality] = useState<ExerciseModality>(config.modality || 'visual');
  const generate = (mode = modality, questionIndex = 0) =>
    buildQuestion(
      module,
      {
        instrument: config.instrument,
        nomenclature: config.nomenclature,
        modality: mode,
        maxFret,
      },
      config.practiceSeed ? seededPractice(`${config.practiceSeed}/${questionIndex}`) : undefined,
    );
  const [question, setQuestion] = useState(() => generate());
  const [index, setIndex] = useState(0),
    [position, setPosition] = useState(0),
    [correct, setCorrect] = useState(0),
    [answer, setAnswer] = useState<string | null>(null),
    [error, setError] = useState('');
  const started = useRef(Date.now()),
    total = module === 'reading' ? 12 : 8;
  const audioGeneration = useRef(0);
  const currentNumber = module === 'reading' ? index * 4 + position : index;
  const rightAnswer = module === 'reading' ? question.answers[position]! : question.answer;
  const stopAudio = () => {
    audioGeneration.current++;
    audio.stop();
  };
  useEffect(() => stopAudio, []);
  useEffect(() => {
    onActivity?.(true);
    return () => onActivity?.(false);
  }, [onActivity]);

  async function listen(notes = question.notes) {
    const token = ++audioGeneration.current;
    try {
      setError('');
      await audio.ready();
      if (token !== audioGeneration.current) return;
      audio.stop();
      const t = audio.now() + 0.1;
      notes.forEach((note, i) => audio.tone(note, t + i * 0.65, 0.5));
    } catch (e) {
      if (token === audioGeneration.current) setError((e as Error).message);
    }
  }
  function choose(value: string) {
    if (answer !== null) return;
    setAnswer(value);
    if (value === rightAnswer) setCorrect((c) => c + 1);
  }
  function next() {
    if (currentNumber + 1 >= total) {
      onResult({
        correct,
        total,
        duration: Math.round((Date.now() - started.current) / 1000),
        config: { ...config, modality, reading: module === 'reading' ? 'notes' : undefined },
        detail: `${modality === 'ear' ? 'Reconocimiento auditivo' : modality === 'fretboard' ? 'Notas en el mástil' : modality === 'tab' ? 'Lectura de tablatura' : 'Lectura en clave de fa'} · ${config.instrument!.name} · ${total} respuestas`,
      });
      return;
    }
    if (module === 'reading' && position < 3) setPosition((p) => p + 1);
    else {
      setPosition(0);
      setIndex((i) => i + 1);
      setQuestion(generate(modality, index + 1));
    }
    setAnswer(null);
    stopAudio();
  }
  return (
    <View style={styles.panel}>
      <View style={styles.between}>
        <Text style={styles.h3}>
          {module === 'reading'
            ? `Frase ${index + 1} de 3 · nota ${position + 1} de 4`
            : `Pregunta ${index + 1} de ${total}`}
        </Text>
        <Label muted>{correct} aciertos</Label>
      </View>
      <View style={{ height: 5, borderRadius: 5, backgroundColor: colors.sunken }}>
        <View
          style={{
            height: 5,
            borderRadius: 5,
            width: `${(currentNumber / total) * 100}%`,
            backgroundColor: colors.accent,
          }}
        />
      </View>
      {!config.practiceSeed ? (
        <Chips<ExerciseModality>
          options={[
            { value: 'visual', label: 'Clave de fa' },
            ...(module === 'reading'
              ? [{ value: 'tab' as const, label: 'Tablatura' }]
              : [{ value: 'ear' as const, label: 'De oído' }]),
            ...(module === 'notes' ? [{ value: 'fretboard' as const, label: 'Mástil' }] : []),
          ]}
          value={modality}
          onChange={(v) => {
            setModality(v);
            setCorrect(0);
            setIndex(0);
            setPosition(0);
            setAnswer(null);
            setQuestion(generate(v));
            started.current = Date.now();
            stopAudio();
          }}
        />
      ) : null}
      <View style={{ paddingVertical: 20, gap: 14 }}>
        <Text style={[styles.h2, { textAlign: 'center' }]}>
          {module === 'intervals'
            ? '¿Qué intervalo separa estas notas?'
            : module === 'reading'
              ? 'Identifica la nota marcada, de izquierda a derecha'
              : modality === 'ear'
                ? '¿Qué nota escuchas?'
                : 'Identifica la nota'}
        </Text>
        {modality === 'fretboard' && question.position ? (
          <View style={{ gap: 10 }}>
            <Fretboard
              instrument={config.instrument!}
              nomenclature={config.nomenclature ?? 'latin'}
              leftHanded={leftHanded}
              marks={[
                {
                  ...question.position,
                  label: '?',
                  root: true,
                  description: `Nota por identificar`,
                },
              ]}
            />
            <Label muted style={{ textAlign: 'center' }}>
              {question.prompt}
            </Label>
          </View>
        ) : modality === 'tab' ? (
          <Tab
            notes={question.scoreNotes}
            instrument={config.instrument!}
            nomenclature={config.nomenclature}
            active={position}
          />
        ) : modality === 'visual' ? (
          <Staff
            notes={question.scoreNotes}
            clef="bass"
            octaveShift={1}
            active={module === 'reading' ? position : -1}
          />
        ) : (
          <View style={{ alignItems: 'center', padding: 30 }}>
            <Icon name="ear" size={60} color={colors.accentText} />
          </View>
        )}
        <Button
          variant="secondary"
          icon="play"
          onPress={() => void listen()}
          style={{ alignSelf: 'center' }}
        >
          {module === 'notes' && modality === 'ear' ? 'Escuchar nota' : 'Escuchar ejemplo'}
        </Button>
        {module === 'notes' && modality === 'ear' ? (
          <Label muted style={{ textAlign: 'center' }}>
            Sin referencia: reconocimiento de altura absoluta. Puedes escuchar Do4 como referencia.
          </Label>
        ) : null}
        {module === 'notes' && modality === 'ear' ? (
          <Button variant="ghost" onPress={() => void listen([60])}>
            Escuchar Do4 de referencia
          </Button>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {question.choices.map((choice) => {
          const right = answer !== null && choice === rightAnswer,
            wrong = answer === choice && !right;
          return (
            <Pressable
              accessibilityRole="button"
              key={choice}
              disabled={answer !== null}
              onPress={() => choose(choice)}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
                flexGrow: 1,
                flexBasis: module === 'intervals' ? '28%' : '20%',
                minHeight: 58,
                borderRadius: 9,
                borderWidth: 1,
                borderColor: right ? colors.success : wrong ? colors.error : colors.line,
                backgroundColor: right
                  ? colors.successSoft
                  : wrong
                    ? colors.errorSoft
                    : hovered
                      ? colors.accentSoft
                      : colors.raised,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text
                style={{
                  fontSize: 17,
                  color: wrong ? colors.error : colors.ink,
                  fontWeight: '500',
                }}
              >
                {choice}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {answer !== null ? (
        <View style={styles.between}>
          <Label style={{ color: answer === rightAnswer ? colors.accentText : colors.error }}>
            {answer === rightAnswer ? 'Correcto.' : `La respuesta es ${rightAnswer}.`}
          </Label>
          <Button onPress={next} icon="arrow">
            {currentNumber + 1 === total ? 'Ver resultado' : 'Continuar'}
          </Button>
        </View>
      ) : (
        <Label muted>Elige una respuesta para continuar.</Label>
      )}
      {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
    </View>
  );
}
