# Tareas: app para bajistas

Tareas para un agente de código. Hazlas de una en una y en el orden indicado salvo que se diga otra cosa.

## Reglas comunes (aplican a todas las tareas)

- Antes de empezar, lee `AGENTS.md`, `.agents/AGENTS.MD` y `REQUISITOS.md`.
- Stack confirmado: Expo + React Native + TypeScript con un único código para iOS, Android y web (react-native-web). Escribe componentes React Native y no componentes DOM. Usa `react-native-svg` para los gráficos.
- La lógica musical va en `src/core/`, sin React, sin DOM y sin APIs nativas, y con pruebas en `tests/`. Las APIs de plataforma van en `src/platform/*.ts` (nativo) y `src/platform/*.web.ts` (web), con la misma interfaz.
- No añadas dependencias sin justificarlas en el resumen final. Las dependencias nativas de audio solo entran a través de la tarea 6.
- Las academias son un proyecto aparte. No añadas conceptos docentes (roles, clases, matrículas, asignaciones).
- Al terminar, ejecuta `npm run typecheck`, `npm test` y `npm run build`, y añade la exportación nativa si la tarea toca código nativo. En el resumen indica:
  - qué has comprobado y en qué plataforma;
  - qué no has podido probar, sobre todo el audio en dispositivos reales;
  - las decisiones que hayas tomado y que deban validarse.
- No inventes decisiones que `REQUISITOS.md` marque como pendientes. Si una tarea depende de una, implementa lo que no dependa de ella y anótala.
- La interfaz es en español, simple y sin eslóganes, con etiquetas accesibles.

---

## Tarea 1: Modelo de instrumento y mástil en el núcleo

**Depende de:** nada. **Bloquea:** 2, 4 y 5.

**Objetivo:** representar el bajo como un instrumento configurable y calcular notas y posiciones en el mástil.

**Alcance**
- Nuevo módulo `src/core/instrument.ts`:
  - Tipo `Instrument` con cuerdas (MIDI al aire, ordenadas de grave a agudo), número de trastes y nombre.
  - Afinaciones predefinidas:
    - 4 cuerdas estándar: Mi1 La1 Re2 Sol2 (MIDI 28, 33, 38, 43).
    - 5 cuerdas con Si0 (MIDI 23).
    - 6 cuerdas con Do3 agudo (MIDI 48).
    - Drop D.
    - Medio tono abajo.
  - Funciones:
    - `noteAt(instrument, string, fret)`.
    - `positionsOf(instrument, midi)`, que devuelve todas las posiciones de una nota.
    - `range(instrument)`.
- Nuevo módulo `src/core/theory.ts` (o amplía `music.ts` si encaja mejor):
  - Escalas: mayor, menor natural, los siete modos, pentatónica mayor y menor, blues, menor armónica y menor melódica.
  - Arpegios: tríadas y cuatríadas habituales.
  - Función que, dada una tónica, una escala o arpegio, un instrumento y un rango de trastes, devuelva las posiciones con el grado de cada nota.
- Nomenclatura latina y anglosajona seleccionable. Reutiliza `notation.ts` y respeta la enarmonía según la tonalidad (no escribas La♯ en Fa mayor).

**Fuera de alcance:** interfaz gráfica.

**Aceptación**
- Pruebas que cubran las cinco afinaciones, posiciones de una nota repetida en varias cuerdas, escalas en tonalidades con sostenidos y con bemoles, y límites de trastes.
- Ningún import de React ni de `src/platform` en estos módulos.

**Estado:** implementada el 2026-11-19.

