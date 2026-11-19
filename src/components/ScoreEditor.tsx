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
  TimeMap,
} from '../core/scoreTypes';
import {
  History,
  addMeasure,
  commit,
  createHistory,
  deleteEvent,
  emptyScore,
  ensureMeasures,
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
  addBeatMarker,
  addMeasureMarker,
  emptyTimeMap,
  generateMeasures,
  measureSpan,
  positionAt,
  removeMarkerNear,
  tapTempo,
  timeAt,
} from '../core/timeMap';
import { loadScoreDoc, saveScoreDoc } from '../data/scores';

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
  register: (actions: { markMeasure: () => void; markBeat: () => void }) => void;
}) {
  const [history, setHistory] = useState<History>(() => createHistory(emptyScore()));
  const [timeMap, setTimeMap] = useState<TimeMap>(emptyTimeMap);
  const [display, setDisplay] = useState<ScoreDisplay>('both');
  const [cursor, setCursor] = useState<EditCursor>({ measure: 0, event: 0, string: 1 });
  const [duration_, setDuration_] = useState<Duration>({ base: 8, dots: 0 });
  const [taps, setTaps] = useState<number[]>([]);
  const [width, setWidth] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const score = history.present;
  const timeRef = useRef(time);
  timeRef.current = time;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carga la partitura de esta canción.
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    void loadScoreDoc(sessionId)
      .then((doc) => {
        if (!alive) return;
        if (doc) {
          setHistory(createHistory(doc.score));
          setTimeMap(doc.timeMap);
          setDisplay(doc.display);
        } else {
          setHistory(createHistory(emptyScore()));
          setTimeMap(emptyTimeMap());
        }
        setCursor({ measure: 0, event: 0, string: Math.min(1, instrument.strings.length - 1) });
        setLoaded(true);
      })
      .catch(() => setError('No se pudo leer la partitura guardada.'));
    return () => {
      alive = false;
    };
  }, [sessionId, instrument.strings.length]);

  // Guardado diferido.
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveScoreDoc(sessionId, {
        score,
        timeMap,
        display,
        updatedAt: new Date().toISOString(),
      }).catch(() => setError('No se pudo guardar la partitura en este dispositivo.'));
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [score, timeMap, display, loaded, sessionId]);

  const apply = useCallback((edit: { score: Score; cursor: EditCursor }) => {
    setHistory((h) => commit(h, edit.score));
    setCursor(edit.cursor);
  }, []);
  const run = useCallback(
    (fn: (s: Score, c: EditCursor) => { score: Score; cursor: EditCursor }) => {
      try {
        apply(fn(history.present, cursor));
        setError('');
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [apply, history.present, cursor],
  );

  // Marcas sobre el audio (las teclas M y B las envía Transcribe).
  const markMeasure = useCallback(() => {
    setTimeMap((m) => {
      const next = addMeasureMarker(m, timeRef.current);
      setHistory((h) => {
        const grown = ensureMeasures(h.present, next.measures.length);
        return grown === h.present ? h : commit(h, grown);
      });
      return next;
    });
  }, []);
  const markBeat = useCallback(() => setTimeMap((m) => addBeatMarker(m, timeRef.current)), []);
  useEffect(() => register({ markMeasure, markBeat }), [register, markMeasure, markBeat]);

  const tempo = useMemo(() => tapTempo(taps), [taps]);
  const tap = () =>
    setTaps((t) => {
      const now = timeRef.current;
      // Una pausa de más de 2 s empieza una serie nueva.
      const keep = t.length && now - t[t.length - 1]! > 2 ? [] : t;
      return [...keep, now].slice(-9);
    });
  const fillFromHere = () => {
    if (!tempo) return;
    const beats = measureMeter(score, 0).beats;
    setTimeMap((m) => {
      const next = generateMeasures(m, {
        start: timeRef.current,
        bpm: tempo.bpm,
        beatsPerMeasure: beats,
        until: duration,
      });
      setHistory((h) => commit(h, ensureMeasures(h.present, next.measures.length)));
      return next;
    });
  };

  const playhead = useMemo(
    () => positionAt(timeMap, score, time, duration),
    [timeMap, score, time, duration],
  );
  const goToMeasure = (measure: number, loop: boolean) => {
    const span = measureSpan(timeMap, measure, duration);
    if (!span) return;
    onSeek(span.start);
    if (loop) onLoop({ a: span.start, b: span.end });
  };
  const select = (c: EditCursor) => {
    setCursor(c);
    const t = timeAt(timeMap, score, { measure: c.measure, beat: 0 }, duration);
    if (t !== null && !editing) onSeek(t);
  };

  // Teclado del modo «Escribir» (web). Los números se acumulan 0,6 s para trastes de dos cifras.
  const pendingFret = useRef<{ value: string; timer: ReturnType<typeof setTimeout> | null }>({
    value: '',
    timer: null,
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || !editing || typeof document === 'undefined') return;
    const flushFret = () => {
      const fret = Number(pendingFret.current.value);
      pendingFret.current = { value: '', timer: null };
      if (Number.isInteger(fret)) run((s, c) => insertNote(s, c, fret, duration_, instrument));
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const key = e.key;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && key.toLowerCase() === 'z') {
        e.preventDefault();
        setHistory((h) => (e.shiftKey ? redo(h) : undo(h)));
        return;
      }
      if (mod || e.altKey) return;
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        const p = pendingFret.current;
        if (p.timer) clearTimeout(p.timer);
        p.value = (p.value + key).slice(-2);
        if (Number(p.value) * 10 > instrument.frets) flushFret();
        else p.timer = setTimeout(flushFret, 600);
        return;
      }
      const lower = key.toLowerCase();
      const value = values.find((v) => v.key === lower);
      const moves: Record<string, Parameters<typeof moveCursor>[2]> = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
        PageDown: 'nextMeasure',
        PageUp: 'prevMeasure',
      };
      if (moves[key]) {
        e.preventDefault();
        setCursor((c) => moveCursor(score, c, moves[key]!, instrument));
      } else if (value) {
        const next = { ...duration_, base: value.value };
        setDuration_(next);
        run((s, c) => setDuration(s, c, next));
      } else if (key === '.') run(toggleDot);
      else if (lower === 't') run(toggleTriplet);
      else if (lower === 'l') run(toggleTie);
      else if (lower === 'r') run((s, c) => insertRest(s, c, duration_));
      else if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault();
        run(deleteEvent);
      } else if (key === 'Escape') onEditingChange(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing, run, score, duration_, instrument, onEditingChange]);

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
            <Button variant="ghost" onPress={() => setTimeMap((m) => removeMarkerNear(m, time))}>
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
            <Chips<BaseValue>
              value={duration_.base}
              onChange={(base) => {
                const next = { ...duration_, base };
                setDuration_(next);
                run((s, c) => setDuration(s, c, next));
              }}
              options={values.map((v) => ({ value: v.value, label: `${v.label} (${v.key})` }))}
            />
          </Row>
          <Row wide={wide}>
            <View style={[styles.row, { gap: 8 }]}>
              <Button small variant="secondary" onPress={() => run(toggleDot)}>
                Puntillo (.)
              </Button>
              <Button small variant="secondary" onPress={() => run(toggleTriplet)}>
                Tresillo (t)
              </Button>
              <Button small variant="secondary" onPress={() => run(toggleTie)}>
                Ligadura (l)
              </Button>
              <Button
                small
                variant="secondary"
                onPress={() => run((s, c) => insertRest(s, c, duration_))}
              >
                Silencio (r)
              </Button>
              <Button small variant="ghost" onPress={() => run(deleteEvent)}>
                Borrar
              </Button>
              <Button
                small
                variant="ghost"
                disabled={!history.past.length}
                onPress={() => setHistory(undo)}
              >
                Deshacer
              </Button>
              <Button
                small
                variant="ghost"
                disabled={!history.future.length}
                onPress={() => setHistory(redo)}
              >
                Rehacer
              </Button>
            </View>
          </Row>
          <Row wide={wide}>
            <Chips<Technique | 'none'>
              value={score.measures[cursor.measure]?.events[cursor.event]?.technique ?? 'none'}
              onChange={(t) => run((s, c) => setTechnique(s, c, t === 'none' ? null : t))}
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
            onPressEvent={select}
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
              setHistory((h) => commit(h, setMeter(h.present, cursor.measure, m)));
            }}
            options={meters.map((m) => ({ value: meterKey(m), label: meterKey(m) }))}
          />
          <Button
            small
            variant="ghost"
            onPress={() => setHistory((h) => commit(h, addMeasure(h.present, cursor.measure)))}
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
            onPress={(string, fret) =>
              run((s, c) => insertNote(s, { ...c, string }, fret, duration_, instrument))
            }
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
