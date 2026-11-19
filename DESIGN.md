---
name: clasRo
description: Sistema visual «vintage / analógico» de la app de estudio para bajistas. Oscuro por defecto, claro opcional.
themes: [dark, light]
source: src/theme/palette.ts
colors:
  dark:
    bg: "#17120E"
    surface: "#221A14"
    raised: "#2C231B"
    sunken: "#120E0B"
    chrome: "#1B1511"
    line: "#3A2F25"
    line-strong: "#54453A"
    sheen: "#4A3C2F"
    ink: "#F1E6D2"
    muted: "#B9A88E"
    faint: "#9C8B72"
    accent: "#E8A33D"
    on-accent: "#1A120A"
    accent-text: "#E8A33D"
    accent-soft: "#3A2A16"
    focus: "#F4C46B"
    success: "#5FA58A"
    warning: "#D4844A"
    error: "#E06B5B"
    info: "#8FB3C9"
  light:
    bg: "#F6EFE3"
    surface: "#FFFBF4"
    raised: "#FFFFFF"
    sunken: "#EFE5D4"
    chrome: "#EFE6D6"
    line: "#E2D4BE"
    line-strong: "#C9B79C"
    sheen: "#FFFFFF"
    ink: "#2A2119"
    muted: "#6E5F4C"
    faint: "#7D6D58"
    accent: "#94580A"
    on-accent: "#FFFBF4"
    accent-text: "#8A520A"
    accent-soft: "#F3E2C2"
    focus: "#A8670F"
    success: "#2F6E57"
    warning: "#9A5420"
    error: "#B23A2B"
    info: "#3C6880"
typography:
  display: "Fraunces (OFL), 600"
  body: "IBM Plex Sans (OFL)"
  data: "IBM Plex Mono (OFL), cifras tabulares"
  title: { fontFamily: display, fontSize: 32px, lineHeight: 38px, letterSpacing: -0.6px }
  h2: { fontFamily: display, fontSize: 22px, lineHeight: 28px, letterSpacing: -0.3px }
  h3: { fontFamily: body, fontSize: 16px, lineHeight: 22px, fontWeight: 600 }
  text: { fontFamily: body, fontSize: 15px, lineHeight: 23px }
  muted: { fontFamily: body, fontSize: 14px, lineHeight: 21px }
  legend: { fontFamily: body, fontSize: 12px, fontWeight: 600, letterSpacing: 0.6px, textTransform: uppercase }
  data: { fontFamily: data, fontWeight: 600, fontVariant: tabular-nums }
rounded: { badge: 6px, chip: 8px, control: 10px, panel: 14px }
spacing: { xs: 4px, s: 8px, m: 12px, l: 16px, xl: 24px, xxl: 32px, xxxl: 48px, page-compact: 20px, page-desktop: 40px }
---

# Sistema visual: clasRo

Sustituye al sistema anterior (verde sobre blanco). Decisión del usuario del 2026-11-19: estética **vintage / analógica** —ampli de válvulas, madera, cromo y crema—, **oscuro por defecto** y claro opcional.

## Principios

- **El instrumento manda.** Materiales del mundo del bajista (placas de ampli, madera del diapasón, cromo de las cuerdas, pilotos ámbar) y ninguna textura genérica.
- **Una acción principal por pantalla**, en ámbar. Las secundarias van en botones de placa, en «Más» o en secciones plegadas.
- **Aire.** Grupos apretados, separación generosa entre bloques, más espacio encima de un título que debajo.
- **Nada de colores sueltos.** Todo color sale de `src/theme/palette.ts` a través de `colors` (`src/components/theme.tsx`). Las pruebas (`tests/theme.test.ts`) comprueban el contraste AA de ambos temas.

## Temas