- API en `src/core/instrument.ts` (`tunings`, `noteAt`, `positionsOf`, `range`) y `src/core/theory.ts` (`scales`, `arpeggios`, `positionsFor`). La selección de nomenclatura amplía `pitchName` sin cambiar su comportamiento por defecto.
- Convenciones de implementación: índice de cuerda desde 0, de grave a agudo; traste 0 al aire; límites del rango de trastes incluidos. Los presets usan 24 trastes, configurables mediante `Instrument`.
- `positionsFor('F', scales.major, tunings.standard4, { min: 0, max: 12 }, 'latin')` devuelve posiciones con MIDI, escritura, nombre, grado, etiqueta del grado y marca de tónica. `'english'` selecciona nombres anglosajones.
- Menor melódica: forma ascendente/jazz; blues: menor con quinta disminuida de paso. Se conserva la escritura hasta alteraciones dobles, límite del modelo de `notation.ts`; las tonalidades que requieren alteraciones triples producen un error explícito.
- Validación: `npm run typecheck`, `npm test` (los seis archivos de pruebas pasan) y `npm run build` (exportación web). Núcleo sin React ni APIs de plataforma y sin dependencias nuevas. No se ha modificado código nativo ni audio; no se ha probado en dispositivos físicos.
- Pendiente de validación de producto: número de trastes por defecto de los presets. El modelo permite cambiarlo sin modificar la lógica.

---

## Tarea 2: Afinador para bajo (rango grave y cuerdas)

**Depende de:** 1.

**Contexto:** `pitchFromSamples` en [src/core/music.ts](../src/core/music.ts) limita el retardo máximo a `sampleRate / 35`, así que no detecta el Si0 (30,87 Hz). El afinador web está en `src/platform/audio.web.ts` y en `src/screens/Tools.tsx`. El nativo (`src/platform/audio.ts`) lanza un error; eso se resuelve en la tarea 6, no en esta.

**Alcance**
- Ampliar la detección hasta unos 28 Hz. Revisar que el tamaño de la ventana de análisis en web contenga al menos dos periodos de Si0, tanto a 44,1 kHz como a 48 kHz.
- Evitar errores de octava. Los bajos tienen una fundamental débil frente a sus armónicos, así que hay que probar con señales sintéticas en las que el segundo armónico sea más fuerte que la fundamental.
- `tuning()` debe aceptar una referencia de La4 configurable, entre 415 y 466 Hz.
- Nueva función que, dado un instrumento y una frecuencia, devuelva la cuerda objetivo más probable y la desviación en cents respecto a ella.
- Interfaz web del afinador:
  - Selector de afinación (de la tarea 1).
  - Cuerda objetivo, nota y desviación en cents.
  - Estados para «sin señal», «permiso denegado» y «navegador no compatible».

**Aceptación**
- Pruebas con señales sintéticas de todas las cuerdas al aire de las cinco afinaciones, a 44,1 kHz y a 48 kHz. Error menor de 3 cents en señales limpias y sin errores de octava en las señales con armónicos dominantes.
- Indicar en el resumen que la precisión con micrófono real sigue pendiente.

**Estado:** implementada el 2026-11-19; validación con micrófono real pendiente.

- Detector en `music.ts`: rango desde 28 Hz, eliminación de continua y comparación de máximos interpolados de autocorrelación en toda la ventana para evitar elegir el segundo armónico. Ventana web de 4096 muestras a 44,1/48 kHz, ampliada automáticamente para frecuencias de muestreo mayores.
- `tuning(hz, reference = 440)` y `targetString(instrument, hz, reference = 440)` admiten La4 entre 415 y 466 Hz. La cuerda se elige por distancia en cents a las cuerdas al aire, sin plegar octavas; el índice del núcleo empieza en la cuerda más grave (0). La interfaz usa la numeración habitual desde la más aguda (1).
- Selector de las cinco afinaciones, referencia editable, objetivo, nota detectada y cents respecto a la cuerda. Estados de permiso, ausencia de señal, incompatibilidad y desconexión. Se liberan las pistas, el temporizador y el contexto al detener, salir o fallar; una activación pendiente se puede cancelar.
- `tests/tuner.test.ts`: todas las cuerdas de las cinco afinaciones a 44,1/48 kHz, referencias 415/440/466, desviaciones de ±25 cents, error menor de 3 cents; armónicos con hasta 20 veces la amplitud de la fundamental y distintas fases, sin errores de octava. También cubre 28 Hz, silencio, continua y entradas inválidas.
- `tests/tuner-web.test.ts`: adaptador con APIs simuladas, denegación, fallo parcial, desconexión, cierre idempotente y ventanas a 44,1/48/96 kHz.
- Pasan `npm run typecheck`, `npm test` (nueve archivos en la comprobación final, incluidos los cambios simultáneos del proyecto), `npm run build` y `npx expo export --platform ios --platform android --output-dir /tmp/clasro-task2-native`. Las exportaciones nativas son bundles, no compilaciones instalables ni pruebas en dispositivos.
- Revisión en Chromium a 390 × 844 y 1440 × 1000, sin desbordamiento horizontal; foco visible y navegación por teclado. Estados de permiso denegado e incompatibilidad simulados; silencio y Si0 con segundo armónico dominante mediante un flujo sintético de Web Audio. Cambiar La4 a 432 Hz recalcula los cents; un valor fuera de rango muestra validación; detener deja la pista en estado `ended`. Capturas en `.impeccable/review/tarea-2-mobile.png` y `tarea-2-desktop.png` (estado desactivado, tras los cambios simultáneos de navegación).
- Sin dependencias nuevas ni elección de librería nativa. La captura nativa sigue pendiente de la tarea 6. Pendiente: precisión, latencia y estabilidad con bajo y micrófono reales, y comprobación en Safari/Firefox y dispositivos físicos.

