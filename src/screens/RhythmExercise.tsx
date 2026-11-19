import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Fretboard } from '../components/Fretboard';
import { GrooveTrain } from '../components/GrooveTrain';
import { HarmonicWagons, chordLabel } from '../components/HarmonicWagons';
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
  parseTrainChord,
  pitchTrainTargets,
  scoreTrain,
  trainTargets,
  trainTones,
  type RhythmHit,
  type RhythmInput,
} from '../core/chordTrain';
import {
  chordLineAttacks,
  chordLineBeats,
  chordLineDifficulties,
  chordLineLevels,
  chordLineRhythmOptions,
  chordLineTolerance,
  chordLineWagons,
  createChordLineSettingsStorage,
  defaultChordLineRhythm,
  resolveChordLineDifficulty,
  type ChordLineDifficulty,
  type ChordLineRhythmSelection,
  type ChordLineSettings,
  type ChordLineSnapshot,
} from '../core/chordLine';
import { figurePool, makePattern, pitchFromSamples } from '../core/music';
import { fifthsCircle, pitchName } from '../core/notation';
import { positionsFor } from '../core/theory';
import {
  availableTrainProgressions,
  progressionChords,
  randomTrainProgression,
  trainChordAllowed,
  type TrainProgression,
  type TrainMode,
} from '../core/trainProgressions';
import type { Level } from '../core/profile';
import type { ExerciseConfig } from '../core/types';
import { useStore } from '../data/Store';
import { audio } from '../platform/audio';
import { onSpace } from '../platform/keyboard';
import { openRhythmMic, rhythmMicAvailable } from '../platform/rhythmMic';
import type { RhythmMic } from '../platform/rhythmMicTypes';
import { grooveColors as palette } from '../theme/groove';
import { harmonicColors } from '../theme/harmonic';

type RhythmExerciseConfig = ExerciseConfig & { chordLine?: ChordLineSnapshot };

