import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, TextInput } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';
import {
  Button,
  Chips,
  Heading,
  Icon,
  Label,
  MoreMenu,
  colors,
  radius,
  space,
  styles,
  useTheme,
} from './ui';
import { pianoPosition, scoreTimeline, synthTones, type TimedEvent } from '../core/scoreAudio';
import type { Player, PickedAudio } from '../platform/playerTypes';
import { exportScore } from '../platform/exportScore';
import { printTab } from '../platform/printTab';
import { PianoEntry, pianoKeys } from './PianoEntry';
import { ChordEditor } from './ChordEditor';
import { Fretboard } from './Fretboard';
import { ScoreView, type ScoreFrame } from './ScoreView';
import type { Instrument } from '../core/instrument';
import type { Nomenclature } from '../core/notation';
import type {
  BaseValue,
  Duration,
  EditCursor,
  Meter,
  Score,
  ScoreDisplay,
  Technique,
} from '../core/scoreTypes';
import {
  type Edit,
  MAX_SCORE_MEASURES,
  addMeasure,
  changeMeasureMeter,
  durationValue,
  insertNote,
  eventNotes,
  setChordNote,
  tiedStrings,
  insertRest,
  isMeasurePlaceholder,
  measureMeter,
  moveCursor,
  redo,
  repairMeasure,
  setDuration,
  setTechnique,
  toggleDot,
  toggleTie,
  toggleTriplet,
  tupletCount,
  undo,
} from '../core/score';
import {
  ENTRY_BASES,
  advanceAfterEntry,
  entryMeasureFill,
  eraseEntry,
  stepEntryDuration,
  createScoreEditor,
  editScore,
  fillScoreMeasures,
  restoreScore,
  selectScoreCursor,
  updateScoreTimeMap,
} from '../core/scoreEditor';
import {
  addBeatMarker,
  addMeasureMarker,
  beatAnchors,
  DEFAULT_SCORE_BPM,
  measureSpan,
  moveMeasureMarker,
  positionAt,
  removeMarkerNear,
  scorePlaybackMap,
  tapTempo,
  timeAtBeat,
} from '../core/timeMap';
import { loadScoreDoc, saveScoreDoc, type ScoreDoc } from '../data/scores';

const figureLabels = ['Redonda', 'Blanca', 'Negra', 'Corchea', 'Semicorchea'];
const figureKeys = 'whqes';
const pulseFormat = new Intl.NumberFormat('es', { maximumFractionDigits: 2 });
const techniques: { value: Technique | null; icon: string; label: string }[] = [
  { value: null, icon: '–', label: 'Sin técnica' },
  { value: 'hammer', icon: 'h', label: 'Ligado asc.' },
  { value: 'pull', icon: 'p', label: 'Ligado desc.' },
  { value: 'slide', icon: '/', label: 'Slide' },
  { value: 'dead', icon: '×', label: 'Nota muerta' },
  { value: 'staccato', icon: '•', label: 'Staccato' },
];
const notices = {
  chordOutside:
    'Mueve o quita el acorde que quedaría fuera del compás antes de cambiar la métrica.',
  split: 'La figura se dividió para respetar la métrica.',
  reflow: 'El sobrante pasó al compás siguiente.',
  limit: 'Se alcanzó el límite de compases.',
};
const fillLabels = { empty: 'Vacío', short: 'Incompleto', full: 'Completo', over: 'Pasado' };
const meters: Meter[] = [
  { beats: 4, unit: 4 },
  { beats: 3, unit: 4 },
  { beats: 2, unit: 4 },
  { beats: 6, unit: 8 },
  { beats: 12, unit: 8 },
];
const meterKey = (m: Meter) => `${m.beats}/${m.unit}`;
/**
 * Editor de la línea de bajo dentro de Transcribir. Dos modos, como en los
 * reproductores de transcripción: «Marcar» (teclas S, M, B sobre el audio,
 * las gestiona Transcribe) y «Escribir» (este componente captura el teclado).
 */
