import { minTunerHz, tunerWindowSize } from '../core/music';
import { OnsetDetector } from '../core/rhythm';
import { rhythmAudioContext } from './audio.web';
import type { CapturedAttack, RhythmMic, RhythmMicOptions } from './rhythmMicTypes';

export const rhythmMicAvailable = true;
const loaded = new WeakMap<AudioContext, Promise<void>>();

function loadProcessor(context: AudioContext) {
  const existing = loaded.get(context);
  if (existing) return existing;
  // The same self-contained detector runs in the audio thread and in Node tests.
  const source = `
    const OnsetDetector = ${OnsetDetector.toString()};
    const pitchWindow = Math.max(${tunerWindowSize}, 2 ** Math.ceil(Math.log2(2 * sampleRate / ${minTunerHz})));
    class RhythmAttacks extends AudioWorkletProcessor {
      constructor() {
        super();
        this.detector = new OnsetDetector(sampleRate);
        this.sensitivity = 35;
        this.capturePitch = false;
        this.lastMeter = -Infinity;
        this.pending = null;
        this.port.onmessage = ({ data }) => {
          this.sensitivity = data.sensitivity;
          this.capturePitch = data.capturePitch;
          if (!this.capturePitch) this.pending = null;
        };
      }
      flush() {
        const { time, buffer, used } = this.pending;
        this.pending = null;
        const samples = buffer.subarray(0, used);
        this.port.postMessage({ time, sampleRate, samples }, [buffer.buffer]);
      }
      process(inputs) {
        const raw = inputs[0]?.[0];
        const filtered = inputs[1]?.[0];
        if (!raw?.length || !filtered?.length) return true;
        const { hit, rms, threshold } = this.detector.process(filtered, currentTime, this.sensitivity);
        if (currentTime - this.lastMeter >= 1 / 30) {
          this.port.postMessage({ rms, threshold });
          this.lastMeter = currentTime;
        }
        if (hit) {
          if (this.pending) this.flush();
          if (!this.capturePitch) this.port.postMessage({ time: currentTime, sampleRate });
          else this.pending = { time: currentTime, buffer: new Float32Array(pitchWindow), used: 0 };
        }
        const note = this.pending;
        if (note) {
          // Allow the initial pluck transient to decay before autocorrelation.
          const offset = Math.max(0, Math.ceil(sampleRate * (note.time + 0.008 - currentTime)));
          const count = Math.min(raw.length - offset, pitchWindow - note.used);
          if (count > 0) {
            note.buffer.set(raw.subarray(offset, offset + count), note.used);
            note.used += count;
          }
          if (note.used === pitchWindow) this.flush();
        }
        // Never copy microphone data into the output.
        return true;
      }
    }
    registerProcessor('clasro-rhythm-attacks', RhythmAttacks);
  `;
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const pending = context.audioWorklet
    .addModule(url)
    .catch((error) => {
      loaded.delete(context);
      throw error;
    })
    .finally(() => URL.revokeObjectURL(url));
  loaded.set(context, pending);
  return pending;
}

export async function openRhythmMic(options: RhythmMicOptions): Promise<RhythmMic> {
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error('El micrófono necesita HTTPS o localhost en un navegador compatible.');
  const context = await rhythmAudioContext();
  if (!context.audioWorklet || typeof AudioWorkletNode === 'undefined')
    throw new Error('Este navegador no admite el análisis rítmico por micrófono.');
  await loadProcessor(context);
  let stream: MediaStream | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let filter: BiquadFilterNode | undefined;
  let node: AudioWorkletNode | undefined;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (node) {
      node.port.onmessage = null;
      node.onprocessorerror = null;
      node.port.close();
      node.disconnect();
    }
    source?.disconnect();
    filter?.disconnect();
    stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
  };
  const disconnected = () => {
    if (stopped) return;
    stop();
    options.onDisconnect();
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false,
      },
    });
    source = context.createMediaStreamSource(stream);
    filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 40;
    node = new AudioWorkletNode(context, 'clasro-rhythm-attacks', {
      numberOfInputs: 2,
      outputChannelCount: [1],
    });
    source.connect(node, 0, 0);
    source.connect(filter);
    filter.connect(node, 0, 1);
    node.connect(context.destination);
    node.onprocessorerror = disconnected;
    node.port.onmessage = ({
      data,
    }: MessageEvent<CapturedAttack | { rms: number; threshold: number }>) => {
      if ('time' in data) options.onAttack(data);
      else options.onLevel(data.rms, data.threshold);
    };
    for (const track of stream.getTracks()) track.onended = disconnected;
    return {
      stop,
      configure: (sensitivity, capturePitch) =>
        node?.port.postMessage({ sensitivity, capturePitch }),
    };
  } catch (error) {
    stop();
    if (['NotAllowedError', 'SecurityError'].includes((error as Error).name))
      throw new Error(
        'Permite el micrófono en los ajustes del navegador o usa el botón y el teclado.',
      );
    throw error;
  }
}
