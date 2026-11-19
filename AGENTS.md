# Instrucciones del proyecto

**Al empezar cualquier sesión, lee [docs/ESTADO.md](docs/ESTADO.md) (traspaso de contexto) y actualízalo al terminar cada encargo.**

Leer y aplicar [.agents/AGENTS.MD](.agents/AGENTS.MD) como guía de trabajo para todo este repositorio.

Consultar [REQUISITOS.md](REQUISITOS.md) para el detalle funcional, las prioridades y los criterios de aceptación. Mantener la distinción entre decisiones confirmadas, propuestas y cuestiones pendientes.

## Trabajo simultáneo con otros agentes (obligatorio)

En este repositorio trabajan dos agentes (`claude` y `codex`). Sigue [docs/COORDINACION.md](docs/COORDINACION.md).

**Papeles (decisión del usuario, 2026-11-19):**

| Agente | Papel |
| --- | --- |
| `claude` (Claude Code, Opus 5.5) | Coordinador. Diseño de interfaz y experiencia, requisitos, planificación y reparto de tareas, revisión e **integración en `main`** (es el único que integra). |
| `codex` (Codex CLI, Sol 6.1) | Subagente de implementación técnica: lógica musical y de audio, algoritmos y DSP, módulos nativos, pruebas extensas y refactors amplios. Recibe encargos de `claude` (`scripts/sol.sh`) o del usuario, entrega una rama lista y no integra. |

Reglas:


- Trabaja solo en tu worktree (`../clasRo-claude` o `../clasRo-codex`) y en una rama `<agente>/<tarea>`. No edites nunca la carpeta `clasRo` (rama `main`).
- **Buzón:** Claude Code lo recibe automáticamente por un hook (`.claude/settings.json`). Los demás agentes (Codex) deben ejecutar `npm run coord -- inbox <agente>` al empezar **cada turno**, antes de cada commit y antes de integrar, y tener en cuenta lo que reciban antes de seguir. Usa `npm run coord -- status` para ver las reservas.
- Reserva las rutas antes de editarlas (`npm run coord -- claim`). Si una ruta está reservada por otro agente, pídela por mensaje en lugar de editarla.
- `codex` termina con las comprobaciones pasando, `release` de sus reservas y `send codex claude` con el resumen. Cuando se ejecuta con `scripts/sol.sh`, deja los cambios sin commit (su sandbox no escribe en `.git`). `claude` revisa el diff, hace el commit en la rama `codex/<tarea>` e integra con `git -C /home/sk/codes/clasRo merge --ff-only <rama>`.
- Las decisiones de diseño de interfaz las toma `claude`. Si `codex` necesita cambiar una pantalla, implementa la lógica y deja la presentación mínima, o pregunta por el buzón.

## Skills de frontend

Instaladas el 2026-11-19 para mejorar el frontend. Las comparten los dos agentes (las de Claude Code, además, en `.claude/skills/` y en el plugin `expo`):

| Skill | Para qué |
| --- | --- |
| `impeccable` | Dirección de diseño, revisión visual y DESIGN.md. Sigue siendo la referencia principal de diseño. |
| `expo-design-system` | Tokens, convenciones de componentes y desviaciones respecto a DESIGN.md. |
| `expo-native-ui`, `expo-ui` | Pantallas con aspecto nativo y componentes de `@expo/ui`. |
| `expo-animation` | Movimiento y gestos (Reanimated, Gesture Handler). |
| `react-native-best-practices` (Callstack) | Rendimiento: medir antes de optimizar. Clave para la partitura (muchos elementos SVG). |
| `agent-device` (Callstack) | Manejar la app en un emulador o dispositivo y hacer capturas. Necesita el CLI `agent-device` y un dispositivo; en este Linux, solo Android. |

**Regla: las skills orientan; las decisiones confirmadas del proyecto mandan.** Si una skill contradice `AGENTS.md`, `.agents/AGENTS.MD`, `REQUISITOS.md` o `DESIGN.md`, se sigue el proyecto. Conflictos conocidos:

- **Navegación:** la app usa navegación propia en `App.tsx`, no Expo Router. No migrar a Expo Router ni usar `Color` de `expo-router`.
- **Almacenamiento local:** se usa `@react-native-async-storage/async-storage` (paquete de la comunidad). La prohibición de `expo-native-ui` se refiere al antiguo `AsyncStorage` incluido en React Native, no a este paquete.
- **Colores y tipografía:** mandan los tokens de `DESIGN.md`, no los colores semánticos de la plataforma, salvo decisión explícita.
- **Dependencias y arquitectura:** añadir una dependencia (por ejemplo Reanimated, Gesture Handler o `@expo/ui`), cambiar la navegación, el almacenamiento o la estructura de carpetas, o instalar herramientas globales **se consulta antes**. `codex` lo pregunta por el buzón a `claude`, y `claude` se lo pregunta al usuario.
