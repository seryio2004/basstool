/**
 * Bajo Lab: prototipo de audio nativo (tarea 6 de docs/TAREAS.md).
 * Prueba react-native-audio-api en un dispositivo real:
 *   1. Metrónomo programado en el reloj de audio (precisión y retrasos).
 *   2. Afinador con micrófono en PCM y el detector real de src/core/music.ts.
 *   3. Reproductor: velocidad sin cambiar tono, transporte, bucle A–B y graves.
 * No es código de producción: no lo importes desde la app principal.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioContext,
  AudioManager,
  AudioRecorder,
  BiquadFilterNode,
} from 'react-native-audio-api';
import { pitchFromSamples, tuning } from '../../src/core/music';

type Tab = 'metronome' | 'tuner' | 'player';

let shared: AudioContext | null = null;
function ctx() {
  if (!shared) shared = new AudioContext();
  return shared;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('metronome');
  return (
    <SafeAreaView style={s.root}>
      <Text style={s.h1}>Bajo Lab</Text>
      <Text style={s.muted}>Prototipo de audio · no es la app final</Text>
      <View style={s.tabs}>
        {(
          [
            ['metronome', 'Metrónomo'],
            ['tuner', 'Afinador'],
            ['player', 'Reproductor'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === id }}
            onPress={() => setTab(id)}
            style={[s.tab, tab === id && s.tabOn]}
          >
            <Text style={[s.tabText, tab === id && s.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {tab === 'metronome' && <Metronome />}
        {tab === 'tuner' && <Tuner />}
        {tab === 'player' && <Player />}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- 1. Metrónomo ---------------- */

const LOOKAHEAD_S = 0.12; // cuánto adelantamos la programación
const TICK_MS = 25; // cada cuánto revisa el planificador en JS

function Metronome() {
  const [bpm, setBpm] = useState(100);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({ beats: 0, late: 0, worstMarginMs: Infinity, elapsed: 0 });
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  useEffect(() => {
    if (!running) return;
    const c = ctx();
    void AudioManager.setAudioSessionActivity(true);
    let next = c.currentTime + 0.1;
    let beat = 0;
    const startedAt = next;
    const st = { beats: 0, late: 0, worstMarginMs: Infinity, elapsed: 0 };
    const timer = setInterval(() => {
      while (next < c.currentTime + LOOKAHEAD_S) {
        // Margen = cuánto antes de sonar lo programamos. Negativo = llega tarde.
        const margin = (next - c.currentTime) * 1000;
        st.worstMarginMs = Math.min(st.worstMarginMs, margin);
        if (margin < 0) st.late++;
        click(c, next, beat % 4 === 0);
        st.beats++;
        beat++;
        next += 60 / bpmRef.current;
      }
      st.elapsed = c.currentTime - startedAt;
    }, TICK_MS);
    const ui = setInterval(() => setStats({ ...st }), 500);
    return () => {
      clearInterval(timer);
      clearInterval(ui);
    };
  }, [running]);

  return (
    <View style={s.card}>
      <Text style={s.h2}>Metrónomo en el reloj de audio</Text>
      <Text style={s.big}>{bpm} BPM</Text>
      <Row>
        {[-10, -1, 1, 10].map((d) => (
          <Btn key={d} label={d > 0 ? `+${d}` : `${d}`} onPress={() => setBpm((b) => clamp(b + d, 30, 300))} />
        ))}
      </Row>
      <Btn primary label={running ? 'Parar' : 'Empezar'} onPress={() => setRunning((r) => !r)} />
      <Btn label="Bloquear JS 300 ms (simula carga)" onPress={() => busy(300)} />
      <Metric k="Tiempo" v={`${stats.elapsed.toFixed(0)} s`} />
      <Metric k="Pulsos programados" v={`${stats.beats}`} />
      <Metric k="Pulsos programados tarde" v={`${stats.late}`} />
      <Metric
        k="Peor margen"
        v={Number.isFinite(stats.worstMarginMs) ? `${stats.worstMarginMs.toFixed(1)} ms` : '—'}
      />
      <Text style={s.muted}>
        Con el bloqueo de 300 ms es normal que aparezcan pulsos tarde: el margen es de 120 ms. Sin
        bloqueo, «tarde» debe quedarse en 0 durante 5 minutos. Para medir la deriva real, graba el
        móvil junto a un metrónomo de referencia y compara al final.
      </Text>
    </View>
  );
}

function click(c: AudioContext, when: number, accent: boolean) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.frequency.value = accent ? 1760 : 1320;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(accent ? 0.6 : 0.35, when + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(when);
  osc.stop(when + 0.05);
}

