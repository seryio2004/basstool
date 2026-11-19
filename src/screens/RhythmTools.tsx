import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
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
  kick: { volume: '100', mute: false },
  snare: { volume: '100', mute: false },
  cymbal: { volume: '100', mute: false },
};
const mixerLevels = (mixer: typeof initialMixer) => ({
  kick: mixer.kick.mute ? 0 : Number(mixer.kick.volume) / 100,
  snare: mixer.snare.mute ? 0 : Number(mixer.snare.volume) / 100,
  cymbal: mixer.cymbal.mute ? 0 : Number(mixer.cymbal.volume) / 100,
});

function DrumMachine() {
  useTheme();
  const [groove, setGroove] = useState(defaultGroove);
  const current = useRef(groove);
  const [bpmText, setBpmText] = useState(String(groove.bpm));
  const [swingText, setSwingText] = useState(String(groove.swing));
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
    setSwingText(String(swing));
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
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          <Button
            icon={running ? 'pause' : 'play'}
            disabled={!running && !validTempo}
            onPress={() => void toggle()}
          >
            {running ? 'Detener' : 'Iniciar batería'}
          </Button>
          {position && (
            <Text style={styles.data}>
              {position.bpm} BPM · Compás {position.bar + 1}
              {position.variation === 'fill' ? ' · Relleno' : ''}
            </Text>
          )}
        </View>
        <RhythmError message={error} />
        <PatternGrid pattern={pattern} activeStep={position?.step} ride={ride} />
        <View style={{ gap: space.s }}>
          <View style={[styles.row, { flexWrap: 'wrap', alignItems: 'flex-end' }]}>
            <View style={{ width: 118 }}>
              <Field
                label="BPM (40–240)"
                keyboardType="numeric"
                value={bpmText}
                onChangeText={(value) => changeTempo(digits(value))}
              />
            </View>
            <Button
              variant="secondary"
              accessibilityLabel="Bajar 1 BPM"
              onPress={() => changeTempo(String(bounded(groove.bpm - 1, 40, 240)))}
            >
              −
            </Button>
            <Button
              variant="secondary"
              accessibilityLabel="Subir 1 BPM"
              onPress={() => changeTempo(String(bounded(groove.bpm + 1, 40, 240)))}
            >
              +
            </Button>
            <Button
              variant="secondary"
              onPress={() => {
                const result = tapTempo(taps.current, performance.now());
                taps.current = result.taps;
                if (result.bpm !== undefined) changeTempo(String(result.bpm), true);
              }}
            >
              Marcar tempo
            </Button>
          </View>
          {!validTempo && <RhythmError message="Introduce un tempo entre 40 y 240 BPM." />}
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
        <View style={{ maxWidth: 160 }}>
          <Field
            label="Swing (0–60 %)"
            keyboardType="numeric"
            value={swingText}
            onChangeText={(value) => {
              const text = digits(value);
              const swing = Math.min(60, Number(text));
              setSwingText(text === '' ? '' : String(swing));
              change({ swing });
            }}
          />
        </View>
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
            <View key={piece} style={[styles.row, { flexWrap: 'wrap', alignItems: 'flex-end' }]}>
              <View style={{ width: 140 }}>
                <Field
                  label={`${label} (%)`}
                  value={mixer[piece].volume}
                  keyboardType="numeric"
                  onChangeText={(value) => {
                    const text = digits(value);
                    changeMix(piece, {
                      volume: text === '' ? '' : String(Math.min(100, Number(text))),
                    });
                  }}
                />
              </View>
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
  return (
    <View style={{ gap: space.xs }}>
      {drumPieces.map((piece) => {
        const label = pieceLabel(piece, ride);
        const hits = pattern.map(({ hits }) => hits.some(({ drum }) => drumPiece(drum) === piece));
        const steps = hits.flatMap((hit, i) => (hit ? [i + 1] : []));
        return (
          <View
            key={piece}
            accessible
            accessibilityLabel={
              steps.length
                ? `${label}. Golpes en los pasos ${steps.join(', ')}`
                : `${label}. Sin golpes`
            }
            style={[styles.row, { gap: space.s, minHeight: 20 }]}
          >
            <Text style={[styles.muted, { width: 54 }]}>{label}</Text>
            <View style={{ flex: 1, flexDirection: 'row', gap: 2 }} aria-hidden>
              {hits.map((hit, step) => {
                const active = activeStep === step;
                return (
                  <View
                    key={step}
                    style={{
                      flex: 1,
                      marginLeft: step > 0 && Number.isInteger(pattern[step]?.pulse) ? space.xs : 0,
                      height: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderRadius: radius.badge,
                      borderColor: active ? colors.accent : colors.lineStrong,
                      backgroundColor: active ? colors.accent : colors.sunken,
                    }}
                  >
                    {hit && (
                      <View
                        style={{
                          width: '60%',
                          maxWidth: 8,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: active ? colors.onAccent : colors.accentText,
                        }}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
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
  useTheme();
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
    setCount(
      progress.current.bpm === position.bpm ? progress.current.repetitions : settings.repetitions,
    );
  }

  return (
    <View style={[styles.panel, { gap: space.l }]}>
      {running ? (
        <>
          <View accessibilityLiveRegion="polite" style={{ gap: space.xs }}>
            <Text style={[styles.data, { fontSize: 28 }]}>
              {position?.bpm ?? settings.start} BPM
            </Text>
            <Label muted>
              {!position
                ? 'Preparando audio…'
                : position.bpm >= settings.target
                  ? 'Objetivo alcanzado'
                  : `${count}/${settings.repetitions} ${mode === 'auto' ? 'compases' : 'repeticiones'}`}
            </Label>
          </View>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {mode === 'manual' && (
              <Button
                disabled={
                  !position || count >= settings.repetitions || position.bpm >= settings.target
                }
                onPress={() => report('success')}
              >
                Lo he clavado
              </Button>
            )}
            <Button disabled={!position} variant="secondary" onPress={() => report('failure')}>
              Fallo
            </Button>
            <Button icon="pause" variant={mode === 'auto' ? 'primary' : 'secondary'} onPress={stop}>
              Detener
            </Button>
          </View>
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
