# Requisitos del producto

Estado: borrador para validar (reformulado el 2026-11-19). Este documento desarrolla la idea de `.agents/AGENTS.MD`. Cada apartado indica si es una **decisión confirmada**, una **propuesta** o una **cuestión pendiente**. Las propuestas y las cuestiones pendientes no son requisitos hasta que el usuario las confirme.

El proyecto empezó como una plataforma docente para academias y profesores y el 2026-11-19 se reorientó a una **app para bajistas**. El código docente se retiró ese mismo día (copia de seguridad fuera del repositorio: `../clasRo-backup-academias-2026-11-19.tar.gz`).

## 1. Objetivo

Crear una app para iOS, Android y web dirigida a bajistas. Reúne en un mismo sitio:

- **Herramientas** para tocar y practicar: afinador, metrónomo, caja de ritmos y mástil interactivo.
- **Transcripción**: escuchar, ralentizar, aislar y anotar líneas de bajo a partir de grabaciones.
- **Teoría** aplicada al mástil del bajo.
- **Entrenamiento** de ritmo, oído y lectura, con seguimiento del progreso.

Recorrido principal: abrir la app → usar una herramienta o elegir una práctica → practicar o transcribir → guardar el resultado o el trabajo → ver el progreso.

## 2. Decisiones

### Confirmadas

- Producto centrado en el bajo eléctrico.
- Apps nativas para iOS y Android, además de una versión web.
- Tres áreas principales: herramientas, teoría y transcripción. El entrenamiento y el progreso ya existían en la primera fase y se adaptan al bajo.
- Stack: Expo + React Native + TypeScript con código compartido; Supabase como backend inicial.
- Modelo freemium con un premium personal. Los precios y la cobertura siguen pendientes.
- La gestión de academias y profesores queda fuera de este proyecto y será un proyecto aparte (decidido el 2026-11-19).

### Propuestas

- Diseñar la interfaz pensando primero en el móvil y adaptarla después a la web.
- Modelar el instrumento como parámetro (afinación, número de cuerdas, número de trastes) para añadir guitarra u otros instrumentos más adelante sin reescribir la lógica.
- Que las herramientas y la transcripción funcionen sin cuenta y sin conexión; la cuenta sirve para sincronizar y para el premium.
- Procesar el audio en el dispositivo, sin subir grabaciones del usuario a servidores.

### Pendientes

Ver el apartado 12.

## 3. Usuario objetivo

| Perfil | Necesidad principal |
| --- | --- |
| Bajista principiante (0–2 años) | Afinar, llevar el tempo, conocer el mástil, aprender teoría básica aplicada y practicar con constancia. |
| Bajista intermedio | Sacar líneas de oído, entender la armonía que sostiene, leer en clave de fa y en tablatura y mejorar el groove. |
| Bajista que transcribe a menudo | Ralentizar, repetir en bucle y aislar el bajo de una canción, y anotar lo que oye. |

Propuesta: la configuración inicial pide número de cuerdas (4, 5 o 6), afinación, mano dominante y nivel declarado. Todo se puede cambiar después.

Las academias y los profesores no son usuarios de este producto (ver apartado 11).

## 4. Plataformas

| Plataforma | Estado | Notas |
| --- | --- | --- |
| iOS | Confirmada | Publicación en App Store. |
| Android | Confirmada | Publicación en Google Play. |
| Web | Confirmada | Adaptable a escritorio y móvil. Algunas funciones de audio pueden diferir según el navegador. |

- El código compartido cubre la interfaz, la lógica musical y los datos. Las APIs de audio, micrófono y archivos se aíslan en `src/platform/`.
- Propuesta: usar development builds de Expo (EAS), no Expo Go, porque el audio en tiempo real y el procesamiento de archivos necesitan módulos nativos.
- Pendiente: la librería de audio nativo. Hay que elegirla con una prueba de concepto que mida latencia, cambio de tempo sin alterar el tono y análisis del micrófono en dispositivos reales.
- Cada función que dependa del audio debe documentar en qué plataformas está validada.

## 5. Herramientas — P0

Se acceden desde la navegación principal y funcionan sin cuenta.

### Afinador

- Afinaciones predefinidas: estándar de 4 cuerdas (Mi La Re Sol), 5 cuerdas con Si grave, 6 cuerdas con Do agudo, Drop D, medio tono abajo. Propuesta: permitir afinaciones personalizadas.
- Detectar desde Si0 (≈30,87 Hz). El detector se ha comprobado con señales sintéticas desde 28 Hz a 44,1 y 48 kHz, incluidas fundamentales débiles frente al segundo armónico. La precisión con micrófono real sigue pendiente (ver tarea 2 en `docs/TAREAS.md`).
- Mostrar nota, cuerda más probable y desviación en cents. Permitir cambiar la referencia de La4.
- Gestionar el permiso de micrófono, la ausencia de señal y el cierre del micrófono. El audio se procesa localmente.
- Funcionar en iOS y Android. Hoy solo funciona en web.

