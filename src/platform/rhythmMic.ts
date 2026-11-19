import type { RhythmMic, RhythmMicOptions } from './rhythmMicTypes';

export const rhythmMicAvailable = false;
export async function openRhythmMic(_options: RhythmMicOptions): Promise<RhythmMic> {
  throw new Error('La entrada rítmica por micrófono está disponible en web.');
}
