import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button, Chips, Heading, Icon, Label, colors, styles } from '../components/ui';
import { Waveform } from '../components/Waveform';
import { ScoreEditor } from '../components/ScoreEditor';
import { tunings } from '../core/instrument';
import { loopFromTimes } from '../core/waveform';
import { useStore } from '../data/Store';
import {
  RATE_MAX,
  RATE_MIN,
  Session,
  addMarker,
  clampTime,
  clearLoop,
  formatTime,
  newSession,
  nudgeLoop,
  removeMarker,
  renameMarker,
  setLoopEnd,
  setLoopStart,
  setRate,
  setTranspose,
  setVolume,
} from '../core/transcription';
import { listSessions, loadSession, saveSession } from '../data/transcriptions';
import { createPlayer } from '../platform/player';
import type { BassMode, Loop, PickedAudio, Player } from '../platform/playerTypes';

export function Transcribe({ pagePadding }: { pagePadding: number }) {
  const { width, height } = useWindowDimensions();
  const wide = width >= 1100;
  const player = useRef<Player | null>(null);
  if (!player.current) player.current = createPlayer();
  const [audio, setAudio] = useState<PickedAudio | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<Session[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Session | null>(null);
  const { profile } = useStore();
  const instrument = tunings[profile.tuning];
  const [editing, setEditing] = useState(false);
  const [openSection, setOpenSection] = useState<'Bucle' | 'Sonido' | 'Secciones' | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const scrollBody = useRef<React.ComponentRef<typeof View>>(null);
  const scrollY = useRef(0);
  const resumeVolume = useRef(1);
  const revealCursor = useCallback(
    (view: React.ComponentRef<typeof View>, top: number, height: number) => {
      if (!scrollBody.current || !viewportHeight) return;
      view.measureLayout(scrollBody.current, (_, offset) => {
        const start = offset + top;
        const end = start + height;
        const y = scrollY.current;
        const next =
          start < y + 12
            ? start - 12
            : end > y + viewportHeight - 12
              ? end - viewportHeight + 12
              : y;
        if (next !== y) scroll.current?.scrollTo({ y: Math.max(0, next), animated: false });
      });
    },
    [viewportHeight],
  );
  const frame = (body: React.ReactNode, entry?: React.ReactNode) => (
    <View style={{ flex: 1, minHeight: 0 }}>
      <ScrollView
        ref={scroll}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        <View
          ref={scrollBody}
          collapsable={false}
          style={{
            width: '100%',
            maxWidth: 1400,
            alignSelf: 'center',
            padding: pagePadding,
            paddingBottom: entry ? 12 : 50,
            gap: 16,
          }}
        >
          {body}
        </View>
      </ScrollView>
      {entry ? (
        <View
          style={{ backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 1400,
              alignSelf: 'center',
              paddingHorizontal: Math.min(20, pagePadding),
              paddingVertical: 6,
            }}
          >
            {entry}
          </View>
        </View>
      ) : null}
    </View>
  );
  // Acciones de marcado que registra el editor de partitura (teclas M y B).
  const scoreActions = useRef<{ markMeasure: () => void; markBeat: () => void } | null>(null);
  const registerScore = useCallback(
    (actions: { markMeasure: () => void; markBeat: () => void } | null) => {
      scoreActions.current = actions;
    },
    [],
  );

  const persist = useCallback((next: Session) => {
    latest.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void saveSession(next).catch(() =>
        setError('No se pudo guardar la sesión en este dispositivo.'),
      );
    }, 600);
  }, []);
  /** Cambia la sesión y la guarda. Cada acción actualiza también el reproductor. */
  const update = useCallback(
    (change: (s: Session) => Session) => {
      const current = latest.current;
      if (!current) return;
      const next = change(current);
      if (next === current) return;
      persist(next);
      setSession(next);
    },
    [persist],
  );

  useEffect(() => {
    void listSessions()
      .then(setRecent)
      .catch(() => {});
    const p = player.current!;
    const off = p.onTime((t, isPlaying) => {
      setTime(t);
      setPlaying(isPlaying);
    });
    return () => {
      off();
      p.unload();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (latest.current) void saveSession(latest.current).catch(() => {});
    };
  }, []);

  async function pick() {
    setError('');
    setBusy(true);
    try {
      const picked = await player.current!.pick();
      if (!picked) return;
      const previous = latest.current;
      if (previous && previous.id !== picked.id && saveTimer.current !== null) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void saveSession(previous).catch(() => setError('No se pudo guardar la sesión anterior.'));
      }
      const s =
        previous?.id === picked.id
          ? previous
          : ((await loadSession(picked.id)) ?? newSession(picked));
      resumeVolume.current = s.volume || 1;
      const p = player.current!;
      p.setRate(s.rate);
      p.setVolume(s.volume);
      p.setLoop(s.loop);
      p.setBass(s.bass);
      p.setTranspose(s.transpose);
      p.seek(s.position);
      if (latest.current?.id !== s.id) setEditing(false);
      setAudio(picked);
      setSession(s);
      setTime(s.position);
      persist(s);
    } catch (e) {
      setError((e as Error).message || 'No se pudo abrir el archivo.');
    } finally {
      setBusy(false);
    }
  }

  const seek = useCallback(
    (t: number) =>
      update((s) => {
        const position = clampTime(s, t);
        player.current!.seek(position);
        setTime(position);
        return { ...s, position };
      }),
    [update],
  );
  const toggle = useCallback(() => {
    const p = player.current!;
    if (playing) {
      p.pause();
      update((s) => ({ ...s, position: time }));
    } else void p.play().catch((e) => setError((e as Error).message));
  }, [playing, time, update]);
  const loopAt = useCallback(
    (edge: 'a' | 'b') =>
      update((s) => {
        const next = edge === 'a' ? setLoopStart(s, time) : setLoopEnd(s, time);
        player.current!.setLoop(next.loop);
        return next;
      }),
    [time, update],
  );
  const mark = useCallback(() => update((s) => addMarker(s, time)), [time, update]);

  // Atajos de teclado en web, como en los reproductores de transcripción: espacio,
  // flechas (Mayús = 5 s), S sección, M compás, B pulso, [ y ] bucle.
  // En modo «Escribir» el teclado es del editor de partitura.
  useEffect(() => {
    if (Platform.OS !== 'web' || !session || editing || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.defaultPrevented ||
        target?.closest('input, textarea, select, [contenteditable=true], [role=slider]')
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === ' ') {
        if (target?.closest('button, [role=button]')) return;
        e.preventDefault();
        toggle();
      } else if (key === 'arrowleft' || key === 'arrowright') {
        e.preventDefault();
        seek(time + (key === 'arrowleft' ? -1 : 1) * (e.shiftKey ? 5 : 1));
      } else if (key === '[') loopAt('a');
      else if (key === ']') loopAt('b');
      else if (key === 's') mark();
      else if (key === 'm') scoreActions.current?.markMeasure();
      else if (key === 'b') scoreActions.current?.markBeat();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [session, editing, toggle, seek, loopAt, mark, time]);

  if (!audio || !session)
    return frame(
      <>
        <Intro />
        <View style={[styles.panel, { alignItems: 'flex-start' }]}>
          <Heading level={2} style={styles.h2}>
            Elige una canción
          </Heading>
          <Label muted>
            MP3, M4A o WAV de tu dispositivo. Podrás ralentizarla sin cambiar el tono, repetir un
            fragmento y realzar los graves.
          </Label>
          <Button icon="plus" busy={busy} onPress={() => void pick()}>
            Elegir canción
          </Button>
          {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
        </View>
        {recent.length ? (
          <View style={styles.panel}>
            <Heading level={2} style={styles.h2}>
              Recientes
            </Heading>
            <Label muted>
              Se guardan la posición, el bucle, las marcas y los ajustes, no el audio. Vuelve a
              elegir el archivo para seguir donde lo dejaste.
            </Label>
            {recent.slice(0, 8).map((s) => (
              <View
                key={s.id}
                style={{
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.line,
                  gap: 3,
                }}
              >
                <Text style={styles.h3} numberOfLines={1}>
                  {s.name}
                </Text>
                <Label muted>
                  {formatTime(s.duration)}
                  {s.markers.length
                    ? ` · ${s.markers.length} ${s.markers.length === 1 ? 'marca' : 'marcas'}`
                    : ''}
                  {s.loop ? ` · bucle ${formatTime(s.loop.a)}–${formatTime(s.loop.b)}` : ''}
                </Label>
              </View>
            ))}
          </View>
        ) : null}
      </>,
    );

  const percent = Math.round(session.rate * 100);
  const p = player.current!;
  const withPlayer = (change: (s: Session) => Session, apply: (s: Session) => void) =>
    update((s) => {
      const next = change(s);
      if (next !== s) apply(next);
      return next;
    });

  const selectLoop = (selection: Loop | null) =>
    withPlayer(
      (s) => {
        if (!selection) return clearLoop(s);
        const loop = loopFromTimes(clampTime(s, selection.a), clampTime(s, selection.b));
        return loop ? { ...s, loop, updatedAt: new Date().toISOString() } : s;
      },
      (s) => p.setLoop(s.loop),
    );

  const changeVolume = (value: number) =>
    withPlayer(
      (s) => setVolume(s, value),
      (s) => {
        if (s.volume > 0) resumeVolume.current = s.volume;
        p.setVolume(s.volume);
      },
    );

  const transport = (
    <View style={[styles.panel, { gap: 8, padding: wide ? 24 : 12 }]}>
      <View style={styles.between}>
        <Text style={[styles.h3, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
          {audio.name}
        </Text>
        <Button variant="ghost" busy={busy} onPress={() => void pick()}>
          Cambiar canción
        </Button>
      </View>
      <Waveform
        key={session.id}
        height={wide ? 120 : 88}
        peaks={audio.peaks}
        duration={session.duration}
        position={time}
        loop={session.loop}
        markers={session.markers}
        playing={playing}
        onSeek={seek}
        onSelect={selectLoop}
        onClearLoop={() => selectLoop(null)}
      />
      <View style={[styles.between, { gap: 8 }]}>
        <View style={[styles.row, { gap: 6 }]}>
          <Text
            style={{
              color: colors.ink,
              fontSize: 20,
              fontWeight: '600',
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatTime(time)}
          </Text>
          <Label muted style={{ fontVariant: ['tabular-nums'] }}>
            / {formatTime(session.duration)}
          </Label>
        </View>
        <Label muted>{percent} %</Label>
      </View>
      <View
        style={{
          flexDirection: wide ? 'row' : 'column',
          alignItems: wide ? 'center' : 'stretch',
          gap: 8,
        }}
      >
        <View
          style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
        >
          <Round label="−5 s" hint="Retroceder 5 segundos" onPress={() => seek(time - 5)} />
          <Round label="−1 s" hint="Retroceder 1 segundo" onPress={() => seek(time - 1)} />
          <Round
            icon={playing ? 'pause' : 'play'}
            hint={playing ? 'Pausa' : 'Reproducir'}
            onPress={toggle}
            primary
          />
          <Round label="+1 s" hint="Avanzar 1 segundo" onPress={() => seek(time + 1)} />
          <Round label="+5 s" hint="Avanzar 5 segundos" onPress={() => seek(time + 5)} />
        </View>
        <VolumeControl
          volume={session.volume}
          onChange={changeVolume}
          onMute={() => changeVolume(session.volume > 0 ? 0 : resumeVolume.current)}
        />
      </View>
      {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
    </View>
  );

  const songTools = (
    <View style={[styles.panel, { gap: 8, padding: wide ? 24 : 12 }]}>
      <Chips
        minHeight={44}
        value={openSection ?? ''}
        onChange={(name) => setOpenSection(!name || name === openSection ? null : name)}
        options={[
          { value: 'Bucle', label: session.loop ? 'Bucle · A–B' : 'Bucle' },
          { value: 'Sonido', label: 'Sonido' },
          {
            value: 'Secciones',
            label: session.markers.length ? `Secciones · ${session.markers.length}` : 'Secciones',
          },
        ]}
      />
      {openSection === 'Bucle' ? (
        <View style={{ gap: 8 }}>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            <Button variant="secondary" onPress={() => loopAt('a')}>
              A aquí ([)
            </Button>
            <Button variant="secondary" onPress={() => loopAt('b')} disabled={!session.loop}>
              B aquí (])
            </Button>
            {session.loop ? (
              <Button variant="ghost" onPress={() => withPlayer(clearLoop, () => p.setLoop(null))}>
                Quitar
              </Button>
            ) : null}
          </View>
          {session.loop ? (
            <View style={{ gap: 8 }}>
              {(['a', 'b'] as const).map((edge) => (
                <View key={edge} style={[styles.row, { gap: 8 }]}>
                  <Text style={[styles.h3, { width: 18 }]}>{edge.toUpperCase()}</Text>
                  <Stepper
                    value={formatTime(session.loop![edge])}
                    label={`Punto ${edge.toUpperCase()}`}
                    onMinus={() =>
                      withPlayer(
                        (s) => nudgeLoop(s, edge, -0.1),
                        (s) => p.setLoop(s.loop),
                      )
                    }
                    onPlus={() =>
                      withPlayer(
                        (s) => nudgeLoop(s, edge, 0.1),
                        (s) => p.setLoop(s.loop),
                      )
                    }
                  />
                </View>
              ))}
              <Button
                variant="ghost"
                icon="play"
                onPress={() => seek(session.loop!.a)}
                style={{ alignSelf: 'flex-start' }}
              >
                Ir al inicio del bucle
              </Button>
            </View>
          ) : (
            <Label muted>
              Pulsa «A aquí» donde empieza el fragmento: se crea un bucle de 4 s que ajustas con B.
            </Label>
          )}
        </View>
      ) : openSection === 'Sonido' ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.text, { fontWeight: '600' }]}>Velocidad</Text>
          <Stepper
            value={`${percent} %`}
            label="Velocidad"
            onMinus={() =>
              withPlayer(
                (s) => setRate(s, s.rate - 0.05),
                (s) => p.setRate(s.rate),
              )
            }
            onPlus={() =>
              withPlayer(
                (s) => setRate(s, s.rate + 0.05),
                (s) => p.setRate(s.rate),
              )
            }
            minusDisabled={session.rate <= RATE_MIN}
            plusDisabled={session.rate >= RATE_MAX}
          />
          <Chips
            minHeight={44}
            value={String(percent)}
            onChange={(v) =>
              withPlayer(
                (s) => setRate(s, Number(v) / 100),
                (s) => p.setRate(s.rate),
              )
            }
            options={['50', '75', '100'].map((v) => ({ value: v, label: `${v} %` }))}
          />
          <Text style={[styles.text, { fontWeight: '600', marginTop: 4 }]}>Graves</Text>
          <Chips<BassMode>
            minHeight={44}
            value={session.bass}
            onChange={(bass) =>
              withPlayer(
                (s) => ({ ...s, bass }),
                () => p.setBass(bass),
              )
            }
            options={[
              { value: 'off', label: 'Normal' },
              { value: 'boost', label: 'Realzar' },
              { value: 'solo', label: 'Solo graves' },
            ]}
          />
          {p.canTranspose ? (
            <>
              <Text style={[styles.text, { fontWeight: '600', marginTop: 4 }]}>Tono</Text>
              <Stepper
                value={`${session.transpose > 0 ? '+' : ''}${session.transpose} st`}
                label="Transporte en semitonos"
                onMinus={() =>
                  withPlayer(
                    (s) => setTranspose(s, s.transpose - 1),
                    (s) => p.setTranspose(s.transpose),
                  )
                }
                onPlus={() =>
                  withPlayer(
                    (s) => setTranspose(s, s.transpose + 1),
                    (s) => p.setTranspose(s.transpose),
                  )
                }
              />
            </>
          ) : null}
        </View>
      ) : openSection === 'Secciones' ? (
        <View style={{ gap: 8 }}>
          <Button
            variant="secondary"
            icon="plus"
            onPress={mark}
            style={{ alignSelf: 'flex-start' }}
          >
            Sección en {formatTime(time)} (S)
          </Button>
          {session.markers.length ? (
            session.markers.map((m) => (
              <MarkerRow
                key={m.id}
                time={m.time}
                name={m.name}
                onGo={() => seek(m.time)}
                onRename={(name) => update((s) => renameMarker(s, m.id, name))}
                onRemove={() => update((s) => removeMarker(s, m.id))}
              />
            ))
          ) : (
            <Label muted>
              Nombra la intro, la estrofa, el estribillo o el puente para saltar entre ellos.
            </Label>
          )}
        </View>
      ) : null}
    </View>
  );

  return (
    <ScoreEditor
      key={session.id}
      sessionId={session.id}
      duration={session.duration}
      time={time}
      instrument={instrument}
      nomenclature={profile.nomenclature}
      leftHanded={profile.leftHanded}
      wide={wide}
      editing={editing}
      onEditingChange={setEditing}
      onSeek={seek}
      onLoop={selectLoop}
      register={registerScore}
      onCursorFrame={revealCursor}
      fretboardHeight={Math.max(100, Math.min(294, height - 475))}
      playing={playing}
      onTogglePlayback={toggle}
      renderLayout={(score, entry) =>
        frame(
          <>
            <Heading level={1} style={styles.title}>
              Transcribir
            </Heading>
            {transport}
            {score}
            {songTools}
          </>,
          entry,
        )
      }
    />
  );
}

function Intro() {
  return (
    <View style={{ gap: 8 }}>
      <Heading level={1} style={styles.title}>
        Transcribir
      </Heading>
      <Label muted>Saca líneas de bajo de tus canciones. El audio no sale de tu dispositivo.</Label>
    </View>
  );
}

function MarkerRow({
  time,
  name,
  onGo,
  onRename,
  onRemove,
}: {
  time: number;
  name: string;
  onGo: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const commit = () => {
    const clean = draft.trim();
    if (clean && clean !== name) onRename(clean);
    else setDraft(name);
  };
  return (
    <View style={[styles.row, { gap: 8 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ir a ${name}, ${formatTime(time)}`}
        onPress={onGo}
        style={{
          minHeight: 44,
          justifyContent: 'center',
          paddingHorizontal: 9,
          borderRadius: 7,
          backgroundColor: colors.pale,
        }}
      >
        <Text style={{ color: colors.green, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
          {formatTime(time)}
        </Text>
      </Pressable>
      <TextInput
        accessibilityLabel={`Nombre de la marca en ${formatTime(time)}`}
        value={draft}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        maxLength={40}
        style={[styles.field, { flex: 1, minWidth: 0, minHeight: 44, paddingVertical: 8 }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Borrar ${name}`}
        onPress={onRemove}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="close" size={18} />
      </Pressable>
    </View>
  );
}

/** Botón redondo de transporte, grande para usarlo con el bajo colgado. */
function Round({
  label,
  icon,
  hint,
  onPress,
  primary = false,
}: {
  label?: string;
  icon?: string;
  hint: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const size = primary ? 52 : 44;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? colors.green : colors.pale,
        opacity: pressed ? 0.7 : hovered ? 0.86 : 1,
      })}
    >
      {icon ? (
        <Icon name={icon} size={26} color={primary ? colors.white : colors.green} />
      ) : (
        <Text style={{ color: colors.green, fontWeight: '600', fontSize: 13 }}>{label}</Text>
      )}
    </Pressable>
  );
}

function Stepper({
  value,
  label,
  onMinus,
  onPlus,
  minusDisabled = false,
  plusDisabled = false,
}: {
  value: string;
  label: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
}) {
  return (
    <View style={[styles.row, { gap: 6, flexWrap: 'wrap' }]}>
      <Button
        variant="secondary"
        style={{ paddingHorizontal: 12, minWidth: 44 }}
        disabled={minusDisabled}
        onPress={onMinus}
      >
        −
      </Button>
      <Text
        accessibilityLabel={`${label}: ${value}`}
        style={{
          minWidth: 72,
          textAlign: 'center',
          color: colors.ink,
          fontWeight: '600',
          fontSize: 16,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Button
        variant="secondary"
        style={{ paddingHorizontal: 12, minWidth: 44 }}
        disabled={plusDisabled}
        onPress={onPlus}
      >
        +
      </Button>
    </View>
  );
}

function VolumeControl({
  volume,
  onChange,
  onMute,
}: {
  volume: number;
  onChange: (volume: number) => void;
  onMute: () => void;
}) {
  const percent = Math.round(volume * 100);
  return (
    <View style={[styles.row, { flex: 1, minWidth: 0, gap: 8 }]}>
      <Button variant="ghost" style={{ paddingHorizontal: 6, minWidth: 68 }} onPress={onMute}>
        {volume === 0 ? 'Activar sonido' : 'Silenciar'}
      </Button>
      <View style={{ flex: 1, minWidth: 0 }}>
        {Platform.OS === 'web' ? (
          <input
            aria-label="Volumen de la música"
            aria-valuetext={`${percent} %`}
            type="range"
            min={0}
            max={100}
            value={percent}
            onChange={(e) => onChange(e.currentTarget.valueAsNumber / 100)}
            style={{ width: '100%', height: 44, margin: 0, accentColor: colors.green }}
          />
        ) : (
          <NativeVolumeSlider volume={volume} onChange={onChange} />
        )}
      </View>
      <Text
        style={{
          color: colors.ink,
          minWidth: 46,
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        }}
      >
        {percent} %
      </Text>
    </View>
  );
}

function NativeVolumeSlider({
  volume,
  onChange,
}: {
  volume: number;
  onChange: (volume: number) => void;
}) {
  const width = useRef(0);
  const origin = useRef(0);
  const latestChange = useRef(onChange);
  latestChange.current = onChange;
  const responder = useMemo(() => {
    const apply = (x: number) => latestChange.current(Math.round((100 * x) / width.current) / 100);
    return PanResponder.create({
      onStartShouldSetPanResponder: () => width.current > 0,
      onPanResponderGrant: (e) => {
        origin.current = e.nativeEvent.locationX;
        apply(origin.current);
      },
      onPanResponderMove: (_, gesture) => apply(origin.current + gesture.dx),
    });
  }, []);
  const step = (delta: number) => onChange((Math.round(volume * 100) + delta) / 100);
  return (
    <View style={[styles.row, { gap: 4 }]}>
      <Round label="−" hint="Bajar volumen" onPress={() => step(-5)} />
      <View
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Volumen de la música"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(volume * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 5 : -5)}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width;
        }}
        style={{ height: 44, flex: 1, justifyContent: 'center' }}
      >
        <View
          pointerEvents="none"
          style={{ height: 6, borderRadius: 3, backgroundColor: colors.pale }}
        >
          <View
            style={{
              width: `${volume * 100}%`,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.green,
            }}
          />
        </View>
      </View>
      <Round label="+" hint="Subir volumen" onPress={() => step(5)} />
    </View>
  );
}