### Metrónomo

- BPM, compás, subdivisión y acento en el primer pulso.
- Propuesta: tap tempo, compases de silencio para comprobar el tempo interno y entrenador de velocidad (subir BPM cada N compases).
- Temporización estable con la app en primer plano. Pendiente: si debe seguir sonando con la pantalla bloqueada.

### Caja de ritmos

- Patrones de batería básicos por estilo (rock, funk, pop, shuffle, reggae, latino como propuesta inicial) con BPM ajustable.
- Pendiente: origen de las muestras de batería. Deben ser propias, sintetizadas o con licencia verificada.

### Mástil interactivo

- Mostrar notas, escalas, arpeggios e intervalos sobre el mástil según el número de cuerdas y la afinación configurados.
- Elegir tónica, escala o acorde y posición; mostrar digitaciones.
- Tocar la nota al pulsar sobre el mástil.
- Alternar la nomenclatura latina (Do, Re, Mi) y la anglosajona (C, D, E).

### Progresiones y líneas de bajo — P1

- Seleccionar tonalidad y progresión, ver grados y acordes, y reproducirla en bucle para tocar encima.
- Propuesta: sugerir notas objetivo (fundamental, quinta, notas de aproximación) sobre el mástil.

## 6. Transcripción

Es el área que más distingue al producto de otras apps de bajo. Las grabaciones las aporta el usuario y se procesan en el dispositivo.

### P0: reproductor de práctica

- Importar un archivo de audio local (propuesta: MP3, M4A/AAC, WAV) desde el dispositivo o el navegador.
- Cambiar la velocidad (propuesta: entre 25 % y 150 %) sin alterar el tono.
- Transportar el tono en semitonos sin alterar la velocidad.
- Bucle A–B con ajuste fino y marcadores con nombre (estrofa, estribillo…).
- Realce de graves: un filtro que destaca la franja de frecuencias del bajo.
- Forma de onda navegable y avance o retroceso por pasos cortos.
- Guardar por canción la posición, los bucles, los marcadores y los ajustes.

### P1: asistencia y anotación

- Sugerir las notas del fragmento seleccionado a partir del tono detectado (monofónico) y presentarlas como **sugerencia editable**, nunca como transcripción exacta.
- Editor de tablatura sencillo, alineado con la línea de tiempo del audio, con exportación a texto y PDF como propuesta inicial.
- Propuesta: tocar con el micrófono sobre el bucle y comparar la nota tocada con la anotada.

### P2: ampliaciones

- Separación de fuentes para aislar o quitar el bajo de la mezcla. Es costosa en CPU y en tamaño de modelo; hay que decidir si se hace en el dispositivo o en un servidor y cómo afecta a la privacidad y al coste.
- Exportar a MusicXML o a formatos que abre Guitar Pro.
- Detectar los acordes de la canción.

### Límites de la transcripción

- No descargar audio de YouTube, Spotify u otros servicios: incumple sus condiciones. Solo se trabaja con archivos que el usuario ya tiene.
- No subir las grabaciones del usuario sin su consentimiento explícito. Si una función futura necesita un servidor, debe indicarlo antes de enviar nada.
- Las transcripciones son del usuario. Pendiente: si se podrán compartir y en qué condiciones, porque compartir transcripciones de canciones protegidas puede tener implicaciones legales.

## 7. Teoría — P0

- Recorrido de teoría aplicada al bajo: notas en el mástil, intervalos como formas, escalas y modos, arpegios y acordes, función de las notas del bajo en la armonía, ritmo y lectura en clave de fa y en tablatura.
- Cada lección incluye explicación breve, ejemplo audible, diagrama sobre el mástil o pentagrama, preguntas autocorregibles y una práctica con el instrumento con autoevaluación.
- Reutilizar la estructura del curso Armonía I (temas, cuestionarios, prácticas, diagramas) adaptando los ejemplos al registro y al mástil del bajo.
- Las prácticas con el instrumento se autoevalúan; la app no califica la interpretación.
- El contenido pasa por revisión musical antes de presentarse como revisado. El usuario cuenta con profesores para validar el temario.