export function ScoreEditor({
  sessionId,
  audio,
  onSeekNote,
  player,
  onTimeline,
  duration,
  time,
  instrument,
  nomenclature,
  leftHanded,
  wide,
  editing,
  onEditingChange,
  onSeek,
  onLoop,
  register,
  onCursorFrame,
  renderLayout,
  fretboardHeight,
  playing,
  onTogglePlayback,
}: {
  sessionId: string;
  audio: PickedAudio;
  onSeekNote: (time: number) => void;
  player: Player;
  onTimeline: (events: TimedEvent[], bars: number[], beats: number[]) => void;
  duration: number;
  time: number;
  instrument: Instrument;
  nomenclature: Nomenclature;
  leftHanded: boolean;
  wide: boolean;
  fretboardHeight: number;
  playing: boolean;
  onTogglePlayback: () => void;
  onCursorFrame: (
    view: React.ComponentRef<typeof View>,
    cursor: ScoreFrame,
    system?: ScoreFrame,
  ) => void;
  renderLayout: (
    score: React.ReactNode,
    entry: React.ReactNode,
    alignment: React.ReactNode,
    onMoveMeasure: (index: number, time: number) => void,
  ) => React.JSX.Element;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSeek: (time: number) => void;
  onLoop: (span: { a: number; b: number } | null) => void;
  /** Transcribe registra aquí las acciones de marcado para sus atajos (M, B). */
  register: (actions: { markMeasure: () => void; markBeat: () => void } | null) => void;
}) {
  const { colors: theme } = useTheme();
  const [entryExpanded, setEntryExpanded] = useState(true);
  const [{ history, timeMap }, setEditor] = useState(createScoreEditor);
  const [display, setDisplay] = useState<ScoreDisplay>('both');
  const [entryDuration, setEntryDuration] = useState<Duration>({ base: 8, dots: 0 });
  const durationRef = useRef(entryDuration);
  const [tools, setTools] = useState<'actions' | 'techniques' | 'keys' | 'chords' | null>(null);
  const [input, setInput] = useState<'neck' | 'piano'>('neck');
  const [pianoBase, setPianoBase] = useState(Math.floor(instrument.strings[0]! / 12) * 12);
  const [preference, setPreference] = useState<'low' | 'high'>('low');
  const [chordMode, setChordMode] = useState(false);
  const [lastNote, setLastNote] = useState<{ string: number; fret: number } | null>(null);
  const scoreRegion = useRef<React.ComponentRef<typeof View>>(null);
  const showCursor = useCallback(
    (cursor: ScoreFrame, system?: ScoreFrame) => {
      if (scoreRegion.current) onCursorFrame(scoreRegion.current, cursor, system);
    },
    [onCursorFrame],
  );
  const [taps, setTaps] = useState<number[]>([]);
  const [marking, setMarking] = useState<'manual' | 'tempo'>('manual');
  const tempo = useMemo(() => tapTempo(taps), [taps]);
  // BPM elegido a mano: manda sobre el tap tempo y recoloca los compases.
  const [manualBpm, setManualBpm] = useState<number | null>(null);
  const bpm = manualBpm ?? tempo?.bpm ?? DEFAULT_SCORE_BPM;
  const [width, setWidth] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const { score, cursor: position } = history.present;
  const timeline = useMemo(
    () => scoreTimeline(score, timeMap, duration, instrument, bpm),
    [score, timeMap, duration, instrument, bpm],
  );
  useEffect(() => {
    onTimeline(timeline, timeMap.measures, timeMap.beats);
    player.setTones(synthTones(timeline));
  }, [timeline, timeMap.measures, timeMap.beats, player, onTimeline, audio]);
  const cursor = { ...position, string: Math.min(position.string, instrument.strings.length - 1) };
  const bar = score.measures[cursor.measure]!;
  const event = isMeasurePlaceholder(bar) ? undefined : bar.events[cursor.event];
  const timeRef = useRef(time);
  timeRef.current = time;
  const pendingSave = useRef<ScoreDoc | null>(null);

  // El editor se monta por canción. Un cambio de afinación no vuelve a cargar el documento.
  useEffect(() => {
    let alive = true;
    void loadScoreDoc(sessionId)
      .then((doc) => {
        if (!alive) return;
        if (doc) {
          setEditor(createScoreEditor(doc.score, doc.timeMap));
          setDisplay(doc.display);
          setManualBpm(doc.bpm ?? null);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setError('No se pudo leer la partitura guardada.');
      });
    return () => {
      alive = false;
    };
  }, [sessionId]);

  // Conserva la última edición aunque se cambie de canción antes de los 700 ms.
  useEffect(() => {
    if (!loaded) return;
    const doc = {
      score,
      timeMap,
      display,
      updatedAt: new Date().toISOString(),
      ...(manualBpm !== null ? { bpm: manualBpm } : {}),
    };
    pendingSave.current = doc;
    const timer = setTimeout(() => {
      pendingSave.current = null;
      void saveScoreDoc(sessionId, doc).catch(() =>
        setError('No se pudo guardar la partitura en este dispositivo.'),
      );
    }, 700);
    return () => clearTimeout(timer);
  }, [score, timeMap, display, loaded, sessionId]);
  useEffect(
    () => () => {
      if (pendingSave.current) void saveScoreDoc(sessionId, pendingSave.current).catch(() => {});
    },
    [sessionId],
  );

  const run = useCallback(
    (fn: (s: Score, c: EditCursor) => Edit) => {
      if (!loaded) return;
      setEditor((state) => editScore(state, fn));
      setError('');
    },
    [loaded],
  );
  const changeHistory = (travel: typeof undo) => {
    if (loaded) setEditor((state) => restoreScore(state, travel));
    setLastNote(null);
  };
  const adjustEvent = useCallback(
    (fn: (s: Score, c: EditCursor) => Edit) =>
      run((s, c) => {
        const measure = s.measures[c.measure];
        return measure?.events[c.event] && !isMeasurePlaceholder(measure)
          ? fn(s, c)
          : { score: s, cursor: c };
      }),
    [run],
  );

  // Marcas sobre el audio (las teclas M y B las envía Transcribe).
  const markMeasure = useCallback(() => {
    const now = timeRef.current;
    if (!loaded || now >= duration) return;
    setEditor((state) => updateScoreTimeMap(state, addMeasureMarker(state.timeMap, now)));
  }, [duration, loaded]);
  const markBeat = useCallback(() => {
    const now = timeRef.current;
    if (loaded) setEditor((state) => updateScoreTimeMap(state, addBeatMarker(state.timeMap, now)));
  }, [loaded]);
  useEffect(() => {
    register({ markMeasure, markBeat });
    return () => register(null);
  }, [register, markMeasure, markBeat]);

  const moveMarker = (index: number, next: number) => {
    if (!loaded || duration <= 0) return;
    setEditor((state) =>
      updateScoreTimeMap(
        state,
        moveMeasureMarker(state.timeMap, index, Math.min(next, Math.max(0, duration - 0.001))),
      ),
    );
  };
  const tap = () => {
    if (!loaded) return;
    const now = timeRef.current;
    setTaps((t) => {
      const last = t.at(-1);
      if (last === now) return t;
      // Un salto hacia atrás o una pausa larga inicia otra serie sobre el audio.
      const keep = last !== undefined && (now < last || now - last > 2) ? [] : t;
      return [...keep, now].slice(-9);
    });
  };
  /** Cambia el BPM y, si hay compás 1, recoloca todos los compases desde él. */
  const applyBpm = (value: number) => {
    if (!Number.isFinite(value)) return;
    const next = Math.round(Math.min(300, Math.max(20, value)) * 10) / 10;
    setManualBpm(next);
    if (!loaded) return;
    setEditor((state) =>
      state.timeMap.measures.length
        ? fillScoreMeasures(state, state.timeMap.measures[0]!, next, duration)
        : state,
    );
  };
  const fillFromFirst = () => {
    if (!loaded || (!tempo && manualBpm === null)) return;
    setEditor((state) =>
      state.timeMap.measures.length === 1
        ? fillScoreMeasures(state, state.timeMap.measures[0]!, bpm, duration)
        : state,
    );
  };

  const playbackMap = useMemo(() => scorePlaybackMap(score, timeMap, bpm), [score, timeMap, bpm]);
  const playhead = useMemo(
    () => positionAt(playbackMap, score, time, duration),
    [playbackMap, score, time, duration],
  );
  const goToMeasure = (measure: number) => {
    const span = measureSpan(playbackMap, measure, duration);
    setEditor((state) =>
      selectScoreCursor(state, { ...state.history.present.cursor, measure, event: 0 }),
    );
    if (span) {
      onLoop({ a: span.start, b: span.end });
      onSeek(span.start);
    }
  };
  const select = (cursor: EditCursor) => setEditor((state) => selectScoreCursor(state, cursor));

  const pendingFret = useRef<{ value: string; timer: ReturnType<typeof setTimeout> | null }>({
    value: '',
    timer: null,
  });
  const takeFret = useCallback(() => {
    const { value, timer } = pendingFret.current;
    if (timer !== null) clearTimeout(timer);
    pendingFret.current = { value: '', timer: null };
    return value;
  }, []);
  const writeNote = useCallback(
    (fret: number, string = cursor.string) => {
      if (!loaded) return;
      if (!Number.isInteger(fret) || fret < 0 || fret > instrument.frets) {
        setError('Traste fuera del instrumento.');
        return;
      }
      const duration = durationRef.current;
      run((s, c) =>
        chordMode
          ? setChordNote(s, { ...c, string }, fret, duration, instrument)
          : advanceAfterEntry(insertNote(s, { ...c, string }, fret, duration, instrument)),
      );
      setLastNote({ string, fret });
    },
    [cursor.string, instrument, loaded, run, chordMode],
  );
  const writePitch = useCallback(
    (midi: number) => {
      const pos = pianoPosition(
        instrument,
        midi,
        preference,
        chordMode ? eventNotes(event).map((n) => n.string) : [],
      );
      if (pos) writeNote(pos.fret, pos.string);
      else setError('Altura fuera del mástil.');
    },
    [instrument, preference, writeNote, chordMode, event],
  );
  const latestWrite = useRef(writeNote);
  latestWrite.current = writeNote;
  const flushFret = useCallback(() => {
    const value = takeFret();
    if (value) latestWrite.current(Number(value));
  }, [takeFret]);
  useEffect(() => {
    if (editing)
      return () => {
        takeFret();
      };
  }, [editing, takeFret]);

  const changeFigure = useCallback(
    (change: (current: Duration) => Duration) => {
      flushFret();
      const next = change(durationRef.current);
      durationRef.current = next;
      setEntryDuration(next);
    },
    [flushFret],
  );
  const writeRest = useCallback(() => {
    flushFret();
    const duration = durationRef.current;
    run((s, c) => advanceAfterEntry(insertRest(s, c, duration)));
  }, [flushFret, run]);
  const erase = useCallback(
    (backward: boolean) => {
      run((s, c) =>
        chordMode
          ? setChordNote(s, c, null, durationRef.current, instrument)
          : eraseEntry(s, c, backward),
      );
      setLastNote(null);
    },
    [run, chordMode, instrument],
  );
  useEffect(() => {
    if (Platform.OS !== 'web' || !editing || !loaded || typeof document === 'undefined') return;
    const moves: Record<string, Parameters<typeof moveCursor>[2]> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
      PageDown: 'nextMeasure',
      PageUp: 'prevMeasure',
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.defaultPrevented ||
        target?.closest('input, textarea, select, [contenteditable=true], [role=slider]')
      )
        return;
      const key = e.key;
      const lower = key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && lower === 'z') {
        e.preventDefault();
        flushFret();
        setEditor((state) => restoreScore(state, e.shiftKey ? redo : undo));
        setLastNote(null);
        return;
      }
      if (mod || e.altKey) return;
      if (lower === 'c') {
        e.preventDefault();
        if (!e.repeat) {
          flushFret();
          setChordMode((v) => !v);
        }
        return;
      }
      if (input === 'piano' && pianoKeys.includes(lower) && lower.length === 1) {
        e.preventDefault();
        if (!e.repeat) writePitch(pianoBase + pianoKeys.indexOf(lower));
        return;
      }
      if (input === 'neck' && /^[0-9]$/.test(key)) {
        e.preventDefault();
        const p = pendingFret.current;
        if (p.timer !== null) clearTimeout(p.timer);
        p.value += key;
        if (p.value.length === 2 || key === '0' || Number(key) * 10 > instrument.frets) flushFret();
        else p.timer = setTimeout(flushFret, 600);
        return;
      }
      const base = ENTRY_BASES[figureKeys.indexOf(lower)];
      const move = moves[key];
      if (move) {
        e.preventDefault();
        flushFret();
        setEditor((state) => {
          const { score, cursor } = state.history.present;
          return selectScoreCursor(state, moveCursor(score, cursor, move, instrument));
        });
      } else if (base || key === '+' || key === '-' || key === '.' || lower === 't') {
        e.preventDefault();
        const editSelected = !base && !pendingFret.current.value;
        changeFigure((d) => {
          if (base) return { ...d, base };
          if (key === '.') return { ...d, dots: d.dots ? 0 : 1 };
          if (lower === 't')
            return { ...d, tuplet: undefined, triplet: !(d.triplet || d.tuplet === 3) };
          return stepEntryDuration(d, key === '+' ? 'longer' : 'shorter');
        });
        if (editSelected) {
          if (key === '.') adjustEvent(toggleDot);
          else if (lower === 't') adjustEvent(toggleTriplet);
          else
            adjustEvent((s, c) => {
              const duration = s.measures[c.measure]!.events[c.event]!.duration;
              const next = stepEntryDuration(duration, key === '+' ? 'longer' : 'shorter');
              return next === duration
                ? { score: s, cursor: c }
                : setDuration(s, c, next.tuplet === 15 ? { base: next.base, dots: 0 } : next);
            });
        }
      } else if (lower === 'l') {
        flushFret();
        adjustEvent(toggleTie);
      } else if (lower === 'r') {
        writeRest();
      } else if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault();
        if (pendingFret.current.value && key === 'Backspace') takeFret();
        else {
          flushFret();
          erase(key === 'Backspace');
        }
      } else if (key === 'Escape') onEditingChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [
    editing,
    input,
    writePitch,
    pianoBase,
    loaded,
    flushFret,
    takeFret,
    adjustEvent,
    changeFigure,
    writeRest,
    erase,
    instrument,
    onEditingChange,
  ]);

  const suggestAudio = useMemo(() => {
    if (timeMap.measures[cursor.measure] === undefined) return null;
    const anchors = beatAnchors(playbackMap, score, cursor.measure, duration);
    if (!anchors) return null;
    return (start: number, end: number) => {
      const from = timeAtBeat(anchors, start);
      const to = timeAtBeat(anchors, end);
      return from !== null && to !== null
        ? player.suggestChord(from, Math.min(to, duration))
        : null;
    };
  }, [cursor.measure, duration, playbackMap, score, timeMap.measures, player, audio]);
  const fill = entryMeasureFill(score, cursor.measure);
  const currentMeter = measureMeter(score, cursor.measure);
  const ratio = (fill.actual.n * fill.expected.d) / (fill.actual.d * fill.expected.n);
  const fillColor = fill.status === 'over' ? colors.error : colors.accentText;
  const toggleTools = (next: typeof tools) => setTools(tools === next ? null : next);
  const technique = techniques.find((item) => item.value === (event?.technique ?? null))!;
  const entryFolded = !wide && !entryExpanded;
  const entryStatus = (
    <>
      <View style={[styles.between, { gap: 8 }]}>
        <Label>
          Compás {cursor.measure + 1} · {meterKey(currentMeter)}
        </Label>
        <Label style={{ color: fillColor }}>{fillLabels[fill.status]}</Label>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Llenado del compás ${cursor.measure + 1}`}
        accessibilityValue={{
          text: `${fillLabels[fill.status]}, ${Math.round(ratio * 100)} %`,
        }}
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.accentSoft,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${Math.min(ratio * 100, 100)}%`,
            backgroundColor: fillColor,
          }}
        />
      </View>
      {fill.status === 'over' ? (
        <Button variant="secondary" onPress={() => run(repairMeasure)}>
          Corregir compás pasado
        </Button>
      ) : null}
      {wide && history.present.notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {notices[history.present.notice]}
        </Text>
      ) : null}
    </>
  );
  const figureControls = (
    <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
      {ENTRY_BASES.map((base, i) => (
        <EntryKey
          key={base}
          label={figureLabels[i]!}
          selected={entryDuration.base === base}
          onPress={() => changeFigure((d) => ({ ...d, base }))}
        >
          <Figure
            base={base}
            color={entryDuration.base === base ? colors.onAccent : colors.accentText}
          />
        </EntryKey>
      ))}
      <EntryKey
        label="Puntillo"
        selected={!!entryDuration.dots}
        onPress={() => changeFigure((d) => ({ ...d, dots: d.dots ? 0 : 1 }))}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24" aria-hidden>
          <Circle
            cx={12}
            cy={12}
            r={2.5}
            fill={entryDuration.dots ? colors.onAccent : colors.accent}
          />
        </Svg>
      </EntryKey>
      {([3, 5] as const).map((count) => {
        const selected = (entryDuration.tuplet ?? (entryDuration.triplet ? 3 : 1)) === count;
        return (
          <EntryKey
            key={count}
            label={count === 3 ? 'Tresillo' : 'Quintillo'}
            selected={selected}
            onPress={() =>
              changeFigure((d) => ({
                ...d,
                triplet: undefined,
                tuplet: selected ? undefined : count,
              }))
            }
          >
            <Text
              style={{
                color: selected ? colors.onAccent : colors.accentText,
                fontWeight: '700',
              }}
            >
              {count}
            </Text>
          </EntryKey>
        );
      })}
    </View>
  );
  const inputSelector = (
    <Chips
      minHeight={wide ? undefined : 44}
      value={input}
      onChange={(v) => {
        takeFret();
        setInput(v);
      }}
      options={[
        { value: 'neck', label: 'Mástil' },
        { value: 'piano', label: 'Piano' },
      ]}
    />
  );
  const piano = (
    <PianoEntry
      instrument={instrument}
      base={pianoBase}
      onBase={setPianoBase}
      preference={preference}
      onPreference={setPreference}
      onPitch={writePitch}
      nomenclature={nomenclature}
      keysOnly={entryFolded}
      minControlHeight={wide ? undefined : 44}
    />
  );
  const fretboard = (
    <Fretboard
      compact
      onlyString={entryFolded ? cursor.string : undefined}
      instrument={instrument}
      nomenclature={nomenclature}
      leftHanded={leftHanded}
      marks={eventNotes(event).map((n) => ({ ...n, label: String(n.fret) }))}
      activeString={cursor.string}
      active={event || chordMode ? null : lastNote}
      onPress={(string, fret) => {
        takeFret();
        writeNote(fret, string);
      }}
    />
  );
  const entryActions = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      <EntryKey
        label="Modo Acorde (C)"
        selected={chordMode}
        onPress={() => {
          flushFret();
          setChordMode((v) => !v);
        }}
      >
        <Text style={{ color: chordMode ? colors.onAccent : colors.accentText }}>Acorde</Text>
      </EntryKey>
      <EntryKey label={playing ? 'Pausa' : 'Reproducir'} onPress={onTogglePlayback}>
        <Icon name={playing ? 'pause' : 'play'} size={18} color={colors.accentText} />
      </EntryKey>
      <Button variant="ghost" style={{ paddingHorizontal: 12 }} onPress={writeRest}>
        Silencio
      </Button>
      <Button variant="ghost" style={{ paddingHorizontal: 12 }} onPress={() => erase(!event)}>
        {chordMode ? 'Borrar cuerda' : 'Borrar'}
      </Button>
    </View>
  );
  const editorTools = (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        <EntryKey
          label={technique.value ? `Técnica: ${technique.label}` : 'Técnica'}
          expanded={tools === 'techniques'}
          disabled={!eventNotes(event).length}
          onPress={() => toggleTools('techniques')}
        >
          <Icon name="note" size={16} color={colors.accentText} />
          <Text style={{ color: colors.accentText }}>
            {' '}
            {technique.value ? technique.label : 'Técnica'}
          </Text>
        </EntryKey>
        <EntryKey
          label="Acciones de edición"
          expanded={tools === 'actions'}
          onPress={() => toggleTools('actions')}
        >
          <Text style={{ color: colors.accentText }}>Acciones</Text>
        </EntryKey>
        <EntryKey
          label="Acordes del compás"
          expanded={tools === 'chords'}
          onPress={() => toggleTools('chords')}
        >
          <Text style={{ color: colors.accentText }}>Acordes</Text>
        </EntryKey>
        {Platform.OS === 'web' ? (
          <EntryKey
            label="Atajos de teclado"
            expanded={tools === 'keys'}
            onPress={() => toggleTools('keys')}
          >
            <Text style={{ color: colors.accentText }}>Teclado</Text>
          </EntryKey>
        ) : null}
      </View>
      {tools === 'chords' ? (
        <ChordEditor
          key={bar.id + '-' + meterKey(currentMeter)}
          bar={bar}
          meter={currentMeter}
          instrument={instrument}
          suggestAudio={suggestAudio}
          onSave={(beat, symbol) =>
            run((s, c) => ({
              cursor: c,
              score: {
                ...s,
                measures: s.measures.map((m, i) =>
                  i !== c.measure
                    ? m
                    : {
                        ...m,
                        chords: [
                          ...(m.chords ?? []).filter((ch) => ch.beat !== beat),
                          ...(symbol ? [{ beat, symbol }] : []),
                        ].sort((a, b) => a.beat - b.beat),
                      },
                ),
              },
            }))
          }
        />
      ) : null}
      {tools === 'keys' ? (
        <Label muted>
          {input === 'piano'
            ? 'Piano: A W S E D F T G Y H U J, desde Do hasta Si.'
            : 'Números · traste.'}{' '}
          C · modo Acorde. Flechas · cursor. +/− · figura. . · puntillo.{' '}
          {input === 'neck' ? 'T · tresillo. ' : ''} R · silencio. L · ligadura. Supr · borrar
          selección. Retroceso · borrar anterior. Ctrl+Z o ⌘Z · deshacer (Mayús · rehacer). Esc ·
          salir.
        </Label>
      ) : null}
      {tools === 'techniques' && eventNotes(event).length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {techniques.map((item) => (
            <EntryKey
              key={item.label}
              label={item.label}
              selected={item === technique}
              onPress={() => {
                adjustEvent((s, c) => setTechnique(s, c, item.value));
                setTools(null);
              }}
            >
              <Text style={{ color: item === technique ? colors.onAccent : colors.accentText }}>
                {item.icon} {item.label}
              </Text>
            </EntryKey>
          ))}
        </View>
      ) : null}
      {tools === 'actions' ? (
        <View style={{ gap: 8 }}>
          <Chips
            minHeight={44}
            value={meterKey(currentMeter)}
            onChange={(k) => {
              const m = meters.find((x) => meterKey(x) === k)!;
              run((s, c) => changeMeasureMeter(s, c, m));
            }}
            options={meters.map((m) => ({ value: meterKey(m), label: meterKey(m) }))}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            <Button
              variant="ghost"
              disabled={score.measures.length >= MAX_SCORE_MEASURES}
              onPress={() =>
                run((s, c) =>
                  s.measures.length < MAX_SCORE_MEASURES
                    ? {
                        score: addMeasure(s, c.measure),
                        cursor: { ...c, measure: c.measure + 1, event: 0 },
                      }
                    : { score: s, cursor: c },
                )
              }
            >
              Añadir compás
            </Button>
            <Button
              variant="ghost"
              disabled={!event}
              onPress={() => adjustEvent((s, c) => setDuration(s, c, durationRef.current))}
            >
              Aplicar figura
            </Button>
            <Button
              variant="ghost"
              disabled={!eventNotes(event).length}
              onPress={() => adjustEvent(toggleTie)}
            >
              {event && tiedStrings(event).includes(cursor.string) ? 'Quitar ligadura' : 'Ligadura'}
            </Button>
            <Button
              variant="ghost"
              disabled={!history.past.length}
              onPress={() => changeHistory(undo)}
            >
              Deshacer
            </Button>
            <Button
              variant="ghost"
              disabled={!history.future.length}
              onPress={() => changeHistory(redo)}
            >
              Rehacer
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
  const pulse = isMeasurePlaceholder(bar)
    ? 1
    : 1 +
      bar.events.slice(0, cursor.event).reduce((offset, item) => {
        const length = durationValue(item.duration);
        return offset + (length.n * currentMeter.unit) / length.d;
      }, 0);
  const figure = figureLabels[ENTRY_BASES.indexOf(entryDuration.base)];
  const tuplet = tupletCount(entryDuration);
  const figureName = `${figure}${entryDuration.dots ? ' con puntillo' : ''}${
    tuplet === 3 ? ' en tresillo' : tuplet === 5 ? ' en quintillo' : ''
  }`;
  const entryToggleLabel = entryExpanded ? 'Ocultar teclado' : 'Mostrar teclado';
  const entry =
    editing && loaded ? (
      wide ? (
        <View style={{ gap: 6 }}>
          {entryStatus}
          {figureControls}
          {inputSelector}
          {input === 'piano' ? (
            piano
          ) : (
            <ScrollView nestedScrollEnabled style={{ flexGrow: 0, maxHeight: fretboardHeight }}>
              {fretboard}
            </ScrollView>
          )}
          {entryActions}
        </View>
      ) : (
        <View style={{ flexShrink: 1, minHeight: 0, gap: space.xs }}>
          <View
            accessibilityRole="toolbar"
            accessibilityLabel="Panel de escritura"
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, flexShrink: 0 }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.muted, { color: theme.ink }]}>
                Compás {cursor.measure + 1} · Pulso {pulseFormat.format(pulse)} · {figureName}
              </Text>
              {history.present.notice ? (
                <Text accessibilityLiveRegion="polite" style={styles.muted}>
                  {notices[history.present.notice]}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={entryToggleLabel}
              accessibilityState={{ expanded: entryExpanded }}
              aria-expanded={entryExpanded}
              onPress={() => setEntryExpanded((expanded) => !expanded)}
              style={({ pressed }) => ({
                minWidth: 44,
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.xs,
                paddingHorizontal: space.s,
                borderRadius: radius.chip,
                backgroundColor: theme.accentSoft,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Text style={[styles.muted, { color: theme.accentText }]}>{entryToggleLabel}</Text>
              <Icon
                name={entryExpanded ? 'chevron-down' : 'chevron-up'}
                size={16}
                color={theme.accentText}
              />
            </Pressable>
          </View>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={{ flexGrow: 0, minHeight: 0 }}
            contentContainerStyle={{ gap: space.s }}
          >
            {input === 'piano' ? piano : fretboard}
            {entryExpanded ? (
              <>
                {figureControls}
                {inputSelector}
                {entryActions}
                {entryStatus}
                {editorTools}
              </>
            ) : null}
          </ScrollView>
        </View>
      )
    ) : null;

  return renderLayout(
    <View style={[styles.panel, { gap: 12, padding: wide ? 24 : 12 }]}>
      <View style={styles.between}>
        <Heading level={2} style={styles.h2}>
          Partitura
        </Heading>
        <Chips
          minHeight={44}
          label="Modo"
          value={editing ? 'write' : 'mark'}
          onChange={(v) => onEditingChange(v === 'write')}
          options={[
            { value: 'mark', label: 'Marcar' },
            { value: 'write', label: 'Escribir' },
          ]}
        />
      </View>
      {/* Vista y exportación: secundarias, plegadas tras «Más». */}
      <MoreMenu label="Vista y exportar">
        <View style={{ gap: 12, flex: 1 }}>
          <Chips<ScoreDisplay>
            minHeight={44}
            label="Vista"
            value={display}
            onChange={setDisplay}
            options={[
              { value: 'both', label: 'Pentagrama y tablatura' },
              { value: 'tab', label: 'Tablatura' },
              { value: 'staff', label: 'Pentagrama' },
            ]}
          />
          <View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>
            <Button
              variant="secondary"
              small
              disabled={!loaded}
              onPress={() => {
                try {
                  printTab(audio.name, score, instrument);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Exportar PDF
            </Button>
            {Platform.OS === 'web' &&
              (['txt', 'musicxml'] as const).map((format) => (
                <Button
                  key={format}
                  variant="secondary"
                  small
                  disabled={!loaded}
                  onPress={() => {
                    try {
                      exportScore(format, audio.name, score, instrument);
                    } catch (error) {
                      setError((error as Error).message);
                    }
                  }}
                >
                  {format === 'txt' ? 'Exportar TXT' : 'Exportar MusicXML'}
                </Button>
              ))}
          </View>
        </View>
      </MoreMenu>

      {wide && editing && loaded ? editorTools : null}

      <View
        ref={scoreRegion}
        collapsable={false}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width);
        }}
      >
        {width > 0 && loaded ? (
          <ScoreView
            score={score}
            instrument={instrument}
            display={display}
            width={width}
            playhead={playhead}
            cursor={editing ? cursor : null}
            onCursorFrame={editing ? showCursor : undefined}
            followCursorSystem={!wide}
            onPressEvent={(c) => {
              flushFret();
              const e = score.measures[c.measure]?.events[c.event];
              const timed = e && timeline.find((t) => t.id === e.id);
              if (!editing && (!timed || !eventNotes(e).length)) {
                goToMeasure(c.measure);
                return;
              }
              select(c);
              if (timed) onSeekNote(timed.start);
            }}
            selectedMeasures={!editing ? { from: cursor.measure, to: cursor.measure } : null}
            onPressMeasure={!editing ? goToMeasure : undefined}
          />
        ) : null}
      </View>
      {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
    </View>,
    entry,
    !editing && loaded ? (
      <View style={{ gap: 8 }}>
        <Heading level={2} style={styles.h3}>
          Alinear compases
        </Heading>
        <Chips
          minHeight={44}
          value={marking}
          onChange={setMarking}
          options={[
            { value: 'manual', label: 'A mano' },
            { value: 'tempo', label: 'Tempo fijo' },
          ]}
        />
        {marking === 'manual' ? (
          <>
            <Label>1. Reproduce y pulsa «Compás» en cada primer tiempo.</Label>
            <View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>
              <Button onPress={markMeasure}>Compás (M)</Button>
              <Button variant="secondary" onPress={markBeat}>
                Pulso (B)
              </Button>
            </View>
            <Label muted>2. Amplía la onda y arrastra los números para ajustar las marcas.</Label>
          </>
        ) : (
          <>
            <Label>
              1. Reproduce y toca «Tap tempo» al menos tres veces al pulso de la canción.
            </Label>
            <View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>
              <Button variant="secondary" onPress={tap}>
                Tap tempo
              </Button>
              {taps.length > 0 ? (
                <Label>
                  {tempo ? `${Math.round(tempo.bpm)} BPM` : `${taps.length} de 3 toques`}
                </Label>
              ) : null}
            </View>
            <Label>2. Pausa, sitúa el cursor en el primer tiempo y marca el compás 1.</Label>
            <Button
              variant="secondary"
              style={{ alignSelf: 'flex-start' }}
              disabled={timeMap.measures.length > 0}
              onPress={markMeasure}
            >
              {timeMap.measures.length > 0 ? 'Compás 1 marcado' : 'Marcar compás 1'}
            </Button>
            <Label>3. Ajusta el tempo si hace falta: los compases se recolocan solos.</Label>
            <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>
              <Button small variant="secondary" onPress={() => applyBpm(bpm - 1)}>
                −1
              </Button>
              <Button small variant="secondary" onPress={() => applyBpm(bpm - 0.1)}>
                −0,1
              </Button>
              <TextInput
                accessibilityLabel="Tempo en BPM"
                keyboardType="numeric"
                defaultValue={String(Math.round(bpm * 10) / 10)}
                key={Math.round(bpm * 10)}
                onEndEditing={(e) => applyBpm(Number(e.nativeEvent.text.replace(',', '.')))}
                onSubmitEditing={(e) => applyBpm(Number(e.nativeEvent.text.replace(',', '.')))}
                style={[
                  styles.field,
                  { width: 84, minHeight: 40, paddingVertical: 8, textAlign: 'center' },
                ]}
              />
              <Label>BPM</Label>
              <Button small variant="secondary" onPress={() => applyBpm(bpm + 0.1)}>
                +0,1
              </Button>
              <Button small variant="secondary" onPress={() => applyBpm(bpm + 1)}>
                +1
              </Button>
            </View>
            <Label>4. Rellena los compases. Amplía la onda para ajustar las marcas.</Label>
            <Button
              style={{ alignSelf: 'flex-start' }}
              disabled={(!tempo && manualBpm === null) || timeMap.measures.length !== 1}
              onPress={fillFromFirst}
            >
              {timeMap.measures.length > 1 ? 'Compases marcados' : 'Rellenar compases'}
            </Button>
          </>
        )}
        {timeMap.measures.length || timeMap.beats.length ? (
          <View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>
            <Label muted>
              {timeMap.measures.length}{' '}
              {timeMap.measures.length === 1 ? 'compás marcado' : 'compases marcados'}
              {timeMap.beats.length ? ` · ${timeMap.beats.length} pulsos` : ''}
            </Label>
            <Button
              variant="ghost"
              onPress={() =>
                setEditor((state) =>
                  updateScoreTimeMap(state, removeMarkerNear(state.timeMap, timeRef.current)),
                )
              }
            >
              Quitar marca junto al cursor
            </Button>
          </View>
        ) : (
          <Label muted>Tempo de escucha provisional · {Math.round(bpm)} BPM</Label>
        )}
      </View>
    ) : null,
    moveMarker,
  );
}

function EntryKey({
  label,
  selected,
  expanded,
  disabled,
  children,
  onPress,
}: {
  label: string;
  selected?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, expanded, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 44,
        minHeight: 44,
        paddingHorizontal: 6,
        borderRadius: 7,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: selected ? colors.accent : colors.accentSoft,
        opacity: disabled ? 0.45 : pressed ? 0.65 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

function Figure({ base, color }: { base: BaseValue; color: string }) {
  return (
    <Svg width={24} height={28} viewBox="0 0 24 28" aria-hidden>
      <Ellipse
        cx={9}
        cy={21}
        rx={base === 1 ? 5.2 : 4.2}
        ry={3}
        rotation={base === 1 ? 0 : -20}
        origin="9,21"
        fill={base >= 4 ? color : 'none'}
        stroke={color}
        strokeWidth={1.7}
      />
      {base > 1 ? <Line x1={13} x2={13} y1={20} y2={3} stroke={color} strokeWidth={1.7} /> : null}
      {base >= 8 ? <Path d="M13 3q7 4 6 8" fill="none" stroke={color} strokeWidth={1.7} /> : null}
      {base === 16 ? <Path d="M13 8q7 4 6 8" fill="none" stroke={color} strokeWidth={1.7} /> : null}
    </Svg>
  );
}
