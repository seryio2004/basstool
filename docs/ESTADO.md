# Estado del proyecto (traspaso entre sesiones)

Archivo de continuidad para Claude y Sol cuando se renueve el contexto. **Léelo al empezar** y actualízalo al terminar cada encargo (qué se hizo, qué falta, decisiones pendientes).

## Hecho (2026-11-19)
- App para bajistas (Expo/RN, iOS/Android/web). Academias fuera (proyecto aparte).
- Tareas 1–5 y 7–10 de docs/TAREAS.md hechas en web. Tarea 6 (audio nativo): prototipo en spikes/audio, falta medir en dispositivo y aprobar `react-native-audio-api`.
- Transcribir: reproductor (velocidad, bucle por arrastre, graves, volumen, zoom), partitura/tab sincronizadas por marcas de compás (M) y pulso (B), editor con figura persistente, mástil completo y piano, compases limitados a su métrica, acordes por compás, quintillos, síntesis de la transcripción, PDF por impresión en web.

## En curso
- Encargo `transcribir-fix` (Sol 6.2): .git/coord/encargos/transcribir-fix.md — reproducción de la transcripción no funciona, asignar compases no es intuitivo, acordes deducidos de las notas escritas, notas simultáneas (una por cuerda).

- **Interrumpido 2026-11-19 ~08:05 por límite de uso de Codex (reintentar desde las 08:28).** Trabajo parcial en la rama `codex/transcribir-fix` (commit WIP, sin verificar). Para reanudar: `scripts/sol.sh transcribir-fix .git/coord/encargos/transcribir-fix.md` (retoma la misma rama) e incluir también los requisitos enviados por el buzón: notas simultáneas (#22) y selector de BPM (#24) — ver `npm run coord -- log 10`.

## Pendiente de decisión del usuario
- `expo-print` para exportar PDF en móvil (propuesto, sin instalar).
- Aprobar la librería de audio de la tarea 6 tras medir en un dispositivo.

## Cómo seguir
- Coordinación: docs/COORDINACION.md (worktrees, buzón `npm run coord`, `scripts/sol.sh`). Claude coordina, revisa e integra; Sol implementa.
- Modelos: gpt-6.2-sol por defecto; gpt-6.2-astra para lo complejo; gpt-6-luna para lo sencillo.
