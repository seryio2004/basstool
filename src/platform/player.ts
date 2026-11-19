import type { Player } from './playerTypes';

export function createPlayer(): Player {
  return {
    canTranspose: false,
    async pick() {
      throw new Error(
        'La transcripción en el móvil llegará con el nuevo motor de audio (tarea 6). De momento, úsala en la web.',
      );
    },
    async play() {},
    pause() {},
    seek() {},
    setRate() {},
    setLoop() {},
    setBass() {},
    setTranspose() {},
    onTime() {
      return () => {};
    },
    unload() {},
  };
}
