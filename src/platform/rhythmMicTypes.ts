export type CapturedAttack = { time: number; samples?: Float32Array; sampleRate: number };
export type RhythmMicOptions = {
  onAttack: (attack: CapturedAttack) => void;
  onLevel: (rms: number, threshold: number) => void;
  onDisconnect: () => void;
};
export type RhythmMic = {
  configure: (sensitivity: number, capturePitch: boolean) => void;
  stop: () => void;
};
