/**
 * En web, las fuentes OFL de `assets/fonts` se registran con @font-face. Metro
 * empaqueta cada .ttf como recurso y devuelve su URL.
 */
const sources = {
  display: require('../../assets/fonts/Fraunces.ttf'),
  body: require('../../assets/fonts/IBMPlexSans.ttf'),
  monoRegular: require('../../assets/fonts/IBMPlexMono-Regular.ttf'),
  monoSemiBold: require('../../assets/fonts/IBMPlexMono-SemiBold.ttf'),
};

export const fontFamilies = {
  display: 'Fraunces, Georgia, "Times New Roman", serif',
  body: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',
};

const url = (source: unknown): string => {
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object') {
    const s = source as { uri?: string; default?: unknown };
    if (typeof s.uri === 'string') return s.uri;
    if (s.default !== undefined) return url(s.default);
  }
  return '';
};

export function loadFonts() {
  if (document.getElementById('clasro-fonts')) return;
  const face = (family: string, src: unknown, weight: string) =>
    `@font-face{font-family:${family};src:url("${url(src)}") format("truetype");font-weight:${weight};font-style:normal;font-display:swap}`;
  const style = document.createElement('style');
  style.id = 'clasro-fonts';
  style.textContent = [
    face('Fraunces', sources.display, '100 900'),
    face('"IBM Plex Sans"', sources.body, '100 700'),
    face('"IBM Plex Mono"', sources.monoRegular, '400'),
    face('"IBM Plex Mono"', sources.monoSemiBold, '600'),
  ].join('');
  document.head.appendChild(style);
}
