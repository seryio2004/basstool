import { fontFamilies, loadFonts } from './fonts';

export function bootstrap() {
  loadFonts();
  if (document.getElementById('clasro-styles')) return;
  const style = document.createElement('style');
  style.id = 'clasro-styles';
  // Superficies del navegador (selección, cursor, foco, barras de desplazamiento)
  // con los tokens del tema, a través de variables que actualiza applyDocumentTheme.
  style.textContent = `html,body,#root{height:100%;background:var(--bg)}body{margin:0;color-scheme:var(--scheme)}*{box-sizing:border-box}html [dir=auto],html input,html textarea{font-family:${fontFamilies.body}}::selection{background:var(--selection);color:var(--ink)}input,textarea{caret-color:var(--accent)}input::placeholder,textarea::placeholder{color:var(--faint)}button,[role=button],[role=tab],a,input,textarea{outline-offset:3px}button:focus-visible,[role=button]:focus-visible,[role=tab]:focus-visible,[role=switch]:focus-visible,[role=slider]:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--focus)}*{scrollbar-color:var(--scroll) transparent;scrollbar-width:thin}::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:var(--scroll);border-radius:8px}::-webkit-scrollbar-track{background:transparent}@media(prefers-reduced-motion:no-preference){[role=button],[role=tab]{transition:background-color .15s ease-out,opacity .15s ease-out}}`;
  document.head.appendChild(style);
}

/** Pasa los tokens del tema a las superficies que pinta el navegador. */
export function applyDocumentTheme(
  c: {
    bg: string;
    ink: string;
    accent: string;
    focus: string;
    faint: string;
    lineStrong: string;
    accentSoft: string;
  },
  scheme: 'dark' | 'light',
) {
  const root = document.documentElement.style;
  root.setProperty('--bg', c.bg);
  root.setProperty('--ink', c.ink);
  root.setProperty('--accent', c.accent);
  root.setProperty('--focus', c.focus);
  root.setProperty('--faint', c.faint);
  root.setProperty('--scroll', c.lineStrong);
  root.setProperty('--selection', c.accentSoft);
  root.setProperty('--scheme', scheme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.bg);
}