export type RhythmResult = {
  correct: number;
  total: number;
  duration: number;
  config: RhythmExerciseConfig;
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

const chordLineStorage = createChordLineSettingsStorage(AsyncStorage);
const harmonicSources = [
  { value: 'tonal', label: 'Progresiones' },
  { value: 'random', label: 'Sortear acordes' },
  { value: 'manual', label: 'Escribir acordes' },
] as const;
const trainKeys = fifthsCircle.map(({ major, minor }) => ({
  major,
  minor: parseTrainChord(minor)!.tonic,
}));

export function RhythmExercise({
  config,
  variant,
  leftHanded,
  onResult,
}: {
  config: RhythmExerciseConfig;
  variant: 'groove' | 'reading' | 'chord-train';
  leftHanded: boolean;
  onResult: (result: RhythmResult) => void;
}) {
  const { profile } = useStore();
  const reading = variant === 'reading';
  const harmonic = variant === 'chord-train';
  const defaultLength = reading ? 4 : harmonic && config.chords?.length === 48 ? 48 : 16;
  const snapshot = harmonic ? config.chordLine : undefined;
  const profileId = profile.id;
  const profileLevel = profile.level;
  const initialLevel = Math.max(1, Math.min(harmonic ? 4 : 10, config.level));
  const [storedPattern, setPattern] = useState(() =>
    config.pattern?.length === defaultLength
      ? [...config.pattern]
      : harmonic
        ? Array<number>(defaultLength).fill(5)
        : makePattern(initialLevel, defaultLength),
  );
  const [bpm, setBpm] = useState(
    String(harmonic && !config.chords ? chordLineLevels[profileLevel].bpm : config.bpm),
  );
  const [settingsReady, setSettingsReady] = useState(!harmonic || !!snapshot);
  const [settingsError, setSettingsError] = useState('');
  const [settings, setSettings] = useState<ChordLineSettings>(
    () =>
      snapshot ?? {
        difficulty: profileLevel,
        rhythm: defaultChordLineRhythm(profileLevel),
      },
  );
  const [resolvedDifficulty, setResolvedDifficulty] = useState(
    snapshot?.resolvedDifficulty ?? profileLevel,
  );
  const [wagons, setWagons] = useState(
    () => snapshot?.wagons ?? chordLineWagons(48, profileLevel, settings.rhythm),
  );
  const [legacyPattern, setLegacyPattern] = useState(
    harmonic && !snapshot && config.pattern?.length === defaultLength,
  );
  const [replayChords, setReplayChords] = useState(harmonic && !!config.chords);
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
  const [mode, setMode] = useState<TrainMode>('major');
  const [keyIndex, setKeyIndex] = useState('0');
  const [progression, setProgression] = useState('pop');
  const [drawn, setDrawn] = useState<TrainProgression>();
  const [source, setSource] = useState<(typeof harmonicSources)[number]['value']>(
    config.chords ? 'manual' : 'tonal',
  );
  const [symbols, setSymbols] = useState(config.chords?.join(' ') ?? 'C G Am F');
  const microphone = useRef<RhythmMic | null>(null);
  const micGeneration = useRef(0);
  const session = useRef<Session | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const generation = useRef(0);
  const launching = useRef(false);
  const { width } = useWindowDimensions();
  const nomenclature = config.nomenclature ?? 'latin';
  const harmony = chordLineLevels[resolvedDifficulty].harmony;
  const rhythmOptions = chordLineRhythmOptions(resolvedDifficulty);
  const rhythm = rhythmOptions.some(({ value }) => value === settings.rhythm)
    ? settings.rhythm
    : 'varied';
  const presets = useMemo(() => availableTrainProgressions(mode, harmony), [mode, harmony]);
  const selectedProgression = presets.find(({ value }) => value === progression) ?? presets[0]!;
  const recipe = source === 'random' && drawn ? drawn : selectedProgression;
  const tonic = trainKeys[Number(keyIndex)]![mode];
  const chords = useMemo(() => {
    if (!harmonic) return undefined;
    return source === 'manual'
      ? manualTrainChords(symbols, defaultLength)
      : progressionChords(tonic, recipe);
  }, [harmonic, source, symbols, tonic, recipe, defaultLength]);
  const inappropriateChords =
    !replayChords && chords?.some((chord) => !trainChordAllowed(chord, harmony));
  const length = chords?.length ?? defaultLength;
  const scheduledWagons = useMemo(
    () =>
      harmonic && !legacyPattern
        ? Array.from(
            { length: length / chordLineBeats },
            (_, index) => wagons[index % wagons.length]!,
          )
        : undefined,
    [harmonic, legacyPattern, length, wagons],
  );
  const pattern = useMemo(
    () =>
      storedPattern.length === length
        ? storedPattern
        : Array.from({ length }, (_, i) => storedPattern[i % storedPattern.length]!),
    [storedPattern, length],
  );
  const currentChord = chords?.[Math.max(active, 0)];
  const instrument = config.instrument;
  const marks = useMemo(() => {
    if (!currentChord || !instrument) return [];
    const arpeggio = { ...currentChord.arpeggio, tones: trainTones(currentChord, Number(level)) };
    const positions = (root: string) =>
      positionsFor(root, arpeggio, instrument, undefined, nomenclature);
    let notes;
    try {
      notes = positions(currentChord.tonic);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      // The fretboard notation supports up to double accidentals.
      const roots = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
      notes = positions(roots[currentChord.root]!);
    }
    return notes.map(({ string, fret, name, isRoot, degreeLabel }) => ({
      string,
      fret,
      label: name,
      root: isRoot,
      description: `${name}, grado ${degreeLabel}`,
    }));
  }, [currentChord, instrument, level, nomenclature]);

  useEffect(() => {
    if (!harmonic || snapshot) return;
    let mounted = true;
    void chordLineStorage
      .load(profileId, profileLevel)
      .then((saved) => {
        if (!mounted) return;
        const resolved = resolveChordLineDifficulty(saved.difficulty);
        setSettings(saved);
        setResolvedDifficulty(resolved);
        setWagons(chordLineWagons(48, resolved, saved.rhythm));
        if (!config.chords) setBpm(String(chordLineLevels[resolved].bpm));
      })
      .catch(() => {
        if (mounted) setSettingsError('No se pudieron leer los ajustes de ChordLine.');
      })
      .finally(() => {
        if (mounted) setSettingsReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [harmonic, profileId, profileLevel, snapshot, config.chords]);

  function changeBeat(index: number) {
    setPattern((previous) => {
      const next = Array.from({ length }, (_, i) => previous[i % previous.length]!);
      next[index] = (next[index]! + 1) % figurePool.length;
      return next;
    });
  }

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

  const canStart =
    settingsReady &&
    !playing &&
    !opening &&
    validBpm &&
    validMic &&
    chords !== null &&
    !inappropriateChords;

  function regenerate(atLevel = Number(level)) {
    const nextLevel = random ? 1 + Math.floor(Math.random() * 10) : atLevel;
    setLevel(String(nextLevel));
    setPattern(makePattern(nextLevel, length));
  }

  function drawHarmony(nextMode: TrainMode, difficulty: Level) {
    const chordType = chordLineLevels[difficulty].harmony;
    setDrawn(randomTrainProgression(nextMode, chordType));
  }

  function changeHarmonySource(value: typeof source) {
    if (value === source) return;
    if (value === 'random') drawHarmony(mode, resolvedDifficulty);
    setReplayChords(false);
    setSource(value);
  }

  function saveSettings(next: ChordLineSettings) {
    setSettings(next);
    setSettingsError('');
    void chordLineStorage.save(profileId, next).catch(() => {
      setSettingsError('No se pudieron guardar los ajustes de ChordLine.');
    });
  }

  function changeDifficulty(difficulty: ChordLineDifficulty) {
    if (difficulty === settings.difficulty && difficulty !== 'random') {
      saveSettings(settings);
      return;
    }
    const resolved = resolveChordLineDifficulty(difficulty);
    const nextRhythm = defaultChordLineRhythm(resolved);
    saveSettings({ difficulty, rhythm: nextRhythm });
    setResolvedDifficulty(resolved);
    setBpm(String(chordLineLevels[resolved].bpm));
    setWagons(chordLineWagons(48, resolved, nextRhythm));
    setLegacyPattern(false);
    setReplayChords(false);
    if (source === 'random') drawHarmony(mode, resolved);
  }

  function changeRhythm(next: ChordLineRhythmSelection) {
    saveSettings({ ...settings, rhythm: next });
    setLegacyPattern(false);
    setWagons(chordLineWagons(48, resolvedDifficulty, next));
  }

  function regenerateChordLine() {
    const resolved = resolveChordLineDifficulty(settings.difficulty);
    if (resolved !== resolvedDifficulty) setBpm(String(chordLineLevels[resolved].bpm));
    setResolvedDifficulty(resolved);
    setLegacyPattern(false);
    setWagons(chordLineWagons(48, resolved, settings.rhythm));
    if (source === 'random') drawHarmony(mode, resolved);
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
      const expected = scheduledWagons
        ? pitchTrainTargets(chordLineAttacks(scheduledWagons, tempo), chords, Number(level))
        : trainTargets(pattern, tempo, chords, Number(level));
      const tolerance = scheduledWagons
        ? chordLineTolerance(expected, beat)
        : reading
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
          if (note.dead) {
            audio.tone(36, listen.start + note.t, 0.035, 0.16);
            continue;
          }
          const chord = chords?.[note.block];
          const pitch = note.pitches?.[0] ?? chord?.root;
          const next = expected[index + 1]?.t ?? length * beat;
          const duration =
            note.duration === undefined
              ? Math.min(0.22, (next - note.t) * 0.8)
              : note.duration * 0.92;
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
            pattern: scheduledWagons ? undefined : [...pattern],
            chordLine: scheduledWagons
              ? {
                  difficulty: settings.difficulty,
                  resolvedDifficulty,
                  rhythm,
                  wagons: scheduledWagons,
                }
              : undefined,
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
  const exerciseInk = harmonic ? harmonicColors.ink : palette.ink;
  if (!settingsReady) return <Label muted>Cargando ajustes de ChordLine…</Label>;

  const difficultyLabel = chordLineDifficulties.find(
    ({ value }) => value === resolvedDifficulty,
  )!.label;
  return (
    <View style={{ gap: 18 }}>
      {harmonic && !playing ? (
        <View style={styles.panel}>
          <Label>Dificultad{settings.difficulty === 'random' ? ` · ${difficultyLabel}` : ''}</Label>
          <Chips
            minHeight={44}
            value={settings.difficulty}
            options={chordLineDifficulties}
            onChange={changeDifficulty}
          />
          <Label>Ritmo</Label>
          <Label muted>Elige un patrón fijo o varía por compás.</Label>
          <Chips
            minHeight={44}
            value={legacyPattern ? 'legacy' : rhythm}
            options={[
              ...(legacyPattern ? [{ value: 'legacy' as const, label: 'Patrón guardado' }] : []),
              { value: 'varied', label: 'Variado por compás' },
              ...rhythmOptions,
            ]}
            onChange={(value) => {
              if (value !== 'legacy') changeRhythm(value);
            }}
          />
          {settingsError ? <Label style={{ color: colors.error }}>{settingsError}</Label> : null}
        </View>
      ) : null}
      <View
        style={[
          styles.panel,
          harmonic
            ? {
                backgroundColor: harmonicColors.stage,
                borderColor: harmonicColors.border,
                padding: 14,
              }
            : !reading && {
                backgroundColor: palette.yellow,
                borderColor: palette.ink,
                padding: 14,
              },
        ]}
      >
        <View style={styles.between}>
          <Heading level={2} style={[styles.h2, !reading && { color: exerciseInk }]}>
            {phase}
          </Heading>
          <Badge
            background={
              harmonic ? harmonicColors.tonic.background : reading ? undefined : palette.cream
            }
            color={reading ? undefined : exerciseInk}
          >
            {hitCount} golpes
          </Badge>
        </View>
        <Label style={reading ? undefined : { color: exerciseInk }}>
          {reading
            ? 'Lee las figuras y toca después de cuatro pulsos.'
            : `Escucha ${length} pulsos y repite el patrón después de la cuenta de entrada.`}
        </Label>
        {harmonic ? (
          <HarmonicWagons
            active={active}
            chords={chords ?? null}
            nomenclature={nomenclature}
            onChangeBeat={changeBeat}
            pattern={pattern}
            wagons={scheduledWagons}
            playing={playing}
            wide={width >= 860}
          />
        ) : (
          <View style={{ gap: 8 }}>
            {trackRows.map((row, index) => (
              <View key={index} style={{ flexDirection: 'row', gap: 6 }}>
                {row.map((id, column) => {
                  const i = index * columns + column;
                  const selected = i === active;
                  return (
                    <Pressable
                      key={i}
                      accessibilityRole="button"
                      accessibilityLabel={`Pulso ${i + 1}, ${figurePool[id]!.name}. Cambiar figura`}
                      accessibilityState={{ selected, disabled: playing }}
                      disabled={playing}
                      onPress={() => changeBeat(i)}
                      style={({ pressed }) => ({
                        flex: 1,
                        minWidth: 0,
                        minHeight: 58,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 8,
                        borderWidth: 2,
                        opacity: pressed ? 0.68 : 1,
                        borderColor: reading
                          ? 'transparent'
                          : selected
                            ? palette.ink
                            : palette.cream,
                        backgroundColor: reading
                          ? selected
                            ? colors.green
                            : colors.pale
                          : selected
                            ? palette.cream
                            : palette.tiles[i % palette.tiles.length],
                      })}
                    >
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
        )}
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
        ) : !harmonic ? (
          <GrooveTrain active={active} segment={segment} />
        ) : null}
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
            backgroundColor: harmonic
              ? pressed
                ? colors.accentSoft
                : colors.raised
              : pressed
                ? reading
                  ? colors.white
                  : palette.green
                : reading
                  ? colors.pale
                  : palette.cream,
          })}
        >
          <Text
            style={{
              color: harmonic ? colors.ink : reading ? colors.accentText : exerciseInk,
              fontSize: 17,
              fontWeight: '600',
            }}
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
            <Label muted>{harmonic ? 'Modo de evaluación' : 'Nivel'}</Label>
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
                  if (harmonic) setLevel(value);
                  else if (value !== level) regenerate(Number(value));
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
                  minHeight={44}
                  value={source}
                  onChange={changeHarmonySource}
                  options={[...harmonicSources]}
                />
                {source === 'manual' ? (
                  <>
                    <Field
                      label="Acordes por pulso"
                      value={symbols}
                      onChangeText={(value) => {
                        setReplayChords(false);
                        setSymbols(value);
                      }}
                      placeholder="C G Am F"
                    />
                    <Label muted>
                      Separa los acordes con espacios. La secuencia se repite hasta llenar los{' '}
                      {defaultLength} pulsos.
                    </Label>
                    {chords === null ? (
                      <Label style={{ color: colors.error }}>
                        Revisa el cifrado. Prueba con C, Dm7♭5, G9, Am(maj7) o Fadd9.
                      </Label>
                    ) : inappropriateChords ? (
                      <Label style={{ color: colors.error }}>
                        {difficultyLabel} admite{' '}
                        {harmony === 'triads' ? 'tríadas' : 'tríadas y séptimas'}. Elige acordes de
                        ese nivel o cambia la dificultad.
                      </Label>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Label muted>Tonalidad</Label>
                    <Chips
                      minHeight={44}
                      value={mode}
                      onChange={(value: TrainMode) => {
                        setMode(value);
                        if (source === 'random') drawHarmony(value, resolvedDifficulty);
                      }}
                      options={[
                        { value: 'major', label: 'Mayor' },
                        { value: 'minor', label: 'Menor' },
                      ]}
                    />
                    <Chips
                      minHeight={44}
                      value={keyIndex}
                      onChange={setKeyIndex}
                      options={trainKeys.map((key, index) => ({
                        value: String(index),
                        label: pitchName(key[mode] + '4', false, nomenclature),
                      }))}
                    />
                    {source === 'random' ? (
                      <View style={[styles.row, { flexWrap: 'wrap' }]}>
                        <Button
                          variant="secondary"
                          onPress={() => drawHarmony(mode, resolvedDifficulty)}
                        >
                          Sortear progresión
                        </Button>
                        <Label>{recipe.label}</Label>
                      </View>
                    ) : (
                      <>
                        <Label muted>Progresión</Label>
                        <Chips
                          minHeight={44}
                          value={selectedProgression.value}
                          options={presets}
                          onChange={setProgression}
                        />
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <Label muted>Pulsa una figura para editarla antes de empezar.</Label>
            )}
            <Button
              variant="secondary"
              style={{ alignSelf: 'flex-start' }}
              onPress={harmonic ? regenerateChordLine : () => regenerate()}
            >
              {harmonic ? 'Nuevo ejercicio' : 'Nuevo patrón'}
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
