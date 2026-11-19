export function analyseHits(
  expected: { t: number; block: number }[],
  hits: number[],
  tolerance: number,
  beatSec: number,
): {
  matched: { e: number; h: number; err: number; delta: number }[];
  goodBlocks: Set<number>;
  badBlocks: Set<number>;
};
export class OnsetDetector {
  constructor(sampleRate: number);
  process(
    samples: Float32Array,
    time: number,
    sensitivity?: number,
  ): { hit: boolean; rms: number; threshold: number };
}
