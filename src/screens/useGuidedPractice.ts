import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  blockCredit,
  localDay,
  type PracticeBlock,
  type PracticeKind,
  type PracticeResult,
  type PracticeSession,
} from '../core/dailyPractice';
import type { Level } from '../core/profile';
import { uid } from '../core/types';
import { useStore } from '../data/Store';
import { audio } from '../platform/audio';

type Metrics = Pick<PracticeResult, 'bpm' | 'correct' | 'total' | 'rate'> & { title?: string };
type Run = {
  session: Omit<PracticeSession, 'blocks' | 'completed'>;
  blocks: PracticeBlock[];
  results: PracticeResult[];
  metrics: Metrics;
  elapsed: number;
  since: number | null;
  playing: boolean;
  checkpoint: number;
};

const now = () => performance.now();
const isVisible = () =>
  AppState.currentState !== 'background' &&
  AppState.currentState !== 'inactive' &&
  (Platform.OS !== 'web' || typeof document === 'undefined' || !document.hidden);
const secondsIn = (run: Run, target: number) =>
  Math.min(target, Math.floor((run.elapsed + (run.since === null ? 0 : now() - run.since)) / 1000));

function resultFor(run: Run, block: PracticeBlock, seconds: number): PracticeResult {
  return {
    ...run.metrics,
    id: `${run.session.id}/${run.results.length}`,
    title: run.metrics.title ?? block.title,
    seconds,
    module: block.kind === 'exercise' ? block.module : undefined,
  };
}

export function useGuidedPractice() {
  const { savePractice } = useStore();
  const active = useRef<Run | null>(null);
  const saving = useRef(false);
  const persist = useRef(savePractice);
  persist.current = savePractice;
  const visible = useRef(isVisible());
  const [run, setRun] = useState<Run | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState<string>();

  function clock(r: Run) {
    const block = r.blocks[r.results.length]!;
    const count = !saving.current && visible.current && (block.kind === 'scale' || r.playing);
    if (count && r.since === null) r.since = now();
    if (!count && r.since !== null) {
      r.elapsed += now() - r.since;
      r.since = null;
    }
  }

  function checkpoint(r: Run, force = false) {
    if (saving.current) return;
    const block = r.blocks[r.results.length]!;
    const seconds = secondsIn(r, block.seconds);
    if (!force && seconds - r.checkpoint < 30) return;
    if (!seconds && !r.metrics.total) return;
    r.checkpoint = seconds;
    const result = resultFor(r, block, seconds);
    void persist
      .current({
        ...r.session,
        completed: false,
        blocks: [...r.results, result],
      })
      .catch(() => {
        if (active.current?.session.id === r.session.id) r.checkpoint = Math.max(0, seconds - 25);
      });
  }

  useEffect(() => {
    const visibility = () => {
      visible.current = isVisible();
      if (active.current) {
        clock(active.current);
        if (!visible.current) checkpoint(active.current, true);
      }
    };
    const appState = AppState.addEventListener('change', visibility);
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', visibility);
    return () => {
      appState.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  useEffect(() => {
    if (!run) return;
    const timer = setInterval(() => {
      const current = active.current;
      if (current) {
        setSeconds(secondsIn(current, current.blocks[current.results.length]!.seconds));
        checkpoint(current);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [run]);

  function start(kind: PracticeKind, level: Level, blocks: PracticeBlock[], planDay?: number) {
    if (active.current) return;
    audio.stop();
    const started = new Date();
    const next: Run = {
      session: {
        id: uid(),
        kind,
        level,
        day: localDay(started),
        startedAt: started.toISOString(),
        planDay,
      },
      blocks,
      results: [],
      metrics: {},
      elapsed: 0,
      since: null,
      playing: false,
      checkpoint: 0,
    };
    active.current = next;
    clock(next);
    setSeconds(0);
    setError('');
    setFinished(undefined);
    setRun(next);
  }

  const key = run ? `${run.session.id}/${run.results.length}` : '';
  const block = run?.blocks[run.results.length];

  const activity = useCallback(
    (playing: boolean) => {
      const current = active.current;
      if (!current || key !== `${current.session.id}/${current.results.length}`) return;
      current.playing = playing;
      clock(current);
    },
    [key],
  );

  function report(metrics: Metrics, playing?: boolean) {
    const current = active.current;
    if (!current || saving.current || key !== `${current.session.id}/${current.results.length}`)
      return;
    const previous = current.metrics;
    current.metrics = {
      title: metrics.title ?? previous.title,
      correct:
        metrics.correct === undefined
          ? previous.correct
          : (previous.correct ?? 0) + metrics.correct,
      total: metrics.total === undefined ? previous.total : (previous.total ?? 0) + metrics.total,
      bpm: Math.max(previous.bpm ?? 0, metrics.bpm ?? 0) || undefined,
      rate: Math.max(previous.rate ?? 0, metrics.rate ?? 0) || undefined,
    };
    if (playing !== undefined) activity(playing);
    if (metrics.total || playing === false) checkpoint(current, true);
    setRun({ ...current });
  }

  async function advance(action: 'next' | 'skip' | 'exit') {
    const current = active.current;
    if (!current || saving.current) return false;
    const blockIndex = current.results.length;
    const currentBlock = current.blocks[blockIndex]!;
    const seconds = secondsIn(current, currentBlock.seconds);
    const result: PracticeResult = {
      ...resultFor(current, currentBlock, seconds),
      skipped: action !== 'next' || undefined,
    };
    const assessed = currentBlock.kind === 'exercise' && current.session.kind !== 'routine';
    if (action === 'next' && !blockCredit(result, currentBlock.seconds, assessed)) return false;
    const results = [...current.results, result];
    const end = action === 'exit' || results.length === current.blocks.length;
    const completed = end && action !== 'exit' && results.every((item) => !item.skipped);
    const hasPractice = results.some((item) => item.seconds > 0 || item.total);
    saving.current = true;
    clock(current);
    setBusy(true);
    setError('');
    try {
      if (hasPractice) await savePractice({ ...current.session, completed, blocks: results });
      audio.stop();
      if (end) {
        active.current = null;
        setRun(null);
        setFinished(hasPractice ? current.session.id : undefined);
      } else {
        const next: Run = {
          ...current,
          results,
          metrics: {},
          elapsed: 0,
          since: null,
          playing: false,
          checkpoint: 0,
        };
        active.current = next;
        setSeconds(0);
        setRun(next);
      }
      return true;
    } catch (e) {
      setError((e as Error).message || 'No se pudo guardar. Vuelve a intentarlo.');
      return false;
    } finally {
      saving.current = false;
      if (active.current) clock(active.current);
      setBusy(false);
    }
  }

  return {
    start,
    advance,
    report,
    activity,
    key,
    block,
    seconds,
    busy,
    error,
    finished,
    clearFinished: () => setFinished(undefined),
    canAdvance:
      !!block &&
      seconds >= block.seconds &&
      (block.kind !== 'exercise' || run!.session.kind === 'routine' || !!run!.metrics.total),
    needsResult:
      block?.kind === 'exercise' && run!.session.kind !== 'routine' && !run!.metrics.total,
    title:
      run?.session.kind === 'challenge'
        ? 'Reto del día'
        : run?.session.kind === 'plan'
          ? `Plan de 21 días · Día ${run.session.planDay}`
          : 'Rutina de hoy',
    index: run?.results.length ?? 0,
    count: run?.blocks.length ?? 0,
  };
}
