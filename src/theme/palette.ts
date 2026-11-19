/**
 * Paletas del sistema visual «vintage / analógico» (ampli de válvulas, madera,
 * cromo y crema). Módulo puro: sin React ni APIs de plataforma, para poder
 * comprobar el contraste en las pruebas. Los componentes leen estos valores a
 * través de `colors` en `src/components/theme.tsx`, nunca con hex sueltos.
 */

export type ThemeName = 'dark' | 'light';

/** Par tinta / fondo suave para módulos, funciones armónicas y avisos. */
export type Pair = { ink: string; bg: string };

export type ModuleTone = 'groove' | 'chord' | 'notes' | 'intervals' | 'reading' | 'listen-repeat';

export type Palette = {
  /** Fondo de la aplicación (nogal oscuro / papel crema). */
  bg: string;
  /** Placas: paneles, tarjetas, campos. */
  surface: string;
  /** Superficie elevada: menús, elementos activos sobre una placa. */
  raised: string;
  /** Hundido: pozos de la forma de onda, pistas de los deslizadores. */
  sunken: string;
  /** Lateral y barra inferior. */
  chrome: string;
  line: string;
  lineStrong: string;
  /** Borde superior de luz de 1 px de las placas. */
  sheen: string;
  ink: string;
  muted: string;
  /** Texto de ayuda y marcadores de posición (AA sobre `surface`). */
  faint: string;
  /** Ámbar válvula: acción principal, selección, cursor. */
  accent: string;
  /** Texto e iconos sobre `accent`. */
  onAccent: string;
  /** Ámbar como texto sobre `surface` y `bg`. */
  accentText: string;
  /** Fondo suave de selección y botones secundarios. */
  accentSoft: string;
  /** Anillo de foco. */
  focus: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  error: string;
  errorSoft: string;
  info: string;
  infoSoft: string;
  /** Pares de color de cada módulo de práctica. */
  modules: Record<ModuleTone, Pair>;
  /** Funciones armónicas (tónica, subdominante, dominante, dominante secundaria). */
  functions: Record<'T' | 'S' | 'D' | 'Dsec', Pair>;
  /**
   * Grados del 1 al 7 en el mástil. Rellenos medios con texto `onDegree`; el
   * número del grado va siempre escrito dentro, el color solo refuerza.
   */
  degrees: readonly [string, string, string, string, string, string, string];
  degreeFlat: string;
  degreeSharp: string;
  onDegree: string;
  /** Materiales del mástil y de los diagramas. */
  wood: string;
  fret: string;
  string: string;
  inlay: string;
  /** Líneas de pentagrama y teclas del piano de los diagramas. */
  staff: string;
  keyWhite: string;
  keyBlack: string;
  /** Teclas del contexto (notas de la escala sin resaltar). */
  keyContext: string;
  keyContextBlack: string;
  /** Pantalla de la forma de onda y su trazo. */
  wave: string;
  waveDim: string;
  wavePlayed: string;
  /** Mundo propio de GrooveTrain (ver `src/theme/groove.ts`). */
  groove: {
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
  };
};

const dark: Palette = {
  bg: '#25211E',
  surface: '#2B2521',
  raised: '#322B26',
  sunken: '#231F1C',
  chrome: '#27221E',
  line: '#40362F',
  lineStrong: '#594B3F',
  sheen: '#483D33',
  ink: '#D9CCB9',
  muted: '#AA9C8A',
  faint: '#A19482',
  accent: '#BF9B6E',
  onAccent: '#251C14',
  accentText: '#C4A57B',
  accentSoft: '#3C3227',
  focus: '#B9A58D',
  success: '#5FA58A',
  successSoft: '#1C2A23',
  warning: '#D4844A',
  warningSoft: '#33231A',
  error: '#E17A6C',
  errorSoft: '#3A1F1A',
  info: '#9BAEB8',
  infoSoft: '#1D2830',
  modules: {
    groove: { ink: '#C4A57B', bg: '#3C3227' },
    chord: { ink: '#5FA58A', bg: '#1C2A23' },
    notes: { ink: '#D4844A', bg: '#33231A' },
    intervals: { ink: '#B497C6', bg: '#2D2233' },
    reading: { ink: '#6FAAB9', bg: '#1B2A2E' },
    'listen-repeat': { ink: '#D2A6A2', bg: '#3A2727' },
  },
  functions: {
    T: { ink: '#5FA58A', bg: '#1C2A23' },
    S: { ink: '#8FB3C9', bg: '#1D2830' },
    D: { ink: '#D4844A', bg: '#33231A' },
    Dsec: { ink: '#B497C6', bg: '#2D2233' },
  },
  degrees: ['#BF9B6E', '#8FB3C9', '#6CC3A0', '#E9D66B', '#E07B5F', '#C19AD6', '#A9C46A'],
  degreeFlat: '#D6A6B6',
  degreeSharp: '#78C9CB',
  onDegree: '#1A120A',
  wood: '#2A1D14',
  fret: '#8C8273',
  string: '#B8AE9E',
  inlay: '#5C4A39',
  staff: '#6E5F4C',
  keyWhite: '#E9DCC4',
  keyBlack: '#231F1C',
  keyContext: '#D9B97A',
  keyContextBlack: '#6B4F25',
  wave: '#231F1C',
  waveDim: '#8A7B6D',
  wavePlayed: '#A99A86',
  groove: {
    ink: '#E1D5C3',
    yellow: '#2E2112',
    cream: '#17120E',
    paper: '#2C231B',
    green: '#2F5E4C',
    sleeper: '#4A3C2F',
    coral: '#C9783F',
    blue: '#8FB3C9',
    mint: '#5FA58A',
    amber: '#BF9B6E',
    gold: '#C6AB80',
    rose: '#9C7BB0',
    tiles: ['#5A3F1E', '#2F4A3F', '#5A3A2A', '#43344F', '#2C4750', '#4A3A22', '#3B4A2E', '#503040'],
  },
};

