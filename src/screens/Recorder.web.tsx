import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Field,
  Heading,
  Label,
  MoreMenu,
  colors,
  fonts,
  radius,
  styles,
} from '../components/ui';
import {
  drumGenres,
  drumMeters,
  defaultGroove,
  defaultSwing,
  pulsesPerBar,
  type DrumGenre,
} from '../core/drums';
import { tunings } from '../core/instrument';
import { clampCompensation, MAX_COMPENSATION_MS } from '../core/recording';
import { scoreTimeline, synthTones } from '../core/scoreAudio';
import { measureMeter } from '../core/score';
import { DEFAULT_SCORE_BPM, scorePlaybackMap } from '../core/timeMap';
import { formatTime, type Session } from '../core/transcription';
import { loadScoreDoc } from '../data/scores';
import { useStore } from '../data/Store';
import { listSessions } from '../data/transcriptions';
import { pickLocalAudio } from '../platform/player.web';
import { createRecordingContext } from '../platform/recordingCapture.web';
import {
  decodeLocalAudio,
  downloadTake,
  metricalPulses,
  type Backing,
  type Take,
} from '../platform/recordingAudio.web';
import { deleteTake, listTakes, saveTake } from '../platform/recordingStore.web';
import { useRecorder } from './useRecorder.web';

type BaseKind = Backing['kind'];
type Option = { value: string; label: string };
const baseOptions: Option[] = [
  { value: 'none', label: 'Sin base' },
  { value: 'metronome', label: 'Metrónomo' },
  { value: 'drums', label: 'Batería' },
  { value: 'transcription', label: 'Transcripción guardada' },
];
const row = { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 } as const;