---

## Tarea 3: Nueva navegación y estructura de pantallas

> **Hecha el 2026-11-19** (Claude Code). Se conserva la descripción como referencia; no hay que repetirla.

**Depende de:** nada. Puede hacerse en paralelo con la 1.

**Contexto:** la navegación está en [App.tsx](../App.tsx): Mi espacio, Practicar, Mis clases, Biblioteca y Mi progreso.

**Alcance**
- Sustituirla por **Herramientas · Transcribir · Aprender · Practicar · Progreso**:
  - En escritorio, barra lateral.
  - En móvil, barra inferior con iconos y texto.
- Herramientas: listado de afinador, metrónomo, mástil (marcador de posición hasta la tarea 4) y progresiones, reutilizando `Tools.tsx`.
- Transcribir: pantalla vacía con un estado «Importa una canción» (sin funcionalidad todavía).
- Aprender: el contenido de la Biblioteca y el curso Armonía I, sin cambiar su contenido.
- Practicar: los cuatro módulos actuales.
- Progreso: la pantalla actual.
- Quitar «Mis clases» y el inicio docente de la navegación. No borres todavía los archivos: se retiran en la tarea 9.
- Que el foco y el teclado sigan funcionando en web.

**Fuera de alcance:** cambiar Auth o la demo local (ver tarea 8).

**Aceptación**
- Las cinco secciones son navegables en web a 390 × 844 y a 1440 × 1000, sin desbordamiento horizontal.
- La exportación nativa compila.
- Capturas de pantalla de móvil y escritorio adjuntas al resumen o guardadas en `.impeccable/review/`.

---

## Tarea 4: Componente de mástil interactivo y herramienta «Mástil»

**Depende de:** 1 y 3.

**Alcance**
- Componente `src/components/Fretboard.tsx` con `react-native-svg`:
  - Cuerdas y trastes según el `Instrument`, con marcas de trastes 3, 5, 7, 9 y 12.
  - Puntos para las posiciones resaltadas, con etiqueta configurable (nombre de nota, grado o nada) y la tónica distinguida visualmente.
  - Desplazamiento horizontal en móvil.
  - Opción para zurdos (mástil invertido).
  - Pulsar una posición la reproduce con `audio.tone` y la anuncia con una etiqueta accesible.
- Pantalla «Mástil» dentro de Herramientas: elegir tónica, escala o arpegio, afinación, tipo de etiqueta y nomenclatura.

**Aceptación**
- Do mayor en un bajo de 4 cuerdas y La menor pentatónica en un bajo de 5 cuerdas se dibujan con las posiciones correctas (pruebas de la función de datos y revisión visual).
- Se usa en móvil sin zoom: zonas táctiles de al menos 44 × 44 pt.

---

## Tarea 5: Clave de fa, tablatura y ejercicios en el registro del bajo