/* ---------------- 2. Afinador ---------------- */

const WINDOW = 8192; // ≥ 2 periodos de Si0 (30,87 Hz) a 48 kHz

function Tuner() {
  const [state, setState] = useState<'idle' | 'on' | 'denied' | 'error'>('idle');
  const [error, setError] = useState('');
  const [reading, setReading] = useState<ReturnType<typeof tuning> | null>(null);
  const [perf, setPerf] = useState({ rate: 0, analysisMs: 0, callbacks: 0 });
  const recorder = useRef<AudioRecorder | null>(null);

  async function start() {
    const permission = await AudioManager.requestRecordingPermissions();
    if (permission !== 'Granted') {
      setState('denied');
      return;
    }
    // measurement: sin procesado de voz (AGC/supresión), mejor para afinar.
    AudioManager.setSystemOptions({ ios: { category: 'playAndRecord', mode: 'measurement', options: ['defaultToSpeaker'] } });
    await AudioManager.setAudioSessionActivity(true);
    const rec = new AudioRecorder();
    const ring = new Float32Array(WINDOW);
    let filled = 0;
    let callbacks = 0;
    let lastAnalysis = 0;
    rec.onAudioReady({ sampleRate: 48000, bufferLength: 2048, channelCount: 1 }, ({ buffer }) => {
      callbacks++;
      const data = buffer.getChannelData(0);
      // Desplaza la ventana y añade el bloque nuevo al final.
      if (data.length >= WINDOW) ring.set(data.subarray(data.length - WINDOW));
      else {
        ring.copyWithin(0, data.length);
        ring.set(data, WINDOW - data.length);
      }
      filled = Math.min(WINDOW, filled + data.length);
      const now = Date.now();
      if (filled < WINDOW || now - lastAnalysis < 80) return;
      lastAnalysis = now;
      const t0 = performance.now();
      const hz = pitchFromSamples(ring, buffer.sampleRate);
      const ms = performance.now() - t0;
      setReading(hz ? tuning(hz) : null);
      setPerf({ rate: buffer.sampleRate, analysisMs: ms, callbacks });
    });
    rec.onError((e) => {
      setError(String((e as { message?: string }).message ?? e));
      setState('error');
    });
    const result = await rec.start();
    if (result.status === 'error') {
      setError(result.message);
      setState('error');
      return;
    }
    recorder.current = rec;
    setState('on');
  }

  async function stop() {
    const rec = recorder.current;
    recorder.current = null;
    if (rec) {
      rec.clearOnAudioReady();
      await rec.stop();
    }
    setState('idle');
    setReading(null);
  }

  useEffect(() => () => void stop(), []);

  return (
    <View style={s.card}>
      <Text style={s.h2}>Afinador con micrófono</Text>
      <Text style={s.big}>
        {reading ? `${reading.name}${reading.octave}` : state === 'on' ? '…' : '—'}
      </Text>
      <Text style={s.mid}>
        {reading ? `${reading.cents > 0 ? '+' : ''}${reading.cents} cents · ${reading.hz.toFixed(2)} Hz` : 'Sin señal'}
      </Text>
      {state === 'on' ? <Btn primary label="Parar" onPress={() => void stop()} /> : <Btn primary label="Activar micrófono" onPress={() => void start()} />}
      {state === 'denied' && <Text style={s.err}>Permiso denegado. Actívalo en Ajustes → Bajo Lab → Micrófono.</Text>}
      {state === 'error' && <Text style={s.err}>Error: {error}</Text>}
      <Metric k="Frecuencia de muestreo real" v={perf.rate ? `${perf.rate} Hz` : '—'} />
      <Metric k="Tiempo de análisis (JS)" v={perf.rate ? `${perf.analysisMs.toFixed(1)} ms` : '—'} />
      <Metric k="Bloques recibidos" v={`${perf.callbacks}`} />
      <Text style={s.muted}>
        Detector actual de la app: llega hasta ~35 Hz, así que Si0 (30,87 Hz) aún no se detecta; eso es
        la tarea 2. Prueba las cuerdas al aire Mi1 (41,2 Hz), La1, Re2 y Sol2, y anota si salta de octava.
        El análisis debería tardar bastante menos de 80 ms.
      </Text>
    </View>
  );
}

/* ---------------- 3. Reproductor de transcripción ---------------- */

