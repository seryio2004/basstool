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

## Definición del producto (2026-11-19)
- Decidido: función estrella = práctica diaria; lanzamiento web primero; temario propio en lugar del curso de Herrera.
- Práctica diaria: reto diario con racha + plan semanal + rutinas guiadas personalizables; adapta por nivel, tiempo y objetivos; racha y diario de práctica; foco en los primeros 21 días (REQUISITOS §9).
- Planes: premium desbloquea todo (mensual o anual); gratis = herramientas básicas + demo corta de Transcribir (REQUISITOS §10). Por decidir: límite exacto de la demo, precios, prueba gratuita.

- **En curso (Sol, Astra): GrooveTrain original (paleta, tren, niveles, micrófono) + herramienta nueva de acordes por casilla.** Encargo: `.git/coord/encargos/groovetrain.md`.

## Pendiente de decisión del usuario
- `expo-print` para exportar PDF en móvil (propuesto, sin instalar).
- Aprobar la librería de audio de la tarea 6 tras medir en un dispositivo.

## Cómo seguir
- Coordinación: docs/COORDINACION.md (worktrees, buzón `npm run coord`, `scripts/sol.sh`). Claude coordina, revisa e integra; Sol implementa.
- Modelos: gpt-6.2-sol por defecto; gpt-6.2-astra para lo complejo; gpt-6-luna para lo sencillo.
