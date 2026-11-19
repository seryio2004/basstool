# Estado del proyecto (traspaso entre sesiones)

Archivo de continuidad para Claude y Sol cuando se renueve el contexto. **Léelo al empezar** y actualízalo al terminar cada encargo (qué se hizo, qué falta, decisiones pendientes).

## Resumen actual (2026-11-19, tarde) — empieza por aquí
- **Repositorio público:** `git@github.com:seryio2004/basstool.git` (rama `main`). Web en GitHub Pages: https://seryio2004.github.io/basstool/ (workflow `.github/workflows/pages.yml`: pruebas + build + despliegue en cada push a `main`; el usuario debe tener Pages → Source = GitHub Actions). Netlify Drop sigue valiendo para pruebas puntuales.
- **Curso basado en Herrera retirado del repositorio** y del historial (reescrito con filter-branch antes del primer push). Copia privada fuera de git en `/home/sk/codes/clasRo-privado/`. `src/content/harmony/index.ts` es un stub vacío hasta el temario propio. No volver a añadir ese contenido al repo.
- **Integrado hoy:** Escucha y repite v1, Práctica diaria v1 (pestaña «Hoy»: reto, racha, rutinas, plan de 21 días provisional, semana, diario), bajo dibujado en código que gira en Ajustes/configuración (`bassGeometry.ts`), limitador del bus de síntesis.
- **En curso (Sol):** `panel-movil` — en móvil el panel de escritura de Transcribir tapa la partitura (panel acotado y plegable, seguir el cursor).
- **Siguiente (encargos listos en `.git/coord/encargos/`):** `herr-ritmo` (13a: caja de ritmos + entrenador de velocidad, motor de patrones común con Escucha y repite), `herr-referencia` (13b: diccionario de acordes/arpegios, tono de referencia, ejercicios de técnica), `herr-grabadora` (13c: grabadora con selección de entrada, web). Lanzarlos en ese orden con `scripts/sol.sh`.
- **Pendiente del usuario:** aprobar `expo-font` y `expo-print`; temario propio, rutinas avanzadas y validación del plan de 21 días con sus profesores; límites de la demo, precios y prueba.
- **Pendiente técnico:** tarea 11 (separación de bajo con IA), 14 (renders), 6 (audio nativo, necesita Mac), onboarding, paywall, migraciones Supabase 0002–0006, pruebas con bajo/micrófono reales y en móvil.
- **Onboarding (rama `claude/onboarding`, pendiente de integrar):** primera experiencia en 5 pasos (`src/screens/Onboarding.tsx`: bienvenida con el bajo giratorio, tu bajo, nivel en tarjetas + nomenclatura, objetivos (máx. 3)/tiempo/días/descanso, hasta 5 canciones favoritas), «Saltar» en cada paso, llegada a Hoy con el aviso «Tu rutina de hoy está lista». Nuevo `PracticeSettings.favoriteSongs` (parseo tolerante, perfiles antiguos → `[]`), `songOfTheDay` rota la sugerencia «Prueba con: …» del bloque «Tu canción» si no hay sesión de Transcribir; panel «Canciones favoritas» en Ajustes. Lógica pura en `src/core/onboarding.ts`, pruebas en `tests/onboarding.test.ts`. Falta probar en iOS/Android (foco accesible, área segura, teclado sobre el pie fijo).
- Las secciones de abajo son el registro histórico de entregas; algunas «En curso» ya están integradas.

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

### Pulido de sonido, onda y temas

