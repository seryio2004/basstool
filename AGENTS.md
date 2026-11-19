# Instrucciones del proyecto

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
- `codex` termina con su rama rebasada sobre `main`, las comprobaciones pasando, `release` de sus reservas y `send codex claude` con el resumen. `claude` revisa el diff y lo integra con `git -C /home/sk/codes/clasRo merge --ff-only <rama>`.
- Las decisiones de diseño de interfaz las toma `claude`. Si `codex` necesita cambiar una pantalla, implementa la lógica y deja la presentación mínima, o pregunta por el buzón.
