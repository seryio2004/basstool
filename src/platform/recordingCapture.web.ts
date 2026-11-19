import type { PcmBlock } from '../core/recording';

const processor = `
class TakeCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 8192;
    this.first = Infinity;
    this.last = Infinity;
    this.blocks = [];
    this.used = 0;
    this.id = 0;
    this.meter = 0;
    this.peak = 0;
    this.port.onmessage = ({ data }) => {
      if (data.type === 'start') {
        this.id = data.id;
        this.first = data.frame;
        this.last = data.end;
      } else if (data.type === 'stop') {
        this.last = data.frame;
      } else {
        this.first = this.last = Infinity;
        this.used = 0;
      }
    };
  }

  flush() {
    if (!this.used) return;
    const channels = this.blocks.map(channel => channel.slice(0, this.used));
    this.port.postMessage({ type: 'samples', channels, id: this.id }, channels.map(channel => channel.buffer));
    this.used = 0;
  }

  process(inputs, outputs) {
    const channels = inputs[0];
    const frames = outputs[0][0].length;
    for (const channel of channels) {
      for (let i = 0; i < frames; i++) this.peak = Math.max(this.peak, Math.abs(channel[i]));
    }
    this.meter += frames;
    if (this.meter >= sampleRate / 15) {
      this.port.postMessage({ type: 'level', peak: this.peak });
      this.meter = 0;
      this.peak = 0;
    }

    const first = Math.max(0, this.first - currentFrame);
    const last = Math.min(frames, this.last - currentFrame);
    if (last > first) {
      if (!this.blocks.length) {
        this.blocks = Array.from({ length: Math.max(1, channels.length) },
          () => new Float32Array(this.size));
      }
      for (let i = first; i < last; i++) {
        for (let c = 0; c < this.blocks.length; c++) {
          this.blocks[c][this.used] = channels[c]?.[i] ?? 0;
        }
        if (++this.used === this.size) this.flush();
      }
    }
    if (currentFrame + frames >= this.last) {
      this.flush();
      this.first = this.last = Infinity;
      this.port.postMessage({ type: 'done', id: this.id });
    }
    return true;
  }
}
registerProcessor('clasro-take-capture', TakeCapture);
`;

type CaptureMessage =
  | { type: 'level'; peak: number }
  | { type: 'samples'; channels: Float32Array[]; id: number }
  | { type: 'done'; id: number };

export type CaptureJob = {
  samples: Promise<PcmBlock[]>;
  stop(at: number): void;
  cancel(): void;
};

export function createRecordingContext() {
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error('Este navegador no admite Web Audio.');
  return new Ctor();
}

export async function connectInput(
  context: AudioContext,
  stream: MediaStream,
  onLevel: (peak: number) => void,
  onFailure: (message: string) => void,
) {
  if (!context.audioWorklet)
    throw new Error('La grabación requiere HTTPS y un navegador compatible.');
  const url = URL.createObjectURL(new Blob([processor], { type: 'text/javascript' }));
  try {
    await context.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  if (context.state === 'closed') throw new Error('La entrada está cerrada.');
  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, 'clasro-take-capture');
  source.connect(node).connect(context.destination); // The processor outputs silence.
  let active: {
    id: number;
    blocks: PcmBlock[];
    resolve: (blocks: PcmBlock[]) => void;
    reject: (error: Error) => void;
  } | null = null;
  let sequence = 0;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const frame = (at: number) => Math.ceil(at * context.sampleRate);
  function fail(message: string) {
    clearTimeout(deadline);
    active?.reject(new Error(message));
    active = null;
  }
  function armDeadline(end: number) {
    clearTimeout(deadline);
    if (!Number.isFinite(end)) return;
    deadline = setTimeout(
      () => {
        node.port.postMessage({ type: 'cancel' });
        fail('Se interrumpió la captura de audio.');
      },
      Math.max(0, end - context.currentTime) * 1000 + 2500,
    );
  }
  node.port.onmessage = ({ data }: MessageEvent<CaptureMessage>) => {
    if (data.type === 'level') onLevel(data.peak);
    if (data.type === 'samples' && active?.id === data.id) active.blocks.push(data.channels);
    if (data.type === 'done' && active?.id === data.id) {
      clearTimeout(deadline);
      active.resolve(active.blocks);
      active = null;
    }
  };
  node.onprocessorerror = () => {
    const message = 'Falló la captura. Vuelve a activar la entrada.';
    fail(message);
    onFailure(message);
  };
  return {
    capture(start: number, end = Infinity): CaptureJob {
      if (active) throw new Error('Ya hay una captura activa.');
      const id = ++sequence;
      const samples = new Promise<PcmBlock[]>((resolve, reject) => {
        active = { id, blocks: [], resolve, reject };
      });
      node.port.postMessage({ type: 'start', id, frame: frame(start), end: frame(end) });
      armDeadline(end);
      return {
        samples,
        stop(at) {
          if (active?.id !== id) return;
          node.port.postMessage({ type: 'stop', frame: frame(at) });
          armDeadline(at);
        },
        cancel() {
          if (active?.id !== id) return;
          clearTimeout(deadline);
          node.port.postMessage({ type: 'cancel' });
          active?.resolve([]);
          active = null;
        },
      };
    },
    close() {
      fail('Se cerró la entrada de audio.');
      node.port.close();
      node.disconnect();
      source.disconnect();
    },
  };
}

const deviceKey = 'clasro.recorder.input.v1';
let lastDevice = '';
export function preferredInput() {
  try {
    return localStorage.getItem(deviceKey) ?? lastDevice;
  } catch {
    return lastDevice;
  }
}
export function rememberInput(id: string) {
  lastDevice = id;
  try {
    localStorage.setItem(deviceKey, id);
  } catch {
    // This is a local preference. Keep the selection during this session.
  }
}

export async function audioInputs() {
  return (
    (await navigator.mediaDevices?.enumerateDevices())?.filter(
      (device) => device.kind === 'audioinput' && device.deviceId,
    ) ?? []
  );
}

export async function openInput(id: string) {
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error('El micrófono requiere HTTPS y un navegador compatible.');
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(id ? { deviceId: { exact: id } } : {}),
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  } catch (error) {
    const name = (error as Error).name;
    if (name === 'NotAllowedError' || name === 'SecurityError')
      throw new Error('Permite el micrófono en los ajustes de este sitio y vuelve a intentarlo.');
    if (name === 'NotFoundError' || name === 'OverconstrainedError')
      throw new Error('La entrada no está disponible. Conéctala o elige otra.');
    throw new Error('No se pudo abrir la entrada. Comprueba que esté conectada y libre.');
  }
}