- Preferencia en **Ajustes › Apariencia**: «Oscuro (por defecto)», «Claro» o «Sistema». Se guarda en el perfil local (`profile.theme`); con cuenta, sigue siendo una preferencia del dispositivo y no se sincroniza.
- `ThemeProvider` resuelve la preferencia (con `useColorScheme` para «Sistema»), sustituye los tokens vivos (`colors`, `styles`, `grooveColors`) y vuelve a montar el contenido, de modo que los SVG (mástil, partitura, tablatura, forma de onda, diagramas, tren) se pintan con el tema nuevo. En web actualiza además las variables CSS de selección, cursor, foco, barras de desplazamiento y `color-scheme`; en nativo, el estilo de la barra de estado.
- Alias heredados en `colors`: `green` = `accent`, `pale` = `accentSoft`, `white` = `surface` (no es el color blanco). Solo para el código que aún no usa los nombres semánticos.

## Color

| Token | Uso |
| --- | --- |
| `bg` | Fondo de la app: nogal casi negro / papel crema. |
| `surface` | Placas: paneles, tarjetas, campos sobre la placa. |
| `raised` | Botones secundarios, opciones sin seleccionar, menús «Más». |
| `sunken` | Pozos: campos de texto, vúmetro, contador de cinta, pistas. |
| `chrome` | Barra lateral, cabecera móvil y barra inferior. |
| `line` / `lineStrong` | Divisores y bordes; `lineStrong` para campos y botones de placa. |
| `sheen` | Filo de luz de 1 px en el borde superior de las placas. |
| `ink` / `muted` / `faint` | Texto principal, secundario y de ayuda o marcador. |
| `accent` + `onAccent` | Ámbar válvula: acción principal, selección, cursor, piloto activo. |
| `accentText` | Ámbar como texto o icono sobre placas y fondo. |
| `accentSoft` | Selección suave: navegación activa, zona del bucle, hover. |
| `focus` | Anillo de foco (2 px, separación 3 px en web). |
| `success` / `warning` / `error` / `info` (+ `Soft`) | Estados: afinado y acierto en jade, aviso cobre, error, información azul cromo. |
| `modules.*` | Pares tinta/fondo: GrooveTrain ámbar, ChordLine (tren de acordes) jade, Notas cobre, Intervalos ciruela, Lectura azul petróleo. `moduleTone(id)` los devuelve. |
| `functions.*` | Funciones armónicas T, S, D y dominante secundaria en los diagramas. |
| `degrees[0..6]` + `onDegree` | Grados 1–7 del mástil. Rellenos medios con tinta oscura y el número del grado siempre escrito: el color refuerza, no informa solo. La tónica lleva además un aro. |
| `wood` / `fret` / `string` / `inlay` | Mástil: palisandro (oscuro) o arce (claro), trastes de níquel, cuerdas de cromo, incrustaciones. |
| `staff`, `keyWhite`, `keyBlack`, `keyContext*` | Pentagramas y pianos de los diagramas y del editor. |
| `wave` / `waveDim` | Pantalla de la forma de onda y su trazo sin reproducir (lo reproducido va en `accent`). |
| `groove.*` | Mundo propio de GrooveTrain (escenario, casillas, tren). En oscuro, `ink` es crema y `cream` es el resalte oscuro: los nombres se conservan por compatibilidad. |

## Tipografía

- **Títulos:** Fraunces 600 (serif con carácter de rótulo antiguo). Solo `title` y `h2`, la marca y la nota del afinador.
- **Interfaz:** IBM Plex Sans en todo lo demás.
- **Datos:** IBM Plex Mono con cifras tabulares, solo para medidas: BPM, cents, tiempo, porcentajes, números de compás. Nunca como adorno.
- **Rótulos de panel** (`legend`): versalitas de 12 px con espaciado, como la serigrafía de un ampli. Sustituyen a las etiquetas en negrita de los grupos de opciones.
- Archivos OFL en `assets/fonts` con su licencia. En web se registran con `@font-face` desde `src/platform/fonts.web.ts` (y `[dir=auto]` hereda la sans). **En iOS y Android no se cargan todavía**: `expo-font` no está instalado y requiere aprobación; mientras tanto `src/platform/fonts.ts` usa Georgia/serif para títulos, la sans del sistema y Menlo/monospace para datos.