**Depende de:** 1. Para la parte del mástil, también de 4.

**Contexto:** `Staff` en [src/components/ui.tsx](../src/components/ui.tsx) solo dibuja en clave de sol. `buildQuestion` en `music.ts` usa Do4–Do5 y un conjunto reducido de intervalos.

**Alcance**
- `Staff`:
  - Admite clave de fa.
  - Líneas adicionales por debajo y por encima.
  - Notación de bajo a la octava real escrita: el bajo suena una octava por debajo de lo escrito, y debe quedar documentado en el código.
- Nuevo componente `Tab` (tablatura) que comparta su modelo de notas con `Staff`.
- `buildQuestion` y los módulos de práctica:
  - Notas: registro del instrumento configurado, con preguntas en clave de fa, de oído y en el mástil («¿qué nota es la cuerda X, traste Y?»).
  - Intervalos: todos los intervalos de la 2.ª menor a la 8.ª justa, de oído y como forma en el mástil.
  - Lectura: clave de fa y tablatura.
- Los intentos guardan la configuración nueva (clave, instrumento, registro) y los intentos antiguos se siguen mostrando bien.

**Aceptación:** pruebas de generación de preguntas dentro del rango, de la posición correcta de las notas en clave de fa y de la compatibilidad con los intentos antiguos.

---

## Tarea 6: Prueba de concepto de audio nativo (investigación + prototipo)

**Depende de:** nada. Puede hacerse en paralelo. **Bloquea:** el afinador nativo, el metrónomo nativo preciso y la transcripción en móvil.

**Contexto:** el adaptador nativo (`src/platform/audio.ts`) programa los sonidos con `setTimeout` y `expo-audio`, lo que no es preciso para el metrónomo, y no tiene entrada de micrófono.

**Necesidades que deben cubrirse**
1. Programar sonidos con precisión de muestra (metrónomo y caja de ritmos).
2. Leer el micrófono como PCM en tiempo real para el afinador.
3. Reproducir un archivo local cambiando la velocidad sin alterar el tono y transportando sin alterar la velocidad.
4. Aplicar un filtro de graves en tiempo real.
5. Funcionar en web con la misma interfaz (Web Audio).

**Alcance**
- Comparar candidatos frente a esas cinco necesidades, comprobando la versión actual y la compatibilidad con Expo 58 y la nueva arquitectura. Como mínimo:
  - `expo-audio` como está;
  - `react-native-audio-api` (implementación de Web Audio para React Native);
  - cualquier otra opción relevante que encuentres.
- Documentar en `docs/POC_AUDIO.md`:
  - una tabla de capacidades;
  - el estado de mantenimiento;
  - la licencia;
  - el impacto en el tamaño de la app;
  - la necesidad de development builds;
  - una recomendación justificada.
- Prototipo en una rama o carpeta aislada (`spikes/audio/`) con la opción recomendada: metrónomo, lectura del micrófono que alimente `pitchFromSamples` y reproducción de un archivo al 50 %.
- Configuración de EAS para development builds (`eas.json`, plugins en `app.json`) sin publicar nada.

**Fuera de alcance:** sustituir el adaptador de producción. Eso se hará cuando el usuario apruebe la recomendación.

**Aceptación**
- Informe completo.
- El prototipo compila para Android e iOS (o se documenta el bloqueo concreto).
- Lista de pasos para que el usuario lo pruebe en su móvil y qué debe medir: latencia, deriva del metrónomo en 5 minutos y detección de Mi1 y Si0.

---

## Tarea 7: Reproductor de transcripción (web primero, núcleo compartido)

**Depende de:** 3. El adaptador nativo depende de la tarea 6.

**Alcance**
- Núcleo compartido en `src/core/transcription.ts`:
  - Modelo de sesión por canción: id, nombre del archivo, duración, posición, velocidad, transposición, bucle A–B, marcadores con nombre y realce de graves activado o no.
  - Operaciones puras: crear, mover y validar un bucle (A < B, dentro de la duración); añadir, renombrar y borrar marcadores; avanzar o retroceder por pasos.
  - Pruebas.
