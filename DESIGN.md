---
name: clasRo
description: Sistema visual «vintage / analógico» de la app de estudio para bajistas. Oscuro por defecto, claro opcional.
themes: [dark, light]
source: src/theme/palette.ts
colors:
  dark:
    bg: "#25211E"
    surface: "#2B2521"
    raised: "#322B26"
    sunken: "#231F1C"
    chrome: "#27221E"
    line: "#40362F"
    line-strong: "#594B3F"
    sheen: "#483D33"
    ink: "#D9CCB9"
    muted: "#AA9C8A"
    faint: "#A19482"
    accent: "#BF9B6E"
    on-accent: "#251C14"
    accent-text: "#C4A57B"
    accent-soft: "#3C3227"
    focus: "#B9A58D"
    success: "#5FA58A"
    warning: "#D4844A"
    error: "#E17A6C"
    info: "#9BAEB8"
  light:
    bg: "#EEE7DC"
    surface: "#F2ECE1"
    raised: "#F5EFE6"
    sunken: "#E9E0D3"
    chrome: "#ECE3D7"
    line: "#DACDBB"
    line-strong: "#BAAB95"
    sheen: "#F8F2EA"
    ink: "#493D33"
    muted: "#6B5D4E"
    faint: "#71614F"
    accent: "#805B36"
    on-accent: "#F5EFE6"
    accent-text: "#7D5937"
    accent-soft: "#EDE0CB"
    focus: "#806B55"
    success: "#2F6E57"
    warning: "#92501F"
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
- El botón de bajo en la esquina superior derecha alterna entre oscuro y claro. La silueta del tema oscuro es angular. La del tema claro tiene forma de violín.
- `ThemeProvider` resuelve la preferencia (con `useColorScheme` para «Sistema») y sustituye los tokens vivos (`colors`, `styles`, `grooveColors`). Los componentes memoizados se suscriben al tema para conservar el estado de la pantalla al cambiarlo. En web también actualiza las variables CSS de selección, cursor, foco, barras de desplazamiento y `color-scheme`. En nativo actualiza el estilo de la barra de estado.
- Alias heredados en `colors`: `green` = `accent`, `pale` = `accentSoft`, `white` = `surface` (no es el color blanco). Solo para el código que aún no usa los nombres semánticos.

## Color

| Token | Uso |
| --- | --- |
| `bg` | Fondo de la app: nogal oscuro / papel crema. |
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
| `degrees[0..6]`, `degreeFlat`, `degreeSharp` y `onDegree` | Grados 1–7 del mástil. Rellenos medios con tinta oscura y el número del grado siempre escrito: el color refuerza, no informa solo. La tónica lleva además un aro. Bemoles en rosa y sostenidos en cian, con la alteración escrita también en modo sin color. |
| `wood` / `fret` / `string` / `inlay` | Mástil: palisandro (oscuro) o arce (claro), trastes de níquel, cuerdas de cromo, incrustaciones. |
| `staff`, `keyWhite`, `keyBlack`, `keyContext*` | Pentagramas y pianos de los diagramas y del editor. |
| `wave` / `waveDim` | Pantalla y trazo de la forma de onda. `wavePlayed` distingue lo reproducido. El ámbar marca el bucle y la ventana de la vista general. |
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

La aguja del vúmetro usa un muelle amortiguado. El tren de GrooveTrain avanza linealmente con el pulso. El selector de tema cruza las siluetas en 150 ms y las cambia de inmediato con movimiento reducido. En ese modo, la aguja y el tren también saltan sin animación.

## Disposición

- Barra lateral `chrome` de 240 px a partir de 1000 px, con una cabecera de 48 px para el selector de tema. Por debajo de 1000 px, cabecera de 56 px con marca, Ajustes y selector de tema, y barra inferior con cinco destinos (activo en ámbar con piloto).
- Contenido: máximo 1200 px, padding 20 (móvil) / 40 (escritorio), 24 / 44 arriba.
- **Herramientas:** el afinador como placa principal con su dial; el resto como un rack de filas en una sola placa.
- **Practicar:** cada módulo es una tarjeta pulsable con su par de color; no hay un botón ámbar por tarjeta.
- **Transcribir:** transporte arriba; la mezcla («Qué suena») vive en la sección «Sonido»; la vista y la exportación de la partitura, en «Vista y exportar». La onda mide 132 pt en compacto y 192 pt en escritorio, con tiradores A y B de 44 pt.

## Contraste (WCAG 2.x AA)

Calculado con `contrastRatio` de `src/theme/palette.ts`; `tests/theme.test.ts` falla si algún par baja del mínimo. Texto normal ≥ 4,5. En fondo, placa y superficie elevada, el texto principal queda entre 8 y 11 y el secundario entre 5 y 6,2. Elementos no textuales ≥ 3 (foco, trazos) o el mínimo indicado.

