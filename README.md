# basstool (clasRo)

**Practica bajo cada día, saca líneas de tus canciones y ten a mano las herramientas que usas al tocar.**
App para bajistas en web, iOS y Android, hecha con Expo y React Native.

🎸 **Pruébala en el navegador:** https://seryio2004.github.io/basstool/

> Versión de prueba (beta). Funciona sin cuenta y guarda todo en tu dispositivo.

## Qué hace

| Sección | Para qué |
| --- | --- |
| **Hoy** | Práctica diaria: reto del día por nivel, racha, rutina a tu medida (5–30 min) con un bloque para tu canción, plan de 21 días, objetivo semanal y diario automático. |
| **Herramientas** | Afinador, metrónomo, mástil interactivo con escalas y arpegios coloreados por grado, y progresiones. |
| **Transcribir** | Importa una canción tuya: velocidad sin cambiar el tono, bucle arrastrando sobre la onda, realce de graves, y tablatura + partitura sincronizadas por compás con acordes, síntesis de lo escrito y exportación (PDF, TXT, MusicXML). |
| **Practicar** | GrooveTrain (ritmo), ChordLine (líneas sobre acordes), Escucha y repite (oído sobre batería), reconocimiento de notas, intervalos y lectura. |
| **Aprender** | Apuntes breves para consultar mientras tocas. El temario propio está en preparación con profesores. |
| **Progreso** | Historial de sesiones y tiempo de práctica. |

Funciona mejor en un navegador de escritorio o móvil reciente (Chrome, Edge, Firefox, Safari). El micrófono (afinador, ejercicios con evaluación) necesita HTTPS o `localhost` y tu permiso.

## Privacidad

- **Sin cuenta y sin servidor:** ajustes, progreso, transcripciones y notas se guardan solo en tu navegador o dispositivo.
- **Tu audio no sale del dispositivo:** las canciones que importas y el micrófono se procesan localmente; no se suben a ningún sitio.
- No hay analítica ni publicidad. Borrar los datos del sitio en el navegador (o «Borrar datos» en Ajustes) lo elimina todo.
- Las cuentas (Supabase) son opcionales y están desactivadas en la versión publicada.

## Ejecutar en local

Requiere Node.js 22.13 o posterior.

```bash
npm ci
npm run web        # http://localhost:8081
npm start          # Expo Go en el móvil: escanea el QR
```

Web estática: `npm run build` genera `dist/`, que debe servirse por HTTP (no funciona abriendo `index.html` directamente).

Comprobaciones:

```bash
npm run typecheck
npm test
npm run build
```

### Publicación

Cada push a `main` pasa las pruebas, compila la web y la publica en GitHub Pages ([workflow](.github/workflows/pages.yml)).

### Móvil

La app usa módulos incluidos en Expo Go, así que se puede abrir en el móvil con `npm start`. Afinador, transcripción y síntesis en nativo dependen del motor de audio nativo, todavía en prototipo ([docs/POC_AUDIO.md](docs/POC_AUDIO.md)).

### Cuentas (opcional, para desarrollo)

Sin Supabase configurado, todo funciona en modo local. Para probar cuentas:

1. Crea un proyecto Supabase de pruebas y aplica las migraciones de `supabase/migrations/` en orden.
2. Copia `.env.example` a `.env` con la URL y la clave pública `anon` (nunca la `service_role`).
3. Configura en Supabase Auth la URL del sitio y las de redirección, y reinicia Expo.

Cada persona solo accede a sus datos (RLS) y puede eliminar su cuenta desde Ajustes.

## Estructura

```text
App.tsx                    Navegación: barra lateral en escritorio, pestañas en móvil
src/core/                  Lógica musical, partitura, práctica diaria y tipos (sin DOM ni APIs nativas)
src/content/               Contenido: apuntes, práctica diaria
src/screens/               Pantallas
src/components/            Componentes, mástil y notación SVG
src/data/                  Almacenamiento local y Supabase
src/platform/*.web.ts      Web Audio, micrófono, exportación
src/platform/*.ts          Adaptadores nativos
supabase/migrations/       Esquema, RLS y triggers
tests/                     Pruebas
docs/                      Estado, tareas, coordinación y diseño
```

Requisitos y decisiones: [REQUISITOS.md](REQUISITOS.md) · Diseño: [DESIGN.md](DESIGN.md) · Estado actual: [docs/ESTADO.md](docs/ESTADO.md).

## Créditos

`src/core/rhythm.js` adapta la lógica de [seryio2004/grooveTrain](https://github.com/seryio2004/grooveTrain). Todos los sonidos se sintetizan o generan en la app; no se incluye audio de terceros. Los dibujos del bajo son originales y no reproducen ningún modelo comercial.