function Player() {
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [name, setName] = useState('');
  const [info, setInfo] = useState('');
  const [rate, setRate] = useState(1);
  const [semis, setSemis] = useState(0);
  const [bass, setBass] = useState<'off' | 'boost' | 'solo'>('off');
  const [loop, setLoop] = useState<{ a: number; b: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);

  const source = useRef<AudioBufferSourceNode | null>(null);
  const filter = useRef<BiquadFilterNode | null>(null);
  // Posición = offset + (ahora - inicio) * velocidad
  const clock = useRef({ offset: 0, startedAt: 0, rate: 1 });

  const position = () => {
    if (!buffer) return 0;
    const c = ctx();
    const k = clock.current;
    let p = source.current ? k.offset + (c.currentTime - k.startedAt) * k.rate : k.offset;
    if (loop && source.current && p > loop.b) p = loop.a + ((p - loop.a) % (loop.b - loop.a));
    return Math.min(p, buffer.duration);
  };

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setPos(position()), 100);
    return () => clearInterval(t);
  });

  async function pick() {
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    stopSource();
    setInfo('Decodificando…');
    const t0 = performance.now();
    try {
      let decoded: AudioBuffer;
      try {
        decoded = await ctx().decodeAudioData(asset.uri);
      } catch {
        decoded = await ctx().decodeAudioData(asset.uri.replace('file://', ''));
      }
      const ms = performance.now() - t0;
      const mb = (decoded.length * decoded.numberOfChannels * 4) / 1e6;
      setBuffer(decoded);
      setName(asset.name);
      setLoop(null);
      clock.current = { offset: 0, startedAt: 0, rate };
      setPos(0);
      setInfo(
        `${decoded.duration.toFixed(1)} s · ${decoded.sampleRate} Hz · ${decoded.numberOfChannels} canales · ` +
          `decodificado en ${(ms / 1000).toFixed(2)} s · ~${mb.toFixed(0)} MB en memoria`,
      );
    } catch (e) {
      setInfo(`No se pudo decodificar: ${String(e)}`);
    }
  }

  function stopSource() {
    const src = source.current;
    if (src) {
      clock.current.offset = position();
      try {
        src.stop();
      } catch {
        /* ya parado */
      }
      src.disconnect();
    }
    source.current = null;
    setPlaying(false);
  }

  function play(from = position()) {
    if (!buffer) return;
    stopSource();
    const c = ctx();
    void AudioManager.setAudioSessionActivity(true);
    const src = c.createBufferSource({ pitchCorrection: true });
    src.buffer = buffer;
    src.playbackRate.value = rate;
    src.detune.value = semis * 100;
    if (loop) {
      src.loop = true;
      src.loopStart = loop.a;
      src.loopEnd = loop.b;
    }
    const f = c.createBiquadFilter();
    applyBass(f, bass);
    src.connect(f);
    f.connect(c.destination);
    const startAt = loop ? Math.max(loop.a, Math.min(from, loop.b - 0.05)) : from;
    src.start(c.currentTime + 0.02, startAt);
    clock.current = { offset: startAt, startedAt: c.currentTime + 0.02, rate };
    source.current = src;
    filter.current = f;
    setPlaying(true);
  }

  // Cambios en vivo: velocidad y tono se aplican sobre la fuente activa.
  useEffect(() => {
    const src = source.current;
    if (!src) return;
    clock.current = { offset: position(), startedAt: ctx().currentTime, rate };
    src.playbackRate.value = rate;
  }, [rate]);
  useEffect(() => {
    if (source.current) source.current.detune.value = semis * 100;
  }, [semis]);
  useEffect(() => {
    if (filter.current) applyBass(filter.current, bass);
  }, [bass]);

  const seek = (d: number) => {
    const p = clamp(position() + d, 0, buffer?.duration ?? 0);
    if (source.current) play(p);
    else {
      clock.current.offset = p;
      setPos(p);
    }
  };

  return (
    <View style={s.card}>
      <Text style={s.h2}>Reproductor para transcribir</Text>
      <Btn primary label="Elegir canción del iPhone" onPress={() => void pick()} />
      {name ? <Text style={s.mid}>{name}</Text> : null}
      {info ? <Text style={s.muted}>{info}</Text> : null}
      {buffer && (
        <>
          <Text style={s.big}>
            {fmt(pos)} / {fmt(buffer.duration)}
          </Text>
          <Row>
            <Btn label="−5 s" onPress={() => seek(-5)} />
            <Btn primary label={playing ? 'Pausa' : 'Play'} onPress={() => (playing ? stopSource() : play())} />
            <Btn label="+5 s" onPress={() => seek(5)} />
          </Row>
          <Text style={s.label}>Velocidad (sin cambiar el tono): {Math.round(rate * 100)} %</Text>
          <Row>
            {[0.5, 0.75, 1, 1.25].map((r) => (
              <Btn key={r} label={`${r * 100}%`} on={rate === r} onPress={() => setRate(r)} />
            ))}
          </Row>
          <Text style={s.label}>Transporte: {semis > 0 ? '+' : ''}{semis} semitonos</Text>
          <Row>
            <Btn label="−1" onPress={() => setSemis((v) => clamp(v - 1, -12, 12))} />
            <Btn label="0" onPress={() => setSemis(0)} />
            <Btn label="+1" onPress={() => setSemis((v) => clamp(v + 1, -12, 12))} />
          </Row>
          <Text style={s.label}>Graves</Text>
          <Row>
            <Btn label="Normal" on={bass === 'off'} onPress={() => setBass('off')} />
            <Btn label="Realzar" on={bass === 'boost'} onPress={() => setBass('boost')} />
            <Btn label="Solo graves" on={bass === 'solo'} onPress={() => setBass('solo')} />
          </Row>
          <Text style={s.label}>
            Bucle: {loop ? `${fmt(loop.a)} → ${fmt(loop.b)}` : 'sin bucle'}
          </Text>
          <Row>
            <Btn label="A aquí" onPress={() => setLoop({ a: position(), b: Math.min(position() + 4, buffer.duration) })} />
            <Btn label="B aquí" onPress={() => loop && position() > loop.a + 0.2 && setLoop({ ...loop, b: position() })} />
            <Btn label="Quitar" onPress={() => setLoop(null)} />
          </Row>
          {loop && <Btn label="Reproducir bucle" onPress={() => play(loop.a)} />}
        </>
      )}
      <Text style={s.muted}>
        Comprueba: al 50 % el tono no baja; ±1 semitono no cambia la velocidad; el bucle no da saltos
        audibles; «Solo graves» deja oír la línea de bajo. El audio no sale del teléfono.
      </Text>
    </View>
  );
}

