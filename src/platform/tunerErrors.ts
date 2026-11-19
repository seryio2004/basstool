export type TunerErrorCode = 'permission-denied' | 'unsupported' | 'unavailable';

export class TunerError extends Error {
  constructor(
    public readonly code: TunerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TunerError';
  }
}
