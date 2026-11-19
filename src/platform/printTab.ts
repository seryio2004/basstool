import type { printDocument } from '../core/tabPrint';
export function printTab(..._args: Parameters<typeof printDocument>) {
  throw new Error('La exportación PDF está disponible en la web.');
}