- Interfaz `src/platform/player.ts` / `player.web.ts`:
  - Métodos: `load`, `play`, `pause`, `seek`, `setRate`, `setLoop`, `setBassBoost`, `onTime`.
  - En web: `HTMLMediaElement` con `preservesPitch` para la velocidad y un `BiquadFilter` (`MediaElementAudioSourceNode`) para el realce de graves.
  - Transposición: si no hay una solución web sin dependencias, déjala desactivada con la nota «pendiente de la tarea 6».
  - Adaptador nativo: de momento lanza un error claro, como el afinador actual.
- Pantalla Transcribir:
  - Importar un archivo local (MP3, M4A, WAV).
  - Forma de onda navegable, calculada en el cliente y dibujada con `react-native-svg`.
  - Controles grandes de reproducción, velocidad (25–150 %), bucle A–B con ajuste fino, marcadores y realce de graves.
  - Persistencia local de la sesión por canción. El audio no se sube a ningún sitio y el archivo no se copia si no es necesario. Si el navegador obliga a volver a seleccionar el archivo, la sesión se recupera al volver a elegirlo.
- Atajos de teclado en web: espacio para reproducir, A/B para el bucle, flechas para avanzar o retroceder.

**Aceptación (en web)**
- Importar un archivo, ralentizarlo al 50 % sin que cambie el tono, repetir un bucle y recargar la página: la sesión se recupera.
- Pruebas del núcleo.
- Comprobación de que no hay peticiones de red con el audio.

---

## Tarea 8: Uso sin cuenta (sustituir la demo de perfiles)

> **Hecha el 2026-11-19** (Claude Code). Se conserva la descripción como referencia; no hay que repetirla.

**Depende de:** 3.

**Contexto:** hoy la app arranca con cuatro perfiles de demo docentes (`src/data/Store.tsx` y `seed.ts`).

**Alcance**
- Al abrir la app sin Supabase configurado, o sin sesión, el usuario entra directamente con un perfil local. Puede usar herramientas, transcripción, práctica y progreso, y sus datos se guardan en el dispositivo.
- Configuración inicial breve y modificable después: número de cuerdas y afinación, mano dominante, nivel y nomenclatura.
- Iniciar sesión pasa a ser opcional, desde un apartado de Ajustes.
- La sincronización y la fusión de los datos locales con la cuenta quedan pendientes: anótalo y no lo implementes.
- Quitar los perfiles de demo docentes de la interfaz. Su eliminación del código se hace en la tarea 9.

**Aceptación**
- Primer arranque en web y en la exportación nativa sin pantalla de acceso.
- Los ajustes del instrumento se usan en el afinador, el mástil y los ejercicios.
- Las pruebas existentes siguen pasando.

---

## Tarea 9: Retirar el código docente

> **Hecha el 2026-11-19** (Claude Code). Se conserva la descripción como referencia; no hay que repetirla.

**Depende de:** 3 y 8, y de que el usuario confirme que ya existe la copia para el proyecto de academias.

**Alcance**
- Antes de borrar nada, comprobar con el usuario que hay una copia del estado actual: un commit o etiqueta de git, o una copia del repositorio. El proyecto no es un repositorio git todavía; si sigue sin serlo, detente y pregunta.
- Retirar:
  - `src/screens/Classes.tsx` y el inicio docente de `Home.tsx`.
  - Los tipos y permisos de academia, profesor, clase, matrícula, tarea y asignación en `src/core/types.ts`.
  - Los perfiles y datos docentes de `src/data/seed.ts` y `Store.tsx`.
  - Las partes docentes de `src/data/remote.ts`.
- Supabase: crear una nueva migración que reemplace el esquema por uno de usuario individual (perfil, ajustes del instrumento, intentos, progreso del curso, sesiones de transcripción), con RLS «cada usuario solo accede a sus filas». No edites las migraciones ya existentes. Si no se ha desplegado ninguna base de datos real, propón al usuario sustituir las migraciones por una inicial nueva, y espera su confirmación.
- Reescribir `tests/database.test.ts` para el nuevo esquema: un usuario no puede leer ni modificar los datos de otro.
- Actualizar `README.md` para que no describa funciones docentes.

