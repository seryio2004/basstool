import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
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
} from '../core/transcription';
import { listSessions, loadSession, saveSession } from '../data/transcriptions';
import { createPlayer } from '../platform/player';
import type { BassMode, Loop, PickedAudio, Player } from '../platform/playerTypes';

export function Transcribe() {
  const { width } = useWindowDimensions();
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
      if (latest.current) void saveSession(latest.current);
    };
  }, []);

  async function pick() {
    setError('');
    setBusy(true);
    try {
      const picked = await player.current!.pick();
      if (!picked) return;
      const s = (await loadSession(picked.id)) ?? newSession(picked);
      const p = player.current!;
      p.setRate(s.rate);
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
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === ' ') {
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
    return (
      <View style={{ gap: 24 }}>
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
      </View>
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

  return (
    <View style={{ gap: 20 }}>
      <Intro />
      <View style={[styles.panel, { gap: 16 }]}>
        <View style={styles.between}>
          <Text style={[styles.h3, { flex: 1, minWidth: 160 }]} numberOfLines={1}>
            {audio.name}
          </Text>
          <Button small variant="ghost" busy={busy} onPress={() => void pick()}>
            Cambiar canción
          </Button>
        </View>
        <Waveform
          key={session.id}
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
        <View style={[styles.between, { alignItems: 'flex-end' }]}>
          <Text
            style={{
              color: colors.ink,
              fontSize: 30,
              fontWeight: '600',
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatTime(time)}
            <Text style={{ color: colors.muted, fontSize: 15, fontWeight: '400' }}>
              {' '}
              / {formatTime(session.duration)}
            </Text>
          </Text>
          <Text style={{ color: colors.green, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
            {percent} %
            {session.bass !== 'off'
              ? ` · ${session.bass === 'boost' ? 'graves realzados' : 'solo graves'}`
              : ''}
          </Text>
        </View>
        <View
          style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }}
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
        {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
        {Platform.OS === 'web' && wide ? (
          <Label muted style={{ textAlign: 'center' }}>
            Teclado: espacio reproduce o pausa · flechas ±1 s (Mayús ±5 s) · [ y ] fijan el bucle ·
            S sección · M compás · B pulso
          </Label>
        ) : null}
      </View>

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
      />

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
        <Section title="Bucle" wide={wide}>
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
                    unit="0,1 s"
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
                small
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
        </Section>

        <Section title="Sonido" wide={wide}>
          <Text style={[styles.text, { fontWeight: '600' }]}>Velocidad</Text>
          <Stepper
            value={`${percent} %`}
            label="Velocidad"
            unit="5 %"
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
          <Text style={[styles.text, { fontWeight: '600', marginTop: 4 }]}>Tono</Text>
          {p.canTranspose ? (
            <Stepper
              value={`${session.transpose > 0 ? '+' : ''}${session.transpose} st`}
              label="Transporte en semitonos"
              unit="1 semitono"
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
          ) : (
            <Label muted>Transportar el tono llegará con el nuevo motor de audio.</Label>
          )}
        </Section>

        <Section title="Secciones" wide={wide}>
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
        </Section>
      </View>
    </View>
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

function Section({
  title,
  wide,
  children,
}: {
  title: string;
  wide: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.panel, { gap: 12 }, wide ? { flex: 1, minWidth: 0 } : { width: '100%' }]}>
      <Heading level={2} style={styles.h2}>
        {title}
      </Heading>
      {children}
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
          minHeight: 40,
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
        style={[styles.field, { flex: 1, minWidth: 0, minHeight: 40, paddingVertical: 8 }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Borrar ${name}`}
        onPress={onRemove}
        style={{ padding: 11 }}
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
  const size = primary ? 68 : 52;
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
  unit,
  onMinus,
  onPlus,
  minusDisabled = false,
  plusDisabled = false,
}: {
  value: string;
  label: string;
  unit: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
}) {
  return (
    <View style={[styles.row, { gap: 6, flexWrap: 'wrap' }]}>
      <Button small variant="secondary" disabled={minusDisabled} onPress={onMinus}>
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
      <Button small variant="secondary" disabled={plusDisabled} onPress={onPlus}>
        +
      </Button>
      <Label muted style={{ fontSize: 12 }}>
        pasos de {unit}
      </Label>
    </View>
  );
}