## Materiales y componentes

- **Placa** (`styles.panel`): `surface`, borde `line` de 1 px con filo superior `sheen`, radio 14, padding 24. Sin sombras.
- **Botón** principal: `accent` con `onAccent`, alto 48 (pequeño 38), radio 10. Secundario: placa `raised` con borde `lineStrong` y texto `ink`. Fantasma: texto `accentText`. Peligro: texto `error`. Hover con `accentSoft`; pulsado 0,7; desactivado 0,45.
- **Chips** (`role=radiogroup`): seleccionado en `accent`; el resto, `raised` con borde `line`.
- **Interruptor de palanca** (`Toggle`, `role=switch`) para conmutadores binarios (p. ej. zurdo).
- **«Más»** (`MoreMenu`): divulgación en el flujo, sin capas, para acciones secundarias (vista y exportación de la partitura, afinación y referencia del afinador, escribir el tempo).
- **Mando giratorio** (`Knob`): tempo del metrónomo. Arrastre vertical u horizontal, rueda, flechas, Re Pág/Av Pág, Inicio/Fin; control ajustable para lectores de pantalla.
- **Vúmetro** del afinador: escala de −50 a +50 cents en un pozo `sunken`, zona de afinado en jade y aguja con inercia de galvanómetro. Sin señal, la aguja reposa en el tope izquierdo.
- **Contador de cinta** en Transcribir: cada cifra del tiempo en su ventanilla, en Plex Mono.
- **Pilotos:** la marca es un piloto ámbar encendido; la pestaña activa de la barra inferior lleva un piloto encima; los pulsos del metrónomo se encienden como pilotos.
- **Mástil:** madera, trastes, cuerdas de grosor creciente y casillas por grado. Toda la superficie táctil sigue siendo de 44 pt.

## Movimiento

Un único movimiento con autoría: **la aguja del vúmetro** (muelle amortiguado). El tren de GrooveTrain avanza linealmente con el pulso. El resto son transiciones de 150 ms de color u opacidad en web. Con movimiento reducido, la aguja y el tren saltan sin animación.

## Disposición

- Barra lateral `chrome` de 240 px a partir de 1000 px; por debajo, cabecera de 56 px con la marca y Ajustes, y barra inferior con cinco destinos (activo en ámbar con piloto).
- Contenido: máximo 1200 px, padding 20 (móvil) / 40 (escritorio), 24 / 44 arriba.
- **Herramientas:** el afinador como placa principal con su dial; el resto como un rack de filas en una sola placa.
- **Practicar:** cada módulo es una tarjeta pulsable con su par de color; no hay un botón ámbar por tarjeta.
- **Transcribir:** transporte arriba; la mezcla («Qué suena») vive en la sección «Sonido»; la vista y la exportación de la partitura, en «Vista y exportar».

## Contraste (WCAG 2.x AA)

Calculado con `contrastRatio` de `src/theme/palette.ts`; `tests/theme.test.ts` falla si algún par baja del mínimo. Texto normal ≥ 4,5; elementos no textuales ≥ 3 (foco, trazos) o el mínimo indicado.