**Aceptación**
- No queda ninguna referencia a academia, profesor, clase, matrícula o asignación en `src/`, `tests/` ni en la migración vigente.
- `npm run typecheck`, `npm test` y `npm run build` pasan.
- Los intentos y el progreso del curso siguen funcionando.

---

## Tarea 10: Anotación en tablatura y partitura sincronizada con el audio

**Depende de:** 7 (hecha). Ver `REQUISITOS.md` §6, «Anotación en tablatura y partitura».

Se divide en tres partes. Las firmas exactas de 10a y 10b las fija Claude en `src/core/scoreTypes.ts` antes de empezar, como se hizo con `playerTypes.ts` en la tarea 7.

**10a — Modelo y mapa de tiempo (Sol 6.1)**
- `src/core/score.ts`, código puro:
  - Partitura de bajo: compases con métrica, notas con cuerda, traste, figura, puntillo, tresillo y ligadura, silencios y técnicas (ligado ascendente y descendente, slide, nota muerta, staccato).
  - Duraciones en fracciones exactas, nunca en coma flotante.
  - Validación de la suma de cada compás.
  - Operaciones inmutables: insertar, borrar, cambiar figura, mover el cursor y transportar a otra afinación. Historial para deshacer y rehacer.
- Mapa de tiempo: tempo e inicio del primer compás, con conversión entre segundo del audio y compás/pulso, en los dos sentidos, y tap tempo.
- Persistencia de la partitura junto a la sesión de transcripción.
- Pruebas.

**10b — Maquetación (Sol 6.1)**
- `src/core/scoreLayout.ts`, sin React: a partir de la partitura y un ancho disponible, calcula la geometría de la tablatura y la partitura (clave de fa, armadura y métrica):
  - posición de cada nota;
  - plicas, corchetes y barras;
  - silencios, puntillos, alteraciones y ligaduras;
  - saltos de línea por compases.
- Pruebas con casos de referencia.

**10c — Editor y vistas (Claude)**
- Componente que dibuja esa geometría en SVG, con la tablatura y la partitura alineadas y el cursor de reproducción.
- Editor dentro de Transcribir:
  - Paleta de figuras y técnicas.
  - Entrada por teclado (números para el traste, flechas para cuerda y posición).
  - Entrada tocando el mástil de la tarea 4.
  - Tap tempo y ajuste del primer compás.
  - Al tocar un compás, salta a ese punto del audio y crea el bucle de ese compás.
- Diseño en móvil y escritorio.

**Fuera de alcance:** sugerencia automática de notas, exportación y reproducción sintetizada de lo anotado (P1).

---

## Tarea 11: Separación del bajo con IA (P2, empezar por prueba de concepto)

**Por qué:** competidores como Moises separan pistas con IA; para transcribir, oír el bajo aislado (o quitarlo para tocar encima) es un gran valor premium.

**Viabilidad (2026-11-19):** realizable con modelos abiertos con licencia MIT (Demucs/HTDemucs de Meta, Open-Unmix). Riesgos: tamaño del modelo (decenas de MB), tiempo de proceso en CPU (minutos por canción) y memoria en móvil.

**11a — Prueba de concepto (Sol/Astra):**
- Comparar Demucs, HTDemucs y Open-Unmix (stem de bajo) en calidad, tamaño, tiempo y licencia de código **y de pesos**.
- Prototipo web aislado (`spikes/separation/`) que separe el bajo **en el dispositivo** (ONNX Runtime Web con WebGPU o WASM) y mida tiempo y memoria con una canción de 3–4 min.
- Informe en `docs/POC_SEPARACION.md` con una recomendación.

**11b — Integración (tras aprobar la PoC):**
- En Transcribir: «Solo bajo», «Sin bajo» y «Mezcla original», con los mismos controles de velocidad, bucle y volumen.
- El resultado se guarda en el dispositivo; la descarga del modelo se pide con permiso y una vez.

