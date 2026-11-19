import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Fretboard } from '../components/Fretboard';
import { GrooveTrain } from '../components/GrooveTrain';
import {
  Badge,
  Button,
  Chips,
  Field,
  Heading,
  Label,
  RhythmFigure,
  colors,
  styles,
} from '../components/ui';
import {
  manualTrainChords,
  scoreTrain,
  tonalTrainChords,
  trainTargets,
  trainTones,
  type Chord,
  type RhythmHit,
  type RhythmInput,
} from '../core/chordTrain';
import { figurePool, makePattern, pitchFromSamples } from '../core/music';
import { fifthsCircle, pitchName } from '../core/notation';
import { majorProgressions, positionsFor } from '../core/theory';
import type { ExerciseConfig } from '../core/types';
import { audio } from '../platform/audio';
import { onSpace } from '../platform/keyboard';
import { openRhythmMic, rhythmMicAvailable } from '../platform/rhythmMic';
import type { RhythmMic } from '../platform/rhythmMicTypes';
import { grooveColors as palette } from '../theme/groove';

export type RhythmResult = {
  correct: number;
  total: number;
  duration: number;
  config: ExerciseConfig;
  detail: string;
};

type Segment = { start: number; end: number };
type Session = {
  turn: number;
  end: number;
  hits: RhythmHit[];
  challenge: boolean;
  input: RhythmInput;
  offset: number;
  tolerance: number;
};

const levels = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));
const chordLevels = [
  { value: '1', label: 'Fundamental', guide: 'Toca la fundamental de cada acorde.' },
  {
    value: '2',
    label: 'Fundamental y quinta',
    guide: 'Alterna fundamental y quinta. Vuelve a la fundamental cuando cambie el acorde.',
  },
  {
    value: '3',
    label: 'Arpegio',
    guide: 'Toca las notas del arpegio en orden desde la fundamental. Puedes elegir la octava.',
  },
  {
    value: '4',
    label: 'Línea libre',
    guide: 'Elige cualquier nota del acorde en cada ataque escrito.',
  },
];

function chordLabel(chord: Chord, nomenclature: NonNullable<ExerciseConfig['nomenclature']>) {
  return pitchName(chord.tonic + '4', false, nomenclature) + chord.symbol.slice(chord.tonic.length);
}

function newPattern(level: number, length: number, harmonic: boolean) {
  if (!harmonic) return makePattern(level, length);
  if (level <= 2) return Array<number>(length).fill(level === 1 ? 5 : 0);
  // These levels focus on pitch; leave the fastest figures to manual editing.
  return makePattern(level === 3 ? 1 : 3, length);
}