const light: Palette = {
  bg: '#EEE7DC',
  surface: '#F2ECE1',
  raised: '#F5EFE6',
  sunken: '#E9E0D3',
  chrome: '#ECE3D7',
  line: '#DACDBB',
  lineStrong: '#BAAB95',
  sheen: '#F8F2EA',
  ink: '#493D33',
  muted: '#6B5D4E',
  faint: '#71614F',
  accent: '#805B36',
  onAccent: '#F5EFE6',
  accentText: '#7D5937',
  accentSoft: '#EDE0CB',
  focus: '#806B55',
  success: '#2F6E57',
  successSoft: '#E2EFE8',
  warning: '#92501F',
  warningSoft: '#F6E5D6',
  error: '#B23A2B',
  errorSoft: '#F8E1DC',
  info: '#3C6880',
  infoSoft: '#E1ECF2',
  modules: {
    groove: { ink: '#7D5937', bg: '#EDE0CB' },
    chord: { ink: '#2F6E57', bg: '#E2EFE8' },
    notes: { ink: '#92501F', bg: '#F6E5D6' },
    intervals: { ink: '#7A5690', bg: '#EEE5F3' },
    reading: { ink: '#33707F', bg: '#E0EEF1' },
    'listen-repeat': { ink: '#86494D', bg: '#F3E2E1' },
  },
  functions: {
    T: { ink: '#2F6E57', bg: '#E2EFE8' },
    S: { ink: '#3C6880', bg: '#E1ECF2' },
    D: { ink: '#92501F', bg: '#F6E5D6' },
    Dsec: { ink: '#7A5690', bg: '#EEE5F3' },
  },
  degrees: ['#BF9B6E', '#8FB3C9', '#6CC3A0', '#E9D66B', '#E07B5F', '#C19AD6', '#A9C46A'],
  degreeFlat: '#D6A6B6',
  degreeSharp: '#78C9CB',
  onDegree: '#1A120A',
  wood: '#E9DCC6',
  fret: '#A89A85',
  string: '#6E5F4C',
  inlay: '#C9B79C',
  staff: '#9C8B72',
  keyWhite: '#F2ECE1',
  keyBlack: '#2A2119',
  keyContext: '#EDE0CB',
  keyContextBlack: '#8A6A3A',
  wave: '#E9E0D3',
  waveDim: '#897967',
  wavePlayed: '#685B4C',
  groove: {
    ink: '#493D33',
    yellow: '#F0C877',
    cream: '#F2ECE1',
    paper: '#EFE5D4',
    green: '#7FB89E',
    sleeper: '#C9A86A',
    coral: '#D98B5F',
    blue: '#3C6880',
    mint: '#BFE0D2',
    amber: '#F3D08A',
    gold: '#F4C46B',
    rose: '#C7A5D6',
    tiles: ['#E9B95E', '#9FCDB8', '#E5A989', '#C9B3DA', '#9FC6D1', '#EBCB8B', '#B9CF9A', '#DDA9B5'],
  },
};

export const palettes: Record<ThemeName, Palette> = { dark, light };

/** Relación de contraste WCAG 2.x entre dos colores hexadecimales de 6 cifras. */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

type Check = { use: string; fg: (p: Palette) => string; bg: (p: Palette) => string; min: number };
const text = 4.5,
  large = 3;