**Decisiones previas:**
- En el dispositivo (privacidad, sin coste de servidor) frente a un servidor (más rápido, pero el audio saldría del dispositivo y exige consentimiento explícito; ver §6).
- Premium (propuesta). Añadir ONNX Runtime es una dependencia nueva: se aprueba antes.

---

## Tarea 12: «Escucha y repite» (ejercicio propuesto por el profesor del usuario)

**Idea:** suena una frase de bajo y el usuario la replica de oído en los compases siguientes, sin volver a oírla.

**Ciclo:**
1. La frase suena una vez (1–2 compases), con metrónomo o batería de fondo.
2. Siguen **dos compases de silencio** (solo pulso) para que el usuario la toque.
3. La frase vuelve a sonar, y así sucesivamente.
4. Si el usuario la consigue → se genera una frase nueva. Si no → sigue el ciclo, y puede **revelar las notas** en la tablatura, la partitura o el mástil.

**Generación de frases:**
- Aleatoria, pero basada en **escalas y fundamentos de géneros conocidos**: rock (fundamental-quinta, corcheas), funk (semicorcheas, notas muertas), blues (pentatónica y blue note), reggae (silencio en el primer tiempo), latino (tumbao), jazz (walking).
- Siempre dentro del registro del instrumento del perfil.

**Dificultad:**
- Longitud de la frase.
- Densidad rítmica (negras → corcheas → semicorcheas y síncopas).
- Ámbito y escala (pentatónica → mayor y menor → modos y cromatismo).
- Tempo.
- Repeticiones permitidas antes de poder revelar.

**Comprobación:**
- **En web con micrófono:** se compara la altura y el tiempo con la frase (detector del afinador y de ataques de GrooveTrain), con tolerancias según la dificultad.
- **Sin micrófono:** autoevaluación con «Lo tengo» o «Revelar».

**Reutiliza:** la síntesis de la transcripción (scoreAudio), Fretboard, ScoreView, la caja de ritmos y el detector.

Se guarda como intento y se usa en las rutinas diarias y en el reto diario.

---

## Estado

Responsables según los papeles de `AGENTS.md`: Claude diseña, coordina e integra; Sol 6.1 implementa la parte técnica.

| Tarea | Responsable | Estado |
| --- | --- | --- |
| 1. Modelo de instrumento | Sol 6.1 | Hecha, revisada. |
| 2. Afinador para bajo | Sol 6.1 | Hecha (web). El afinador nativo depende de la 6. |
| 3. Navegación | Claude | Hecha. |
| 4. Mástil interactivo | Claude (diseño y componente) | Hecha. |
| 5. Clave de fa y tablatura | Sol 6.1 (notación y preguntas); Claude revisa la presentación | Hecha. El nivel del perfil limita los trastes (iniciación 0–5, intermedio 0–12). |
| 6. Prueba de audio nativo | Sol 6.1 (adaptadores); el usuario mide en un dispositivo | Prototipo hecho; falta medir y aprobar la librería. |
| 7. Reproductor de transcripción | Sol 6.1 (núcleo y reproductor); Claude (pantalla) | Hecha en web: velocidad sin cambiar el tono, bucle A–B, graves, marcas y sesiones guardadas. Pendiente: transporte de tono y versión nativa (dependen de la tarea 6). |
| 8. Uso sin cuenta | Claude | Hecha. El perfil vive en `src/core/profile.ts`. |
| 9. Retirar código docente | Claude | Hecha. |
| 12. Escucha y repite | Sol | Pendiente; lanzar tras GrooveTrain. |
| 11. Separación del bajo con IA | Sol/Astra (PoC) | Pendiente. Realizable; empezar por 11a. |
| 10. Tablatura y partitura sincronizadas | Sol (modelo, mapa de tiempo, maquetación, dibujo, integración); Claude (contrato, editor, revisión) | Hecha en web: marcas de compás y pulso al estilo de Transcribe!, editor con mástil y teclado, forma de onda con zoom y bucle por arrastre. P1 pendiente: sugerencia de notas, exportación, reproducción de lo anotado. |
