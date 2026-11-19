import { Heading } from '../components/ui';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { AttemptInput, ExerciseConfig, Module, initialConfig, modules, uid } from '../core/types';
import { buildQuestion, expectedHits, figurePool, makePattern } from '../core/music';
import { tunings, range } from '../core/instrument';
import { type ExerciseModality } from '../core/exercises';
import { Tab } from '../components/Tab';
import { analyseHits } from '../core/rhythm';
import { audio } from '../platform/audio';
import { onSpace } from '../platform/keyboard';
import {
  Badge,
  Button,
  Chips,
  Field,
  Icon,
  Label,
  RhythmFigure,
  Staff,
  colors,
  styles,
} from '../components/ui';
import { useStore } from '../data/Store';

type Result = {
  correct: number;
  total: number;
  duration: number;
  config: ExerciseConfig;
  detail: string;
};
export function Exercise({ module, onBack }: { module: Module; onBack: () => void }) {
  const [result, setResult] = useState<Result | null>(null),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const { saveAttempt, profile } = useStore();
  const instrument = tunings[profile!.tuning];
  const config: ExerciseConfig = {
    ...initialConfig,
    instrument: { ...instrument, strings: [...instrument.strings] },
    nomenclature: profile!.nomenclature,
    clef: 'bass',
    register: range(instrument),
  };
  const description = modules.find((m) => m.id === module)!;
  const [reading, setReading] = useState<'notes' | 'rhythm'>('notes');
  const [session, setSession] = useState(0);
  const attemptId = useRef(uid());
  async function save() {
    if (!result || busy || saved) return;
    setBusy(true);
    setError('');
    try {
      const input: AttemptInput = {
        ...result,
        id: attemptId.current,
        config: result.config,
        module,
      };
      await saveAttempt(input);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 24 }}>
      <Button onPress={onBack} variant="ghost" icon="back" style={{ alignSelf: 'flex-start' }}>
        Volver a practicar
      </Button>
      <View style={styles.between}>
        <View style={{ gap: 8 }}>
          <Heading level={1} style={styles.title}>
            {description.title}
          </Heading>
          <Label muted>{description.subtitle}</Label>
        </View>
        <Badge background={description.background} color={description.color}>
          {description.category}
        </Badge>
      </View>
      {result ? (
        <View style={[styles.panel, { alignItems: 'center', paddingVertical: 42, gap: 20 }]}>
          <Icon name="check" size={36} color={colors.green} />
          <Heading level={2} style={styles.h2}>
            Sesión completada
          </Heading>
          <Text style={{ fontSize: 70, fontWeight: '600', color: colors.green }}>
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
            <Button onPress={() => void save()} disabled={saved} busy={busy} icon="check">
              {saved ? 'Resultado guardado' : 'Guardar resultado'}
            </Button>
            <Button
              variant="secondary"
              onPress={() => {
                attemptId.current = uid();
                setResult(null);
                setSaved(false);
                setError('');
                setSession((v) => v + 1);
              }}
            >
              Practicar otra vez
            </Button>
          </View>
          {error ? (
            <Label style={{ color: colors.error }}>
              {error} El resultado se conserva aquí; puedes reintentar el guardado.
            </Label>
          ) : null}
        </View>
      ) : (
        <>
          {module === 'reading' ? (
            <Chips
              options={[
                { value: 'notes', label: 'Lectura de notas' },
                { value: 'rhythm', label: 'Lectura rítmica' },
              ]}
              value={reading}
              onChange={(v) => {
                setReading(v);
                setSession((s) => s + 1);
              }}
            />
          ) : null}
          {module === 'groove' || (module === 'reading' && reading === 'rhythm') ? (
            <Groove
              key={`${session}-${reading}`}
              config={config}
              reading={module === 'reading'}
              onResult={setResult}
            />
          ) : (
            <Quiz
              key={session}
              module={module as 'notes' | 'intervals' | 'reading'}
              config={config}
              onResult={setResult}
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
}: {
  module: 'notes' | 'intervals' | 'reading';
  config: ExerciseConfig;
  onResult: (r: Result) => void;
}) {
  const [modality, setModality] = useState<ExerciseModality>(config.modality || 'visual');
  const generate = (mode = modality) =>
    buildQuestion(module, {
      instrument: config.instrument,
      nomenclature: config.nomenclature,
      modality: mode,
    });
  const [question, setQuestion] = useState(() => generate());
  const [index, setIndex] = useState(0),
    [position, setPosition] = useState(0),
    [correct, setCorrect] = useState(0),
    [answer, setAnswer] = useState<string | null>(null),
    [error, setError] = useState('');
  const started = useRef(Date.now()),
    total = module === 'reading' ? 12 : 8;
  const currentNumber = module === 'reading' ? index * 4 + position : index;
  const rightAnswer = module === 'reading' ? question.answers[position]! : question.answer;
  useEffect(() => () => audio.stop(), []);
  async function listen() {
    try {
      setError('');
      await audio.ready();
      audio.stop();
      const t = audio.now() + 0.1;
      question.notes.forEach((note, i) => audio.tone(note, t + i * 0.65, 0.5));
    } catch (e) {
      setError((e as Error).message);
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
      setQuestion(generate());
    }
    setAnswer(null);
    audio.stop();
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
      <View style={{ height: 5, borderRadius: 5, backgroundColor: '#EEF1EB' }}>
        <View
          style={{
            height: 5,
            borderRadius: 5,
            width: `${(currentNumber / total) * 100}%`,
            backgroundColor: colors.green,
          }}
        />
      </View>
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
          audio.stop();
        }}
      />
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
        {modality === 'fretboard' ? (
          <Label style={{ textAlign: 'center' }}>{question.prompt}</Label>
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
            <Icon name="ear" size={60} color={colors.green} />
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
          <Button
            variant="ghost"
            onPress={() => {
              void audio
                .ready()
                .then(() => audio.tone(60, audio.now() + 0.05, 0.5))
                .catch((e) => setError(e.message));
            }}
          >
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
                borderColor: right ? colors.green : wrong ? '#B44F45' : colors.line,
                backgroundColor: right
                  ? colors.pale
                  : wrong
                    ? '#F9EBE8'
                    : hovered
                      ? '#F2F5EF'
                      : colors.white,
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
          <Label style={{ color: answer === rightAnswer ? colors.green : colors.error }}>
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
function Groove({
  config,
  reading,
  onResult,
}: {
  config: ExerciseConfig;
  reading: boolean;
  onResult: (r: Result) => void;
}) {
  const length = reading ? 4 : 16;
  const [pattern, setPattern] = useState(
    () => config.pattern?.slice(0, length) || makePattern(config.level, length),
  );
  const [bpm, setBpm] = useState(String(config.bpm)),
    [level, setLevel] = useState(String(config.level)),
    [playing, setPlaying] = useState(false),
    [phase, setPhase] = useState('Listo para practicar'),
    [active, setActive] = useState(-1),
    [hitCount, setHitCount] = useState(0),
    [error, setError] = useState('');
  const session = useRef<{
    start: number;
    turn: number;
    end: number;
    hits: number[];
    challenge: boolean;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null),
    generation = useRef(0),
    launching = useRef(false);
  const { width } = useWindowDimensions();
  const tap = useRef(() => {});
  tap.current = () => {
    const s = session.current;
    if (!s || !s.challenge) return;
    const offset = audio.now() - s.turn;
    if (offset < -0.12 || audio.now() > s.end + 0.12) return;
    if (s.hits.some((t) => Math.abs(t - offset) < 0.025)) return;
    s.hits.push(offset);
    setHitCount(s.hits.length);
  };
  function stop() {
    generation.current++;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    audio.stop();
    session.current = null;
    launching.current = false;
    setPlaying(false);
    setActive(-1);
    setPhase('Sesión detenida');
  }
  useEffect(() => {
    const remove = onSpace(() => tap.current());
    return () => {
      remove();
      generation.current++;
      if (timer.current) clearInterval(timer.current);
      audio.stop();
      session.current = null;
    };
  }, []);
  async function start(challenge: boolean) {
    if (launching.current || session.current) return;
    launching.current = true;
    const token = ++generation.current;
    setError('');
    try {
      await audio.ready();
      if (token !== generation.current) return;
      const beat = 60 / Number(bpm),
        startTime = audio.now() + 0.18;
      const sampleStart = startTime + 4 * beat,
        listenEnd = sampleStart + length * beat;
      const turn = reading ? sampleStart : listenEnd + 4 * beat,
        end = challenge ? turn + length * beat : listenEnd;
      session.current = { start: startTime, turn, end, hits: [], challenge };
      setPlaying(true);
      setHitCount(0);
      for (let i = 0; i < Math.ceil((end - startTime) / beat - 0.0001); i++)
        audio.click(startTime + i * beat, i % 4 === 0);
      if (!reading || !challenge)
        expectedHits(pattern, Number(bpm)).forEach((note) =>
          audio.tone(48, sampleStart + note.t, 0.08, 0.23),
        );
      timer.current = setInterval(() => {
        const s = session.current;
        if (!s) return;
        const now = audio.now();
        if (now < sampleStart) {
          setPhase(`Prepárate · ${Math.max(1, Math.floor((now - startTime) / beat) + 1)} / 4`);
          setActive(-1);
        } else if ((!reading && now < listenEnd) || (!challenge && now < listenEnd)) {
          setPhase('Escucha el patrón');
          setActive(Math.min(length - 1, Math.floor((now - sampleStart) / beat)));
        } else if (now < turn) {
          setPhase(`Tu turno en ${Math.max(1, Math.ceil((turn - now) / beat))}`);
          setActive(-1);
        } else if (now < end) {
          setPhase('Tu turno · toca el patrón');
          setActive(Math.min(length - 1, Math.floor((now - turn) / beat)));
        }
        if (now >= end + 0.12) {
          const hits = [...s.hits];
          stop();
          if (!challenge) {
            setPhase('Ejemplo completado');
            return;
          }
          const expected = expectedHits(pattern, Number(bpm));
          const analysis = analyseHits(expected, hits, Math.min(0.12, beat * 0.24), beat);
          const count = analysis.matched.length,
            extras = hits.length - count,
            missed = expected.length - count;
          const mean = count
            ? Math.round((analysis.matched.reduce((n, m) => n + m.delta, 0) / count) * 1000)
            : 0;
          onResult({
            correct: count,
            total: Math.max(expected.length, hits.length),
            duration: Math.round(end - startTime),
            config: {
              ...config,
              bpm: Number(bpm),
              level: Number(level),
              pattern: [...pattern],
              reading: reading ? 'rhythm' : undefined,
            },
            detail: `${missed} golpes perdidos · ${extras} golpes extra · ${count ? `desviación media ${mean > 0 ? '+' : ''}${mean} ms` : 'sin golpes coincidentes'}`,
          });
        }
      }, 20);
    } catch (e) {
      setError((e as Error).message);
      stop();
    } finally {
      launching.current = false;
    }
  }
  const valid = Number(bpm) >= 40 && Number(bpm) <= 180;
  return (
    <View style={styles.panel}>
      <View style={styles.between}>
        <View style={{ gap: 6 }}>
          <Heading level={2} style={styles.h2}>
            {phase}
          </Heading>
          <Label muted>
            {reading
              ? 'Lee las figuras y toca con el metrónomo después de cuatro pulsos.'
              : 'Escucha 16 pulsos y repite el patrón después de la cuenta de entrada.'}
          </Label>
        </View>
        <Badge>{hitCount} golpes</Badge>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {pattern.map((id, i) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Bloque ${i + 1}: ${figurePool[id]!.name}. Cambiar figura`}
            disabled={playing}
            onPress={() =>
              setPattern((p) => p.map((n, j) => (i === j ? (n + 1) % figurePool.length : n)))
            }
            key={i}
            style={{
              width: width < 650 ? '22%' : reading ? '22%' : '11%',
              minHeight: 88,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              borderRadius: 8,
              backgroundColor: active === i ? colors.green : '#F1F4ED',
            }}
          >
            <RhythmFigure id={id} color={active === i ? 'white' : colors.ink} size={55} />
            <Text style={{ color: active === i ? 'white' : colors.muted, fontSize: 10 }}>
              {i + 1}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ height: 7, backgroundColor: '#E4EAE0', borderRadius: 5 }}>
        <View
          style={{
            height: 7,
            borderRadius: 5,
            backgroundColor: colors.green,
            width: `${active < 0 ? 0 : ((active + 1) / length) * 100}%`,
          }}
        />
      </View>
      <View style={[styles.row, { flexWrap: 'wrap', alignItems: 'flex-end' }]}>
        <View style={{ width: 125 }}>
          <Field
            label="Tempo (40–180)"
            value={bpm}
            onChangeText={(v) => {
              if (!playing) setBpm(v.replace(/\D/g, '').slice(0, 3));
            }}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1, gap: 7, minWidth: 180 }}>
          <Label muted>Dificultad</Label>
          <Chips
            value={level}
            onChange={(v) => {
              if (!playing) {
                setLevel(v);
                setPattern(makePattern(Number(v), length));
              }
            }}
            options={[
              { value: '1', label: 'Inicial' },
              { value: '3', label: 'Intermedia' },
              { value: '7', label: 'Avanzada' },
            ]}
          />
        </View>
      </View>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Button disabled={playing || !valid} icon="play" onPress={() => void start(true)}>
          Empezar ejercicio
        </Button>
        <Button
          disabled={playing || !valid}
          variant="secondary"
          icon="ear"
          onPress={() => void start(false)}
        >
          Escuchar
        </Button>
        {playing ? (
          <Button variant="danger" onPress={stop}>
            Detener
          </Button>
        ) : (
          <Button variant="ghost" onPress={() => setPattern(makePattern(Number(level), length))}>
            Nuevo patrón
          </Button>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Registrar golpe. También puedes pulsar espacio fuera de los controles."
        onPressIn={() => tap.current()}
        style={({ pressed }) => ({
          padding: 25,
          borderRadius: 10,
          backgroundColor: pressed ? '#234F39' : colors.pale,
          alignItems: 'center',
        })}
      >
        <Text style={{ color: colors.green, fontSize: 18, fontWeight: '600' }}>Tocar</Text>
        <Text style={{ color: colors.green, fontSize: 12, marginTop: 6 }}>
          Pulsa aquí o usa la barra espaciadora
        </Text>
      </Pressable>
      <Label muted>
        Pulsa una figura para editarla antes de empezar. Entrada por pantalla o teclado; el
        micrófono rítmico no está incluido en esta fase.
      </Label>
      {!valid ? (
        <Label style={{ color: colors.error }}>Introduce un tempo entre 40 y 180 BPM.</Label>
      ) : null}
      {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
    </View>
  );
}