/** Pares que deben cumplir AA en ambos temas. DESIGN.md muestra esta misma tabla. */
export const contrastChecks: Check[] = [
  { use: 'Texto sobre fondo', fg: (p) => p.ink, bg: (p) => p.bg, min: text },
  { use: 'Texto sobre placa', fg: (p) => p.ink, bg: (p) => p.surface, min: text },
  { use: 'Texto sobre elevada', fg: (p) => p.ink, bg: (p) => p.raised, min: text },
  { use: 'Secundario sobre fondo', fg: (p) => p.muted, bg: (p) => p.bg, min: text },
  { use: 'Secundario sobre placa', fg: (p) => p.muted, bg: (p) => p.surface, min: text },
  { use: 'Secundario sobre elevada', fg: (p) => p.muted, bg: (p) => p.raised, min: text },
  { use: 'Marcador sobre pozo', fg: (p) => p.faint, bg: (p) => p.sunken, min: text },
  {
    use: 'Secundario sobre selección suave',
    fg: (p) => p.muted,
    bg: (p) => p.accentSoft,
    min: text,
  },
  { use: 'Secundario sobre cabecera', fg: (p) => p.muted, bg: (p) => p.chrome, min: text },
  { use: 'Marcas sobre onda', fg: (p) => p.muted, bg: (p) => p.wave, min: text },
  { use: 'Texto del tirador de compás', fg: (p) => p.ink, bg: (p) => p.raised, min: text },
  { use: 'Marcador sobre campo', fg: (p) => p.faint, bg: (p) => p.surface, min: text },
  { use: 'Texto sobre botón principal', fg: (p) => p.onAccent, bg: (p) => p.accent, min: text },
  { use: 'Ámbar como texto sobre placa', fg: (p) => p.accentText, bg: (p) => p.surface, min: text },
  { use: 'Ámbar como texto sobre fondo', fg: (p) => p.accentText, bg: (p) => p.bg, min: text },
  {
    use: 'Ámbar sobre selección suave',
    fg: (p) => p.accentText,
    bg: (p) => p.accentSoft,
    min: text,
  },
  { use: 'Texto sobre selección suave', fg: (p) => p.ink, bg: (p) => p.accentSoft, min: text },
  { use: 'Éxito sobre placa', fg: (p) => p.success, bg: (p) => p.surface, min: text },
  { use: 'Éxito sobre su fondo', fg: (p) => p.success, bg: (p) => p.successSoft, min: text },
  { use: 'Aviso sobre placa', fg: (p) => p.warning, bg: (p) => p.surface, min: text },
  { use: 'Aviso sobre su fondo', fg: (p) => p.warning, bg: (p) => p.warningSoft, min: text },
  { use: 'Error sobre placa', fg: (p) => p.error, bg: (p) => p.surface, min: text },
  { use: 'Error sobre su fondo', fg: (p) => p.error, bg: (p) => p.errorSoft, min: text },
  { use: 'Información sobre placa', fg: (p) => p.info, bg: (p) => p.surface, min: text },
  { use: 'Información sobre su fondo', fg: (p) => p.info, bg: (p) => p.infoSoft, min: text },
  ...(['groove', 'chord', 'notes', 'intervals', 'reading', 'listen-repeat'] as const).map((m) => ({
    use: `Módulo ${m}`,
    fg: (p: Palette) => p.modules[m].ink,
    bg: (p: Palette) => p.modules[m].bg,
    min: text,
  })),
  ...(['T', 'S', 'D', 'Dsec'] as const).map((f) => ({
    use: `Función ${f}`,
    fg: (p: Palette) => p.functions[f].ink,
    bg: (p: Palette) => p.functions[f].bg,
    min: text,
  })),
  ...[0, 1, 2, 3, 4, 5, 6].map((d) => ({
    use: `Grado ${d + 1}`,
    fg: (p: Palette) => p.onDegree,
    bg: (p: Palette) => p.degrees[d]!,
    min: text,
  })),
  { use: 'Grado bemol', fg: (p) => p.onDegree, bg: (p) => p.degreeFlat, min: text },
  { use: 'Grado sostenido', fg: (p) => p.onDegree, bg: (p) => p.degreeSharp, min: text },
  { use: 'Foco sobre placa (no texto)', fg: (p) => p.focus, bg: (p) => p.surface, min: large },
  {
    use: 'Borde de campo sobre placa (no texto)',
    fg: (p) => p.lineStrong,
    bg: (p) => p.bg,
    min: 1.5,
  },
  { use: 'Trazo de onda sobre pantalla', fg: (p) => p.waveDim, bg: (p) => p.wave, min: large },
  {
    use: 'Trazo reproducido sobre pantalla',
    fg: (p) => p.wavePlayed,
    bg: (p) => p.wave,
    min: large,
  },
  { use: 'Nombre sobre tecla blanca', fg: (p) => p.keyBlack, bg: (p) => p.keyWhite, min: text },
  {
    use: 'Nombre sobre tecla de contexto',
    fg: (p) => p.keyBlack,
    bg: (p) => p.keyContext,
    min: text,
  },
  { use: 'Cuerdas sobre madera', fg: (p) => p.string, bg: (p) => p.wood, min: large },
  {
    use: 'GrooveTrain: texto sobre escenario',
    fg: (p) => p.groove.ink,
    bg: (p) => p.groove.yellow,
    min: text,
  },
  {
    use: 'GrooveTrain: texto sobre resalte',
    fg: (p) => p.groove.ink,
    bg: (p) => p.groove.cream,
    min: text,
  },
  {
    use: 'GrooveTrain: texto sobre pulsado',
    fg: (p) => p.groove.ink,
    bg: (p) => p.groove.green,
    min: text,
  },
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((t) => ({
    use: `GrooveTrain: casilla ${t + 1}`,
    fg: (p: Palette) => p.groove.ink,
    bg: (p: Palette) => p.groove.tiles[t]!,
    min: text,
  })),
];
