import { Platform } from 'react-native';

/**
 * Familias tipográficas. En web se cargan Fraunces, IBM Plex Sans e IBM Plex Mono
 * desde `assets/fonts` (ver `fonts.web.ts`). En iOS y Android, mientras no se
 * apruebe `expo-font`, se usan fuentes del sistema con el mismo papel: una serif
 * para los títulos, la sans del sistema para la interfaz y una monoespaciada
 * solo para datos.
 */
export const fontFamilies = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined }),
  body: undefined as string | undefined,
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: undefined }),
};

/** Las fuentes del sistema no necesitan carga. */
export function loadFonts() {}