| Par | Oscuro | Ratio | Claro | Ratio | Mínimo |
| --- | --- | --- | --- | --- | --- |
| Texto sobre fondo | `#D9CCB9` / `#25211E` | 10,11 | `#493D33` / `#EEE7DC` | 8,56 | 4,5 |
| Texto sobre placa | `#D9CCB9` / `#2B2521` | 9,56 | `#493D33` / `#F2ECE1` | 8,94 | 4,5 |
| Texto sobre elevada | `#D9CCB9` / `#322B26` | 8,80 | `#493D33` / `#F5EFE6` | 9,19 | 4,5 |
| Secundario sobre fondo | `#AA9C8A` / `#25211E` | 5,96 | `#6B5D4E` / `#EEE7DC` | 5,18 | 4,5 |
| Secundario sobre placa | `#AA9C8A` / `#2B2521` | 5,64 | `#6B5D4E` / `#F2ECE1` | 5,41 | 4,5 |
| Secundario sobre elevada | `#AA9C8A` / `#322B26` | 5,19 | `#6B5D4E` / `#F5EFE6` | 5,57 | 4,5 |
| Marcador sobre pozo | `#A19482` / `#231F1C` | 5,51 | `#71614F` / `#E9E0D3` | 4,56 | 4,5 |
| Secundario sobre selección suave | `#AA9C8A` / `#3C3227` | 4,67 | `#6B5D4E` / `#EDE0CB` | 4,89 | 4,5 |
| Secundario sobre cabecera | `#AA9C8A` / `#27221E` | 5,87 | `#6B5D4E` / `#ECE3D7` | 5,01 | 4,5 |
| Marcas sobre onda | `#AA9C8A` / `#231F1C` | 6,10 | `#6B5D4E` / `#E9E0D3` | 4,87 | 4,5 |
| Texto del tirador de compás | `#D9CCB9` / `#322B26` | 8,80 | `#493D33` / `#F5EFE6` | 9,19 | 4,5 |
| Marcador sobre campo | `#A19482` / `#2B2521` | 5,09 | `#71614F` / `#F2ECE1` | 5,07 | 4,5 |
| Texto sobre botón principal | `#251C14` / `#BF9B6E` | 6,48 | `#F5EFE6` / `#805B36` | 5,30 | 4,5 |
| Ámbar como texto sobre placa | `#C4A57B` / `#2B2521` | 6,49 | `#7D5937` / `#F2ECE1` | 5,32 | 4,5 |
| Ámbar como texto sobre fondo | `#C4A57B` / `#25211E` | 6,86 | `#7D5937` / `#EEE7DC` | 5,09 | 4,5 |
| Ámbar sobre selección suave | `#C4A57B` / `#3C3227` | 5,37 | `#7D5937` / `#EDE0CB` | 4,80 | 4,5 |
| Texto sobre selección suave | `#D9CCB9` / `#3C3227` | 7,92 | `#493D33` / `#EDE0CB` | 8,07 | 4,5 |
| Éxito sobre placa | `#5FA58A` / `#2B2521` | 5,21 | `#2F6E57` / `#F2ECE1` | 5,12 | 4,5 |
| Éxito sobre su fondo | `#5FA58A` / `#1C2A23` | 5,15 | `#2F6E57` / `#E2EFE8` | 5,09 | 4,5 |
| Aviso sobre placa | `#D4844A` / `#2B2521` | 5,18 | `#92501F` / `#F2ECE1` | 5,27 | 4,5 |
| Aviso sobre su fondo | `#D4844A` / `#33231A` | 5,16 | `#92501F` / `#F6E5D6` | 5,04 | 4,5 |
| Error sobre placa | `#E17A6C` / `#2B2521` | 5,18 | `#B23A2B` / `#F2ECE1` | 5,06 | 4,5 |
| Error sobre su fondo | `#E17A6C` / `#3A1F1A` | 5,18 | `#B23A2B` / `#F8E1DC` | 4,75 | 4,5 |
| Información sobre placa | `#9BAEB8` / `#2B2521` | 6,58 | `#3C6880` / `#F2ECE1` | 5,13 | 4,5 |
| Información sobre su fondo | `#9BAEB8` / `#1D2830` | 6,54 | `#3C6880` / `#E1ECF2` | 5,02 | 4,5 |
| Módulo groove | `#C4A57B` / `#3C3227` | 5,37 | `#7D5937` / `#EDE0CB` | 4,80 | 4,5 |
| Módulo chord | `#5FA58A` / `#1C2A23` | 5,15 | `#2F6E57` / `#E2EFE8` | 5,09 | 4,5 |
| Módulo notes | `#D4844A` / `#33231A` | 5,16 | `#92501F` / `#F6E5D6` | 5,04 | 4,5 |
| Módulo intervals | `#B497C6` / `#2D2233` | 5,89 | `#7A5690` / `#EEE5F3` | 4,81 | 4,5 |
| Módulo reading | `#6FAAB9` / `#1B2A2E` | 5,73 | `#33707F` / `#E0EEF1` | 4,69 | 4,5 |
| Función T | `#5FA58A` / `#1C2A23` | 5,15 | `#2F6E57` / `#E2EFE8` | 5,09 | 4,5 |
| Función S | `#8FB3C9` / `#1D2830` | 6,76 | `#3C6880` / `#E1ECF2` | 5,02 | 4,5 |
| Función D | `#D4844A` / `#33231A` | 5,16 | `#92501F` / `#F6E5D6` | 5,04 | 4,5 |
| Función Dsec | `#B497C6` / `#2D2233` | 5,89 | `#7A5690` / `#EEE5F3` | 4,81 | 4,5 |
| Grado 1 | `#1A120A` / `#BF9B6E` | 7,16 | `#1A120A` / `#BF9B6E` | 7,16 | 4,5 |
| Grado 2 | `#1A120A` / `#8FB3C9` | 8,34 | `#1A120A` / `#8FB3C9` | 8,34 | 4,5 |
| Grado 3 | `#1A120A` / `#6CC3A0` | 8,77 | `#1A120A` / `#6CC3A0` | 8,77 | 4,5 |
| Grado 4 | `#1A120A` / `#E9D66B` | 12,60 | `#1A120A` / `#E9D66B` | 12,60 | 4,5 |
| Grado 5 | `#1A120A` / `#E07B5F` | 6,32 | `#1A120A` / `#E07B5F` | 6,32 | 4,5 |
| Grado 6 | `#1A120A` / `#C19AD6` | 7,81 | `#1A120A` / `#C19AD6` | 7,81 | 4,5 |
| Grado 7 | `#1A120A` / `#A9C46A` | 9,51 | `#1A120A` / `#A9C46A` | 9,51 | 4,5 |
| Foco sobre placa (no texto) | `#B9A58D` / `#2B2521` | 6,36 | `#806B55` / `#F2ECE1` | 4,30 | 3 |
| Borde de campo sobre placa (no texto) | `#594B3F` / `#25211E` | 1,90 | `#BAAB95` / `#EEE7DC` | 1,83 | 1,5 |
| Trazo de onda sobre pantalla | `#8A7B6D` / `#231F1C` | 4,00 | `#897967` / `#E9E0D3` | 3,22 | 3 |
| Trazo reproducido sobre pantalla | `#A99A86` / `#231F1C` | 5,96 | `#685B4C` / `#E9E0D3` | 5,04 | 3 |
| Nombre sobre tecla blanca | `#231F1C` / `#E9DCC4` | 12,07 | `#2A2119` / `#F2ECE1` | 13,43 | 4,5 |
| Nombre sobre tecla de contexto | `#231F1C` / `#D9B97A` | 8,70 | `#2A2119` / `#EDE0CB` | 12,12 | 4,5 |
| Cuerdas sobre madera | `#B8AE9E` / `#2A1D14` | 7,46 | `#6E5F4C` / `#E9DCC6` | 4,56 | 3 |
| GrooveTrain: texto sobre escenario | `#E1D5C3` / `#2E2112` | 10,81 | `#493D33` / `#F0C877` | 6,62 | 4,5 |
| GrooveTrain: texto sobre resalte | `#E1D5C3` / `#17120E` | 12,85 | `#493D33` / `#F2ECE1` | 8,94 | 4,5 |
| GrooveTrain: texto sobre pulsado | `#E1D5C3` / `#2F5E4C` | 5,13 | `#493D33` / `#7FB89E` | 4,63 | 4,5 |
| GrooveTrain: casilla 1 | `#E1D5C3` / `#5A3F1E` | 6,70 | `#493D33` / `#E9B95E` | 5,79 | 4,5 |
| GrooveTrain: casilla 2 | `#E1D5C3` / `#2F4A3F` | 6,68 | `#493D33` / `#9FCDB8` | 5,95 | 4,5 |
| GrooveTrain: casilla 3 | `#E1D5C3` / `#5A3A2A` | 7,00 | `#493D33` / `#E5A989` | 5,19 | 4,5 |
| GrooveTrain: casilla 4 | `#E1D5C3` / `#43344F` | 7,87 | `#493D33` / `#C9B3DA` | 5,48 | 4,5 |
| GrooveTrain: casilla 5 | `#E1D5C3` / `#2C4750` | 6,83 | `#493D33` / `#9FC6D1` | 5,74 | 4,5 |
| GrooveTrain: casilla 6 | `#E1D5C3` / `#4A3A22` | 7,56 | `#493D33` / `#EBCB8B` | 6,73 | 4,5 |
| GrooveTrain: casilla 7 | `#E1D5C3` / `#3B4A2E` | 6,58 | `#493D33` / `#B9CF9A` | 6,23 | 4,5 |
| GrooveTrain: casilla 8 | `#E1D5C3` / `#503040` | 7,89 | `#493D33` / `#DDA9B5` | 5,21 | 4,5 |
