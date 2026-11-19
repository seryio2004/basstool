# Estado del proyecto (traspaso entre sesiones)

Archivo de continuidad para Claude y Sol cuando se renueve el contexto. **Léelo al empezar** y actualízalo al terminar cada encargo (qué se hizo, qué falta, decisiones pendientes).

## Hecho (2026-11-19)
- App para bajistas (Expo/RN, iOS/Android/web). Academias fuera (proyecto aparte).
- Tareas 1–5 y 7–10 de docs/TAREAS.md hechas en web. Tarea 6 (audio nativo): prototipo en spikes/audio, falta medir en dispositivo y aprobar `react-native-audio-api`.
- Transcribir: reproductor (velocidad, bucle por arrastre, graves, volumen, zoom), partitura/tab sincronizadas por marcas de compás (M) y pulso (B), editor con figura persistente, mástil completo y piano, compases limitados a su métrica, acordes por compás, quintillos, síntesis de la transcripción, PDF por impresión en web.

## En curso
- Integrado 2026-11-19: reproducción de la transcripción, flujo de compases guiado, acordes deducidos de las notas escritas, **selector de BPM** que recoloca los compases (commit 5f65c10).
- **Entregado a Claude para revisión e integración** en `codex/notas-simultaneas`, con los cambios en el worktree sin commit. El modo «Acorde» (tecla C) apila una nota por cuerda en la figura del cursor. «Borrar cuerda» permite quitarla. Al leer una partitura antigua, `parseScore` convierte `note` en una lista de una posición. Las ligaduras parciales se guardan en `tieStrings`.
- La síntesis y el enlace con las marcas de audio conservan un inicio común y duraciones independientes para las cuerdas ligadas. Partitura, tab, impresión PDF y descargas web TXT y MusicXML incluyen todas las notas.
- Las sugerencias escritas y por croma reconocen los catorce tipos de acorde extendido del encargo, con inversiones y omisiones. Se probaron con señales sintéticas, incluidas combinaciones de cinco alturas. Queda por medir la precisión con grabaciones reales.
- Validación de la entrega: `npm run typecheck` y `npm run build` pasan. Se revisó la geometría a 350 y 1200 px. Pasan las siete pruebas nuevas. En `npm test` pasan 18 de 19 archivos. Claude debe repetir la suite fuera del sandbox: la prueba existente de coordinación recibe `spawnSync git EPERM` al intentar crear su repositorio temporal. La interacción en dispositivo físico sigue pendiente.

### ChordLine v2

- Entregado a Claude en `codex/tren-acordes-v2`, con cambios sin commit. «ChordLine» es el nombre elegido por el usuario y se define en `CHORD_TRAIN_TITLE`.
- Once progresiones seleccionables en tonalidades mayores y menores, incluidos los dos blues de 12 compases. El sorteo distingue tríadas, séptimas y extensiones. El mismo catálogo sirve al cifrado manual, el reconocimiento y los cuatro modos de evaluación. Los vagones indican la función con texto y color. El pulso activo cambia de inmediato con movimiento reducido.
- La migración `202611190004_chord_train_v2.sql` admite nuevos cifrados y sesiones de 48 pulsos junto con los intentos de 16 pulsos. Aplicarla en Supabase al desplegar.
- Typecheck, exportación web y pruebas nuevas pasan. `npm test` pasa en 20 de 21 archivos. Solo falla la prueba de coordinación por `spawnSync git EPERM`; pasan los 21 archivos al capturar los subprocesos de esa prueba en archivos temporales. Se comprobó el HTML de los tableros compacto y ancho. Quedan pendientes la revisión visual interactiva y el micrófono real. `main` avanzó con documentación y el sandbox impidió adelantar la rama local.

### ChordLine · dificultad y ritmo por vagón

- Entregado a Claude en `codex/chordline-ritmo`, con los cambios sin commit. Iniciación, Intermedio y Avanzado amplían los acordes, las progresiones y los ritmos permitidos. El tempo inicial es de 72, 92 y 112 BPM respectivamente. «Aleatoria» sortea uno de los tres niveles al abrir ChordLine o generar un ejercicio. Se parte del nivel del perfil y se recuerdan las elecciones en el dispositivo, por perfil.
- El selector «Ritmo» aplica un patrón fijo o varía por compás. Los doce patrones incluyen blancas y negras, rock, síncopas, anticipaciones, reggae, bossa, tumbao, semicorcheas, tresillos, funk y shuffle. Los vagones muestran sus figuras y la evaluación usa sus ataques. Con micrófono se comprueba la altura de las notas con tono y el tiempo de las notas muertas.
- La migración `202611190005_chord_line_rhythm.sql` valida el ritmo efectivamente tocado por vagón y admite los intentos anteriores. Aplicarla en Supabase antes de publicar la versión.
- Pasan `npm run typecheck`, `npm run build`, las once pruebas de ChordLine y el render estático web de ambas disposiciones del tren. `npm test` pasa en 20 de 21 archivos. La prueba de coordinación recibe `spawnSync git EPERM` y pasa al capturar sus subprocesos en archivos temporales. Quedan pendientes la revisión interactiva y la detección con bajo y micrófono reales.

## Definición del producto (2026-11-19)
- Decidido: función estrella = práctica diaria; lanzamiento web primero; temario propio en lugar del curso de Herrera.
- Práctica diaria: reto diario con racha + plan semanal + rutinas guiadas personalizables; adapta por nivel, tiempo y objetivos; racha y diario de práctica; foco en los primeros 21 días (REQUISITOS §9).
- Planes: premium desbloquea todo (mensual o anual); gratis = herramientas básicas + demo corta de Transcribir (REQUISITOS §10). Por decidir: límite exacto de la demo, precios, prueba gratuita.

- **Hecho e integrado: GrooveTrain original (paleta, tren, niveles, micrófono) + herramienta nueva de acordes por casilla.** Encargo: `.git/coord/encargos/groovetrain.md`.

- **Siguiente para Sol:** tarea 12 «Escucha y repite» (docs/TAREAS.md), tras GrooveTrain.

- ChordLine v2 y ritmos integrados. **Rediseño vintage integrado (tema oscuro/claro/sistema, Fraunces + IBM Plex en web; `expo-font` pendiente de aprobación para nativo; pendiente adaptar al tema HarmonicWagons y colores de módulo de src/core/types.ts): visual vintage/analógico, oscuro por defecto** — encargo `.git/coord/encargos/rediseno-vintage.md`.

## Pendiente de decisión del usuario
- `expo-print` para exportar PDF en móvil (propuesto, sin instalar).
- Aprobar la librería de audio de la tarea 6 tras medir en un dispositivo.

## Cómo seguir
- Coordinación: docs/COORDINACION.md (worktrees, buzón `npm run coord`, `scripts/sol.sh`). Claude coordina, revisa e integra; Sol implementa.
- Modelos: gpt-6.2-sol por defecto; gpt-6.2-astra para lo complejo; gpt-6-luna para lo sencillo.
