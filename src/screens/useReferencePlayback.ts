import { useEffect, useRef, useState } from 'react';
import { playReference, type ReferenceNote } from '../platform/referenceAudio';

export function useReferencePlayback(referenceHz: number) {
  const request = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(
    () => () => {
      generation.current++;
      request.current?.();
    },
    [],
  );

  function stop() {
    generation.current++;
    request.current?.();
    request.current = null;
    setPlaying(null);
  }

  async function play(id: string, notes: ReferenceNote[], loopSeconds?: number) {
    stop();
    const token = generation.current;
    setError('');
    setPlaying(id);
    try {
      const cancel = await playReference(notes, {
        referenceHz,
        loopSeconds,
        onEnd() {
          if (generation.current === token) stop();
        },
      });
      if (generation.current === token) request.current = cancel;
      else cancel();
    } catch (failure) {
      if (generation.current !== token) return;
      setError((failure as Error).message);
      stop();
    }
  }

  return { playing, error, play, stop };
}