export function Recorder() {
  const { profile } = useStore();
  const [saved, setSaved] = useState<Awaited<ReturnType<typeof listTakes>>>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [baseKind, setBaseKind] = useState<BaseKind>('none');
  const [tempo, setTempo] = useState('90');
  const [pulseText, setPulseText] = useState('4');
  const [genre, setGenre] = useState<DrumGenre>(defaultGroove.genre);
  const [songId, setSongId] = useState('');
  const [doc, setDoc] = useState<Awaited<ReturnType<typeof loadScoreDoc>>>();
  const [song, setSong] = useState<{ id: string; file: File }>();
  const [mix, setMix] = useState<'song' | 'score' | 'both'>('song');
  const [fileError, setFileError] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [compensation, setCompensation] = useState(0);
  const [writing, setWriting] = useState(false);
  const pendingFile = useRef<(() => void) | null>(null);
  const mounted = useRef(false);
  const fileContext = useRef<AudioContext | null>(null);
  const recorder = useRecorder(async (take) => {
    const next = await saveTake(take);
    if (mounted.current) setSaved(next);
  }, setCompensation);
  const { phase } = recorder;

  useEffect(() => {
    mounted.current = true;
    void listTakes().then((result) => {
      if (mounted.current) setSaved(result);
    });
    void listSessions().then((list) => {
      if (mounted.current) setSessions(list);
    });
    return () => {
      mounted.current = false;
      pendingFile.current?.();
      if (fileContext.current) void fileContext.current.close().catch(() => {});
    };
  }, []);

  const session = sessions.find((item) => item.id === songId);
  useEffect(() => {
    let current = true;
    if (songId)
      void loadScoreDoc(songId).then((result) => {
        if (current) setDoc(result);
      });
    return () => {
      current = false;
    };
  }, [songId]);

  async function chooseFile(selected: Session) {
    setFileError('');
    setLoadingFile(true);
    let context: AudioContext | undefined;
    try {
      const file = await pickLocalAudio((cancel) => {
        pendingFile.current = cancel;
      });
      if (!file || !mounted.current) return;
      const [name, size] = JSON.parse(selected.id) as [string, number, number];
      if (name !== file.name || size !== file.size)
        throw new Error('El archivo elegido no coincide con la canción guardada.');
      context = createRecordingContext();
      fileContext.current = context;
      const decoded = await decodeLocalAudio(context, file);
      if (!mounted.current) return;
      if (Math.abs(decoded.duration - selected.duration) > 0.01)
        throw new Error('El archivo elegido no coincide con la canción guardada.');
      setSong({ id: selected.id, file });
    } catch (error) {
      if (mounted.current)
        setFileError(
          (error instanceof DOMException ? '' : (error as Error).message) ||
            'No se pudo abrir la canción.',
        );
    } finally {
      if (context && context.state !== 'closed') void context.close().catch(() => {});
      fileContext.current = null;
      if (mounted.current) setLoadingFile(false);
    }
  }

  const songFile = song?.id === songId ? song?.file : undefined;
  const tones = React.useMemo(
    () =>
      session && doc
        ? synthTones(
            scoreTimeline(
              doc.score,
              doc.timeMap,
              session.duration,
              tunings[profile.tuning],
              doc.bpm,
            ),
          )
        : [],
    [session, doc, profile.tuning],
  );
  const drumMeter = drumMeters(genre)[0]!;
  const meter = doc && measureMeter(doc.score, 0);
  const pulses =
    baseKind === 'drums'
      ? pulsesPerBar(drumMeter)
      : baseKind === 'transcription' && meter
        ? metricalPulses(meter.beats, meter.unit)
        : Number(pulseText);
  const inferredTempo =
    baseKind === 'transcription' &&
    doc &&
    (mix === 'score' || doc.bpm !== undefined || doc.timeMap.measures.length >= 2);
  const measures =
    inferredTempo && doc ? scorePlaybackMap(doc.score, doc.timeMap, doc.bpm).measures : [];
  const measureSeconds = measures.length > 1 ? measures[1]! - measures[0]! : 0;
  const bpm =
    inferredTempo && doc
      ? measureSeconds > 0
        ? (60 * pulses) / measureSeconds
        : (doc.bpm ?? DEFAULT_SCORE_BPM)
      : Number(tempo);
  const validTempo =
    Number.isFinite(bpm) && bpm > 0 && (inferredTempo || (bpm >= 40 && bpm <= 240));
  const backing: Backing | null =
    baseKind === 'none'
      ? { kind: 'none' }
      : baseKind === 'metronome'
        ? { kind: baseKind, bpm, pulses }
        : baseKind === 'drums'
          ? {
              kind: baseKind,
              groove: {
                ...defaultGroove,
                genre,
                bpm,
                meter: drumMeter,
                swing: defaultSwing(genre, drumMeter),
              },
            }
          : session &&
              doc !== undefined &&
              (mix === 'score' || songFile) &&
              (mix === 'song' || tones.length)
            ? {
                kind: baseKind,
                source: {
                  name: session.name,
                  song: mix === 'score' ? undefined : songFile,
                  tones: mix === 'song' ? [] : tones,
                  bass: session.bass,
                  attack: 'finger',
                },
              }
            : null;
  const busy = phase.kind !== 'idle';
  const editingLocked = busy || loadingFile || writing || recorder.inputState === 'opening';
  const meterDb = recorder.peak > 0 ? Math.round(20 * Math.log10(recorder.peak)) : -60;
  const meterValue = Math.min(0, Math.max(-60, meterDb));

  async function changeTake(take: Take, remove: boolean) {
    setWriting(true);
    try {
      const result = await (remove ? deleteTake(take.id) : saveTake(take));
      if (mounted.current) setSaved(result);
    } finally {
      if (mounted.current) setWriting(false);
    }
  }

  const status =
    phase.kind === 'countdown'
      ? `Cuenta atrás · ${phase.remaining}`
      : phase.kind === 'recording'
        ? `Grabando · ${formatTime(phase.seconds)}`
        : phase.kind === 'preparing'
          ? 'Preparando la grabación…'
          : phase.kind === 'finishing'
            ? 'Guardando toma…'
            : phase.kind === 'playing'
              ? 'Reproduciendo toma…'
              : '';

  return (
    <View style={{ gap: 24 }}>
      <View style={[styles.panel, { gap: 16 }]}>
        <Heading level={2} style={styles.h2}>
          Entrada
        </Heading>
        <Select
          label="Entrada de audio"
          value={recorder.device}
          disabled={editingLocked}
          onChange={recorder.chooseInput}
          options={[
            { value: '', label: 'Predeterminada del sistema' },
            ...(!recorder.device ||
            recorder.devices.some(({ deviceId }) => deviceId === recorder.device)
              ? []
              : [{ value: recorder.device, label: 'Última entrada elegida' }]),
            ...recorder.devices.map(({ deviceId, label }, i) => ({
              value: deviceId,
              label: label || `Entrada ${i + 1}`,
            })),
          ]}
        />
        <View style={[row, { justifyContent: 'space-between' }]}>
          <Label muted>Nivel de entrada</Label>
          <Label style={{ ...styles.data, color: recorder.clipped ? colors.error : colors.muted }}>
            {recorder.clipped
              ? 'Saturación'
              : recorder.inputState !== 'on'
                ? '—'
                : meterDb <= -60
                  ? '≤ −60 dBFS'
                  : `${meterValue} dBFS`}
          </Label>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Nivel de entrada"
          accessibilityValue={{
            min: -60,
            max: 0,
            now: meterValue,
            text: recorder.clipped ? 'Saturación' : `${meterValue} dBFS`,
          }}
          style={{
            height: 12,
            backgroundColor: colors.sunken,
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${(meterValue + 60) / 0.6}%`,
              backgroundColor: recorder.clipped
                ? colors.error
                : meterValue > -6
                  ? colors.warning
                  : colors.success,
            }}
          />
        </View>
        {recorder.inputState === 'on' ? (
          <Button
            disabled={busy}
            variant="secondary"
            onPress={recorder.closeInput}
            style={{ alignSelf: 'flex-start' }}
          >
            Desactivar entrada
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={busy}
            style={{ alignSelf: 'flex-start' }}
            onPress={recorder.inputState === 'opening' ? recorder.closeInput : recorder.enable}
          >
            {recorder.inputState === 'opening' ? 'Cancelar activación' : 'Activar entrada'}
          </Button>
        )}
        <MoreMenu label={`Compensación de latencia · ${compensation} ms`}>
          <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
            <label style={{ display: 'grid', gap: 8, color: colors.ink, fontFamily: fonts.body }}>
              Ajuste manual (−200 a +200 ms)
              <input
                type="range"
                min={-MAX_COMPENSATION_MS}
                max={MAX_COMPENSATION_MS}
                value={compensation}
                disabled={editingLocked}
                aria-valuetext={`${compensation} milisegundos`}
                style={{ width: '100%', accentColor: colors.accent, minHeight: 36 }}
                onChange={(event) =>
                  setCompensation(clampCompensation(event.currentTarget.valueAsNumber))
                }
              />
            </label>
            <Label muted>Un valor positivo adelanta la toma al escucharla con la base.</Label>
            <Label muted>
              Para calibrar, acerca el micrófono al altavoz y deja que capte cuatro clics.
            </Label>
            {phase.kind === 'calibrating' ? (
              <View style={row} accessibilityLiveRegion="polite">
                <Button variant="secondary" onPress={recorder.stopOperation}>
                  Cancelar calibración
                </Button>
                <Label>Escuchando los clics…</Label>
              </View>
            ) : (
              <Button
                variant="secondary"
                disabled={editingLocked || recorder.inputState !== 'on'}
                style={{ alignSelf: 'flex-start' }}
                onPress={() => void recorder.runCalibration()}
              >
                Calibrar con clics
              </Button>
            )}
            {recorder.notice ? (
              <View accessibilityLiveRegion="polite">
                <Label>{recorder.notice}</Label>
              </View>
            ) : null}
          </View>
        </MoreMenu>
      </View>
      <View style={[styles.panel, { gap: 16 }]}>
        <Heading level={2} style={styles.h2}>
          Grabación
        </Heading>
        <Select
          label="Base"
          value={baseKind}
          disabled={editingLocked}
          options={baseOptions}
          onChange={(value) => setBaseKind(value as BaseKind)}
        />
        {baseKind === 'drums' ? (
          <Select
            label={`Ritmo · ${drumMeter}`}
            value={genre}
            disabled={editingLocked}
            options={[...drumGenres]}
            onChange={(value) => setGenre(value as DrumGenre)}
          />
        ) : null}
        {baseKind === 'transcription' ? (
          <>
            {sessions.length ? (
              <Select
                label="Transcripción"
                value={songId}
                disabled={editingLocked}
                options={[
                  { value: '', label: 'Elige una transcripción' },
                  ...sessions.map(({ id, name }) => ({ value: id, label: name })),
                ]}
                onChange={(value) => {
                  setDoc(undefined);
                  setSongId(value);
                  setMix('song');
                  setFileError('');
                }}
              />
            ) : (
              <Label muted>Las sesiones que guardes en Transcribir aparecerán aquí.</Label>
            )}
            {session ? (
              <>
                <Select
                  label="Qué suena"
                  value={mix}
                  disabled={editingLocked}
                  onChange={(value) => setMix(value as typeof mix)}
                  options={[
                    { value: 'song', label: 'Canción' },
                    ...(tones.length
                      ? [
                          { value: 'score', label: 'Síntesis de mis notas' },
                          { value: 'both', label: 'Canción y síntesis' },
                        ]
                      : []),
                  ]}
                />
                {mix !== 'score' ? (
                  <Button
                    variant="secondary"
                    disabled={editingLocked}
                    style={{ alignSelf: 'flex-start' }}
                    onPress={() => void chooseFile(session)}
                  >
                    {loadingFile
                      ? 'Abriendo archivo…'
                      : songFile
                        ? 'Volver a elegir archivo'
                        : 'Elegir archivo de la canción'}
                  </Button>
                ) : null}
                <Label muted>
                  La base empieza desde el principio a velocidad original.
                  {songFile && mix !== 'score' ? ' Archivo vinculado.' : ''}
                </Label>
              </>
            ) : null}
          </>
        ) : null}
        <View style={row}>
          {!inferredTempo ? (
            <NumberField
              label="Tempo (BPM)"
              value={tempo}
              min={40}
              max={240}
              disabled={editingLocked}
              onChange={setTempo}
            />
          ) : (
            <Label muted>
              {Math.round(bpm)} BPM · {pulses} pulsos de entrada
            </Label>
          )}
          {baseKind !== 'drums' && !(baseKind === 'transcription' && doc) ? (
            <Select
              label="Pulsos por compás"
              value={pulseText}
              disabled={editingLocked}
              options={[2, 3, 4, 6].map((value) => ({
                value: String(value),
                label: String(value),
              }))}
              onChange={setPulseText}
            />
          ) : null}
        </View>
        <Label muted>Cuenta atrás de un compás.</Label>
        {!validTempo ? (
          <Label style={{ color: colors.error }}>El tempo debe estar entre 40 y 240 BPM.</Label>
        ) : null}
        {fileError ? <Label style={{ color: colors.error }}>{fileError}</Label> : null}
        <View style={row}>
          {phase.kind === 'countdown' || phase.kind === 'preparing' ? (
            <Button onPress={recorder.stopOperation}>Cancelar</Button>
          ) : phase.kind === 'recording' ? (
            <Button onPress={recorder.stopTake}>Parar y guardar</Button>
          ) : (
            <Button
              style={{ alignSelf: 'flex-start' }}
              disabled={
                !backing || !validTempo || editingLocked || !saved || recorder.inputState !== 'on'
              }
              onPress={() => {
                if (backing) void recorder.record(backing, bpm, pulses, compensation);
              }}
            >
              Grabar
            </Button>
          )}
          {status ? (
            <View accessibilityLiveRegion={phase.kind === 'recording' ? 'none' : 'polite'}>
              <Label style={styles.data}>{status}</Label>
            </View>
          ) : null}
        </View>
        <View accessibilityLiveRegion="polite">
          {recorder.error ? <Label style={{ color: colors.error }}>{recorder.error}</Label> : null}
        </View>
      </View>
      <View style={[styles.panel, { gap: 12 }]}>
        <Heading level={2} style={styles.h2}>
          Tomas
        </Heading>
        {saved?.persistent === false ? (
          <View accessibilityLiveRegion="polite">
            <Label style={{ color: colors.warning }}>
              Almacenamiento local inaccesible. Los cambios quedan en memoria hasta que cierres o
              recargues esta página.
            </Label>
          </View>
        ) : (
          <Label muted>Las grabaciones se guardan en este navegador.</Label>
        )}
        {saved ? (
          saved.takes.map((take) => (
            <TakeRow
              key={take.id}
              take={take}
              locked={editingLocked}
              playing={phase.kind === 'playing' && phase.id === take.id}
              listen={(withBase) => void recorder.listen(take, withBase)}
              stop={recorder.stopOperation}
              save={(next) => void changeTake(next, false)}
              remove={() => void changeTake(take, true)}
            />
          ))
        ) : (
          <Label muted>Cargando tomas…</Label>
        )}
        {saved?.takes.length === 0 ? <Label muted>Todavía no hay tomas.</Label> : null}
      </View>
    </View>
  );
}

function Select({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label
      style={{ display: 'grid', gap: 8, minWidth: 0, color: colors.ink, fontFamily: fonts.body }}
    >
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
        style={{
          boxSizing: 'border-box',
          minHeight: 44,
          minWidth: 0,
          maxWidth: '100%',
          width: '100%',
          padding: '0 12px',
          font: 'inherit',
          outlineOffset: 3,
          borderRadius: radius.control,
          background: colors.sunken,
          color: colors.ink,
          border: `1px solid ${colors.lineStrong}`,
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: 'grid', gap: 8, color: colors.ink, fontFamily: fonts.body }}>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
        style={{
          boxSizing: 'border-box',
          minHeight: 44,
          width: 124,
          padding: '0 12px',
          font: 'inherit',
          outlineOffset: 3,
          borderRadius: radius.control,
          background: colors.sunken,
          color: colors.ink,
          border: `1px solid ${colors.lineStrong}`,
        }}
      />
    </label>
  );
}

function TakeRow({
  take,
  locked,
  playing,
  listen,
  stop,
  save,
  remove,
}: {
  take: Take;
  locked: boolean;
  playing: boolean;
  listen: (withBase: boolean) => void;
  stop: () => void;
  save: (take: Take) => void;
  remove: () => void;
}) {
  const [edit, setEdit] = useState<'none' | 'rename' | 'delete'>('none');
  const [name, setName] = useState(take.name);
  const backing =
    take.backing.kind === 'transcription'
      ? take.backing.source.name
      : baseOptions.find((option) => option.value === take.backing.kind)?.label;
  return (
    <View style={{ gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
      <Heading level={3} style={styles.h3}>
        {take.name}
      </Heading>
      <Label muted>
        {formatTime(take.duration)} · {backing}
        {take.backing.kind !== 'none' ? ` · ${take.compensation} ms` : ''}
      </Label>
      <View style={row}>
        {playing ? (
          <Button variant="secondary" onPress={stop}>
            Parar reproducción
          </Button>
        ) : (
          <>
            <Button disabled={locked} variant="secondary" onPress={() => listen(false)}>
              Toma sola
            </Button>
            {take.backing.kind !== 'none' ? (
              <Button disabled={locked} variant="secondary" onPress={() => listen(true)}>
                Toma + base
              </Button>
            ) : null}
          </>
        )}
        <Button variant="ghost" onPress={() => downloadTake(take)}>
          Descargar WAV
        </Button>
      </View>
      <MoreMenu label="Gestionar toma">
        <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
          {edit === 'rename' ? (
            <Field
              label="Nombre de la toma"
              value={name}
              onChangeText={(text) => setName(text.slice(0, 100))}
            />
          ) : null}
          {edit === 'delete' ? <Label>¿Borrar «{take.name}»?</Label> : null}
          <View style={row}>
            {edit === 'none' ? (
              <>
                <Button
                  variant="secondary"
                  disabled={locked}
                  onPress={() => {
                    setName(take.name);
                    setEdit('rename');
                  }}
                >
                  Renombrar
                </Button>
                <Button variant="danger" disabled={locked} onPress={() => setEdit('delete')}>
                  Borrar
                </Button>
              </>
            ) : (
              <>
                {edit === 'rename' ? (
                  <Button
                    variant="secondary"
                    disabled={locked || !name.trim()}
                    onPress={() => {
                      save({ ...take, name: name.trim() });
                      setEdit('none');
                    }}
                  >
                    Guardar nombre
                  </Button>
                ) : (
                  <Button variant="danger" disabled={locked} onPress={remove}>
                    Borrar toma
                  </Button>
                )}
                <Button variant="ghost" onPress={() => setEdit('none')}>
                  Cancelar
                </Button>
              </>
            )}
          </View>
        </View>
      </MoreMenu>
    </View>
  );
}