- Entregado a Claude en `codex/pulido-sonido`, con cambios sin commit. La paleta vintage atenúa ambos temas y conserva AA en los pares de texto documentados. La cabecera alterna oscuro y claro con dos siluetas SVG originales y un fundido de 150 ms que respeta el movimiento reducido. «Sistema» sigue en Ajustes. El cambio de tema conserva la canción cargada y la edición.
- Transcribir admite zoom de 1 a 32× por pellizco, Ctrl+rueda centrada en el puntero, teclas +/− y deslizador. Dos dedos o Mayús+arrastre desplazan la ventana. La vista general permite saltar. Los tiradores A/B respetan la duración mínima del bucle y pueden encajar en marcas de compás y pulso. Se mantienen toque, doble toque y arrastre para buscar, quitar y crear bucles.
- La voz Web Audio separa el instrumento del transporte para admitir un sampler. Usa síntesis sustractiva, ADSR, armónicos, saturación suave, compresión y un ajuste de ganancia por RMS activo de la canción que conserva el balance. «Ataque del bajo» ofrece dedo, púa o prescindir del transitorio añadido. Las voces simultáneas mantienen sus duraciones y ligaduras. Las notas muertas usan ataques sin altura.
- Pasan `npm run typecheck`, `npm run build`, la revisión estática de los componentes web en ambos tamaños y las pruebas de contraste, zoom, imán y programación musical. En `npm test` pasan 21 de 22 archivos, con `spawnSync git EPERM` en la prueba de coordinación. Los 22 pasan al capturar la salida de sus subprocesos en archivos temporales. Quedan por verificar los gestos y el cambio de tema en un navegador interactivo y la sonoridad con canciones y altavoces físicos. El reproductor nativo sigue en la tarea 6.

### Beta web para profesores y conocidos

- Entrega a Claude en `codex/beta-web`, con cambios en el worktree sin commit. `SHOW_HARMONY_COURSE` en `src/content/flags.json` desactiva el curso en Aprender y Progreso. Metro excluye el contenido de Armonía I del paquete de la beta. Los apuntes propios y el historial de práctica siguen disponibles.
- La cabecera muestra «Beta» y el aviso inicial explica el almacenamiento en el navegador y el permiso de micrófono. «Entendido» guarda el acuse en el navegador. La beta web usa el perfil local aunque haya variables de Supabase configuradas. Claude confirmó que el envío de comentarios queda fuera de esta entrega.
- La configuración inicial y Ajustes comparten el bajo dibujado en código (`bassGeometry.ts`, 16 fotogramas): gira al mantener pulsado o arrastrar y vuelve de frente al soltar; con movimiento reducido solo sigue al dedo. Falta probar fluidez y gesto táctil en iOS/Android. La escala se guarda por dispositivo con 34″ por defecto para los perfiles antiguos. `assets/README.md` documenta los nombres y las dimensiones de los futuros WebP.
- El afinador abre con la afinación del perfil. Se corrigieron el contraste de los controles de ChordLine, el estado accesible de los selectores, la acumulación de temporizadores del metrónomo y las reproducciones de ejemplo que podían arrancar después de salir.
- Pasan `npm run typecheck` y `npm run build`. `npm test` pasa en 22 de 23 archivos. La prueba de coordinación da `spawnSync git EPERM` en el sandbox. Los 23 archivos pasan al capturar la salida de sus subprocesos en archivos temporales. Se comprobó el render estático a 350 y 1200 px de la configuración inicial, las cuatro herramientas, Transcribir en vacío y con una canción de prueba, las cinco prácticas, Aprender, Progreso y Ajustes. Se verificaron las 40 variantes de la ilustración por afinación, escala y mano.
- En los archivos reservados, `player.web.ts` declara `canTranspose: false` y `Transcribe.tsx` oculta el cambio de tono. Por inspección, un fallo al construir el grafo Web Audio tras liberar la canción anterior puede dejar su ficha visible aunque el reproductor ya no la tenga. El coordinador tiene este hallazgo para la revisión de síntesis. Quedan por probar la reproducción y el micrófono reales.

#### Publicación manual con Netlify Drop

