import { Instrument, validateInstrument } from './instrument';
import { frequency, noteName, octave, validateTuningReference } from './music';

/** Closest open string by absolute cents; ties select the lowest string index. */
export function targetString(instrument: Instrument, hz: number, reference = 440) {
  validateInstrument(instrument);
  validateTuningReference(reference);
  if (!Number.isFinite(hz) || hz <= 0) throw new RangeError('La frecuencia debe ser positiva.');
  const exact = 69 + 12 * Math.log2(hz / reference);
  let string = 0;
  for (let i = 1; i < instrument.strings.length; i++) {
    if (
      Math.abs(exact - instrument.strings[i]!) <
      Math.abs(exact - instrument.strings[string]!) - 1e-10
    ) {
      string = i;
    }
  }
  const midi = instrument.strings[string]!;
  return {
    string,
    midi,
    name: noteName(midi),
    octave: octave(midi),
    targetHz: frequency(midi, reference),
    hz,
    cents: 100 * (exact - midi),
  };
}
