import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';
import { Button, Chips, Heading, Icon, Label, colors, styles } from './ui';
import { Fretboard } from './Fretboard';
import { ScoreView } from './ScoreView';
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
  insertNote,
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
  measureSpan,
  positionAt,
  removeMarkerNear,
  tapTempo,
} from '../core/timeMap';
import { loadScoreDoc, saveScoreDoc, type ScoreDoc } from '../data/scores';

const figureLabels = ['Redonda', 'Blanca', 'Negra', 'Corchea', 'Semicorchea'];
const figureKeys = 'whqes';
const techniques: { value: Technique | null; icon: string; label: string }[] = [
  { value: null, icon: '–', label: 'Sin técnica' },
  { value: 'hammer', icon: 'h', label: 'Ligado asc.' },
  { value: 'pull', icon: 'p', label: 'Ligado desc.' },
  { value: 'slide', icon: '/', label: 'Slide' },
  { value: 'dead', icon: '×', label: 'Nota muerta' },
  { value: 'staccato', icon: '•', label: 'Staccato' },
];
const notices = {
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
  duration: number;
  time: number;
  instrument: Instrument;
  nomenclature: Nomenclature;
  leftHanded: boolean;
  wide: boolean;
  fretboardHeight: number;
  playing: boolean;
  onTogglePlayback: () => void;
  onCursorFrame: (view: React.ComponentRef<typeof View>, top: number, height: number) => void;
  renderLayout: (score: React.ReactNode, entry: React.ReactNode) => React.JSX.Element;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSeek: (time: number) => void;
  onLoop: (span: { a: number; b: number } | null) => void;
  /** Transcribe registra aquí las acciones de marcado para sus atajos (M, B). */
  register: (actions: { markMeasure: () => void; markBeat: () => void } | null) => void;
}) {
  const [{ history, timeMap }, setEditor] = useState(createScoreEditor);
  const [display, setDisplay] = useState<ScoreDisplay>('both');
  const [entryDuration, setEntryDuration] = useState<Duration>({ base: 8, dots: 0 });
  const durationRef = useRef(entryDuration);
  const [tools, setTools] = useState<'actions' | 'techniques' | 'keys' | null>(null);
  const [allFrets, setAllFrets] = useState(false);
  const [lastNote, setLastNote] = useState<{ string: number; fret: number } | null>(null);
  const scoreRegion = useRef<React.ComponentRef<typeof View>>(null);
  const showCursor = useCallback(
    (top: number, height: number) => {
      if (scoreRegion.current) onCursorFrame(scoreRegion.current, top, height);
    },
    [onCursorFrame],
  );
  const inputInstrument = useMemo(
    () => (allFrets || instrument.frets <= 12 ? instrument : { ...instrument, frets: 12 }),
    [allFrets, instrument],
  );
  const [taps, setTaps] = useState<number[]>([]);
  const [width, setWidth] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const { score, cursor: position } = history.present;
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
    const doc = { score, timeMap, display, updatedAt: new Date().toISOString() };
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

  const tempo = useMemo(() => tapTempo(taps), [taps]);
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
  const fillFromHere = () => {
    const start = timeRef.current;
    if (!loaded || !tempo || start >= duration) return;
    setEditor((state) => fillScoreMeasures(state, start, tempo.bpm, duration));
  };

  const playhead = useMemo(
    () => positionAt(timeMap, score, time, duration),
    [timeMap, score, time, duration],
  );
  const goToMeasure = (measure: number) => {
    const span = measureSpan(timeMap, measure, duration);
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
      run((s, c) => advanceAfterEntry(insertNote(s, { ...c, string }, fret, duration, instrument)));
      setLastNote({ string, fret });
    },
    [cursor.string, instrument, loaded, run],
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
      run((s, c) => eraseEntry(s, c, backward));
      setLastNote(null);
    },
    [run],
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
      if (/^[0-9]$/.test(key)) {
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
          if (lower === 't') return { ...d, triplet: !d.triplet };
          return stepEntryDuration(d, key === '+' ? 'longer' : 'shorter');
        });
        if (editSelected) {
          if (key === '.') adjustEvent(toggleDot);
          else if (lower === 't') adjustEvent(toggleTriplet);
          else
            adjustEvent((s, c) => {
              const duration = s.measures[c.measure]!.events[c.event]!.duration;
              const next = stepEntryDuration(duration, key === '+' ? 'longer' : 'shorter');
              return next === duration ? { score: s, cursor: c } : setDuration(s, c, next);
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

  const fill = entryMeasureFill(score, cursor.measure);
  const currentMeter = measureMeter(score, cursor.measure);
  const ratio = (fill.actual.n * fill.expected.d) / (fill.actual.d * fill.expected.n);
  const fillColor = fill.status === 'over' ? colors.error : colors.green;
  const toggleTools = (next: typeof tools) => setTools(tools === next ? null : next);
  const technique = techniques.find((item) => item.value === (event?.technique ?? null))!;
  const entry =
    editing && loaded ? (
      <View style={{ gap: 6 }}>
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
          style={{ height: 6, borderRadius: 3, backgroundColor: colors.pale, overflow: 'hidden' }}
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
        {history.present.notice ? (
          <Text accessibilityLiveRegion="polite" style={styles.muted}>
            {notices[history.present.notice]}
          </Text>
        ) : null}
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
                color={entryDuration.base === base ? colors.white : colors.green}
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
                fill={entryDuration.dots ? colors.white : colors.green}
              />
            </Svg>
          </EntryKey>
          <EntryKey
            label="Tresillo"
            selected={!!entryDuration.triplet}
            onPress={() => changeFigure((d) => ({ ...d, triplet: !d.triplet }))}
          >
            <Text
              style={{
                color: entryDuration.triplet ? colors.white : colors.green,
                fontWeight: '700',
              }}
            >
              3
            </Text>
          </EntryKey>
        </View>
        <ScrollView nestedScrollEnabled style={{ flexGrow: 0, maxHeight: fretboardHeight }}>
          <Fretboard
            compact
            instrument={inputInstrument}
            nomenclature={nomenclature}
            leftHanded={leftHanded}
            marks={[]}
            activeString={cursor.string}
            active={lastNote && lastNote.fret <= inputInstrument.frets ? lastNote : null}
            onPress={(string, fret) => {
              takeFret();
              writeNote(fret, string);
            }}
          />
        </ScrollView>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          <EntryKey label={playing ? 'Pausa' : 'Reproducir'} onPress={onTogglePlayback}>
            <Icon name={playing ? 'pause' : 'play'} size={18} color={colors.green} />
          </EntryKey>
          <Button variant="ghost" style={{ paddingHorizontal: 12 }} onPress={writeRest}>
            Silencio
          </Button>
          <Button variant="ghost" style={{ paddingHorizontal: 12 }} onPress={() => erase(!event)}>
            Borrar
          </Button>
          {instrument.frets > 12 ? (
            <Button
              variant="ghost"
              style={{ paddingHorizontal: 12 }}
              onPress={() => setAllFrets(!allFrets)}
            >
              {allFrets ? 'Trastes 0–12' : `Trastes 13–${instrument.frets}`}
            </Button>
          ) : null}
        </View>
      </View>
    ) : null;

  return renderLayout(
    <View style={[styles.panel, { gap: 12, padding: wide ? 24 : 12 }]}>
      <View style={styles.between}>
        <Heading level={2} style={styles.h2}>
          Partitura
        </Heading>
        <View style={[styles.row, { flexWrap: 'wrap', gap: 8, flexShrink: 1 }]}>
          <Chips<ScoreDisplay>
            minHeight={44}
            value={display}
            onChange={setDisplay}
            options={[
              { value: 'both', label: 'Ambas' },
              { value: 'tab', label: 'Tablatura' },
              { value: 'staff', label: 'Pentagrama' },
            ]}
          />
          <Chips
            minHeight={44}
            value={editing ? 'write' : 'mark'}
            onChange={(v) => onEditingChange(v === 'write')}
            options={[
              { value: 'mark', label: 'Marcar' },
              { value: 'write', label: 'Escribir' },
            ]}
          />
        </View>
      </View>

      {!editing ? (
        <View style={{ gap: 10 }}>
          <Label muted>
            Mientras suena, marca el inicio de cada compás (M) y, si quieres, cada pulso (B). Cada
            compás de la partitura seguirá su tramo del audio aunque el tempo cambie.
          </Label>
          <View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>
            <Button variant="secondary" onPress={markMeasure}>
              Compás aquí (M)
            </Button>
            <Button variant="secondary" onPress={markBeat}>
              Pulso aquí (B)
            </Button>
            <Button
              variant="ghost"
              onPress={() => {
                if (loaded)
                  setEditor((state) =>
                    updateScoreTimeMap(state, removeMarkerNear(state.timeMap, timeRef.current)),
                  );
              }}
            >
              Quitar marca cercana
            </Button>
          </View>
          <View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>
            <Button variant="secondary" onPress={tap}>
              Tap tempo
            </Button>
            <Text style={{ color: colors.ink, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
              {tempo
                ? `${Math.round(tempo.bpm)} BPM`
                : taps.length
                  ? `${taps.length} toques…`
                  : '—'}
            </Text>
            <Button variant="ghost" disabled={!tempo} onPress={fillFromHere}>
              Rellenar compases desde aquí
            </Button>
          </View>
          <Label muted>
            {timeMap.measures.length
              ? `${timeMap.measures.length} ${timeMap.measures.length === 1 ? 'compás marcado' : 'compases marcados'}${timeMap.beats.length ? ` · ${timeMap.beats.length} pulsos` : ''}.`
              : 'Aún no hay compases marcados. Sin marcas puedes escribir, pero la partitura no seguirá al audio.'}
          </Label>
        </View>
      ) : null}

      {editing && loaded ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            <EntryKey
              label={technique.value ? `Técnica: ${technique.label}` : 'Técnica'}
              expanded={tools === 'techniques'}
              disabled={!event?.note}
              onPress={() => toggleTools('techniques')}
            >
              <Icon name="note" size={16} color={colors.green} />
              <Text style={{ color: colors.green }}>
                {' '}
                {technique.value ? technique.label : 'Técnica'}
              </Text>
            </EntryKey>
            <EntryKey
              label="Acciones de edición"
              expanded={tools === 'actions'}
              onPress={() => toggleTools('actions')}
            >
              <Text style={{ color: colors.green }}>Acciones</Text>
            </EntryKey>
            {Platform.OS === 'web' ? (
              <EntryKey
                label="Atajos de teclado"
                expanded={tools === 'keys'}
                onPress={() => toggleTools('keys')}
              >
                <Text style={{ color: colors.green }}>Teclado</Text>
              </EntryKey>
            ) : null}
          </View>
          {tools === 'keys' ? (
            <Label muted>
              Números · traste. Flechas · cursor. +/− · figura. . · puntillo. T · tresillo. R ·
              silencio. L · ligadura. Supr · borrar selección. Retroceso · borrar anterior. Ctrl+Z o
              ⌘Z · deshacer (Mayús · rehacer). Esc · salir.
            </Label>
          ) : null}
          {tools === 'techniques' && event?.note ? (
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
                  <Text style={{ color: item === technique ? colors.white : colors.green }}>
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
                  disabled={!event?.note}
                  onPress={() => adjustEvent(toggleTie)}
                >
                  Ligadura
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
      ) : null}

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
            onPressEvent={
              editing
                ? (c) => {
                    flushFret();
                    select(c);
                  }
                : undefined
            }
            selectedMeasures={!editing ? { from: cursor.measure, to: cursor.measure } : null}
            onPressMeasure={!editing ? goToMeasure : undefined}
          />
        ) : null}
      </View>
      {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
    </View>,
    entry,
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
        backgroundColor: selected ? colors.green : colors.pale,
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
