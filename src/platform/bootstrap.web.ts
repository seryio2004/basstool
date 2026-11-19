export function bootstrap() {
  document.title = 'clasRo · Tu espacio de práctica';
  document.documentElement.lang = 'es';
  if (document.getElementById('clasro-styles')) return;
  const style = document.createElement('style');
  style.id = 'clasro-styles';
  style.textContent = `html,body,#root{height:100%;background:#F8F9F6}body{margin:0}*{box-sizing:border-box}::selection{background:#CFE7D4;color:#173E2D}input,textarea{caret-color:#295E43}button,[role=button],a,input,textarea{outline-offset:4px}button:focus-visible,[role=button]:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #295E43}::-webkit-scrollbar{width:7px;height:7px}::-webkit-scrollbar-thumb{background:#C4CCC5;border-radius:8px}::-webkit-scrollbar-track{background:transparent}@media(prefers-reduced-motion:no-preference){[role=button]{transition:background-color .15s ease,opacity .15s ease}}`;
  document.head.appendChild(style);
}
