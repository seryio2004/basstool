import { Heading } from '../components/ui';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, Platform } from 'react-native';
import { Button, Chips, Field, Icon, Label, colors, styles } from '../components/ui';
import { audio, startTuner, TuningValue } from '../platform/audio';
import { naturals, noteName, tuning } from '../core/music';
import { arpeggios, majorProgressions, majorTriads } from '../core/theory';
import { tunings } from '../core/instrument';
import { targetString } from '../core/tuner';
import { TunerError } from '../platform/tunerErrors';
import { FretboardTool } from './FretboardTool';
export type Tool = 'metronome' | 'tuner' | 'chords' | 'fretboard';
export const toolNames: Record<Tool, string> = {
  metronome: 'Metrónomo',
  tuner: 'Afinador',
  chords: 'Progresiones de acordes',
  fretboard: 'Mástil',
};

export function Tools({ tool, onBack }: { tool: Tool; onBack: () => void }) {
  return (
    <View style={{ gap: 24 }}>
      <Button onPress={onBack} variant="ghost" icon="back" style={{ alignSelf: 'flex-start' }}>
        Herramientas
      </Button>
      <Heading level={1} style={styles.title}>
        {toolNames[tool]}
      </Heading>
      {tool === 'metronome' ? (
        <Metronome />
      ) : tool === 'tuner' ? (
        <Tuner />
      ) : tool === 'fretboard' ? (
        <FretboardTool />
      ) : (
        <Chords />
      )}
    </View>
  );
}
function Metronome() {
  const [bpm, setBpm] = useState('90'),
    [meter, setMeter] = useState('4'),
    [running, setRunning] = useState(false),
    [beat, setBeat] = useState(-1),
    [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    if (!running) return;
    const token = ++generation.current;
    let timer: ReturnType<typeof setInterval> | undefined;
    const flashes: ReturnType<typeof setTimeout>[] = [];
    (async () => {
      try {
        await audio.ready();
        if (token !== generation.current) return;
        let next = audio.now() + 0.1,
          i = 0;
        const schedule = () => {
          while (next < audio.now() + 0.12) {
            audio.click(next, i % Number(meter) === 0);
            const current = i++ % Number(meter);
            flashes.push(
              setTimeout(() => setBeat(current), Math.max(0, (next - audio.now()) * 1000)),
            );
            next += 60 / Number(bpm);
          }
        };
        schedule();
        timer = setInterval(schedule, 25);
      } catch (e) {
        setError((e as Error).message);
        setRunning(false);
      }
    })();
    return () => {
      generation.current++;
      clearInterval(timer);
      flashes.forEach(clearTimeout);
      audio.stop();
      setBeat(-1);
    };
  }, [running, bpm, meter]);
  const valid = Number(bpm) >= 30 && Number(bpm) <= 240;
  return (
    <View style={[styles.panel, { alignItems: 'center', paddingVertical: 40 }]}>
      <Icon name="metronome" size={38} color={colors.green} />
      <Text
        style={{
          fontSize: 76,
          fontWeight: '600',
          color: colors.ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {bpm || '—'}
      </Text>
      <Label muted>Pulsos por minuto</Label>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {Array.from({ length: Number(meter) }, (_, i) => (
          <View
            key={i}
            style={{
              width: i === 0 ? 23 : 18,
              height: i === 0 ? 23 : 18,
              marginTop: i === 0 ? 0 : 2.5,
              borderRadius: 20,
              backgroundColor: beat === i ? colors.green : '#E4E9E1',
            }}
          />
        ))}
      </View>
      <View style={[styles.row, { flexWrap: 'wrap', justifyContent: 'center' }]}>
        <Button variant="secondary" onPress={() => setBpm(String(Math.max(30, Number(bpm) - 5)))}>
          −5
        </Button>
        <View style={{ width: 110 }}>
          <Field
            label="Tempo (30–240)"
            value={bpm}
            onChangeText={(v) => {
              setRunning(false);
              setBpm(v.replace(/\D/g, '').slice(0, 3));
            }}
            keyboardType="numeric"
          />
        </View>
        <Button variant="secondary" onPress={() => setBpm(String(Math.min(240, Number(bpm) + 5)))}>
          +5
        </Button>
      </View>
      <Chips
        options={['2', '3', '4', '6'].map((v) => ({ value: v, label: `${v} pulsos` }))}
        value={meter}
        onChange={setMeter}
      />
      <Button
        disabled={!valid && !running}
        icon={running ? 'pause' : 'play'}
        onPress={() => {
          setError('');
          setRunning(!running);
        }}
      >
        {running ? 'Detener' : 'Iniciar metrónomo'}
      </Button>
      {!valid ? (
        <Label style={{ color: colors.error }}>El tempo debe estar entre 30 y 240 BPM.</Label>
      ) : null}
      {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
    </View>
  );
}
function Tuner() {
  const [active, setActive] = useState(false),
    [busy, setBusy] = useState(false),
    [pitch, setPitch] = useState<TuningValue | null>(null),
    [error, setError] = useState<TunerError | null>(null),
    [preset, setPreset] = useState<keyof typeof tunings>('standard4'),
    [referenceText, setReferenceText] = useState('440');
  const cleanup = useRef<(() => void) | null>(null),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      cleanup.current?.();
    },
    [],
  );
  async function toggle() {
    if (active || busy) {
      generation.current++;
      cleanup.current?.();
      cleanup.current = null;
      setActive(false);
      setBusy(false);
      setPitch(null);
      return;
    }
    setBusy(true);
    setError(null);
    setPitch(null);
    const token = ++generation.current;
    try {
      const stop = await startTuner(
        (value) => {
          if (token === generation.current) setPitch(value);
        },
        (failure) => {
          if (token !== generation.current) return;
          setError(failure);
          setPitch(null);
          setActive(false);
          cleanup.current = null;
        },
      );
      if (token !== generation.current) {
        stop();
        return;
      }
      cleanup.current = stop;
      setActive(true);
    } catch (e) {
      if (token === generation.current) {
        setError(e instanceof TunerError ? e : new TunerError('unavailable', (e as Error).message));
      }
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  const reference = Number(referenceText.replace(',', '.'));
  const validReference = reference >= 415 && reference <= 466;
  const instrument = tunings[preset];
  const target = pitch && validReference ? targetString(instrument, pitch.hz, reference) : null;
  const detected = pitch && validReference ? tuning(pitch.hz, reference) : null;
  const centered = target !== null && Math.abs(target.cents) <= 5;
  const cents = target ? Math.round(target.cents) : 0;
  const errorTitle =
    error?.code === 'permission-denied'
      ? 'Permiso denegado'
      : error?.code === 'unsupported'
        ? Platform.OS === 'web'
          ? 'Navegador no compatible'
          : 'Afinador nativo pendiente'
        : 'Micrófono no disponible';
  return (
    <View style={[styles.panel, { gap: 24 }]}>
      <View style={{ gap: 10 }}>
        <Label style={{ fontWeight: '600', fontSize: 16 }}>Afinación</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(tunings) as (keyof typeof tunings)[]).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`Afinación: ${tunings[key].name}`}
              accessibilityState={{ selected: preset === key }}
              aria-pressed={preset === key}
              onPress={() => setPreset(key)}
              style={({ pressed }) => ({
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: preset === key ? colors.green : colors.pale,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Text style={{ fontSize: 16, color: preset === key ? colors.white : colors.green }}>
                {tunings[key].name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ gap: 8, maxWidth: 280 }}>
        <Label style={{ fontSize: 16 }}>Referencia de La4 (Hz)</Label>
        <TextInput
          accessibilityLabel="Referencia de La4 en Hz, entre 415 y 466"
          keyboardType="numeric"
          value={referenceText}
          onChangeText={setReferenceText}
          style={[styles.field, { fontSize: 16 }]}
        />
        <Label muted>Entre 415 y 466 Hz. Habitual: 440 Hz.</Label>
        {!validReference ? (
          <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 14 }}>
            Introduce una referencia entre 415 y 466 Hz.
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 12 }}>
        <Icon name="tuner" size={35} color={colors.green} />
        <Label style={{ fontSize: 16 }}>
          {target
            ? `Cuerda ${instrument.strings.length - target.string} · objetivo`
            : 'Cuerda objetivo'}
        </Label>
        <Text
          style={{ fontSize: 72, color: centered ? colors.green : colors.ink, fontWeight: '600' }}
        >
          {target ? `${target.name}${target.octave}` : '—'}
        </Text>
        <Label style={{ fontSize: 18 }}>
          {target ? `${cents > 0 ? '+' : ''}${cents} cents` : '— cents'}
        </Label>
        <Label muted style={{ textAlign: 'center' }}>
          {detected
            ? `Detectado: ${detected.name}${detected.octave} · ${detected.hz.toFixed(1)} Hz`
            : 'Cuerdas numeradas desde la más aguda (1).'}
        </Label>
        <View
          accessible={false}
          style={{ width: '100%', maxWidth: 400, height: 46, justifyContent: 'center' }}
        >
          <View style={{ height: 5, backgroundColor: colors.line, borderRadius: 5 }} />
          <View
            style={{
              position: 'absolute',
              width: 3,
              height: 28,
              left: '50%',
              backgroundColor: colors.green,
            }}
          />
          {target ? (
            <View
              style={{
                position: 'absolute',
                width: 10,
                height: 20,
                borderRadius: 4,
                left: `${50 + Math.max(-45, Math.min(45, target.cents))}%`,
                backgroundColor: centered ? colors.green : colors.ink,
              }}
            />
          ) : null}
        </View>
        <View accessibilityLiveRegion="polite" style={{ gap: 6, alignItems: 'center' }}>
          <Text
            style={[styles.h3, { textAlign: 'center', color: error ? colors.error : colors.ink }]}
          >
            {error
              ? errorTitle
              : busy
                ? 'Esperando permiso del micrófono…'
                : !validReference
                  ? 'Revisa la referencia de La4'
                  : centered
                    ? 'Afinado'
                    : target
                      ? target.cents < 0
                        ? 'Sube la afinación'
                        : 'Baja la afinación'
                      : active
                        ? 'Sin señal'
                        : 'Micrófono desactivado'}
          </Text>
          <Label muted style={{ textAlign: 'center' }}>
            {error
              ? error.message
              : active && !target
                ? 'Toca una cuerda al aire y deja que suene.'
                : 'El audio se analiza en este dispositivo.'}
          </Label>
        </View>
        <Button disabled={!validReference && !active && !busy} onPress={() => void toggle()}>
          {busy ? 'Cancelar activación' : active ? 'Desactivar micrófono' : 'Activar micrófono'}
        </Button>
      </View>
    </View>
  );
}
function Chords() {
  const [root, setRoot] = useState('0'),
    [progression, setProgression] = useState('0,4,5,3'),
    [error, setError] = useState('');
  const chords = majorTriads(60 + Number(root), progression);
  useEffect(() => () => audio.stop(), []);
  async function play() {
    try {
      setError('');
      audio.stop();
      await audio.ready();
      const t = audio.now() + 0.1;
      chords.forEach(({ root, quality }, i) => {
        arpeggios[quality].tones.forEach(({ semitones }) =>
          audio.tone(root + semitones, t + i * 0.8, 0.65, 0.08),
        );
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <View style={styles.panel}>
      <Heading level={2} style={styles.h2}>
        Progresiones en tonalidad mayor
      </Heading>
      <Label muted>Selecciona una tonalidad y escucha cómo se relacionan los acordes.</Label>
      <Chips
        value={root}
        onChange={setRoot}
        options={naturals
          .slice(0, 7)
          .map((n) => ({ value: String(n - 60), label: `${noteName(n)} mayor` }))}
      />
      <Chips value={progression} onChange={setProgression} options={majorProgressions} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 20 }}>
        {chords.map(({ root, quality, degree }, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              minWidth: 100,
              backgroundColor: '#F0F4EC',
              borderRadius: 10,
              padding: 22,
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Text style={{ color: colors.green, fontSize: 30, fontWeight: '600' }}>
              {noteName(root)}
              {quality === 'minor' ? 'm' : quality === 'diminished' ? '°' : ''}
            </Text>
            <Label muted>{degree}</Label>
          </View>
        ))}
      </View>
      <Button icon="play" style={{ alignSelf: 'flex-start' }} onPress={() => void play()}>
        Escuchar progresión
      </Button>
      {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
    </View>
  );
}