export function RhythmExercise({
  config,
  variant,
  leftHanded,
  onResult,
}: {
  config: ExerciseConfig;
  variant: 'groove' | 'reading' | 'chord-train';
  leftHanded: boolean;
  onResult: (result: RhythmResult) => void;
}) {
  const reading = variant === 'reading';
  const harmonic = variant === 'chord-train';
  const length = reading ? 4 : 16;
  const initialLevel = Math.max(1, Math.min(harmonic ? 4 : 10, config.level));
  const [pattern, setPattern] = useState(() =>
    config.pattern?.length === length
      ? [...config.pattern]
      : newPattern(initialLevel, length, harmonic),
  );
  const [bpm, setBpm] = useState(String(config.bpm));
  const [level, setLevel] = useState(String(initialLevel));
  const [random, setRandom] = useState(variant === 'groove' && config.rhythmMode === 'random');
  const [phase, setPhase] = useState('Listo para practicar');
  const [active, setActive] = useState(-1);
  const [segment, setSegment] = useState<Segment | null>(null);
  const [hitCount, setHitCount] = useState(0);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [opening, setOpening] = useState(false);
  const [input, setInput] = useState<RhythmInput>('manual');
  const [sensitivity, setSensitivity] = useState(String(config.micSensitivity ?? 35));
  const [offset, setOffset] = useState(String(config.micOffsetMs ?? 0));
  const [meter, setMeter] = useState({ rms: 0, loud: false });
  const [tonic, setTonic] = useState('C');
  const [progression, setProgression] = useState(majorProgressions[0]!.value);
  const [source, setSource] = useState(config.chords ? 'manual' : 'tonal');
  const [symbols, setSymbols] = useState(config.chords?.join(' ') ?? 'C G Am F');
  const microphone = useRef<RhythmMic | null>(null);
  const micGeneration = useRef(0);
  const session = useRef<Session | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const generation = useRef(0);
  const launching = useRef(false);
  const { width } = useWindowDimensions();
  const nomenclature = config.nomenclature ?? 'latin';
  const chords = useMemo(
    () =>
      harmonic
        ? source === 'manual'
          ? manualTrainChords(symbols)
          : tonalTrainChords(tonic, progression)
        : undefined,
    [harmonic, source, symbols, tonic, progression],
  );
  const currentChord = chords?.[Math.max(active, 0)];
  const instrument = config.instrument;
  const marks = useMemo(
    () =>
      currentChord && instrument
        ? positionsFor(
            currentChord.tonic,
            { ...currentChord.arpeggio, tones: trainTones(currentChord, Number(level)) },
            instrument,
            undefined,
            nomenclature,
          ).map(({ string, fret, name, isRoot, degreeLabel }) => ({
            string,
            fret,
            label: name,
            root: isRoot,
            description: `${name}, grado ${degreeLabel}`,
          }))
        : [],
    [currentChord, instrument, level, nomenclature],
  );

  function stop() {
    generation.current++;
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
    audio.stop();
    session.current = null;
    microphone.current?.configure(Number(sensitivity), false);
    launching.current = false;
    setPlaying(false);
    setActive(-1);
    setSegment(null);
    setPhase('Sesión detenida');
  }

  useEffect(
    () => () => {
      generation.current++;
      micGeneration.current++;
      if (timer.current !== null) clearInterval(timer.current);
      session.current = null;
      audio.stop();
      microphone.current?.stop();
    },
    [],
  );

  function recordHit(capturedTime: number, source: RhythmInput, midi?: number | null) {
    const run = session.current;
    if (!run?.challenge || run.input !== source) return;
    const t = capturedTime - run.turn - (source === 'mic' ? run.offset : 0);
    if (t < -run.tolerance || t > run.end - run.turn + run.tolerance) return;
    if (run.hits.some((hit) => Math.abs(hit.t - t) < 0.025)) return;
    run.hits.push({ t, midi });
    setHitCount(run.hits.length);
  }

  useEffect(() => {
    if (playing && input === 'manual') return onSpace(() => recordHit(audio.now(), 'manual'));
  }, [playing, input]);

  function disconnectMic() {
    micGeneration.current++;
    microphone.current?.stop();
    microphone.current = null;
    setOpening(false);
    setInput('manual');
    setMeter({ rms: 0, loud: false });
  }

  async function connectMic() {
    const token = ++micGeneration.current;
    setOpening(true);
    setError('');
    try {
      const opened = await openRhythmMic({
        onAttack: ({ time, samples, sampleRate }) => {
          const run = session.current;
          if (token !== micGeneration.current || !run?.challenge || run.input !== 'mic') return;
          const corrected = time - run.offset;
          if (corrected < run.turn - run.tolerance || corrected > run.end + run.tolerance) return;
          const hz = samples && pitchFromSamples(samples, sampleRate);
          recordHit(time, 'mic', hz ? Math.round(69 + 12 * Math.log2(hz / 440)) : null);
        },
        onLevel: (rms, threshold) => {
          if (!session.current && token === micGeneration.current)
            setMeter({ rms, loud: rms > threshold });
        },
        onDisconnect: () => {
          if (token !== micGeneration.current) return;
          if (session.current?.input === 'mic' && session.current.challenge) stop();
          disconnectMic();
          setError('El micrófono se ha desconectado. Puedes seguir con el botón o el teclado.');
        },
      });
      if (token !== micGeneration.current) {
        opened.stop();
        return;
      }
      microphone.current = opened;
      opened.configure(Number(sensitivity), false);
      setInput('mic');
    } catch (cause) {
      if (token === micGeneration.current) setError((cause as Error).message);
    } finally {
      if (token === micGeneration.current) setOpening(false);
    }
  }

  const validBpm = Number(bpm) >= 40 && Number(bpm) <= 180;
  const validMic =
    input !== 'mic' ||
    (sensitivity !== '' &&
      Number(sensitivity) >= 8 &&
      Number(sensitivity) <= 90 &&
      /^-?\d+$/.test(offset) &&
      Number(offset) >= -120 &&
      Number(offset) <= 300);

  const canStart = !playing && !opening && validBpm && validMic && chords !== null;

  function regenerate(atLevel = Number(level)) {
    const nextLevel = random ? 1 + Math.floor(Math.random() * 10) : atLevel;
    setLevel(String(nextLevel));
    setPattern(newPattern(nextLevel, length, harmonic));
  }

  async function start(challenge: boolean) {
    if (launching.current || session.current || !canStart) return;
    const token = ++generation.current;
    launching.current = true;
    setPlaying(true);
    setError('');
    try {
      await audio.ready();
      if (token !== generation.current) return;
      const tempo = Number(bpm);
      const beat = 60 / tempo;
      const startAt = audio.now() + 0.18;
      const listen = { start: startAt + 4 * beat, end: startAt + (4 + length) * beat };
      const turn = reading ? listen.start : listen.end + 4 * beat;
      const end = challenge ? turn + length * beat : listen.end;
      const response = { start: turn, end };
      const expected = trainTargets(pattern, tempo, chords, Number(level));
      const tolerance = reading
        ? Math.min(0.12, beat * 0.24)
        : Math.min(
            0.135,
            (0.45 * beat) / Math.max(...pattern.map((id) => figurePool[id]!.notes.length)),
          );
      session.current = {
        turn,
        end,
        challenge,
        input,
        hits: [],
        offset: Number(offset) / 1000,
        tolerance,
      };
      microphone.current?.configure(Number(sensitivity), harmonic && challenge);
      setHitCount(0);
      const beats = Math.round((end - startAt) / beat);
      for (let i = 0; i < beats; i++) audio.click(startAt + i * beat, i % 4 === 0);
      if (!reading || !challenge) {
        for (const [index, note] of expected.entries()) {
          const chord = chords?.[note.block];
          const pitch = expected[index]!.pitches?.[0] ?? chord?.root;
          const next = expected[index + 1]?.t ?? length * beat;
          const duration = Math.min(0.22, (next - note.t) * 0.8);
          audio.tone(pitch === undefined ? 48 : 36 + pitch, listen.start + note.t, duration, 0.23);
        }
      }
      const update = () => {
        const run = session.current;
        if (!run) return;
        const now = audio.now();
        const listening = (!reading || !challenge) && now >= listen.start && now < listen.end;
        const responding = challenge && now >= turn && now < end;
        const point = listening ? listen : responding ? response : null;
        if (now < end) {
          setSegment(point);
          setActive(point ? Math.min(length - 1, Math.floor((now - point.start) / beat)) : -1);
        }
        if (now < listen.start) {
          setPhase(`Prepárate · ${Math.max(1, Math.floor((now - startAt) / beat) + 1)} / 4`);
        } else if (listening) {
          setPhase('Escucha el patrón');
        } else if (now < turn && challenge) {
          setPhase(`Tu turno en ${Math.max(1, Math.ceil((turn - now) / beat))}`);
        } else if (responding) {
          setPhase('Tu turno · toca el patrón');
        }
        // The worklet returns the original timestamp after gathering a pitch window.
        const captureTail = challenge && input === 'mic' ? Math.max(0, run.offset) + 0.16 : 0;
        if (now < end + tolerance + captureTail) return;
        stop();
        if (!challenge) {
          setPhase('Ejemplo completado');
          return;
        }
        const pitchChecked = harmonic && input === 'mic';
        const { correct, total, missed, extras, wrongPitch, bias } = scoreTrain(
          expected,
          run.hits,
          tolerance,
          beat,
          pitchChecked,
        );
        const detail = [
          `${missed} golpes perdidos`,
          `${extras} golpes extra`,
          ...(pitchChecked ? [`${wrongPitch} alturas incorrectas o sin detectar`] : []),
          bias === null
            ? 'sin golpes coincidentes'
            : `desviación media ${bias > 0 ? '+' : ''}${bias} ms`,
        ].join(' · ');
        onResult({
          correct,
          total,
          detail,
          duration: Math.round(end - startAt),
          config: {
            ...config,
            bpm: tempo,
            level: Number(level),
            pattern: [...pattern],
            chords: chords?.map(({ symbol }) => symbol),
            reading: reading ? 'rhythm' : undefined,
            rhythmInput: input,
            rhythmVersion: 1,
            micSensitivity: input === 'mic' ? Number(sensitivity) : undefined,
            micOffsetMs: input === 'mic' ? Number(offset) : undefined,
            rhythmMode: variant === 'groove' ? (random ? 'random' : 'levels') : undefined,
          },
        });
      };
      update();
      timer.current = setInterval(update, 25);
    } catch (cause) {
      if (token !== generation.current) return;
      setError((cause as Error).message);
      stop();
    } finally {
      if (token === generation.current) launching.current = false;
    }
  }

  const columns = reading || width < 740 ? 4 : 8;
  const trackRows = Array.from({ length: length / columns }, (_, row) =>
    pattern.slice(row * columns, (row + 1) * columns),
  );
  return (
    <View style={{ gap: 18 }}>
      <View
        style={[
          styles.panel,
          !reading && { backgroundColor: palette.yellow, borderColor: palette.ink, padding: 14 },
        ]}
      >
        <View style={styles.between}>
          <Heading level={2} style={[styles.h2, !reading && { color: palette.ink }]}>
            {phase}
          </Heading>
          <Badge
            background={reading ? undefined : palette.cream}
            color={reading ? undefined : palette.ink}
          >
            {hitCount} golpes
          </Badge>
        </View>
        <Label style={reading ? undefined : { color: palette.ink }}>
          {reading
            ? 'Lee las figuras y toca después de cuatro pulsos.'
            : 'Escucha 16 pulsos y repite el patrón después de la cuenta de entrada.'}
        </Label>
        <View style={{ gap: 8 }}>
          {trackRows.map((row, index) => (
            <View key={index} style={{ flexDirection: 'row', gap: 6 }}>
              {row.map((id, column) => {
                const i = index * columns + column;
                const chord = chords?.[i];
                const label = chord ? chordLabel(chord, nomenclature) : undefined;
                const selected = i === active;
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityLabel={`Pulso ${i + 1}, ${label ? label + ', ' : ''}${figurePool[id]!.name}. Cambiar figura`}
                    accessibilityState={{ selected, disabled: playing }}
                    disabled={playing}
                    onPress={() =>
                      setPattern((current) =>
                        current.map((figure, j) =>
                          j === i ? (figure + 1) % figurePool.length : figure,
                        ),
                      )
                    }
                    style={({ pressed }) => ({
                      flex: 1,
                      minWidth: 0,
                      minHeight: 58,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      borderWidth: 2,
                      opacity: pressed ? 0.68 : 1,
                      borderColor: reading ? 'transparent' : selected ? palette.ink : palette.cream,
                      backgroundColor: reading
                        ? selected
                          ? colors.green
                          : colors.pale
                        : selected
                          ? palette.cream
                          : palette.tiles[i % palette.tiles.length],
                    })}
                  >
                    {label ? (
                      <Text style={{ color: palette.ink, fontWeight: '700', textAlign: 'center' }}>
                        {label}
                      </Text>
                    ) : null}
                    <RhythmFigure
                      id={id}
                      color={reading && selected ? colors.white : palette.ink}
                      size={42}
                    />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        {reading ? (
          <View style={{ height: 6, backgroundColor: colors.pale, borderRadius: 5 }}>
            <View
              style={{
                height: 6,
                borderRadius: 5,
                backgroundColor: colors.green,
                width: `${(Math.max(0, active + 1) / length) * 100}%`,
              }}
            />
          </View>
        ) : (
          <GrooveTrain active={active} segment={segment} />
        )}
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          <Button disabled={!canStart} icon="play" onPress={() => void start(true)}>
            Empezar ejercicio
          </Button>
          <Button
            disabled={!canStart}
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
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Registrar golpe. También puedes pulsar espacio fuera de los controles."
          disabled={input === 'mic' || !playing}
          onPress={() => recordHit(audio.now(), 'manual')}
          style={({ pressed }) => ({
            padding: 14,
            alignItems: 'center',
            borderRadius: 8,
            backgroundColor: pressed
              ? reading
                ? colors.white
                : palette.green
              : reading
                ? colors.pale
                : palette.cream,
          })}
        >
          <Text
            style={{ color: reading ? colors.green : palette.ink, fontSize: 17, fontWeight: '600' }}
          >
            {input === 'mic' ? 'Entrada por micrófono' : 'Registrar golpe · Espacio'}
          </Text>
        </Pressable>
      </View>
      {currentChord && instrument ? (
        <View style={styles.panel}>
          <Heading level={2} style={styles.h2}>
            Mástil · {chordLabel(currentChord, nomenclature)}
          </Heading>
          <Label muted>{chordLevels[Number(level) - 1]?.guide}</Label>
          <Fretboard
            instrument={instrument}
            marks={marks}
            nomenclature={nomenclature}
            leftHanded={leftHanded}
            compact
          />
        </View>
      ) : null}
      <View style={styles.panel}>
        <Heading level={2} style={styles.h2}>
          Configuración
        </Heading>
        {!playing ? (
          <>
            <View style={{ maxWidth: 155 }}>
              <Field
                label="Tempo (40–180 BPM)"
                value={bpm}
                onChangeText={(value) => setBpm(value.replace(/\D/g, '').slice(0, 3))}
                keyboardType="numeric"
              />
            </View>
            <Label muted>Nivel</Label>
            {!reading && !harmonic ? (
              <Chips
                value={random ? 'random' : 'levels'}
                options={[
                  { value: 'levels', label: 'Progresión' },
                  { value: 'random', label: 'Aleatorio' },
                ]}
                onChange={(value) => {
                  if (value === 'random' && !random) {
                    const drawnLevel = 1 + Math.floor(Math.random() * 10);
                    setLevel(String(drawnLevel));
                    setPattern(makePattern(drawnLevel, length));
                  }
                  setRandom(value === 'random');
                }}
              />
            ) : null}
            {random ? (
              <Label>Nivel del patrón · {level}</Label>
            ) : (
              <Chips
                value={level}
                onChange={(value) => {
                  if (value !== level) regenerate(Number(value));
                }}
                options={
                  harmonic
                    ? chordLevels
                    : reading
                      ? [
                          { value: '1', label: 'Inicial' },
                          { value: '3', label: 'Intermedia' },
                          { value: '7', label: 'Avanzada' },
                        ]
                      : levels
                }
              />
            )}
            {harmonic ? (
              <>
                <Chips
                  value={source}
                  onChange={setSource}
                  options={[
                    { value: 'tonal', label: 'Por tonalidad' },
                    { value: 'manual', label: 'Escribir acordes' },
                  ]}
                />
                {source === 'manual' ? (
                  <>
                    <Field
                      label="Acordes por pulso"
                      value={symbols}
                      onChangeText={setSymbols}
                      placeholder="C G Am F"
                    />
                    <Label muted>
                      Escribe hasta 16 acordes separados por espacios. La secuencia se repite hasta
                      llenar los 16 pulsos.
                    </Label>
                    {chords === null ? (
                      <Label style={{ color: colors.error }}>
                        Revisa el cifrado. Se admiten tríadas, sus2, sus4 y séptimas como Cmaj7, Dm7
                        y G7.
                      </Label>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Label muted>Tonalidad mayor</Label>
                    <Chips
                      value={tonic}
                      onChange={setTonic}
                      options={fifthsCircle.map(({ major }) => ({
                        value: major,
                        label: pitchName(major + '4', false, nomenclature),
                      }))}
                    />
                    <Chips
                      value={progression}
                      options={majorProgressions}
                      onChange={setProgression}
                    />
                    <Label muted>
                      Cada acorde dura cuatro pulsos. Pulsa una figura para cambiar el ritmo de esa
                      casilla.
                    </Label>
                  </>
                )}
              </>
            ) : (
              <Label muted>Pulsa una figura para editarla antes de empezar.</Label>
            )}
            <Button
              variant="secondary"
              style={{ alignSelf: 'flex-start' }}
              onPress={() => regenerate()}
            >
              Nuevo patrón
            </Button>
          </>
        ) : (
          <Label>
            {bpm} BPM · {harmonic ? chordLevels[Number(level) - 1]?.label : `Nivel ${level}`}
          </Label>
        )}
        {!reading && rhythmMicAvailable && !playing ? (
          <View style={{ gap: 12 }}>
            <Button
              variant="secondary"
              style={{ alignSelf: 'flex-start' }}
              onPress={() => (opening || input === 'mic' ? disconnectMic() : void connectMic())}
            >
              {opening
                ? 'Cancelar activación'
                : input === 'mic'
                  ? 'Desactivar micrófono'
                  : 'Activar micrófono'}
            </Button>
            {input === 'mic' ? (
              <>
                <Label muted>
                  Usa auriculares para aislar el metrónomo.{' '}
                  {harmonic ? 'Se evalúan el tiempo y la nota.' : 'Se evalúa el tiempo del ataque.'}
                </Label>
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel="Nivel de entrada"
                  accessibilityValue={{
                    min: 0,
                    max: 100,
                    now: Math.round(Math.min(100, meter.rms * 450)),
                  }}
                  style={{
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: palette.paper,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: 7,
                      width: `${Math.min(100, meter.rms * 450)}%`,
                      backgroundColor: meter.loud ? palette.green : palette.blue,
                    }}
                  />
                </View>
                <View style={[styles.row, { flexWrap: 'wrap' }]}>
                  <Field
                    label="Sensibilidad (8–90)"
                    value={sensitivity}
                    keyboardType="numeric"
                    onChangeText={(value) => {
                      const number = value.replace(/\D/g, '').slice(0, 2);
                      setSensitivity(number);
                      if (Number(number) >= 8 && Number(number) <= 90)
                        microphone.current?.configure(Number(number), false);
                    }}
                  />
                  <Field
                    label="Compensación (−120 a 300 ms)"
                    value={offset}
                    onChangeText={(value) => setOffset(value.replace(/[^\d-]/g, '').slice(0, 4))}
                  />
                </View>
                <Label muted>
                  Sube la sensibilidad para golpes suaves. Si aparecen tarde, aumenta la
                  compensación.
                </Label>
              </>
            ) : harmonic ? (
              <Label muted>
                Con botón o teclado se evalúa el tiempo. El micrófono añade la evaluación de altura.
              </Label>
            ) : null}
          </View>
        ) : null}
        {!reading && !rhythmMicAvailable ? (
          <Label muted>
            La entrada por micrófono está disponible en web. Aquí puedes practicar con el botón y se
            evalúa el tiempo.
          </Label>
        ) : null}
        {!validBpm ? (
          <Label style={{ color: colors.error }}>Introduce un tempo entre 40 y 180 BPM.</Label>
        ) : null}
        {!validMic ? (
          <Label style={{ color: colors.error }}>
            Revisa los valores de sensibilidad y compensación.
          </Label>
        ) : null}
        {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
      </View>
    </View>
  );
}
