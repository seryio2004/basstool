import { useEffect, useRef, useState } from 'react';
import { takeAlignment } from '../core/recording';
import {
  calibrate,
  countIn,
  decodeLocalAudio,
  makeTake,
  playTake,
  scheduleBacking,
  type Backing,
  type Take,
} from '../platform/recordingAudio.web';
import {
  audioInputs,
  connectInput,
  createRecordingContext,
  openInput,
  preferredInput,
  rememberInput,
} from '../platform/recordingCapture.web';

type Phase =
  | { kind: 'idle' | 'preparing' | 'finishing' | 'calibrating' }
  | { kind: 'countdown'; remaining: number }
  | { kind: 'recording'; seconds: number }
  | { kind: 'playing'; id: string };

type Input = {
  context: AudioContext;
  capture: Awaited<ReturnType<typeof connectInput>>;
  close(): void;
};

export function useRecorder(
  onTake: (take: Take) => Promise<void>,
  onCalibration: (ms: number) => void,
) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [device, setDevice] = useState(preferredInput);
  const [inputState, setInputState] = useState<'off' | 'opening' | 'on'>('off');
  const [peak, setPeak] = useState(0);
  const [clipped, setClipped] = useState(false);
  const input = useRef<Input | null>(null);
  const closePending = useRef<(() => void) | null>(null);
  const operation = useRef<AbortController | null>(null);
  const stopCapture = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const clipUntil = useRef(0);

  useEffect(() => {
    let mounted = true;
    const media = navigator.mediaDevices;
    const refresh = () =>
      audioInputs()
        .then((list) => {
          if (mounted && list.length) setDevices(list);
        })
        .catch(() => {});
    void refresh();
    media?.addEventListener?.('devicechange', refresh);
    return () => {
      mounted = false;
      media?.removeEventListener?.('devicechange', refresh);
      generation.current++;
      operation.current?.abort();
      closePending.current?.();
      input.current?.close();
    };
  }, []);

  function stopOperation() {
    operation.current?.abort();
    operation.current = null;
    stopCapture.current = null;
    setPhase({ kind: 'idle' });
  }

  function closeInput() {
    generation.current++;
    closePending.current?.();
    closePending.current = null;
    input.current?.close();
    input.current = null;
    clipUntil.current = 0;
    setPeak(0);
    setClipped(false);
    setInputState('off');
  }

  async function enable(id: string) {
    closeInput();
    const token = generation.current;
    setError('');
    setNotice('');
    setInputState('opening');
    let context: AudioContext | undefined;
    let stream: MediaStream | undefined;
    let capture: Input['capture'] | undefined;
    function dispose() {
      capture?.close();
      capture = undefined;
      stream?.getTracks().forEach((track) => track.stop());
      if (context && context.state !== 'closed') void context.close().catch(() => {});
    }
    closePending.current = dispose;
    function failed(message: string) {
      if (token !== generation.current) return;
      stopOperation();
      closeInput();
      setError(message);
    }
    try {
      context = createRecordingContext();
      const resume = context.resume();
      // Request permission in the original activation and clean up even if resume fails first.
      const microphone = openInput(id).then((opened) => {
        if (token !== generation.current) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = opened;
      });
      await Promise.all([resume, microphone]);
      if (!stream || token !== generation.current) return;
      const track = stream.getAudioTracks()[0];
      if (!track || track.readyState === 'ended') throw new Error('La entrada no está disponible.');
      track.addEventListener('ended', () => failed('Se desconectó la entrada de audio.'), {
        once: true,
      });
      capture = await connectInput(
        context,
        stream,
        (level) => {
          if (token !== generation.current) return;
          const now = performance.now();
          if (level >= 0.995) clipUntil.current = now + 1000;
          setPeak(level);
          setClipped(now < clipUntil.current);
        },
        failed,
      );
      if (token !== generation.current) {
        dispose();
        return;
      }
      input.current = { context, capture, close: dispose };
      closePending.current = null;
      setInputState('on');
      const connected = await audioInputs().catch(() => []);
      if (token === generation.current && connected.length) setDevices(connected);
    } catch (failure) {
      if (token === generation.current) failed((failure as Error).message);
      else dispose();
    }
  }

  function chooseInput(id: string) {
    setDevice(id);
    rememberInput(id);
    if (input.current) void enable(id);
  }

  function begin() {
    if (operation.current) return null;
    const controller = new AbortController();
    operation.current = controller;
    setError('');
    setNotice('');
    return controller;
  }

  function finish(controller: AbortController, failure?: unknown) {
    if (controller.signal.aborted || operation.current !== controller) return;
    stopOperation();
    if (failure) setError((failure as Error).message || 'Se interrumpió el audio.');
  }

  async function record(backing: Backing, bpm: number, pulses: number, compensation: number) {
    const source = input.current;
    if (!source) return;
    const controller = begin();
    if (!controller) return;
    setPhase({ kind: 'preparing' });
    const { context, capture } = source;
    const bus = context.createGain();
    let stopCount = () => {};
    let stopBacking = () => {};
    let cancel = () => {};
    let clock: ReturnType<typeof setInterval> | undefined;
    const cleanup = () => {
      clearInterval(clock);
      stopCount();
      stopBacking();
      cancel();
      bus.disconnect();
    };
    controller.signal.addEventListener('abort', cleanup, { once: true });
    try {
      const [decoded] = await Promise.all([
        backing.kind === 'transcription' && backing.source.song
          ? decodeLocalAudio(context, backing.source.song)
          : undefined,
        context.resume(),
      ]);
      if (controller.signal.aborted) return;
      bus.connect(context.destination);
      const beat = 60 / bpm;
      const firstClick = context.currentTime + 0.18;
      const start =
        Math.ceil((firstClick + pulses * beat) * context.sampleRate) / context.sampleRate;
      const job = capture.capture(start);
      cancel = job.cancel;
      stopCount = countIn(context, firstClick, bpm, pulses);
      stopBacking = scheduleBacking(context, bus, backing, start, decoded);
      const update = () => {
        const remaining = start - context.currentTime;
        setPhase(
          remaining > 0
            ? { kind: 'countdown', remaining: Math.min(pulses, Math.ceil(remaining / beat)) }
            : { kind: 'recording', seconds: Math.floor(-remaining) },
        );
      };
      update();
      clock = setInterval(update, 60);
      stopCapture.current = () => {
        if (context.currentTime < start) {
          stopOperation();
          return;
        }
        clearInterval(clock);
        stopBacking();
        stopBacking = () => {};
        stopCapture.current = null;
        setPhase({ kind: 'finishing' });
        const tail = backing.kind === 'none' ? 0 : takeAlignment(compensation).skip;
        job.stop(context.currentTime + 0.04 + tail);
      };
      const blocks = await job.samples;
      if (controller.signal.aborted) return;
      const take = makeTake(blocks, context.sampleRate, backing, compensation);
      if (take) await onTake(take);
      finish(controller);
    } catch (failure) {
      finish(controller, failure);
    }
  }

  async function runCalibration() {
    const source = input.current;
    if (!source) return;
    const controller = begin();
    if (!controller) return;
    setPhase({ kind: 'calibrating' });
    try {
      await source.context.resume();
      if (controller.signal.aborted) return;
      const job = calibrate(source.context, source.capture);
      controller.signal.addEventListener('abort', job.cancel, { once: true });
      const result = await job.result();
      if (controller.signal.aborted) return;
      controller.signal.removeEventListener('abort', job.cancel);
      if (result === null) {
        throw new Error('No se distinguieron los clics. Acerca el micrófono al altavoz y repite.');
      }
      onCalibration(result);
      setNotice(`Se aplicaron ${result} ms de compensación.`);
      finish(controller);
    } catch (failure) {
      finish(controller, failure);
    }
  }

  async function listen(take: Take, withBacking: boolean) {
    const controller = begin();
    if (!controller) return;
    setPhase({ kind: 'playing', id: take.id });
    try {
      const context = createRecordingContext();
      controller.signal.addEventListener(
        'abort',
        () => {
          void context.close().catch(() => {});
        },
        { once: true },
      );
      await playTake(context, take, withBacking, controller.signal, () => finish(controller));
    } catch (failure) {
      finish(controller, failure);
    }
  }

  return {
    phase,
    error,
    notice,
    devices,
    device,
    inputState,
    peak,
    clipped,
    enable: () => void enable(device),
    chooseInput,
    closeInput,
    record,
    listen,
    runCalibration,
    stopOperation,
    stopTake: () => stopCapture.current?.(),
  };
}
