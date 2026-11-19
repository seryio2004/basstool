export type ReferenceNote = { midi: number; at: number; seconds: number };
export type ReferenceOptions = { referenceHz: number; loopSeconds?: number; onEnd: () => void };

export async function playReference(
  _notes: readonly ReferenceNote[],
  _options: ReferenceOptions,
): Promise<() => void> {
  throw new Error('Disponible en la versión web');
}