function applyBass(f: BiquadFilterNode, mode: 'off' | 'boost' | 'solo') {
  if (mode === 'solo') {
    f.type = 'lowpass';
    f.frequency.value = 300;
    f.Q.value = 0.9;
  } else {
    f.type = 'peaking';
    f.frequency.value = 90;
    f.Q.value = 0.8;
    f.gain.value = mode === 'boost' ? 9 : 0;
  }
}

/* ---------------- utilidades ---------------- */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
function busy(ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* bloqueo intencionado */
  }
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={s.row}>{children}</View>;
}
function Btn({ label, onPress, primary, on }: { label: string; onPress: () => void; primary?: boolean; on?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.btn, primary && s.btnPrimary, on && s.btnOn, pressed && { opacity: 0.7 }]}
    >
      <Text style={[s.btnText, (primary || on) && s.btnTextPrimary]}>{label}</Text>
    </Pressable>
  );
}
function Metric({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.metric}>
      <Text style={s.muted}>{k}</Text>
      <Text style={s.metricV}>{v}</Text>
    </View>
  );
}

const green = '#295E43';
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9F6' },
  h1: { fontSize: 28, fontWeight: '700', color: '#202E26', paddingHorizontal: 20, paddingTop: 12 },
  h2: { fontSize: 19, fontWeight: '600', color: '#202E26' },
  big: { fontSize: 40, fontWeight: '700', color: '#202E26', fontVariant: ['tabular-nums'] },
  mid: { fontSize: 16, color: '#202E26' },
  label: { fontSize: 14, fontWeight: '600', color: '#202E26', marginTop: 6 },
  muted: { fontSize: 13, lineHeight: 19, color: '#657168', paddingHorizontal: 0 },
  err: { fontSize: 14, color: '#A33131' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#F0F3EC', alignItems: 'center' },
  tabOn: { backgroundColor: '#DDE8D5' },
  tabText: { fontSize: 14, color: '#5E6B59', fontWeight: '600' },
  tabTextOn: { color: '#2D5738' },
  body: { padding: 20, paddingTop: 0, gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, gap: 12, borderWidth: 1, borderColor: '#E2E7DF' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: { minHeight: 48, minWidth: 64, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#E8EFE7', alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: green },
  btnOn: { backgroundColor: green },
  btnText: { fontSize: 15, fontWeight: '600', color: green },
  btnTextPrimary: { color: '#fff' },
  metric: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E2E7DF', paddingTop: 8 },
  metricV: { fontSize: 14, fontWeight: '600', color: '#202E26', fontVariant: ['tabular-nums'] },
});
