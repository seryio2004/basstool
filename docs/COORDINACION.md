# Trabajo simultáneo de varios agentes

Claude Code y Codex pueden trabajar a la vez sin pisarse. Se apoyan en tres piezas:

1. **Un worktree de git por agente.** Cada agente tiene su propia carpeta y su rama, así que nunca edita la misma copia de los archivos que el otro.
2. **Reservas de rutas** antes de editar, para detectar choques antes de que ocurran.
3. **Un buzón de mensajes** compartido entre agentes.

Las reservas y los mensajes se guardan en `.git/coord/`. Todos los worktrees comparten el mismo `.git`, así que ambos agentes ven lo mismo, y nada de esto entra en los commits.

## Carpetas

| Carpeta | Rama | Quién |
| --- | --- | --- |
| `/home/sk/codes/clasRo` | `main` | Integración. Ningún agente edita aquí. |
| `/home/sk/codes/clasRo-claude` | `claude/<tarea>` | Claude Code |
| `/home/sk/codes/clasRo-codex` | `codex/<tarea>` | Codex |

Abre cada agente en **su** carpeta: VS Code o la terminal de Claude Code en `clasRo-claude`, y Codex en `clasRo-codex`.

Para crearlas (ya están creadas; esto es por si hay que rehacerlas):

```bash
cd /home/sk/codes/clasRo
git worktree add --detach ../clasRo-claude main
git worktree add --detach ../clasRo-codex main
(cd ../clasRo-claude && npm ci)
(cd ../clasRo-codex && npm ci)
```

Cada worktree tiene su propio `node_modules`. Para que dos servidores no choquen, cada agente usa su puerto: Claude `npx expo start --web --port 8082` y Codex `--port 8083`.

## Ciclo de una tarea

Sustituye `<yo>` por `claude` o `codex`.

```bash
# 1. Al empezar: leer mensajes y ver qué está reservado
npm run coord -- inbox <yo>
npm run coord -- status

# 2. Rama nueva desde main y reserva de lo que vas a tocar
git switch -c <yo>/tarea-5 main
npm run coord -- claim <yo> tarea-5 src/components/ui.tsx src/core/music.ts src/screens/Exercise.tsx

# 3. Trabajar con commits pequeños. Antes de tocar un archivo no reservado:
npm run coord -- who src/screens/Tools.tsx     # «Libre» o quién lo tiene
npm run coord -- claim <yo> tarea-5 src/screens/Tools.tsx

# 4. Integrar en main
git rebase main
npm run typecheck && npm test && npm run build
git -C /home/sk/codes/clasRo merge --ff-only <yo>/tarea-5

# 5. Avisar y liberar
npm run coord -- release <yo> tarea-5
npm run coord -- send <yo> all "Integrada tarea-5 en main (clave de fa y tablatura). Haced rebase."
```

Cuando llega un aviso de integración, el otro agente hace `git rebase main` en su rama en cuanto termine el paso en el que esté.

Si `merge --ff-only` falla, es que `main` ha avanzado: repite el paso 4. Nunca se usa `--force` ni se reescribe `main`.

## Reglas

- **Reservar antes de editar.** Si una ruta está reservada por el otro, se le pide por mensaje en lugar de editarla. Una reserva de carpeta cubre todo lo que contiene.
- **Archivos compartidos** (`App.tsx`, `src/components/ui.tsx`, `src/core/types.ts`, `package.json`, `package-lock.json`): reservarlos solo el tiempo necesario y mencionarlo en el mensaje de integración. Para añadir una dependencia, avisar antes por mensaje.
- **`docs/TAREAS.md`:** su tabla de estado solo se actualiza en el commit que se integra en `main`.
- **Conflictos de rebase:** cada agente resuelve los de su rama. Si el conflicto está en código que el otro acaba de integrar y no está claro, hay que preguntarle antes de resolverlo.
- **Mensajes breves y accionables:** qué ha cambiado, qué archivos y qué necesitas del otro. Las decisiones de producto no se toman entre agentes: se anotan en `REQUISITOS.md` como pendientes y se le preguntan al usuario.
- **Reservas abandonadas:** si un agente deja una reserva olvidada, el usuario puede liberarla con `npm run coord -- release <agente>`.

## Comandos

```text
npm run coord -- status                          Reservas activas y mensajes sin leer
npm run coord -- inbox <agente> [--peek]         Mensajes nuevos (--peek no los marca como leídos)
npm run coord -- send <de> <para|all> <texto>    Enviar un mensaje
npm run coord -- log [n]                         Últimos n mensajes
npm run coord -- claim <agente> <tarea> <ruta>…  Reservar rutas
npm run coord -- release <agente> [tarea]        Liberar reservas
npm run coord -- who <ruta>                      Quién tiene una ruta
```

Tú también puedes escribir a los agentes: `npm run coord -- send usuario all "…"`.