1. Tras integrar los cambios que deban entrar en la beta, ejecuta `npm run build` en la rama que se va a publicar. Expo genera `dist/`.
2. Arrastra la carpeta `dist/` completa a [Netlify Drop](https://app.netlify.com/drop). Para una actualización, sube el nuevo `dist/` al sitio existente. El HTML, el favicon, las fuentes y el JavaScript conservan sus rutas relativas.
3. Abre la URL HTTPS resultante. Comprueba el título «clasRo — beta», el aviso en un perfil limpio, el afinador con permiso de micrófono y Transcribir con un archivo local antes de compartir la URL.

### Escucha y repite · tarea 12

- Entregado a Claude en `codex/escucha-repite`, con los cambios en el worktree sin commit. El módulo de Practicar genera frases originales de seis géneros y tres dificultades en la afinación del perfil. La frase se repite tras dos compases de batería. Los acordes opcionales solo acompañan el modelo. «Revelar» abre tablatura, partitura o mástil.
- En web reutiliza la voz del bajo y el reloj de Web Audio, el detector de ataques de GrooveTrain y el afinador. Compara tiempo y altura con tolerancias por nivel, incluidas las notas muertas de funk. «Lo tengo» y «Otra vez» guardan la autoevaluación. En nativo la reproducción usa los tonos existentes y la entrada es manual.
- `ExerciseConfig.listenRepeat` admite un preset con género, dificultad, acordes y semilla opcional. Los intentos guardan el preset efectivo y el tipo de entrada. La práctica diaria podrá pasar ese preset al abrir el ejercicio. Aplicar `202611190006_listen_repeat.sql` antes de sincronizar intentos con Supabase.
- Pasan `npm run typecheck`, `npm run build` y las cinco pruebas nuevas. `npm test` pasa en 24 de 25 archivos. Solo falla la prueba de coordinación por `spawnSync git EPERM`. Los 25 pasan al capturar la salida de los subprocesos de esa prueba en archivos temporales. El render estático pasó a 350 y 1200 px en ambos temas. El sandbox bloqueó el servidor local y Chromium, así que quedan por probar la interacción, la sonoridad y la precisión con bajo y micrófono reales.

### Práctica diaria · versión 1

- Entrega a Claude en `codex/practica-diaria`, con cambios en el worktree sin commit. «Hoy» es la primera pestaña. El reto dura entre 3 y 5 minutos y usa los mismos presets por fecha local y nivel. La afinación y la nomenclatura del perfil siguen aplicándose al mostrar y tocar los ejercicios.
- La racha cuenta días de reto completo o de al menos 5 minutos acumulados, con hitos en 3, 7, 14 y 21. La propuesta de descanso está activada por defecto y se cambia en Ajustes. Protege un único día aislado por semana de lunes a domingo y conserva la racha sin sumar el descanso. Si el día omitido fue ayer, hoy aún se puede retomar. Ajustes parte de 10 minutos por rutina y de 30 minutos semanales repartidos en lunes, miércoles y viernes.
- Las rutinas ajustan el reparto por objetivos y el tempo de GrooveTrain y ChordLine según los aciertos y el último BPM. Todas reservan tiempo para canciones propias. El temporizador permite saltar y el usuario confirma cuándo avanzar. Un reto o día del plan exige completar sus bloques y registrar al menos un intento por ejercicio evaluado. Una sesión guiada se asigna a la fecha local de inicio.
- Transcribir pide volver a elegir el archivo local. En el bloque guiado usa el bucle guardado o un fragmento de hasta 12 segundos, empieza al 75 % o al tempo guardado si es menor y aumenta cinco puntos por cada tres vueltas hasta el 100 %. Conserva el tempo y el bucle de la sesión original. El diario indica BPM de la canción cuando la partitura tiene un tempo guardado y registra el porcentaje de velocidad en los demás casos. En iOS y Android la importación sigue dependiendo del motor de audio de la tarea 6.
- El plan de 21 días por nivel y la rutina avanzada son provisionales y requieren la validación de profesores. Sesiones, objetivos e hitos finales se editan en `src/content/dailyPractice.ts`. Se puede completar un día del plan por nivel y fecha local.
- El diario agrupa por día las sesiones guiadas y el historial de intentos, registra tiempo y métricas disponibles, y permite editar una nota de hasta 240 caracteres. Las sesiones guiadas guardan avances parciales. Los nuevos campos se almacenan en AsyncStorage y los perfiles antiguos reciben valores por defecto. La práctica diaria permanece local para perfiles con cuenta. `practiceAccess` en `src/core/dailyPractice.ts` centraliza la futura clasificación por plan. Reto y racha son gratuitos.
- Pasan `npm run typecheck`, `npm run build` y las nueve pruebas nuevas. `npm test` pasa en 25 de 26 archivos. La prueba existente de coordinación recibe `spawnSync git EPERM` en el sandbox. Los 26 pasan al capturar la salida de los subprocesos de esa prueba en archivos temporales. La comprobación estática web pasó a 350 y 1200 px en ambos temas. Queda por probar el flujo interactivo en navegador y en dispositivos, incluidos el bucle de una canción real y el uso con micrófono.

### Transcribir · panel de escritura en móvil

- Entregado a Claude en `codex/panel-movil`, con cambios en el worktree sin commit. Por debajo de 1100 px, el panel de escritura queda debajo de la partitura con desplazamiento interno y un límite del 45 % de la ventana. La barra muestra compás, pulso y figura. Al plegar el panel se conserva la cuerda activa del mástil o la fila de teclas del piano. El panel empieza abierto al cargar una canción.
- El desplazamiento sigue el sistema del compás activo al escribir o mover el cursor. Si la altura disponible impide mostrar el sistema completo, se revela la zona del cursor. El DOM del editor a 1200 px coincide antes y después. Se conserva la lógica musical del editor.
- Pasan `npm run typecheck` y `npm run build`. En `npm test` pasan 24 de 25 archivos. La prueba existente de coordinación recibe `spawnSync git EPERM` en el sandbox. Los 25 archivos pasan al capturar los subprocesos de esa prueba en archivos temporales.
- El render estático usó la forma de onda de `linea-de-bajo.wav` y verificó los dos temas, los estados abierto y plegado, el mástil y el piano a 390 × 844. Las cinco vistas HTML están en `.impeccable/review/`. El sandbox bloqueó el puerto local y el arranque de Chromium. Quedan pendientes las capturas PNG y la comprobación interactiva del desplazamiento en navegador y dispositivo.

## Definición del producto (2026-11-19)
- Decidido: función estrella = práctica diaria; lanzamiento web primero; temario propio en lugar del curso de Herrera.
- Práctica diaria: reto diario con racha + plan semanal + rutinas guiadas personalizables; adapta por nivel, tiempo y objetivos; racha y diario de práctica; foco en los primeros 21 días (REQUISITOS §9).
- Planes: premium desbloquea todo (mensual o anual); gratis = herramientas básicas + demo corta de Transcribir (REQUISITOS §10). Por decidir: límite exacto de la demo, precios, prueba gratuita.

- **Hecho e integrado: GrooveTrain original (paleta, tren, niveles, micrófono) + herramienta nueva de acordes por casilla.** Encargo: `.git/coord/encargos/groovetrain.md`.

- **Entregada a Claude:** tarea 12 «Escucha y repite» (docs/TAREAS.md), pendiente de revisión e integración.

- ChordLine v2 y ritmos integrados. **Rediseño vintage integrado (tema oscuro/claro/sistema, Fraunces + IBM Plex en web; `expo-font` pendiente de aprobación para nativo; pendiente adaptar al tema HarmonicWagons y colores de módulo de src/core/types.ts): visual vintage/analógico, oscuro por defecto** — encargo `.git/coord/encargos/rediseno-vintage.md`.

- Integrado: corcheas con grabado estándar (plicas, barras inclinadas, banderines curvos, espaciado proporcional) y acordes con 9/11 ampliados (Cm11 sin 9, m(add9), add11, 7sus4, m6/9, 9(♯11)).

## Pendiente de decisión del usuario
- `expo-print` para exportar PDF en móvil (propuesto, sin instalar).
- Aprobar la librería de audio de la tarea 6 tras medir en un dispositivo.

## Cómo seguir
- Coordinación: docs/COORDINACION.md (worktrees, buzón `npm run coord`, `scripts/sol.sh`). Claude coordina, revisa e integra; Sol implementa.
- Modelos: gpt-6.2-sol por defecto; gpt-6.2-astra para lo complejo; gpt-6-luna para lo sencillo.
