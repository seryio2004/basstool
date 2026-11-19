import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { Button, Chips, Heading, Label, colors, styles } from './ui';
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
  MAX_SCORE_MEASURES,
  addMeasure,
  deleteEvent,
  insertNote,
  insertRest,
  measureFill,
  measureMeter,
  moveCursor,
  redo,
  setDuration,
  setMeter,
  setTechnique,
  toggleDot,
  toggleTie,
  toggleTriplet,
  undo,
} from '../core/score';
import {
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

const values: { value: BaseValue; label: string; key: string }[] = [
  { value: 1, label: 'Redonda', key: 'w' },
  { value: 2, label: 'Blanca', key: 'h' },
  { value: 4, label: 'Negra', key: 'q' },
  { value: 8, label: 'Corchea', key: 'e' },
  { value: 16, label: 'Semicorchea', key: 's' },
];
const techniques: { value: Technique | 'none'; label: string }[] = [
  { value: 'none', label: 'Sin técnica' },
  { value: 'hammer', label: 'Ligado ascendente (h)' },
  { value: 'pull', label: 'Ligado descendente (p)' },
  { value: 'slide', label: 'Slide (/)' },
  { value: 'dead', label: 'Muerta (x)' },
  { value: 'staccato', label: 'Staccato' },
];
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
}: {
  sessionId: string;
  duration: number;
  time: number;
  instrument: Instrument;
  nomenclature: Nomenclature;
  leftHanded: boolean;
  wide: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSeek: (time: number) => void;
  onLoop: (span: { a: number; b: number } | null) => void;
  /** Transcribe registra aquí las acciones de marcado para sus atajos (M, B). */
  register: (actions: { markMeasure: () => void; markBeat: () => void } | null) => void;
}) {
  const [{ history, timeMap }, setEditor] = useState(createScoreEditor);
  const [display, setDisplay] = useState<ScoreDisplay>('both');
  const [duration_, setDuration_] = useState<Duration>({ base: 8, dots: 0 });
  const [taps, setTaps] = useState<number[]>([]);
  const [width, setWidth] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const { score, cursor } = history.present;
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
    (fn: (s: Score, c: EditCursor) => { score: Score; cursor: EditCursor }) => {
      if (!loaded) return;
      setEditor((state) => editScore(state, fn));
      setError('');
    },
    [loaded],
  );
  const changeHistory = (travel: typeof undo) => {
    if (loaded) setEditor((state) => restoreScore(state, travel));
  };
  const adjustEvent = useCallback(
    (fn: (s: Score, c: EditCursor) => { score: Score; cursor: EditCursor }) =>
      run((s, c) => (s.measures[c.measure]?.events[c.event] ? fn(s, c) : { score: s, cursor: c })),
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
  const goToMeasure = (measure: number, loop: boolean) => {
    const span = measureSpan(timeMap, measure, duration);
    if (!span) return;
    if (loop) {
      setEditor((state) =>
        selectScoreCursor(state, { ...state.history.present.cursor, measure, event: 0 }),
      );
      onLoop({ a: span.start, b: span.end });
    }
    onSeek(span.start);
  };
  const select = (cursor: EditCursor) => setEditor((state) => selectScoreCursor(state, cursor));

  const writeNote = useCallback(
    (fret: number, string?: number) => {
      if (!Number.isInteger(fret) || fret < 0 || fret > instrument.frets) {
        setError('Traste fuera del instrumento.');
        return;
      }
      run((s, c) =>
        insertNote(
          s,
          { ...c, string: Math.min(string ?? c.string, instrument.strings.length - 1) },
          fret,
          duration_,
          instrument,
        ),
      );
    },
    [duration_, instrument, run],
  );

  // Teclado del modo «Escribir» (web). Los números se acumulan 0,6 s para trastes de dos cifras.
  const pendingFret = useRef<{ value: string; timer: ReturnType<typeof setTimeout> | null }>({
    value: '',
    timer: null,
  });
  const latestWrite = useRef(writeNote);
  latestWrite.current = writeNote;
  const flushFret = useCallback(() => {
    const { value, timer } = pendingFret.current;
    if (timer !== null) clearTimeout(timer);
    pendingFret.current = { value: '', timer: null };
    if (value) latestWrite.current(Number(value));
  }, []);
  useEffect(() => {
    if (!editing) return;
    return () => {
      const { timer } = pendingFret.current;
      if (timer !== null) clearTimeout(timer);
      pendingFret.current = { value: '', timer: null };
    };
  }, [editing]);
  const changeDuration = useCallback(
    (base: BaseValue) => {
      const next = { ...duration_, base };
      setDuration_(next);
      adjustEvent((s, c) => setDuration(s, c, next));
    },
    [adjustEvent, duration_],
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
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const key = e.key;
      const lower = key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && lower === 'z') {
        e.preventDefault();
        flushFret();
        setEditor((state) => restoreScore(state, e.shiftKey ? redo : undo));
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
      const value = values.find((v) => v.key === lower);
      const move = moves[key];
      if (move) {
        e.preventDefault();
        flushFret();
        setEditor((state) => {
          const { score, cursor } = state.history.present;
          return selectScoreCursor(state, moveCursor(score, cursor, move, instrument));
        });
      } else if (value) {
        flushFret();
        changeDuration(value.value);
      } else if (key === '.' || lower === 't' || lower === 'l') {
        flushFret();
        adjustEvent(key === '.' ? toggleDot : lower === 't' ? toggleTriplet : toggleTie);
      } else if (lower === 'r') {
        flushFret();
        run((s, c) => insertRest(s, c, duration_));
      } else if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault();
        const { value, timer } = pendingFret.current;
        if (value && key === 'Backspace') {
          if (timer !== null) clearTimeout(timer);
          pendingFret.current = { value: '', timer: null };
        } else {
          flushFret();
          adjustEvent(deleteEvent);
        }
      } else if (key === 'Escape') onEditingChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [
    editing,
    loaded,
    flushFret,
    run,
    adjustEvent,
    duration_,
    changeDuration,
    instrument,
    onEditingChange,
  ]);

  const fill = measureFill(score, cursor.measure);
  const currentMeter = measureMeter(score, cursor.measure);

  return (
    <View style={[styles.panel, { gap: 16 }]}>
      <View style={styles.between}>
        <Heading level={2} style={styles.h2}>
          Partitura
        </Heading>
        <View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>
          <Chips<ScoreDisplay>
            value={display}
            onChange={setDisplay}
            options={[
              { value: 'both', label: 'Tab y partitura' },
              { value: 'tab', label: 'Tablatura' },
              { value: 'staff', label: 'Partitura' },
            ]}
          />
          <Chips
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
      ) : (
        <View style={{ gap: 12 }}>
          <Row wide={wide}>
            <Chips
              value={String(duration_.base)}
              onChange={(base) => changeDuration(Number(base) as BaseValue)}
              options={values.map((v) => ({
                value: String(v.value),
                label: `${v.label} (${v.key})`,
              }))}
            />
          </Row>
          <Row wide={wide}>
            <View style={[styles.row, { gap: 8 }]}>
              <Button small variant="secondary" onPress={() => adjustEvent(toggleDot)}>
                Puntillo (.)
              </Button>
              <Button small variant="secondary" onPress={() => adjustEvent(toggleTriplet)}>
                Tresillo (t)
              </Button>
              <Button small variant="secondary" onPress={() => adjustEvent(toggleTie)}>
                Ligadura (l)
              </Button>
              <Button
                small
                variant="secondary"
                onPress={() => run((s, c) => insertRest(s, c, duration_))}
              >
                Silencio (r)
              </Button>
              <Button small variant="ghost" onPress={() => adjustEvent(deleteEvent)}>
                Borrar
              </Button>
              <Button
                small
                variant="ghost"
                disabled={!history.past.length}
                onPress={() => changeHistory(undo)}
              >
                Deshacer
              </Button>
              <Button
                small
                variant="ghost"
                disabled={!history.future.length}
                onPress={() => changeHistory(redo)}
              >
                Rehacer
              </Button>
            </View>
          </Row>
          <Row wide={wide}>
            <Chips<Technique | 'none'>
              value={score.measures[cursor.measure]?.events[cursor.event]?.technique ?? 'none'}
              onChange={(t) => adjustEvent((s, c) => setTechnique(s, c, t === 'none' ? null : t))}
              options={techniques}
            />
          </Row>
        </View>
      )}

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && loaded ? (
          <ScoreView
            score={score}
            instrument={instrument}
            display={display}
            width={width}
            playhead={playhead}
            cursor={editing ? cursor : null}
            onPressEvent={editing ? select : undefined}
            onPressMeasure={(m) => goToMeasure(m, !editing)}
          />
        ) : null}
      </View>

      <View style={[styles.between, { gap: 8 }]}>
        <Label muted>
          Compás {cursor.measure + 1} · {meterKey(currentMeter)} ·{' '}
          {fill.status === 'full'
            ? 'completo'
            : fill.status === 'empty'
              ? 'vacío'
              : fill.status === 'short'
                ? 'incompleto'
                : 'se pasa de su métrica'}
        </Label>
        <View style={[styles.row, { gap: 8, flexWrap: 'wrap' }]}>
          <Chips
            value={meterKey(currentMeter)}
            onChange={(k) => {
              const m = meters.find((x) => meterKey(x) === k)!;
              run((s, c) => ({ score: setMeter(s, c.measure, m), cursor: c }));
            }}
            options={meters.map((m) => ({ value: meterKey(m), label: meterKey(m) }))}
          />
          <Button
            small
            variant="ghost"
            onPress={() =>
              run((s, c) => ({
                score: s.measures.length < MAX_SCORE_MEASURES ? addMeasure(s, c.measure) : s,
                cursor: c,
              }))
            }
          >
            Añadir compás
          </Button>
        </View>
      </View>

      {editing ? (
        <View style={{ gap: 8 }}>
          <Label muted>
            Toca una casilla del mástil para escribir la nota con la figura elegida
            {Platform.OS === 'web'
              ? ' o usa el teclado: números para el traste, flechas para moverte, Esc para salir'
              : ''}
            .
          </Label>
          <Fretboard
            instrument={instrument}
            nomenclature={nomenclature}
            leftHanded={leftHanded}
            marks={[]}
            onPress={(string, fret) => writeNote(fret, string)}
          />
        </View>
      ) : null}
      {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
    </View>
  );
}

/** En pantallas estrechas, fila desplazable en lugar de varias líneas. */
function Row({ wide, children }: { wide: boolean; children: React.ReactNode }) {
  if (wide) return <>{children}</>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}
