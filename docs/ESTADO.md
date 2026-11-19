# Estado del proyecto (traspaso entre sesiones)

Archivo de continuidad para Claude y Sol cuando se renueve el contexto. **Léelo al empezar** y actualízalo al terminar cada encargo (qué se hizo, qué falta, decisiones pendientes).

## Hecho (2026-11-19)
- App para bajistas (Expo/RN, iOS/Android/web). Academias fuera (proyecto aparte).
- Tareas 1–5 y 7–10 de docs/TAREAS.md hechas en web. Tarea 6 (audio nativo): prototipo en spikes/audio, falta medir en dispositivo y aprobar `react-native-audio-api`.
- Transcribir: reproductor (velocidad, bucle por arrastre, graves, volumen, zoom), partitura/tab sincronizadas por marcas de compás (M) y pulso (B), editor con figura persistente, mástil completo y piano, compases limitados a su métrica, acordes por compás, quintillos, síntesis de la transcripción, PDF por impresión en web.

## En curso
- Integrado 2026-11-19: reproducción de la transcripción, flujo de compases guiado, acordes deducidos de las notas escritas, **selector de BPM** que recoloca los compases (commit 5f65c10).
- **En curso (Sol, Astra): notas simultáneas (una por cuerda).** Encargo listo en `.git/coord/encargos/notas-simultaneas.md`; lanzar con `scripts/sol.sh notas-simultaneas .git/coord/encargos/notas-simultaneas.md` (si Sol ya lo lanzó, ver su rama `codex/notas-simultaneas` y `.git/coord/sol/notas-simultaneas.md`).

- **En curso (parte 2 del encargo notas-simultaneas): reconocimiento de acordes extendidos** (pedido por el usuario). Ampliar la deducción por notas escritas (`inferChord` en src/core/chroma.ts) y la detección por audio para novenas, oncenas y trecenas: Cmaj9, C9, Cm9, C7(♭9/♯9), Cadd9, C11, Cm11, C7(♯11), C13…, admitiendo la omisión de la quinta (y de la 11 en acordes dominantes) cuando hay 5 o más notas. Elegir la interpretación más simple ante ambigüedad (p. ej. preferir C6 a Am7/C según el bajo) y probar con casos concretos. Encargo en `.git/coord/encargos/notas-simultaneas.md`, parte 2.

## Definición del producto (2026-11-19)
- Decidido: función estrella = práctica diaria; lanzamiento web primero; temario propio en lugar del curso de Herrera.
- Por decidir: reparto gratis/premium (el usuario eligió «otra» sin detallar); diseño concreto de la práctica diaria.

## Pendiente de decisión del usuario
- `expo-print` para exportar PDF en móvil (propuesto, sin instalar).
- Aprobar la librería de audio de la tarea 6 tras medir en un dispositivo.

## Cómo seguir
- Coordinación: docs/COORDINACION.md (worktrees, buzón `npm run coord`, `scripts/sol.sh`). Claude coordina, revisa e integra; Sol implementa.
- Modelos: gpt-6.2-sol por defecto; gpt-6.2-astra para lo complejo; gpt-6-luna para lo sencillo.