**Riesgo legal pendiente.** El curso Armonía I sigue el volumen I de Enric Herrera. Antes de publicarlo en las tiendas o de incluirlo en el premium hay que obtener licencia, reescribirlo de forma independiente con un temario propio, o retirarlo. Hasta resolverlo, no se presenta como contenido comercial.

## 8. Entrenamiento — P0

Los cuatro módulos de la primera fase se mantienen y se adaptan al bajo.

| Módulo | Adaptación al bajo |
| --- | --- |
| GrooveTrain (ritmo) | Patrones típicos de bajo, opción de practicar sobre la caja de ritmos y botón o teclado como entrada. La detección de ataques por micrófono sigue siendo experimental. |
| Notas | Identificar notas en el mástil (cuerda y traste), en clave de fa y de oído, en el registro del bajo (Mi1–Sol4 para 4 cuerdas). |
| Intervalos | De oído y como forma sobre el mástil; ampliar al conjunto completo de intervalos. |
| Lectura | Clave de fa y tablatura, con notas y ritmo y dificultad configurable. |

- Propuesta: un entrenamiento de oído para reconocer el grado de la nota del bajo dentro de una tonalidad.
- Cada intento guarda módulo, configuración, fecha, respuestas y resultado. Los intentos guardados no cambian si después cambia la configuración.

## 9. Progreso y hábito

- P0: historial de intentos y resumen por módulo, separando intentos de aciertos.
- P1: diario de práctica (tiempo, qué se practicó, BPM alcanzado) y reto diario corto.
- P1: objetivos de tempo por ejercicio (por ejemplo, llegar a 120 BPM sin fallos).
- La gamificación avanzada queda fuera de esta etapa.

## 10. Cuentas, datos y planes

### Cuentas — P0

- Usar herramientas, transcripción local y lecciones gratuitas sin cuenta.
- La cuenta (Supabase Auth) sirve para sincronizar progreso, transcripciones y ajustes entre dispositivos, y para el premium.
- Registro, inicio y cierre de sesión, recuperación de contraseña, edición del perfil y eliminación de la cuenta desde la app. Las tiendas exigen poder eliminarla.
- Pendiente: inicio de sesión con Apple y Google. Apple exige Sign in with Apple si se ofrecen otros inicios de sesión de terceros.
- Pendiente: si se sincronizan los archivos de audio o solo los metadatos (bucles, marcadores, tablaturas).

### Planes — P0 estructura, pendientes los detalles

| Plan | Estado | Propuesta de contenido |
| --- | --- | --- |
| Gratuito | Confirmado | Afinador, metrónomo, mástil, reproductor de transcripción básico, lecciones iniciales y entrenamiento básico. |
| Premium personal | Confirmado | Pendiente. Candidatos: teoría completa, asistencia de notas, tablatura y exportación, caja de ritmos completa y sincronización ilimitada. |

- Pendiente: precio, periodicidad, periodo de prueba y límites exactos del plan gratuito.
- Las suscripciones digitales vendidas dentro de las apps de iOS y Android deben usar los pagos integrados de cada tienda. Stripe sirve para la web. Propuesta: usar un servicio que unifique los derechos de acceso entre tiendas y web.
- El estado premium se valida en el servidor. No guardar datos de tarjeta ni claves secretas en el cliente. Los eventos de pago no se procesan dos veces.

## 11. Academias: fuera de este proyecto

**Decisión confirmada (2026-11-19):** la gestión de academias, profesores, clases, matrículas y tareas queda fuera de este proyecto y será un proyecto aparte.

- Esta app no incluye roles docentes, espacios compartidos ni asignaciones de profesor a alumno. No se diseña la navegación, el modelo de datos ni los planes pensando en ellos.
- El código docente de la primera fase se retiró el 2026-11-19. La copia completa para el otro proyecto está en `../clasRo-backup-academias-2026-11-19.tar.gz`.
- Pendiente: si el proyecto de academias compartirá en el futuro el núcleo musical (`src/core/`) mediante un paquete común o una copia. Mientras tanto, mantener `src/core/` libre de conceptos docentes para que pueda reutilizarse.

## 12. Cuestiones pendientes

1. Librería de audio nativo para el afinador, la reproducción con cambio de tempo y tono y el análisis del micrófono (requiere prueba de concepto).
2. Precio, prueba gratuita y reparto exacto entre el plan gratuito y el premium.
3. Proveedor de compras integradas y unificación con Stripe en la web.
4. Licencia, reescritura o retirada del contenido basado en Enric Herrera.
5. Origen y licencia de las muestras de batería.
6. Sincronización de audio en la nube o solo de metadatos.
7. Compartir transcripciones entre usuarios.
8. Edad mínima y tratamiento de datos de menores.
9. Nombre comercial: «clasRo» viene del enfoque docente; decidir si se mantiene.
10. Idiomas de lanzamiento (propuesta: español primero).

