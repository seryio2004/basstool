import { frequency, minTunerHz, pitchFromSamples, tuning, tunerWindowSize } from '../core/music';
import { TunerError } from './tunerErrors';

let context: AudioContext | null = null;
const nodes = new Set<OscillatorNode>();
export const audio = {
  async ready() {
    if (!context) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor)
        throw new Error('Este navegador no admite audio. Prueba con un navegador actualizado.');
      context = new Ctor();
    }
    await context.resume();
  },
  now() {
    return context?.currentTime ?? 0;
  },
  tone(midi: number, when: number, duration = 0.35, volume = 0.16) {
    if (!context) return;
    remember(scheduleTone(context, context.destination, midi, when, duration, volume));
  },
  click(when: number, accent = false) {
    if (context) remember(scheduleClick(context, context.destination, when, accent));
  },
  stop() {
    for (const node of nodes) {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
    }
    nodes.clear();
  },
};
function remember(oscillator: OscillatorNode) {
  nodes.add(oscillator);
  oscillator.addEventListener('ended', () => nodes.delete(oscillator), { once: true });
}

function scheduleTone(
  ctx: AudioContext,
  output: AudioNode,
  midi: number,
  when: number,
  duration: number,
  volume: number,
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = Math.max(when, ctx.currentTime);
  oscillator.type = 'triangle';
  oscillator.frequency.value = frequency(midi);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(output);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
  return oscillator;
}

export function scheduleClick(ctx: AudioContext, output: AudioNode, when: number, accent: boolean) {
  return scheduleTone(ctx, output, accent ? 93 : 86, when, 0.045, accent ? 0.14 : 0.08);
}

export async function rhythmAudioContext(): Promise<AudioContext> {
  await audio.ready();
  return context!;
}

export type TuningValue = ReturnType<typeof tuning>;
export async function startTuner(
  onPitch: (value: TuningValue | null) => void,
  onError?: (error: TunerError) => void,
): Promise<() => void> {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
    throw new TunerError(
      'unsupported',
      'El afinador necesita HTTPS o localhost, Web Audio y acceso al micrófono. Prueba con un navegador actualizado.',
    );
  }
  let ctx: AudioContext | undefined;
  let stream: MediaStream | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    source?.disconnect();
    stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
  };
  try {
    ctx = new Ctor();
    // Resume in the activation gesture, before the asynchronous permission prompt.
    await ctx.resume();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    // 4096 covers >2 periods at 28 Hz at both 44.1 and 48 kHz.
    // Increase for higher device rates rather than silently losing the bass range.
    analyser.fftSize = Math.max(
      tunerWindowSize,
      2 ** Math.ceil(Math.log2((2 * ctx.sampleRate) / minTunerHz)),
    );
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const sampleRate = ctx.sampleRate;
    timer = setInterval(() => {
      if (stopped) return;
      analyser.getFloatTimeDomainData(samples);
      const hz = pitchFromSamples(samples, sampleRate);
      onPitch(hz ? tuning(hz) : null);
    }, 100);
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        stop();
        onPitch(null);
        onError?.(
          new TunerError(
            'unavailable',
            'Se ha desconectado el micrófono. Conéctalo y vuelve a activarlo.',
          ),
        );
      };
    });
    return stop;
  } catch (error) {
    stop();
    const name = (error as Error).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new TunerError(
        'permission-denied',
        'Permite el micrófono en los ajustes del navegador y vuelve a activarlo.',
      );
    }
    throw new TunerError(
      'unavailable',
      'No se pudo iniciar el micrófono. Comprueba que esté conectado y disponible y vuelve a intentarlo.',
    );
  }
}
