/** Strings are ordered low to high. Frets exclude the open string (fret 0). */
export type Instrument = {
  readonly name: string;
  readonly strings: readonly number[];
  readonly frets: number;
};

export type Position = { string: number; fret: number };

/** Presets use 24 frets; callers can supply any valid fret count. */
export const tunings = {
  standard4: { name: '4 cuerdas estándar', strings: [28, 33, 38, 43], frets: 24 },
  standard5: { name: '5 cuerdas con Si0', strings: [23, 28, 33, 38, 43], frets: 24 },
  standard6: { name: '6 cuerdas con Do3', strings: [23, 28, 33, 38, 43, 48], frets: 24 },
  dropD: { name: 'Drop D', strings: [26, 33, 38, 43], frets: 24 },
  halfStepDown: { name: 'Medio tono abajo', strings: [27, 32, 37, 42], frets: 24 },
} as const satisfies Record<string, Instrument>;

export function validateInstrument(instrument: Instrument): void {
  if (!Number.isInteger(instrument.frets) || instrument.frets < 0) {
    throw new RangeError('El número de trastes debe ser un entero no negativo.');
  }
  if (
    !instrument.strings.length ||
    instrument.strings.some(
      (midi, index, strings) =>
        !Number.isInteger(midi) ||
        midi < 0 ||
        midi + instrument.frets > 127 ||
        (index > 0 && midi < strings[index - 1]!),
    )
  ) {
    throw new RangeError(
      'Las cuerdas deben estar ordenadas de grave a agudo dentro del rango MIDI.',
    );
  }
}

export function validateMidi(midi: number): void {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
    throw new RangeError('La nota debe ser un entero MIDI entre 0 y 127.');
  }
}

/** Zero-based string index, starting at the lowest string; fret 0 is open. */
export function noteAt(instrument: Instrument, string: number, fret: number): number {
  validateInstrument(instrument);
  if (!Number.isInteger(string) || string < 0 || string >= instrument.strings.length) {
    throw new RangeError('Cuerda fuera del instrumento.');
  }
  if (!Number.isInteger(fret) || fret < 0 || fret > instrument.frets) {
    throw new RangeError('Traste fuera del instrumento.');
  }
  return instrument.strings[string]! + fret;
}

/** Exact pitch, including octave; ordered by string index. */
export function positionsOf(instrument: Instrument, midi: number): Position[] {
  validateInstrument(instrument);
  validateMidi(midi);
  return instrument.strings.flatMap((open, string) => {
    const fret = midi - open;
    return fret >= 0 && fret <= instrument.frets ? [{ string, fret }] : [];
  });
}

export function range(instrument: Instrument): { min: number; max: number } {
  validateInstrument(instrument);
  return { min: instrument.strings[0]!, max: instrument.strings.at(-1)! + instrument.frets };
}