| Par | Oscuro | Ratio | Claro | Ratio | Mínimo |
| --- | --- | --- | --- | --- | --- |
| Texto sobre fondo | `#F1E6D2` / `#17120E` | 15,04 | `#2A2119` / `#F6EFE3` | 13,82 | 4,5 |
| Texto sobre placa | `#F1E6D2` / `#221A14` | 13,86 | `#2A2119` / `#FFFBF4` | 15,31 | 4,5 |
| Texto sobre elevada | `#F1E6D2` / `#2C231B` | 12,46 | `#2A2119` / `#FFFFFF` | 15,79 | 4,5 |
| Secundario sobre fondo | `#B9A88E` / `#17120E` | 8,02 | `#6E5F4C` / `#F6EFE3` | 5,40 | 4,5 |
| Secundario sobre placa | `#B9A88E` / `#221A14` | 7,39 | `#6E5F4C` / `#FFFBF4` | 5,98 | 4,5 |
| Marcador sobre campo | `#9C8B72` / `#221A14` | 5,18 | `#7D6D58` / `#FFFBF4` | 4,85 | 4,5 |
| Texto sobre botón principal | `#1A120A` / `#E8A33D` | 8,58 | `#FFFBF4` / `#94580A` | 5,56 | 4,5 |
| Ámbar como texto sobre placa | `#E8A33D` / `#221A14` | 7,94 | `#8A520A` / `#FFFBF4` | 6,18 | 4,5 |
| Ámbar como texto sobre fondo | `#E8A33D` / `#17120E` | 8,62 | `#8A520A` / `#F6EFE3` | 5,58 | 4,5 |
| Ámbar sobre selección suave | `#E8A33D` / `#3A2A16` | 6,39 | `#8A520A` / `#F3E2C2` | 5,00 | 4,5 |
| Texto sobre selección suave | `#F1E6D2` / `#3A2A16` | 11,16 | `#2A2119` / `#F3E2C2` | 12,38 | 4,5 |
| Éxito sobre placa | `#5FA58A` / `#221A14` | 5,90 | `#2F6E57` / `#FFFBF4` | 5,83 | 4,5 |
| Éxito sobre su fondo | `#5FA58A` / `#1C2A23` | 5,15 | `#2F6E57` / `#E2EFE8` | 5,09 | 4,5 |
| Aviso sobre placa | `#D4844A` / `#221A14` | 5,87 | `#9A5420` / `#FFFBF4` | 5,56 | 4,5 |
| Aviso sobre su fondo | `#D4844A` / `#33231A` | 5,16 | `#9A5420` / `#F6E5D6` | 4,67 | 4,5 |
| Error sobre placa | `#E06B5B` / `#221A14` | 5,24 | `#B23A2B` / `#FFFBF4` | 5,76 | 4,5 |
| Error sobre su fondo | `#E06B5B` / `#3A1F1A` | 4,62 | `#B23A2B` / `#F8E1DC` | 4,75 | 4,5 |
| Información sobre placa | `#8FB3C9` / `#221A14` | 7,72 | `#3C6880` / `#FFFBF4` | 5,84 | 4,5 |
| Información sobre su fondo | `#8FB3C9` / `#1D2830` | 6,76 | `#3C6880` / `#E1ECF2` | 5,02 | 4,5 |
| Módulo groove | `#E8A33D` / `#3A2A16` | 6,39 | `#8A520A` / `#F3E2C2` | 5,00 | 4,5 |
| Módulo chord | `#5FA58A` / `#1C2A23` | 5,15 | `#2F6E57` / `#E2EFE8` | 5,09 | 4,5 |
| Módulo notes | `#D4844A` / `#33231A` | 5,16 | `#9A5420` / `#F6E5D6` | 4,67 | 4,5 |
| Módulo intervals | `#B497C6` / `#2D2233` | 5,89 | `#7A5690` / `#EEE5F3` | 4,81 | 4,5 |
| Módulo reading | `#6FAAB9` / `#1B2A2E` | 5,73 | `#33707F` / `#E0EEF1` | 4,69 | 4,5 |
| Función T | `#5FA58A` / `#1C2A23` | 5,15 | `#2F6E57` / `#E2EFE8` | 5,09 | 4,5 |
| Función S | `#8FB3C9` / `#1D2830` | 6,76 | `#3C6880` / `#E1ECF2` | 5,02 | 4,5 |
| Función D | `#D4844A` / `#33231A` | 5,16 | `#9A5420` / `#F6E5D6` | 4,67 | 4,5 |
| Función Dsec | `#B497C6` / `#2D2233` | 5,89 | `#7A5690` / `#EEE5F3` | 4,81 | 4,5 |
| Grado 1 | `#1A120A` / `#E8A33D` | 8,58 | `#1A120A` / `#E8A33D` | 8,58 | 4,5 |
| Grado 2 | `#1A120A` / `#8FB3C9` | 8,34 | `#1A120A` / `#8FB3C9` | 8,34 | 4,5 |
| Grado 3 | `#1A120A` / `#6CC3A0` | 8,77 | `#1A120A` / `#6CC3A0` | 8,77 | 4,5 |
| Grado 4 | `#1A120A` / `#E9D66B` | 12,60 | `#1A120A` / `#E9D66B` | 12,60 | 4,5 |
| Grado 5 | `#1A120A` / `#E07B5F` | 6,32 | `#1A120A` / `#E07B5F` | 6,32 | 4,5 |
| Grado 6 | `#1A120A` / `#C19AD6` | 7,81 | `#1A120A` / `#C19AD6` | 7,81 | 4,5 |
| Grado 7 | `#1A120A` / `#A9C46A` | 9,51 | `#1A120A` / `#A9C46A` | 9,51 | 4,5 |
| Foco sobre placa (no texto) | `#F4C46B` / `#221A14` | 10,57 | `#A8670F` / `#FFFBF4` | 4,41 | 3 |
| Borde de campo sobre placa (no texto) | `#54453A` / `#17120E` | 2,03 | `#C9B79C` / `#F6EFE3` | 1,71 | 1,5 |
| Trazo de onda sobre pantalla | `#E8A33D` / `#120E0B` | 8,91 | `#94580A` / `#EFE5D4` | 4,60 | 3 |
| Nombre sobre tecla blanca | `#120E0B` / `#E9DCC4` | 14,18 | `#2A2119` / `#FFFBF4` | 15,31 | 4,5 |
| Nombre sobre tecla de contexto | `#120E0B` / `#D9B97A` | 10,22 | `#2A2119` / `#F3E2C2` | 12,38 | 4,5 |
| Cuerdas sobre madera | `#B8AE9E` / `#2A1D14` | 7,46 | `#6E5F4C` / `#E9DCC6` | 4,56 | 3 |
| GrooveTrain: texto sobre escenario | `#F1E6D2` / `#2E2112` | 12,66 | `#2A2119` / `#F0C877` | 9,95 | 4,5 |
| GrooveTrain: texto sobre resalte | `#F1E6D2` / `#17120E` | 15,04 | `#2A2119` / `#FFFBF4` | 15,31 | 4,5 |
| GrooveTrain: texto sobre pulsado | `#F1E6D2` / `#2F5E4C` | 6,01 | `#2A2119` / `#7FB89E` | 6,96 | 4,5 |
| GrooveTrain: casilla 1 | `#F1E6D2` / `#5A3F1E` | 7,85 | `#2A2119` / `#E9B95E` | 8,70 | 4,5 |
| GrooveTrain: casilla 2 | `#F1E6D2` / `#2F4A3F` | 7,82 | `#2A2119` / `#9FCDB8` | 8,95 | 4,5 |
| GrooveTrain: casilla 3 | `#F1E6D2` / `#5A3A2A` | 8,19 | `#2A2119` / `#E5A989` | 7,80 | 4,5 |
| GrooveTrain: casilla 4 | `#F1E6D2` / `#43344F` | 9,22 | `#2A2119` / `#C9B3DA` | 8,23 | 4,5 |
| GrooveTrain: casilla 5 | `#F1E6D2` / `#2C4750` | 8,00 | `#2A2119` / `#9FC6D1` | 8,63 | 4,5 |
| GrooveTrain: casilla 6 | `#F1E6D2` / `#4A3A22` | 8,85 | `#2A2119` / `#EBCB8B` | 10,11 | 4,5 |
| GrooveTrain: casilla 7 | `#F1E6D2` / `#3B4A2E` | 7,71 | `#2A2119` / `#B9CF9A` | 9,36 | 4,5 |
| GrooveTrain: casilla 8 | `#F1E6D2` / `#503040` | 9,24 | `#2A2119` / `#DDA9B5` | 7,83 | 4,5 |
