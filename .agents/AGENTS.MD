# Guía del proyecto

## Propósito y documentación

Desarrollar una app para bajistas en iOS, Android y web con herramientas, transcripción, teoría aplicada al mástil y entrenamiento. La gestión de academias y profesores es un proyecto aparte (ver `REQUISITOS.md` §11).

- Consultar [REQUISITOS.md](../REQUISITOS.md) antes de planificar o implementar. Las rutas de este documento son relativas a `.agents/`.
- Este archivo resume el contexto y las reglas de trabajo. `REQUISITOS.md` contiene el detalle funcional, las prioridades, los criterios de aceptación y las cuestiones pendientes.
- Respetar las decisiones confirmadas. Mantener las propuestas y las cuestiones pendientes identificadas como tales; no convertirlas en decisiones implícitas.
- Si una cuestión pendiente afecta a cobros, privacidad del audio, licencias de contenido o elección de librerías nativas, resolverla antes de implementar ese comportamiento. Avanzar mientras tanto con el trabajo que no dependa de ella.
- Actualizar ambos documentos cuando se confirme un cambio y evitar contradicciones entre ellos.
- [docs/TAREAS.md](../docs/TAREAS.md) contiene las tareas en curso.

## Decisiones confirmadas

- Instrumento: bajo eléctrico. Modelar el instrumento como parámetro (cuerdas, afinación, trastes) para no bloquear otros instrumentos.
- Plataformas: iOS, Android y web desde una base Expo + React Native + TypeScript.
- Áreas: herramientas, transcripción, teoría y entrenamiento, con seguimiento del progreso.
- Modelo freemium con premium personal. Precio y cobertura pendientes.
- Supabase como backend inicial.
- Sin academias, profesores, clases ni matrículas en esta app.

## Áreas del producto

| Área | Núcleo P0 |
| --- | --- |
| Herramientas | Afinador para bajos de 4, 5 y 6 cuerdas (desde Si0), metrónomo, caja de ritmos y mástil interactivo. |
| Transcripción | Importar audio local, cambiar velocidad sin alterar el tono, transportar, bucle A–B, marcadores, realce de graves y guardado por canción. |
| Teoría | Lecciones aplicadas al mástil con ejemplo audible, diagrama, cuestionario autocorregido y práctica autoevaluada. |
| Entrenamiento | GrooveTrain, notas (mástil, clave de fa y oído), intervalos y lectura en clave de fa y en tablatura. |
| Progreso | Historial de intentos por módulo, separando intentos de aciertos. |

La asistencia de notas, la tablatura, el diario y los retos son P1. La separación de fuentes con IA es P2.

## Reglas de audio y privacidad

- Procesar micrófono y grabaciones en el dispositivo. No subir audio del usuario sin consentimiento explícito.
- No descargar audio de plataformas de streaming; trabajar solo con archivos aportados por el usuario.
- Presentar la detección de notas como sugerencia editable, nunca como transcripción exacta.
- No presentar la puntuación rítmica ni la autoevaluación como evaluación de la interpretación.
- Gestionar el permiso de micrófono, su denegación y su cierre sin bloquear el resto de la app.
- Validar latencia, tempo y rango de detección en dispositivos reales antes de dar una herramienta por terminada en una plataforma.

## Contenido

- El curso Armonía I sigue el libro de Enric Herrera. No publicarlo ni monetizarlo hasta resolver la licencia o reescribirlo de forma independiente. Consultar [docs/ARMONIA_I.md](../docs/ARMONIA_I.md) antes de modificarlo.
- Adaptar los ejemplos al registro y al mástil del bajo.
- Solo presentar como revisado el contenido que haya pasado la revisión musical.
- Las muestras de audio deben ser propias, sintetizadas o tener una licencia verificada.

## Stack y reglas de implementación

- Expo con development builds para los módulos nativos de audio. Elegir la librería de audio con una prueba de concepto en dispositivos.
- Aislar las APIs de plataforma en `src/platform/` (archivos `.web.ts` y nativos). Mantener la lógica musical en `src/core/`, sin DOM ni APIs nativas, y con pruebas.
- Usar pocas dependencias y justificar cada una.
- Que las herramientas y la transcripción funcionen sin cuenta y sin conexión. La cuenta sirve para sincronizar y para el premium.
- RLS en Supabase: cada usuario accede solo a sus datos. Secretos fuera del cliente y del repositorio.
- Usar compras integradas en iOS y Android para las suscripciones digitales, y Stripe en la web. Validar el estado premium en el servidor.
- Inspeccionar el proyecto antes de ejecutar o documentar comandos; no suponer que hay infraestructura configurada.
- No añadir conceptos docentes (roles, clases, matrículas, asignaciones, espacios). Mantener `src/core/` libre de ellos por si el proyecto de academias lo reutiliza.

## Interfaz

- Móvil primero, con controles grandes y usables con el instrumento colgado. Adaptar después a escritorio.
- Navegación: Herramientas · Transcribir · Aprender · Practicar · Progreso, y Ajustes aparte.
- Interfaz simple y concisa, sin eslóganes. Estados de carga, vacío, error y operación completada.
- Accesibilidad: etiquetas, foco visible en la web, contraste y tamaño de texto del sistema.
- Para diseño de interfaces, consultar la skill local [Impeccable](skills/impeccable/SKILL.md).

## Validación y entrega

- Usar los criterios de aceptación de `REQUISITOS.md` §16.
- Indicar en qué plataformas y dispositivos se ha validado cada función de audio.
- Afinador: núcleo validado desde 28 Hz con señales sintéticas a 44,1/48 kHz y flujo sintético en Chromium; precisión y latencia con micrófono real pendientes. La captura nativa depende de la tarea 6.
- Ejecutar las comprobaciones disponibles (`npm run typecheck`, `npm test`, `npm run build`) y revisar visualmente los cambios en tamaños de móvil y escritorio.
- Informar de lo verificado y de lo pendiente. No presentar una simulación o una exportación de bundle como una app probada en un dispositivo.
