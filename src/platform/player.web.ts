import { peaksFrom, RATE_MIN, RATE_MAX, MIN_LOOP } from '../core/transcription';
import type { BassMode, Loop, PickedAudio, Player } from './playerTypes';

/** Resolución de la envolvente: suficiente para zoom 32× en pantallas anchas. */
const PEAKS = 16000;
const ACCEPT = 'audio/mpeg,audio/mp4,audio/aac,audio/x-m4a,audio/wav,.mp3,.m4a,.aac,.wav';
export function createPlayer(): Player {
  let audio: HTMLAudioElement | null = null;
  let context: AudioContext | null = null;
  const decodingContexts = new Set<AudioContext>();
  let source: MediaElementAudioSourceNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let gain: GainNode | null = null;
  let url: string | null = null;
  let duration = 0;
  let loop: Loop | null = null;
  let rate = 1;
  let bass: BassMode = 'off';
  let frame: number | null = null;
  let generation = 0;
  let cancelPick: (() => void) | null = null;
  let detach: (() => void) | null = null;
  const listeners = new Set<(time: number, playing: boolean) => void>();
  const emit = () => {
    for (const listener of listeners)
      listener(audio?.currentTime ?? 0, !!audio && !audio.paused && !audio.ended);
  };
  const stopFrame = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };
  const checkLoop = () => {
    if (audio && loop && !audio.paused && audio.currentTime >= loop.b) audio.currentTime = loop.a;
  };
  const tick = () => {
    frame = null;
    checkLoop();
    emit();
    if (audio && !audio.paused && !audio.ended) frame = requestAnimationFrame(tick);
  };
  const applyBass = () => {
    if (!filter) return;
    filter.type = bass === 'solo' ? 'lowpass' : 'peaking';
    filter.frequency.value = bass === 'solo' ? 300 : 90;
    filter.Q.value = bass === 'solo' ? 0.9 : 0.8;
    filter.gain.value = bass === 'boost' ? 9 : 0;
  };
  const release = () => {
    stopFrame();
    detach?.();
    detach = null;
    audio?.pause();
    audio?.removeAttribute('src');
    audio?.load();
    audio = null;
    source?.disconnect();
    source = null;
    filter?.disconnect();
    filter = null;
    gain?.disconnect();
    gain = null;
    if (url) URL.revokeObjectURL(url);
    url = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
    context = null;
    duration = 0;
    loop = null;
  };
  const time = (v: number) => Math.max(0, Math.min(duration, v));
  return {
    canTranspose: false,
    async pick(): Promise<PickedAudio | null> {
      cancelPick?.();
      const token = ++generation;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = ACCEPT;
      const file = await new Promise<File | null>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const done = (file: File | null) => {
          cleanup();
          resolve(file);
        };
        const change = () => done(input.files?.[0] ?? null);
        const cancel = () => done(null);
        // Older browsers do not emit cancel. Focus returns before change on some engines.
        const focus = () => {
          timer = setTimeout(() => {
            if (!input.files?.length) done(null);
          }, 300);
        };
        const cleanup = () => {
          clearTimeout(timer);
          input.removeEventListener('change', change);
          input.removeEventListener('cancel', cancel);
          window.removeEventListener('focus', focus);
          input.remove();
          if (cancelPick === cancel) cancelPick = null;
        };
        cancelPick = cancel;
        input.addEventListener('change', change);
        input.addEventListener('cancel', cancel);
        window.addEventListener('focus', focus);
        try {
          input.click();
        } catch (error) {
          cleanup();
          reject(error);
        }
      });
      if (!file || token !== generation) return null;
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor)
        throw new Error('Este navegador no admite Web Audio. Usa un navegador actualizado.');
      let ctx: AudioContext | null = new Ctor();
      const decodingContext = ctx;
      decodingContexts.add(decodingContext);
      try {
        // File.arrayBuffer and blob URLs stay local; no fetch, upload or remote source.
        let decoded: AudioBuffer | null = await ctx.decodeAudioData(await file.arrayBuffer());
        if (token !== generation) return null;
        const length = decoded.duration;
        if (!Number.isFinite(length) || length <= 0)
          throw new Error('El archivo de audio está vacío.');
        // Preserve peaks from every channel, including stereo with opposite phases.
        const peaks = Array<number>(PEAKS).fill(0);
        for (let c = 0; c < decoded.numberOfChannels; c++) {
          const samples = decoded.getChannelData(c);
          // peaksFrom normalizes per channel; restore channel amplitude before merging.
          let max = 0;
          for (const sample of samples) max = Math.max(max, Math.abs(sample));
          const channel = peaksFrom(samples, PEAKS);
          for (let b = 0; b < peaks.length; b++) peaks[b] = Math.max(peaks[b]!, channel[b]! * max);
        }
        const maximum = Math.max(...peaks);
        if (maximum) for (let b = 0; b < peaks.length; b++) peaks[b] = peaks[b]! / maximum;
        decoded = null; // Only HTMLAudioElement retains the compressed file for playback.
        release();
        context = ctx;
        ctx = null;
        duration = length;
        rate = 1;
        bass = 'off';
        audio = new Audio();
        audio.preload = 'auto';
        audio.preservesPitch = true;
        audio.playbackRate = rate;
        url = URL.createObjectURL(file);
        audio.src = url;
        source = context.createMediaElementSource(audio);
        filter = context.createBiquadFilter();
        source.connect(filter);
        gain = context.createGain();
        filter.connect(gain);
        gain.connect(context.destination);
        applyBass();
        const changed = () => {
          checkLoop();
          emit();
        };
        const playing = () => {
          stopFrame();
          tick();
        };
        const paused = () => {
          stopFrame();
          emit();
        };
        const ended = () => {
          if (audio && loop) {
            audio.currentTime = loop.a;
            void audio.play().catch(() => {
              emit();
            });
          } else paused();
        };
        const element = audio;
        element.addEventListener('timeupdate', changed);
        element.addEventListener('seeked', changed);
        element.addEventListener('play', playing);
        element.addEventListener('pause', paused);
        element.addEventListener('ended', ended);
        detach = () => {
          element.removeEventListener('timeupdate', changed);
          element.removeEventListener('seeked', changed);
          element.removeEventListener('play', playing);
          element.removeEventListener('pause', paused);
          element.removeEventListener('ended', ended);
        };
        emit();
        return {
          id: JSON.stringify([file.name, file.size, length]),
          name: file.name,
          size: file.size,
          duration: length,
          peaks,
        };
      } catch {
        if (token !== generation) return null;
        if (token === generation && !ctx) {
          release();
          emit();
        }
        throw new Error(
          'No se pudo abrir el audio. Prueba con un archivo MP3, M4A/AAC o WAV válido.',
        );
      } finally {
        decodingContexts.delete(decodingContext);
        if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
      }
    },
    async play() {
      const element = audio;
      if (!element || !context) return;
      await context.resume();
      if (element !== audio) return;
      if (loop && (element.currentTime < loop.a || element.currentTime >= loop.b))
        element.currentTime = loop.a;
      else if (element.ended || element.currentTime >= duration) element.currentTime = 0;
      await element.play();
    },
    pause() {
      audio?.pause();
      emit();
    },
    seek(value) {
      if (audio && Number.isFinite(value)) {
        audio.currentTime = time(value);
        emit();
      }
    },
    setRate(value) {
      if (!Number.isFinite(value)) return;
      rate = Math.round(Math.max(RATE_MIN, Math.min(RATE_MAX, value)) * 20) / 20;
      if (audio) {
        audio.preservesPitch = true;
        audio.playbackRate = rate;
      }
      emit();
    },
    setVolume(value) {
      if (gain && Number.isFinite(value)) gain.gain.value = Math.max(0, Math.min(1, value));
    },
    setLoop(value) {
      if (value === null) loop = null;
      else if (Number.isFinite(value.a) && Number.isFinite(value.b)) {
        const a = time(value.a),
          b = time(value.b);
        if (b - a >= MIN_LOOP - 1e-9) loop = { a, b };
      }
      checkLoop();
      emit();
    },
    setBass(value) {
      if (['off', 'boost', 'solo'].includes(value)) {
        bass = value;
        applyBass();
        emit();
      }
    },
    setTranspose() {},
    onTime(listener) {
      listeners.add(listener);
      listener(audio?.currentTime ?? 0, !!audio && !audio.paused && !audio.ended);
      return () => {
        listeners.delete(listener);
      };
    },
    unload() {
      ++generation;
      cancelPick?.();
      for (const pending of decodingContexts) {
        if (pending.state !== 'closed') void pending.close().catch(() => {});
      }
      decodingContexts.clear();
      release();
      emit();
    },
  };
}
