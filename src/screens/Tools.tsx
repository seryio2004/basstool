import { Heading } from '../components/ui';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View, Text, TextInput, Platform } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { Button, Chips, Field, Label, MoreMenu, colors, fonts, styles } from '../components/ui';
import { Knob } from '../components/Knob';
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
  const setTempo = (v: number) => setBpm(String(Math.max(30, Math.min(240, v))));
  return (
    <View style={[styles.panel, { alignItems: 'center', paddingVertical: 36, gap: 24 }]}>
      <View style={{ alignItems: 'center' }}>
        <Text
          accessibilityLabel={`${bpm || 'Sin'} pulsos por minuto`}
          style={[styles.data, { fontSize: 72, lineHeight: 80 }]}
        >
          {bpm || '—'}
        </Text>
        <Text style={styles.legend}>Pulsos por minuto</Text>
      </View>
      <View
        accessibilityElementsHidden
        style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}
      >
        {Array.from({ length: Number(meter) }, (_, i) => (
          <View
            key={i}
            style={{
              width: i === 0 ? 22 : 16,
              height: i === 0 ? 22 : 16,
              borderRadius: 11,
              borderWidth: 1,
              borderColor: beat === i ? colors.accent : colors.lineStrong,
              backgroundColor: beat === i ? colors.accent : colors.sunken,
            }}
          />
        ))}
      </View>
      <View style={[styles.row, { gap: 20 }]}>
        <Button
          variant="secondary"
          accessibilityLabel="Bajar 5 BPM"
          onPress={() => setTempo(Number(bpm) - 5)}
        >
          −5
        </Button>
        <Knob
          label="Tempo"
          value={valid ? Number(bpm) : 90}
          min={30}
          max={240}
          onChange={(v) => setBpm(String(v))}
          format={(v) => `${v} BPM`}
        />
        <Button
          variant="secondary"
          accessibilityLabel="Subir 5 BPM"
          onPress={() => setTempo(Number(bpm) + 5)}
        >
          +5
        </Button>
      </View>
      <Chips
        label="Pulsos por compás"
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
      <MoreMenu label="Escribir el tempo" align="center">
        <View style={{ width: 160 }}>
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
      </MoreMenu>
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
  const status = error
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
              : 'Micrófono desactivado';
  return (
    <View style={{ gap: 20 }}>
      <View style={[styles.panel, { alignItems: 'center', gap: 16, paddingVertical: 32 }]}>
        <VuMeter cents={target ? target.cents : null} centered={centered} />
        <View style={{ alignItems: 'center' }}>
          <Text
            style={[
              styles.title,
              {
                fontSize: 64,
                lineHeight: 72,
                color: centered ? colors.success : target ? colors.ink : colors.faint,
              },
            ]}
          >
            {target ? `${target.name}${target.octave}` : '—'}
          </Text>
          <Text style={[styles.data, { fontSize: 20, color: colors.muted }]}>
            {target ? `${cents > 0 ? '+' : ''}${cents} cents` : '— cents'}
          </Text>
        </View>
        <Label muted style={{ textAlign: 'center' }}>
          {target
            ? `Cuerda ${instrument.strings.length - target.string} · ${detected ? `${detected.name}${detected.octave} · ${detected.hz.toFixed(1)} Hz` : ''}`
            : 'Cuerdas numeradas desde la más aguda (1).'}
        </Label>
        <View accessibilityLiveRegion="polite" style={{ gap: 6, alignItems: 'center' }}>
          <Text
            style={[
              styles.h3,
              {
                textAlign: 'center',
                color: error ? colors.error : centered ? colors.success : colors.ink,
              },
            ]}
          >
            {status}
          </Text>
          <Label muted style={{ textAlign: 'center' }}>
            {error
              ? error.message
              : active && !target
                ? 'Toca una cuerda al aire y deja que suene.'
                : 'El audio se analiza en este dispositivo.'}
          </Label>
        </View>
        <Button
          icon={active || busy ? 'pause' : 'tuner'}
          disabled={!validReference && !active && !busy}
          onPress={() => void toggle()}
        >
          {busy ? 'Cancelar activación' : active ? 'Desactivar micrófono' : 'Activar micrófono'}
        </Button>
      </View>
      <MoreMenu label={`Afinación: ${instrument.name} · La4 ${referenceText} Hz`}>
        <View style={{ gap: 20, padding: 6, flex: 1 }}>
          <Chips
            label="Afinación"
            value={preset}
            onChange={setPreset}
            minHeight={44}
            options={(Object.keys(tunings) as (keyof typeof tunings)[]).map((key) => ({
              value: key,
              label: tunings[key].name,
            }))}
          />
          <View style={{ gap: 8, maxWidth: 280 }}>
            <Label style={{ fontWeight: '500' }}>Referencia de La4 (Hz)</Label>
            <TextInput
              accessibilityLabel="Referencia de La4 en Hz, entre 415 y 466"
              keyboardType="numeric"
              value={referenceText}
              onChangeText={setReferenceText}
              style={[styles.field, styles.data, { fontSize: 16 }]}
            />
            <Label muted>Entre 415 y 466 Hz. Habitual: 440 Hz.</Label>
          </View>
        </View>
      </MoreMenu>
      {!validReference ? (
        <Text accessibilityRole="alert" style={[styles.text, { color: colors.error }]}>
          Introduce una referencia de La4 entre 415 y 466 Hz.
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Vúmetro del afinador: escala de −50 a +50 cents y aguja con inercia de
 * galvanómetro. Es el único movimiento con autoría de la app; con movimiento
 * reducido la aguja salta sin animación.
 */
function VuMeter({ cents, centered }: { cents: number | null; centered: boolean }) {
  const W = 300,
    H = 150,
    R = 128,
    cx = W / 2,
    cy = H - 8;
  const angle = useRef(new Animated.Value(-58)).current;
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduced(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  // Sin señal, la aguja descansa en el tope izquierdo, fuera de la escala.
  const target = cents === null ? -58 : Math.max(-50, Math.min(50, cents));
  useEffect(() => {
    if (reduced) {
      angle.setValue(target);
      return;
    }
    const spring = Animated.spring(angle, {
      toValue: target,
      friction: 7,
      tension: 60,
      useNativeDriver: Platform.OS !== 'web',
    });
    spring.start();
    return () => spring.stop();
  }, [target, reduced, angle]);
  const point = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const ticks = Array.from({ length: 21 }, (_, i) => -50 + i * 5);
  const zone = [point(-5, R + 2), point(5, R + 2)];
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Desviación en cents"
      accessibilityValue={{ min: -50, max: 50, now: cents === null ? 0 : Math.round(cents) }}
      style={{
        width: W,
        maxWidth: '100%',
        height: H,
        borderRadius: 12,
        backgroundColor: colors.sunken,
        borderWidth: 1,
        borderColor: colors.line,
        overflow: 'hidden',
      }}
    >
      <Svg width={W} height={H} accessibilityElementsHidden>
        <Path
          d={`M${zone[0]!.x} ${zone[0]!.y}A${R + 2} ${R + 2} 0 0 1 ${zone[1]!.x} ${zone[1]!.y}`}
          stroke={centered ? colors.success : colors.accentSoft}
          strokeWidth={10}
          fill="none"
        />
        {ticks.map((t) => {
          const major = t % 25 === 0;
          const a = point(t, R - 4),
            b = point(t, R - (major ? 20 : 11));
          return (
            <Line
              key={t}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={t === 0 ? colors.accent : colors.faint}
              strokeWidth={major ? 2 : 1}
            />
          );
        })}
        {[-50, -25, 0, 25, 50].map((t) => {
          const p = point(t, R - 34);
          return (
            <SvgText
              key={t}
              x={p.x}
              y={p.y + 4}
              fontSize={11}
              fontFamily={fonts.mono}
              fill={colors.muted}
              textAnchor="middle"
            >
              {t > 0 ? `+${t}` : t}
            </SvgText>
          );
        })}
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: cx - 1.5,
          top: cy - (R - 6),
          width: 3,
          height: (R - 6) * 2,
          transform: [
            {
              rotate: angle.interpolate({
                inputRange: [-60, 60],
                outputRange: ['-60deg', '60deg'],
              }),
            },
          ],
        }}
      >
        <View
          style={{
            height: R - 6,
            borderRadius: 2,
            backgroundColor:
              cents === null ? colors.faint : centered ? colors.success : colors.accent,
          }}
        />
      </Animated.View>
      <View
        style={{
          position: 'absolute',
          left: cx - 9,
          top: cy - 9,
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: colors.raised,
          borderWidth: 1,
          borderColor: colors.lineStrong,
        }}
      />
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
              backgroundColor: colors.raised,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 10,
              padding: 22,
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Text style={[styles.h2, { color: colors.accentText, fontSize: 30, lineHeight: 36 }]}>
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
