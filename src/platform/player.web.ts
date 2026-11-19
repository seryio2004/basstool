import { activeRms, createBassInstrument, type Instrument } from './bassInstrument.web';
import { analysisAudio, detectChord } from '../core/chroma';
import { scheduleTones, toneEndIndex, type Tone } from '../core/scoreAudio';
import type { BassAttack, MixMode } from './playerTypes';
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
  let analysis: ReturnType<typeof analysisAudio> | null = null;
  let tones: Tone[] = [];
  let ends: number[] = [];
  let mode: MixMode = 'song',
    balance = 0.5,
    volume = 1;
  let synth: GainNode | null = null;
  let instrument: Instrument | null = null;
  let scoreGain = 1;
  let attack: BassAttack = 'finger';
  let timer: ReturnType<typeof setInterval> | undefined;
  const voices = new Map<number, ReturnType<Instrument['play']>>();
  function silence() {
    for (const voice of voices.values()) voice.stop();
    voices.clear();
  }
  function mix() {
    if (mode !== 'song' && context && !synth) {
      synth = context.createGain();
      synth.connect(context.destination);
      instrument = createBassInstrument(context, synth);
    }
    if (gain) gain.gain.value = volume * (mode === 'score' ? 0 : mode === 'both' ? 1 - balance : 1);
    if (synth)
      synth.gain.value = scoreGain * volume * (mode === 'song' ? 0 : mode === 'both' ? balance : 1);
  }
  function schedule() {
    if (
      !audio ||
      audio.paused ||
      audio.ended ||
      audio.seeking ||
      audio.readyState < 3 ||
      !context ||
      context.state !== 'running' ||
      !instrument ||
      mode === 'song'
    )
      return;
    const from = audio.currentTime;
    for (const note of scheduleTones(
      tones,
      from,
      from + 0.12 * rate,
      rate,
      context.currentTime,
      loop?.b ?? duration,
      ends,
    )) {
      if (voices.has(note.id) || note.until <= note.when) continue;
      const voice = instrument.play({ ...note, attack }, () => {
        if (voices.get(note.id) === voice) voices.delete(note.id);
      });
      voices.set(note.id, voice);
    }
  }
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
    if (audio && loop && !audio.paused && audio.currentTime >= loop.b) {
      silence();
      audio.currentTime = loop.a;
    }
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
    clearInterval(timer);
    silence();
    instrument?.disconnect();
    instrument = null;
    synth?.disconnect();
    synth = null;
    analysis = null;
    tones = [];
    ends = [];
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
        let strongest = 0,
          channelIndex = 0;
        for (let c = 0; c < decoded.numberOfChannels; c++) {
          const samples = decoded.getChannelData(c);
          // peaksFrom normalizes per channel; restore channel amplitude before merging.
          let max = 0;
          for (const sample of samples) max = Math.max(max, Math.abs(sample));
          if (max > strongest) {
            strongest = max;
            channelIndex = c;
          }
          const channel = peaksFrom(samples, PEAKS);
          for (let b = 0; b < peaks.length; b++) peaks[b] = Math.max(peaks[b]!, channel[b]! * max);
        }
        const maximum = Math.max(...peaks);
        if (maximum) for (let b = 0; b < peaks.length; b++) peaks[b] = peaks[b]! / maximum;
        const samples = decoded.getChannelData(channelIndex);
        const reduced = analysisAudio(samples, decoded.sampleRate);
        const rms = activeRms(samples, decoded.sampleRate);
        decoded = null; // Only HTMLAudioElement retains the compressed file for playback.
        release();
        analysis = reduced;
        // Reference level of a sustained synth note after compression.
        scoreGain = rms ? Math.max(0.45, Math.min(1.8, rms / 0.15)) : 1;
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
        mix();
        applyBass();
        const changed = () => {
          checkLoop();
          emit();
        };
        const playing = () => {
          clearInterval(timer);
          timer = setInterval(schedule, 40);
          schedule();
          stopFrame();
          tick();
        };
        const paused = () => {
          clearInterval(timer);
          silence();
          stopFrame();
          emit();
        };
        const ended = () => {
          if (audio && loop) {
            silence();
            audio.currentTime = loop.a;
            void audio.play().catch(() => {
              emit();
            });
          } else paused();
        };
        const element = audio;
        element.addEventListener('timeupdate', changed);
        const seeked = () => {
          if (element.paused) changed();
          else playing();
        };
        element.addEventListener('seeked', seeked);
        element.addEventListener('play', playing);
        element.addEventListener('playing', playing);
        element.addEventListener('waiting', paused);
        element.addEventListener('pause', paused);
        element.addEventListener('ended', ended);
        detach = () => {
          element.removeEventListener('timeupdate', changed);
          element.removeEventListener('seeked', seeked);
          element.removeEventListener('play', playing);
          element.removeEventListener('playing', playing);
          element.removeEventListener('waiting', paused);
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
      if (loop && (element.currentTime < loop.a || element.currentTime >= loop.b))
        element.currentTime = loop.a;
      else if (element.ended || element.currentTime >= duration) element.currentTime = 0;
      // Start both during the same user activation. Each browser can gate audio separately.
      await Promise.all([context.resume(), element.play()]);
      if (element === audio) schedule();
    },
    pause() {
      audio?.pause();
      emit();
    },
    seek(value) {
      if (audio && Number.isFinite(value)) {
        silence();
        audio.currentTime = time(value);
        emit();
      }
    },
    setRate(value) {
      if (!Number.isFinite(value)) return;
      silence();
      rate = Math.round(Math.max(RATE_MIN, Math.min(RATE_MAX, value)) * 20) / 20;
      if (audio) {
        audio.preservesPitch = true;
        audio.playbackRate = rate;
      }
      emit();
    },
    setVolume(value) {
      if (Number.isFinite(value)) {
        volume = Math.max(0, Math.min(1, value));
        mix();
      }
    },
    suggestChord(start, end) {
      return analysis ? detectChord(analysis, start, end) : null;
    },
    setTones(value) {
      silence();
      tones = value;
      ends = toneEndIndex(value);
      schedule();
    },
    setAttack(value) {
      attack = value;
    },
    setMix(value, level) {
      if (mode !== value) silence();
      mode = value;
      balance = Math.max(0, Math.min(1, level));
      mix();
      schedule();
    },
    setLoop(value) {
      silence();
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