## 13. Reutilización del código de la primera fase

| Parte | Decisión propuesta |
| --- | --- |
| `src/core/music.ts`, `notation.ts`, `diagrams.ts`, `course.ts` | Reutilizar. Añadir modelo de instrumento (cuerdas, afinación, trastes), clave de fa y registro grave. |
| `src/core/rhythm.js` (GrooveTrain) | Reutilizar con patrones de bajo. |
| Afinador web y detector | Reutilizar el algoritmo; ampliar el rango a Si0 e implementar el adaptador nativo. |
| Metrónomo y progresiones | Reutilizar y ampliar. |
| Curso Armonía I y diagramas | Reutilizar estructura y componentes; adaptar contenido al bajo y resolver la licencia. |
| `Exercise.tsx` | Reutilizar los módulos; añadir mástil y tablatura como formas de pregunta y respuesta. |
| Clases, tareas, matrículas, espacios y RLS docentes | **Hecho:** retirados; esquema de Supabase sustituido por uno de usuario individual. |
| `Home.tsx`, navegación de `App.tsx` | **Hecho:** Herramientas · Transcribir · Aprender · Practicar · Progreso. |
| Demo local con cuatro perfiles | **Hecho:** uso sin cuenta con perfil local y configuración inicial del bajo. |

## 14. Interfaz y calidad — P0

- Móvil primero, con controles grandes que se puedan usar con el bajo colgado y una sola mano libre. Propuesta: modo horizontal en el reproductor de transcripción y en el mástil.
- Interfaz simple y concisa, sin eslóganes ni texto ornamental.
- Accesibilidad: etiquetas, foco visible en la web, contraste suficiente y tamaño de texto del sistema.
- Estados claros de carga, vacío, error y operación completada; avisar cuando una función necesite micrófono, archivos o conexión.
- Funcionamiento sin conexión de herramientas, transcripción local y contenido descargado.
- Medir latencia y estabilidad del audio en dispositivos reales antes de dar por buena una herramienta en una plataforma.
- No presentar datos de ejemplo ni simulaciones como uso real.

## 15. Restricciones técnicas

- Expo + React Native + TypeScript. Supabase para identidad, datos y almacenamiento.
- Pocas dependencias; justificar cada una, sobre todo las nativas de audio.
- Lógica musical y de audio separada de la presentación y la persistencia, con pruebas.
- RLS en Supabase para que cada usuario solo acceda a sus datos.
- Secretos fuera del cliente y del repositorio; entornos de pruebas y producción separados.
- Cumplir las directrices de App Store y Google Play: privacidad, permisos de micrófono y archivos, eliminación de cuenta y compras.

## 16. Criterios de aceptación de la primera versión de la app de bajo

1. En iOS, Android y web, un usuario sin cuenta afina un bajo de 4 y de 5 cuerdas. La detección de Si0 y Mi1 está validada con micrófono real.
2. El metrónomo mantiene el tempo y acentúa el primer pulso en las tres plataformas.
3. El mástil muestra correctamente una escala y un arpegio elegidos para la afinación configurada.
4. El usuario importa una canción propia, la ralentiza al 50 % sin cambiar el tono, repite un bucle A–B y lo encuentra guardado al volver a abrir la app.
5. El realce de graves destaca de forma audible la franja del bajo.
6. Notas, intervalos, lectura en clave de fa y tablatura, y GrooveTrain funcionan de principio a fin y guardan sus intentos.
7. Una lección de teoría muestra ejemplos en el mástil, corrige el cuestionario y registra la práctica autoevaluada.
8. Al denegar el micrófono aparece una explicación útil y el resto de la app sigue funcionando.
9. Un usuario crea una cuenta, sincroniza su progreso en otro dispositivo y puede eliminar la cuenta desde la app.
10. En pruebas (sandbox), el premium se activa y se cancela en cada plataforma y solo concede los accesos definidos.
11. Ninguna grabación del usuario sale del dispositivo sin su consentimiento.

## 17. Fuera de alcance de esta etapa — P2

- Separación de fuentes con IA, salvo que se priorice expresamente.
- Editor de partituras completo y exportación nativa a Guitar Pro.
- Calificación automática de interpretaciones completas.
- Comunidad, chat o compartición pública de transcripciones.
- Gamificación avanzada y recomendaciones con aprendizaje automático.
- Otros instrumentos, aunque el modelo de instrumento debe permitirlos.
