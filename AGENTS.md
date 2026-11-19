# Instrucciones del proyecto

Leer y aplicar [.agents/AGENTS.MD](.agents/AGENTS.MD) como guía de trabajo para todo este repositorio.

Consultar [REQUISITOS.md](REQUISITOS.md) para el detalle funcional, las prioridades y los criterios de aceptación. Mantener la distinción entre decisiones confirmadas, propuestas y cuestiones pendientes.

## Trabajo simultáneo con otros agentes (obligatorio)

En este repositorio trabajan varios agentes a la vez (`claude` y `codex`). Sigue [docs/COORDINACION.md](docs/COORDINACION.md):

- Trabaja solo en tu worktree (`../clasRo-claude` o `../clasRo-codex`) y en una rama `<agente>/<tarea>`. No edites nunca la carpeta `clasRo` (rama `main`).
- Al empezar cada sesión y antes de integrar, ejecuta `npm run coord -- inbox <agente>` y `npm run coord -- status`.
- Reserva las rutas antes de editarlas (`npm run coord -- claim`). Si una ruta está reservada por otro agente, pídela por mensaje en lugar de editarla.
- Para integrar: `git rebase main`, comprobaciones, `git -C /home/sk/codes/clasRo merge --ff-only <rama>`, después `release` y un mensaje `send <agente> all` con el resumen.
