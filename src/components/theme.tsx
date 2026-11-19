import React, { createContext, useContext } from 'react';
import { StatusBar, TextStyle, ViewStyle, useColorScheme } from 'react-native';
import type { ThemePreference } from '../core/profile';
import {
  palettes,
  type ModuleTone,
  type Pair,
  type Palette,
  type ThemeName,
} from '../theme/palette';
import { grooveColors } from '../theme/groove';
import { fontFamilies } from '../platform/fonts';
import { applyDocumentTheme } from '../platform/bootstrap';

/**
 * Tokens vivos del tema. `colors` y `styles` son objetos estables cuyo contenido
 * se sustituye al cambiar de tema. Los componentes memoizados se suscriben
 * con `useTheme` para repintarse sin perder el estado de la pantalla.
 *
 * Alias heredados (`green`, `pale`, `white`): se mantienen para el código que
 * todavía no usa los nombres semánticos. `green` es el acento, `pale` la
 * selección suave y `white` la superficie de las placas (no el color blanco).
 */
type Colors = Palette & { green: string; pale: string; white: string };

const withAliases = (p: Palette): Colors => ({
  ...p,
  green: p.accent,
  pale: p.accentSoft,
  white: p.surface,
});

export const colors: Colors = withAliases(palettes.dark);

export const fonts = fontFamilies;

/** Escala de espaciado (pt). Grupos apretados, separación generosa. */
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { badge: 6, chip: 8, control: 10, panel: 14, pill: 999 } as const;

/** Cifras de ancho fijo para tiempo, BPM, cents y trastes. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

function makeStyles(c: Colors) {
  return {
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 } as ViewStyle,
    between: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    } as ViewStyle,
    /** Placa de ampli: superficie con filo de luz superior de 1 px, sin sombra. */
    panel: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.line,
      borderTopColor: c.sheen,
      borderRadius: radius.panel,
      padding: 24,
      gap: 20,
    } as ViewStyle,
    title: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 32,
      lineHeight: 38,
      fontWeight: '600',
      letterSpacing: -0.6,
    } as TextStyle,
    h2: {
      color: c.ink,
      fontFamily: fonts.display,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '600',
      letterSpacing: -0.3,
    } as TextStyle,
    h3: {
      color: c.ink,
      fontFamily: fonts.body,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '600',
    } as TextStyle,
    text: { color: c.ink, fontFamily: fonts.body, fontSize: 15, lineHeight: 23 } as TextStyle,
    muted: { color: c.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 } as TextStyle,
    /** Rótulo de sección pequeño: estilo de serigrafía de panel. */
    legend: {
      color: c.muted,
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    } as TextStyle,
    /** Datos medidos: tiempo, BPM, cents. */
    data: {
      color: c.ink,
      fontFamily: fonts.mono,
      fontVariant: ['tabular-nums'],
      fontWeight: '600',
    } as TextStyle,
    field: {
      color: c.ink,
      backgroundColor: c.sunken,
      borderColor: c.lineStrong,
      borderWidth: 1,
      borderRadius: radius.control,
      padding: 12,
      fontFamily: fonts.body,
      fontSize: 15,
      minHeight: 46,
    } as TextStyle,
    divider: { height: 1, backgroundColor: c.line } as ViewStyle,
  };
}

export const styles = makeStyles(colors);

let current: ThemeName = 'dark';

/** Sustituye los tokens vivos. Es idempotente. */
export function applyTheme(name: ThemeName) {
  current = name;
  const palette = palettes[name];
  Object.assign(colors, withAliases(palette));
  Object.assign(styles, makeStyles(colors));
  Object.assign(grooveColors, palette.groove);
  applyDocumentTheme(colors, name);
}

export function resolveTheme(preference: ThemePreference, system: string | null | undefined) {
  return preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
}

const ThemeContext = createContext<{ name: ThemeName; colors: Colors }>({
  name: 'dark',
  colors,
});

export function ThemeProvider({
  preference,
  children,
}: {
  preference: ThemePreference;
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  const name = resolveTheme(preference, system);
  // Se aplica durante el render para que los hijos lean ya los tokens nuevos.
  if (name !== current || colors.bg !== palettes[name].bg) applyTheme(name);
  return (
    <ThemeContext.Provider value={{ name, colors: { ...colors } }}>
      <StatusBar barStyle={name === 'dark' ? 'light-content' : 'dark-content'} />
      {children}
    </ThemeContext.Provider>
  );
}

/** Nombre del tema activo y tokens. Las pantallas que dependen del tema lo usan para volver a pintarse. */
export function useTheme() {
  return useContext(ThemeContext);
}

applyDocumentTheme(colors, 'dark');

/** Par de color del módulo de práctica (`chord-train` es ChordLine). */
export function moduleTone(id: string): Pair {
  const key = (id === 'chord-train' ? 'chord' : id) as ModuleTone;
  return colors.modules[key] ?? { ink: colors.accentText, bg: colors.accentSoft };
}
