# clasRo

App de estudio para bajistas en iOS, Android y web: herramientas, transcripción, teoría aplicada al mástil y entrenamiento. Expo + React Native + TypeScript comparten pantallas y lógica entre plataformas.

Alcance y decisiones: [REQUISITOS.md](REQUISITOS.md). Tareas en curso: [docs/TAREAS.md](docs/TAREAS.md).

## Ejecutar

Requiere Node.js 22.13 o posterior.

```bash
npm ci
npm run web        # http://localhost:8081
npm start          # Expo Go en el móvil: escanear el QR
```

Para generar la web estática: `npm run build`. El resultado queda en `dist/` y debe servirse por HTTP; no funciona abriendo `index.html` directamente.

## Qué hay hoy

La app funciona **sin cuenta**: la primera vez pide configurar el bajo (cuerdas y afinación, mano, nivel y nomenclatura) y guarda todo en el dispositivo.

| Sección | Contenido |
| --- | --- |
| Herramientas | Afinador (web; nativo pendiente de [la prueba de audio](docs/POC_AUDIO.md)), metrónomo, mástil interactivo con escalas y arpegios, y progresiones. |
| Transcribir | Reproductor en web: importar una canción propia, velocidad sin cambiar el tono, bucle A–B con ajuste fino, realce o solo graves, marcas y sesiones guardadas en el dispositivo. El audio no sale del navegador. Transporte de tono y versión móvil pendientes de la tarea 6. |
| Aprender | Curso de armonía (32 temas, ver [docs/ARMONIA_I.md](docs/ARMONIA_I.md)) y apuntes para bajo pendientes de revisión musical. |
| Practicar | GrooveTrain, notas, intervalos y lectura. La clave de fa y la tablatura son la tarea 5. |
| Progreso | Historial de intentos y progreso del curso. |
| Ajustes | Bajo, cuenta opcional y borrado de los datos del dispositivo. |

El afinador web procesa el micrófono localmente y necesita localhost o HTTPS.

## Cuentas (opcional)

Sin Supabase configurado, la app funciona completa en modo local. Para probar cuentas:

1. Crear un proyecto Supabase de pruebas.
2. Aplicar [la migración inicial](supabase/migrations/202611190001_initial.sql) en su editor SQL o mediante la CLI.
3. Copiar `.env.example` a `.env` y completar la URL y la clave pública `anon`. Nunca usar la clave `service_role` en la app.
4. En Supabase Auth, configurar la URL del sitio y las URL de redirección para confirmación y recuperación.
5. Reiniciar Expo. En Ajustes aparecerán el registro y el inicio de sesión.

Cada persona solo accede a su perfil, sus intentos y su progreso (RLS). Los intentos no se pueden modificar después de guardarse. La cuenta se puede eliminar desde Ajustes.

Mientras haya una sesión iniciada se usan los datos de la cuenta. Los datos guardados sin cuenta se quedan en el dispositivo; fusionarlos con la cuenta está pendiente.

La migración se ha verificado con PostgreSQL embebido (PGlite) y una frontera de Auth simulada, no contra un proyecto Supabase real.

## Estructura

```text
App.tsx                    Navegación: barra lateral en escritorio, pestañas en móvil
src/core/                  Lógica musical, instrumento, perfil y tipos (sin DOM ni APIs nativas)
src/content/               Curso de armonía y apuntes
src/screens/               Pantallas compartidas
src/components/            Componentes React Native y notación SVG
src/data/                  Almacenamiento local y Supabase
src/platform/*.web.ts      Web Audio, micrófono y teclado del navegador
src/platform/*.ts          Adaptadores nativos
supabase/migrations/       Esquema, RLS y triggers
spikes/audio/              Prototipo de audio nativo (app aparte, ver docs/POC_AUDIO.md)
tests/                     Pruebas de lógica musical y de la base de datos
```

## Comprobaciones

```bash
npm run typecheck
npm test
npm run build
```

## Móvil

Hoy la app usa solo módulos incluidos en Expo Go, así que se puede probar en el móvil con `npm start`. El audio nativo avanzado (afinador nativo, metrónomo preciso, transcripción) necesitará una development build; ver [docs/POC_AUDIO.md](docs/POC_AUDIO.md).

## Créditos

`src/core/rhythm.js` adapta la lógica de [seryio2004/grooveTrain](https://github.com/seryio2004/grooveTrain). Las muestras de `assets/audio/` se generan con ondas sinusoidales, sin audio de terceros.
