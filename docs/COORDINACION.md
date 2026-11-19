# Trabajo simultáneo de varios agentes

Claude Code y Codex pueden trabajar a la vez sin pisarse. Se apoyan en tres piezas:

1. **Un worktree de git por agente.** Cada agente tiene su propia carpeta y su rama, así que nunca edita la misma copia de los archivos que el otro.
2. **Reservas de rutas** antes de editar, para detectar choques antes de que ocurran.
3. **Un buzón de mensajes** compartido entre agentes.

Las reservas y los mensajes se guardan en `.git/coord/`. Todos los worktrees comparten el mismo `.git`, así que ambos agentes ven lo mismo, y nada de esto entra en los commits.

## Carpetas

| Carpeta | Rama | Quién |
| --- | --- | --- |
| `/home/sk/codes/clasRo` | `main` | Integración: solo Claude integra aquí, con `merge --ff-only`. |
| `/home/sk/codes/clasRo-claude` | `claude/<tarea>` | Claude Code |
| `/home/sk/codes/clasRo-codex` | `codex/<tarea>` | Codex (Sol 6.1) |

## Papeles

- **Claude (Opus 5.5)** coordina: diseño de interfaz, requisitos, tareas, revisión e integración en `main`.
- **Sol 6.1 (Codex)** es el subagente de implementación técnica: lógica y audio, algoritmos, módulos nativos y pruebas. Entrega ramas listas; no integra.

## Delegar en Sol 6.1

Claude escribe el encargo en un archivo (objetivo, contexto, alcance, fuera de alcance, criterios de aceptación) y lo lanza en segundo plano:

```bash
scripts/sol.sh tarea-5 /ruta/al/encargo.md
```

El script prepara la rama `codex/tarea-5` en `clasRo-codex` y ejecuta `codex exec` sin interacción, con sandbox de escritura limitado al worktree y a `.git`. El resumen final queda en `.git/coord/sol/tarea-5.md`. Claude revisa el diff (`git diff main...codex/tarea-5`), pide cambios por buzón o con un nuevo encargo, e integra.

También puedes abrir Codex tú directamente en `clasRo-codex`; las reglas son las mismas.

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

# 4. Dejar la rama lista
git rebase main
npm run typecheck && npm test && npm run build

# 5a. Codex: liberar y avisar a Claude (no integra)
npm run coord -- release codex tarea-5
npm run coord -- send codex claude "tarea-5 lista en codex/tarea-5: clave de fa y tablatura."

# 5b. Claude: revisar e integrar (también sus propias ramas)
git diff main...codex/tarea-5
git -C /home/sk/codes/clasRo merge --ff-only codex/tarea-5
npm run coord -- send claude all "Integrada tarea-5 en main. Haced rebase."
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

## Recepción de mensajes

- **Claude Code** los recibe solo: `.claude/settings.json` ejecuta `inbox claude --hook` al empezar la sesión y con cada mensaje tuyo. Si no hay nada, no muestra nada; si hay mensajes, los añade al contexto y los marca como leídos.
- **Codex** no tiene ese hook: `AGENTS.md` le obliga a ejecutar `npm run coord -- inbox codex` al empezar cada turno, antes de cada commit y antes de integrar.

Tú también puedes escribir a los agentes: `npm run coord -- send usuario all "…"`.
