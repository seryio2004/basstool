import { palettes } from './palette';

/**
 * Colores del mundo de GrooveTrain. Objeto vivo: `applyTheme` sustituye sus
 * valores por los del tema activo (ver `palette.ts`, clave `groove`).
 * `ink` es el color de trazo y texto; `cream` es el resalte que contrasta con él.
 */
export const grooveColors: {
  ink: string;
  yellow: string;
  cream: string;
  paper: string;
  green: string;
  sleeper: string;
  coral: string;
  blue: string;
  mint: string;
  amber: string;
  gold: string;
  rose: string;
  tiles: readonly string[];
} = { ...palettes.dark.groove };
