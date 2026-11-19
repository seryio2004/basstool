import type { exportScore as webExport } from './exportScore.web';

export function exportScore(..._args: Parameters<typeof webExport>) {
  throw new Error('La descarga de archivos está disponible en la web.');
}
