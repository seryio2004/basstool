import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import {
  Button,
  Chips,
  Field,
  Heading,
  Label,
  Toggle,
  radius,
  space,
  styles,
  useTheme,
} from '../components/ui';
import {
  defaultGroove,
  defaultSwing,
  drumBar,
  drumGenres,
  drumMeters,
  drumPiece,
  drumPieces,
  tapTempo,
  type DrumGenre,
  type DrumMeter,
  type DrumPiece,
  type DrumVariation,
  type Groove,
} from '../core/drums';
import type { PracticeSession } from '../core/dailyPractice';
import {
  advanceSpeed,
  startSpeed,
  speedPracticeSession,
  validSpeedSettings,
  type SpeedMode,
  type SpeedSettings,
} from '../core/speedTrainer';
import { uid } from '../core/types';
import { useStore } from '../data/Store';
import {
  startGroove,
  startMetronome,
  type DrumTransport,
  type GroovePosition,
  type RhythmPosition,
  type Transport,
} from '../platform/drumMachine';

const variationOptions = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'fill', label: 'Relleno' },
] satisfies { value: DrumVariation; label: string }[];
const digits = (value: string) => value.replace(/\D/g, '').slice(0, 3);
const bounded = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const transportButton = {
  flexGrow: 1,
  flexBasis: '45%',
  minWidth: 124,
  paddingHorizontal: space.m,
} as const;

function WebOnly() {
  useTheme();
  return (
    <View style={styles.panel}>
      <Label>Disponible en la versión web</Label>
    </View>
  );
}

export function DrumMachineTool() {
  return Platform.OS === 'web' ? <DrumMachine /> : <WebOnly />;
}

export function SpeedTrainerTool() {
  return Platform.OS === 'web' ? <SpeedTrainer /> : <WebOnly />;
}

function RhythmError({ message }: { message: string }) {
  const { colors } = useTheme();
  return message ? (
    <Text accessibilityRole="alert" style={[styles.text, { color: colors.error }]}>
      {message}
    </Text>
  ) : null;
}

function GrooveGenre({
  value,
  onChange,
}: {
  value: DrumGenre;
  onChange: (genre: DrumGenre) => void;
}) {
  useTheme();
  return (
    <View style={{ gap: space.s }}>
      <Text style={styles.legend}>Género</Text>
      <Chips
        label="Género"
        options={[...drumGenres]}
        value={value}
        onChange={onChange}
        minHeight={44}
      />
    </View>
  );
}

const pieceLabel = (piece: DrumPiece, ride: boolean) =>
  piece === 'kick' ? 'Bombo' : piece === 'snare' ? 'Caja' : ride ? 'Ride' : 'Charles';
const initialMixer = {
  kick: { volume: 100, mute: false },
  snare: { volume: 100, mute: false },
  cymbal: { volume: 100, mute: false },
};
const mixerLevels = (mixer: typeof initialMixer) => ({
  kick: mixer.kick.mute ? 0 : mixer.kick.volume / 100,
  snare: mixer.snare.mute ? 0 : mixer.snare.volume / 100,
  cymbal: mixer.cymbal.mute ? 0 : mixer.cymbal.volume / 100,
});

function DrumMachine() {
  const { colors } = useTheme();
  const [groove, setGroove] = useState(defaultGroove);
  const current = useRef(groove);
  const [bpmText, setBpmText] = useState(String(groove.bpm));
  const [position, setPosition] = useState<GroovePosition>();
  const [mixer, setMixer] = useState(initialMixer);
  const levels = useRef(mixerLevels(initialMixer));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const taps = useRef<number[]>([]);
  const transport = useRef<DrumTransport | null>(null);
  const run = useRef(0);
  useEffect(
    () => () => {
      run.current++;
      transport.current?.stop();
    },
    [],
  );

  function change(patch: Partial<Groove>) {
    current.current = { ...current.current, ...patch };
    setGroove(current.current);
  }

  function changeMeter(genre: DrumGenre, meter: DrumMeter) {
    if (genre === groove.genre && meter === groove.meter) return;
    const swing = defaultSwing(genre, meter);
    change({ genre, meter, swing });
    taps.current = [];
  }

  function changeTempo(text: string, fromTap = false) {
    setBpmText(text);
    const bpm = Number(text);
    if (bpm >= 40 && bpm <= 240) change({ bpm });
    if (!fromTap) taps.current = [];
  }

  function changeMix(piece: DrumPiece, patch: Partial<typeof initialMixer.kick>) {
    const next = { ...mixer, [piece]: { ...mixer[piece], ...patch } };
    setMixer(next);
    levels.current = mixerLevels(next);
    transport.current?.setLevels(levels.current);
  }

  async function toggle() {
    const token = ++run.current;
    if (running) {
      transport.current?.stop();
      transport.current = null;
      setRunning(false);
      setPosition(undefined);
      return;
    }
    setRunning(true);
    setError('');
    try {
      const player = await startGroove(
        { ...current.current, levels: levels.current },
        {
          getGroove: () => current.current,
          onStep: (step) => {
            if (run.current === token) setPosition(step);
          },
          onError: (failure) => {
            if (run.current !== token) return;
            transport.current = null;
            setRunning(false);
            setPosition(undefined);
            setError(failure.message);
          },
        },
      );
      if (run.current !== token) player.stop();
      else {
        transport.current = player;
        player.setLevels(levels.current);
      }
    } catch (failure) {
      if (run.current !== token) return;
      setRunning(false);
      setError((failure as Error).message);
    }
  }

  const validTempo = Number(bpmText) >= 40 && Number(bpmText) <= 240;
  const pattern = position?.pattern ?? drumBar(groove);
  const ride = position
    ? pattern.some(({ hits }) => hits.some(({ drum }) => drum === 'ride'))
    : groove.genre === 'jazz';
  return (
    <View style={{ gap: space.l }}>
      <View style={[styles.panel, { gap: space.l }]}>
        <View style={[styles.row, { flexWrap: 'wrap', gap: space.s }]}>
          <Button
            icon={running ? 'pause' : 'play'}
            disabled={!running && !validTempo}
            onPress={() => void toggle()}
            style={transportButton}
          >
            {running ? 'Parar batería' : 'Iniciar batería'}
          </Button>
          <Button
            variant="secondary"
            style={transportButton}
            onPress={() => {
              const result = tapTempo(taps.current, performance.now());
              taps.current = result.taps;
              if (result.bpm !== undefined) changeTempo(String(result.bpm), true);
            }}
          >
            Marcar tempo
          </Button>
        </View>
        <View style={[styles.row, { justifyContent: 'center' }]}>
          <Button
            variant="secondary"
            accessibilityLabel="Bajar 1 BPM"
            onPress={() => changeTempo(String(bounded(groove.bpm - 1, 40, 240)))}
          >
            −
          </Button>
          <View style={{ width: 92, alignItems: 'center' }}>
            <TextInput
              accessibilityLabel="Tempo en BPM (40–240)"
              inputMode="numeric"
              value={bpmText}
              onChangeText={(value) => changeTempo(digits(value))}
              style={[
                styles.data,
                {
                  fontSize: 34,
                  width: '100%',
                  textAlign: 'center',
                  borderBottomWidth: 1,
                  borderBottomColor: colors.lineStrong,
                },
              ]}
            />
            <Text style={styles.legend}>BPM</Text>
          </View>
          <Button
            variant="secondary"
            accessibilityLabel="Subir 1 BPM"
            onPress={() => changeTempo(String(bounded(groove.bpm + 1, 40, 240)))}
          >
            +
          </Button>
        </View>
        <RhythmError message={error} />
        {!validTempo && <RhythmError message="Introduce un tempo entre 40 y 240 BPM." />}
        <View style={{ gap: space.s }}>
          <Text style={styles.muted}>
            Compás {position ? position.bar + 1 : '—'}
            {position?.variation === 'fill' ? ' · Relleno' : ''}
            {position && position.bpm !== groove.bpm ? ` · ${position.bpm} BPM` : ''}
          </Text>
          <PatternGrid pattern={pattern} activeStep={position?.step} ride={ride} />
          {(groove.meter === '6/8' || groove.meter === '12/8') && (
            <Label muted>El pulso es una negra con puntillo.</Label>
          )}
        </View>
        <GrooveGenre
          value={groove.genre}
          onChange={(genre) =>
            changeMeter(genre, drumMeters(genre).includes(groove.meter) ? groove.meter : '4/4')
          }
        />
        <View style={{ gap: space.s }}>
          <Text style={styles.legend}>Variación</Text>
          <Chips
            label="Variación"
            value={groove.variation}
            options={variationOptions}
            onChange={(variation) => change({ variation })}
            minHeight={44}
          />
        </View>
        <View style={{ gap: space.s }}>
          <Text style={styles.legend}>Compás</Text>
          <Chips
            label="Compás"
            value={groove.meter}
            options={drumMeters(groove.genre).map((meter) => ({ value: meter, label: meter }))}
            onChange={(meter) => changeMeter(groove.genre, meter)}
            minHeight={44}
          />
        </View>
        <PercentSlider
          label="Swing"
          value={groove.swing}
          max={60}
          onChange={(swing) => change({ swing })}
        />
        {groove.variation !== 'fill' && (
          <View style={{ gap: space.s }}>
            <Text style={styles.legend}>Relleno automático</Text>
            <Chips
              label="Relleno automático"
              value={groove.fillEvery ?? 0}
              options={[
                { value: 0, label: 'Desactivado' },
                { value: 4, label: 'Cada 4 compases' },
                { value: 8, label: 'Cada 8 compases' },
              ]}
              onChange={(fillEvery) => change({ fillEvery })}
              minHeight={44}
            />
          </View>
        )}
      </View>
      <View style={[styles.panel, { gap: space.m }]}>
        <Heading level={2} style={styles.h2}>
          Mezcla
        </Heading>
        {drumPieces.map((piece) => {
          const label = pieceLabel(piece, groove.genre === 'jazz');
          return (
            <View key={piece}>
              <PercentSlider
                label={label}
                value={mixer[piece].volume}
                onChange={(volume) => changeMix(piece, { volume })}
              />
              <Toggle
                label={`Silenciar ${label.toLowerCase()}`}
                value={mixer[piece].mute}
                onChange={(mute) => changeMix(piece, { mute })}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PercentSlider({
  label,
  value,
  max = 100,
  onChange,
}: {
  label: string;
  value: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ maxWidth: 640 }}>
      <View style={styles.between}>
        <Text style={styles.legend}>{label}</Text>
        <Text style={styles.data}>{value} %</Text>
      </View>
      <input
        aria-label={label}
        aria-valuetext={`${value} %`}
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        style={{ width: '100%', minHeight: 44, margin: 0, accentColor: colors.accent }}
      />
    </View>
  );
}

const cellWidth = 18;
const cellGap = 2;
const labelWidth = 56;

function PatternGrid({
  pattern,
  activeStep,
  ride,
}: {
  pattern: ReturnType<typeof drumBar>;
  activeStep?: number;
  ride: boolean;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const pulses: number[][] = [];
  pattern.forEach(({ pulse }, step) => {
    const index = Math.floor(pulse);
    (pulses[index] ??= []).push(step);
  });
  const maxSteps = Math.max(...pulses.map((pulse) => pulse.length));
  const pulseWidth = maxSteps * cellWidth + (maxSteps - 1) * cellGap;
  // Los pulsos se mantienen enteros y todos los bloques tienen un número parecido de pulsos.
  const available = width - labelWidth - space.s;
  const capacity = Math.max(1, Math.floor((available + space.s) / (pulseWidth + space.s)));
  const perBlock = Math.ceil(pulses.length / Math.ceil(pulses.length / capacity));
  const blocks = [];
  for (let index = 0; index < pulses.length; index += perBlock) {
    blocks.push(pulses.slice(index, index + perBlock));
  }

  return (
    <View
      style={{ width: '100%', maxWidth: 640, gap: space.m }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {blocks.map((block, index) => (
        <View key={index} style={{ gap: space.xs }}>
          <View style={{ flexDirection: 'row', gap: space.s, marginLeft: labelWidth + space.s }}>
            {block.map((steps, beat) => (
              <Text
                key={steps[0]}
                style={[styles.data, { flex: 1, fontSize: 12, color: colors.muted }]}
              >
                {index * perBlock + beat + 1}
              </Text>
            ))}
          </View>
          {drumPieces.map((piece) => {
            const label = pieceLabel(piece, ride);
            const hits = pattern.map(({ hits }) =>
              hits.some(({ drum }) => drumPiece(drum) === piece),
            );
            const hitSteps = block
              .flat()
              .filter((step) => hits[step])
              .map((step) => step + 1);
            return (
              <View
                key={piece}
                accessible
                accessibilityLabel={
                  hitSteps.length
                    ? `${label}. Golpes en los pasos ${hitSteps.join(', ')}`
                    : `${label}. Sin golpes`
                }
                style={[styles.row, { gap: space.s }]}
              >
                <Text style={[styles.muted, { width: labelWidth }]}>{label}</Text>
                <View style={{ flex: 1, flexDirection: 'row', gap: space.s }} aria-hidden>
                  {block.map((steps) => (
                    <View key={steps[0]} style={{ flex: 1, flexDirection: 'row', gap: cellGap }}>
                      {steps.map((step) => {
                        const active = activeStep === step;
                        const hit = hits[step];
                        return (
                          <View
                            key={step}
                            style={{
                              flex: 1,
                              minWidth: cellWidth,
                              height: 26,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: 1,
                              borderRadius: radius.badge,
                              borderColor: active ? colors.accent : colors.lineStrong,
                              backgroundColor: active
                                ? colors.accent
                                : hit
                                  ? colors.accentSoft
                                  : colors.sunken,
                            }}
                          >
                            {hit && (
                              <View
                                style={{
                                  width: 8,
                                  height: 6,
                                  borderRadius: 2,
                                  backgroundColor: active ? colors.onAccent : colors.accentText,
                                }}
                              />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

type SpeedRun = {
  id: string;
  startedAt?: Date;
  startClock: number;
  maxBpm: number;
  player?: Transport;
  save: (session: PracticeSession) => Promise<void>;
  level: PracticeSession['level'];
};

function finishSpeed(run: SpeedRun): PracticeSession | undefined {
  run.player?.stop();
  if (!run.startedAt) return;
  const seconds = Math.max(0, Math.round((performance.now() - run.startClock) / 1000));
  return speedPracticeSession(run.id, run.level, run.startedAt, seconds, run.maxBpm);
}

function SpeedTrainer() {
  const { colors } = useTheme();
  const { profile, savePractice } = useStore();
  const [start, setStart] = useState('60');
  const [target, setTarget] = useState('120');
  const [step, setStep] = useState('5');
  const [repetitions, setRepetitions] = useState('4');
  const [lowerOnFailure, setLowerOnFailure] = useState(false);
  const [mode, setMode] = useState<SpeedMode>('auto');
  const [source, setSource] = useState<'click' | 'drums'>('click');
  const [genre, setGenre] = useState<DrumGenre>('rock');
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PracticeSession>();
  const [retry, setRetry] = useState<PracticeSession>();
  const [position, setPosition] = useState<RhythmPosition>();
  const [count, setCount] = useState(0);
  const [pendingTempo, setPendingTempo] = useState(false);
  const active = useRef<SpeedRun | null>(null);
  const progress = useRef({ bpm: 60, repetitions: 0 });
  const mounted = useRef(false);
  const settings = {
    start: Number(start),
    target: Number(target),
    step: Number(step),
    repetitions: Number(repetitions),
    mode,
    lowerOnFailure,
  } satisfies SpeedSettings;
  const valid = validSpeedSettings(settings);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const run = active.current;
      active.current = null;
      if (!run) return;
      const session = finishSpeed(run);
      if (session) void run.save(session).catch(() => {}); // Store reports persistence errors.
    };
  }, []);

  async function persist(session: PracticeSession, save = savePractice) {
    setSaving(true);
    try {
      await save(session);
      if (!mounted.current) return;
      setResult(session);
      setRetry(undefined);
    } catch (failure) {
      if (!mounted.current) return;
      setRetry(session);
      setError((failure as Error).message);
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  function stop() {
    const run = active.current;
    if (!run) return;
    const session = finishSpeed(run);
    active.current = null;
    setRunning(false);
    setPosition(undefined);
    if (session) void persist(session, run.save);
  }

  async function startRun() {
    if (active.current || !valid) return;
    setError('');
    setResult(undefined);
    setCount(0);
    setPendingTempo(false);
    progress.current = startSpeed(settings);
    const run: SpeedRun = {
      id: uid(),
      startClock: 0,
      maxBpm: 0,
      save: savePractice,
      level: profile.level,
    };
    active.current = run;
    setRunning(true);
    const options = {
      bpmForBar(bar: number) {
        if (bar > 0) progress.current = advanceSpeed(settings, progress.current, 'bar');
        return progress.current.bpm;
      },
      onStep(next: RhythmPosition) {
        if (next.step !== 0) return;
        if (!run.startedAt) {
          run.startedAt = new Date();
          run.startClock = performance.now();
        }
        run.maxBpm = Math.max(run.maxBpm, next.bpm);
        if (!mounted.current || active.current !== run) return;
        setPosition(next);
        setCount(progress.current.bpm === next.bpm ? progress.current.repetitions : 0);
        setPendingTempo(false);
      },
      onError(failure: Error) {
        if (active.current !== run) return;
        stop();
        setError(failure.message);
      },
    };
    try {
      const player =
        source === 'click'
          ? await startMetronome(settings.start, 4, options)
          : await startGroove(
              { ...defaultGroove, genre, bpm: settings.start, swing: defaultSwing(genre, '4/4') },
              options,
            );
      if (active.current === run) run.player = player;
      else player.stop();
    } catch (failure) {
      if (active.current !== run) return;
      active.current = null;
      setRunning(false);
      setError((failure as Error).message);
    }
  }

  function report(event: 'success' | 'failure') {
    if (!position || !active.current) return;
    progress.current = advanceSpeed(settings, progress.current, event);
    setPendingTempo(progress.current.bpm !== position.bpm);
    setCount(progress.current.repetitions);
  }

  const bpm = position?.bpm ?? settings.start;
  const reached = Boolean(position) && bpm >= settings.target;
  const progressPercent =
    settings.target > settings.start
      ? bounded((100 * (bpm - settings.start)) / (settings.target - settings.start), 0, 100)
      : reached
        ? 100
        : 0;
  const remaining = settings.repetitions - count;

  return (
    <View style={[styles.panel, { gap: space.l }]}>
      {running ? (
        <>
          <View style={{ gap: space.m, width: '100%', maxWidth: 640 }}>
            <View accessibilityLiveRegion="polite" style={{ alignItems: 'center' }}>
              <Text style={[styles.data, { fontSize: 52, lineHeight: 58 }]}>{bpm}</Text>
              <Text style={styles.legend}>BPM actuales</Text>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Progreso hacia el tempo objetivo"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progressPercent)}
              style={{
                height: 12,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: colors.lineStrong,
                backgroundColor: colors.sunken,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  backgroundColor: colors.accent,
                }}
              />
            </View>
            <View style={styles.between}>
              <Text style={styles.muted}>Inicio · {settings.start} BPM</Text>
              <Text style={styles.muted}>Objetivo · {settings.target} BPM</Text>
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.h3}>
              {!position
                ? 'Preparando audio…'
                : pendingTempo
                  ? 'Cambio de tempo en el próximo compás'
                  : reached
                    ? 'Objetivo alcanzado'
                    : mode === 'auto'
                      ? `Siguiente paso en ${remaining} ${remaining === 1 ? 'compás' : 'compases'}`
                      : `Siguiente paso en ${remaining} ${remaining === 1 ? 'repetición' : 'repeticiones'}`}
            </Text>
          </View>
          <View style={[styles.row, { flexWrap: 'wrap', maxWidth: 640 }]}>
            {mode === 'manual' && (
              <Button
                disabled={!position || pendingTempo || reached}
                onPress={() => report('success')}
                style={{ flexGrow: 1 }}
              >
                Lo he clavado
              </Button>
            )}
            <Button
              disabled={!position}
              variant="secondary"
              onPress={() => report('failure')}
              style={mode === 'manual' ? { flexGrow: 1 } : undefined}
            >
              Fallo
            </Button>
          </View>
          <Button
            icon="pause"
            variant={mode === 'auto' ? 'primary' : 'secondary'}
            onPress={stop}
            style={{ alignSelf: 'flex-start' }}
          >
            Detener
          </Button>
        </>
      ) : (
        <>
          <View style={{ gap: space.s }}>
            <Text style={styles.legend}>Acompañamiento</Text>
            <Chips
              label="Acompañamiento"
              value={source}
              onChange={setSource}
              minHeight={44}
              options={[
                { value: 'click', label: 'Metrónomo' },
                { value: 'drums', label: 'Batería' },
              ]}
            />
          </View>
          {source === 'drums' && <GrooveGenre value={genre} onChange={setGenre} />}
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {[
              { label: 'Inicio (BPM)', value: start, set: setStart },
              { label: 'Objetivo (BPM)', value: target, set: setTarget },
              { label: 'Paso (BPM)', value: step, set: setStep },
            ].map(({ label, value, set }) => (
              <View key={label} style={{ flex: 1, minWidth: 96, maxWidth: 160 }}>
                <Field
                  label={label}
                  value={value}
                  onChangeText={(text) => set(digits(text))}
                  keyboardType="numeric"
                />
              </View>
            ))}
          </View>
          <View style={{ gap: space.s }}>
            <Text style={styles.legend}>Modo</Text>
            <Chips
              label="Modo"
              value={mode}
              onChange={setMode}
              minHeight={44}
              options={[
                { value: 'auto', label: 'Automático' },
                { value: 'manual', label: 'Manual' },
              ]}
            />
          </View>
          <View style={{ maxWidth: 190 }}>
            <Field
              label={mode === 'auto' ? 'Compases por tempo' : 'Repeticiones por tempo'}
              value={repetitions}
              onChangeText={(text) => setRepetitions(digits(text))}
              keyboardType="numeric"
            />
          </View>
          <Toggle
            label="Bajar un paso al pulsar «Fallo»"
            value={lowerOnFailure}
            onChange={setLowerOnFailure}
          />
          {!valid && (
            <RhythmError message="Inicio y objetivo entre 40 y 240 BPM, objetivo igual o superior al inicio, paso entre 1 y 200 BPM y compases o repeticiones entre 1 y 99." />
          )}
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {retry ? (
              <Button
                disabled={saving}
                onPress={() => {
                  setError('');
                  void persist(retry);
                }}
              >
                Volver a guardar
              </Button>
            ) : (
              <Button icon="play" disabled={!valid || saving} onPress={() => void startRun()}>
                Iniciar entrenamiento
              </Button>
            )}
            {saving && <Label muted>Guardando en el diario…</Label>}
          </View>
          {result && (
            <Text accessibilityLiveRegion="polite" style={styles.text}>
              Guardado en el diario · {result.blocks[0]?.bpm} BPM máximos
            </Text>
          )}
        </>
      )}
      <RhythmError message={error} />
    </View>
  );
}
