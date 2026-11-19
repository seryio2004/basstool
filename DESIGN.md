---
name: clasRo
description: Sistema visual implementado de la aplicación de enseñanza y práctica musical.
colors:
  green: "#295E43"
  pale: "#E8EFE7"
  ink: "#202E26"
  muted: "#657168"
  line: "#E2E7DF"
  bg: "#F8F9F6"
  white: "#FFFFFF"
  error: "#A33131"
  field-border: "#C8D1C7"
  placeholder: "#727D73"
  chip-bg: "#F1F3EE"
  chip-hover: "#EDF1EA"
  nav-bg: "#F0F3EC"
  nav-selected: "#DDE8D5"
  nav-hover: "#E8EDE2"
  nav-active-ink: "#2D5738"
  nav-ink: "#5E6B59"
  groove-ink: "#191A1D"
  groove-stage: "#F7DB16"
  groove-cream: "#FFFDF3"
  groove-paper: "#F6F4ED"
  groove-green: "#80B586"
  groove-sleeper: "#B69A2D"
  groove-coral: "#E79C7B"
  groove-blue: "#6D9CBF"
  groove-mint: "#C1E6E0"
  groove-amber: "#FFE3A5"
  groove-gold: "#FFDF6B"
  groove-rose: "#CE8296"
  groove-tile-1: "#58A4B0"
  groove-tile-2: "#689ACA"
  groove-tile-3: "#CC7E91"
  groove-tile-4: "#73A878"
  groove-tile-5: "#E79C7B"
  groove-tile-6: "#8EA7D2"
  groove-tile-7: "#5E98CE"
  groove-tile-8: "#D89886"
  harmonic-ink: "#513344"
  harmonic-stage: "#F5EDF2"
  harmonic-border: "#CCB8C4"
  harmonic-tonic: "#ECDCE6"
  harmonic-subdominant-ink: "#2E554D"
  harmonic-subdominant: "#DFEDE6"
  harmonic-dominant-ink: "#6B4025"
  harmonic-dominant: "#F5E4D4"
  notes-ink: "#745437"
  notes-bg: "#F3EBDF"
  intervals-ink: "#5B547E"
  intervals-bg: "#EDEAF5"
  reading-ink: "#375B76"
  reading-bg: "#E7EFF5"
typography:
  title:
    fontSize: "29px"
    fontWeight: 700
    letterSpacing: "-0.6px"
  headline:
    fontSize: "19px"
    fontWeight: 600
    letterSpacing: "-0.25px"
  item-title:
    fontSize: "16px"
    fontWeight: 600
  body:
    fontSize: "14px"
    lineHeight: "22px"
  muted:
    fontSize: "13px"
    lineHeight: "20px"
  button:
    fontSize: "13px"
    fontWeight: 600
  badge:
    fontSize: "11px"
    fontWeight: 600
rounded:
  badge: "5px"
  selection: "7px"
  control: "8px"
  practice-card: "12px"
  panel: "14px"
spacing:
  icon: "8px"
  row: "12px"
  panel-gap: "18px"
  compact-page: "20px"
  panel: "24px"
  desktop-page: "36px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  button-secondary:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.green}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.green}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.error}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px"
  panel:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  chip:
    backgroundColor: "{colors.chip-bg}"
    textColor: "{colors.muted}"
    rounded: "{rounded.selection}"
    padding: "9px 13px"
  chip-selected:
    backgroundColor: "{colors.green}"
    textColor: "{colors.white}"
    rounded: "{rounded.selection}"
    padding: "9px 13px"
  badge:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.green}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "4px 9px"
  nav-selected:
    backgroundColor: "{colors.nav-selected}"
    textColor: "{colors.nav-active-ink}"
    rounded: "{rounded.selection}"
    padding: "12px"
---

# Design System: clasRo

## Overview

Este documento describe el resultado implementado, no una nueva identidad aprobada. La única restricción de identidad confirmada es una interfaz simple, concisa y sin eslóganes. No se ha acordado una metáfora ni un nombre creativo para el sistema.

Las superficies claras, la tinta oscura y el verde reúnen navegación, tareas y práctica. Los componentes compartidos de React Native mantienen las mismas formas y estados en las pantallas; las APIs de la plataforma resuelven las diferencias del dispositivo. La densidad se adapta mediante columnas, saltos de línea y navegación horizontal.

**Key Characteristics:**

- Superficies planas delimitadas por trazos suaves.
- Verde para acciones y selección; los pares de color identifican los módulos.
- Jerarquía breve de texto y componentes reutilizados.

## Colors

El acento verde y los neutros claros se complementan con pares de color vinculados a módulos. Los valores normativos están en el frontmatter; los nombres describen su uso actual.

### Primary

- **green / pale:** acción principal, variantes secundarias, badges y selección de ejercicios.
- **nav-selected / nav-active-ink:** destino seleccionado en la navegación; **nav-hover** indica paso del puntero.

### Secondary

- **groove-ink / groove-stage:** GrooveTrain.
- **harmonic-ink / harmonic-stage:** ChordLine. **harmonic-border** delimita el tablero y los vagones.
- **notes-ink / notes-bg:** reconocimiento de notas.
- **intervals-ink / intervals-bg:** intervalos.
- **reading-ink / reading-bg:** lectura musical.

### Neutral

- **ink / muted:** texto principal y información de apoyo.
- **bg / white / nav-bg:** fondo de aplicación, paneles y barra lateral.
- **line / field-border:** divisores de contenido y borde de campos.
- **placeholder:** pistas dentro de campos.
- **chip-bg / chip-hover:** opciones sin seleccionar y su estado de puntero.
- **nav-ink:** destino sin seleccionar.

El color **error** identifica errores y acciones peligrosas. No existe una escala tonal de producto; los tonos locales no forman una escala continua.

**The Module Pair Rule.** El color de cada módulo acompaña a su nombre e icono en catálogo y tareas.

## Typography

La aplicación no declara una familia tipográfica propia: usa los valores predeterminados de Text y TextInput de React Native y su resolución web. No se establece una fuente display de marca. Los tamaños del frontmatter corresponden a los números de StyleSheet; en web se traducen a píxeles CSS.

### Hierarchy

- **title:** título de pantalla; Heading con nivel 1.
- **headline:** encabezado de sección; Heading con nivel 2.
- **item-title:** título de tarea, recurso o herramienta.
- **body / muted:** texto de contenido e información auxiliar.
- **button / badge:** acciones y metadatos compactos.

El acceso usa un título local de mayor tamaño (45/52 en escritorio y 32/40 en compacto); el inicio usa un encabezado destacado de 25. Son tratamientos de esas superficies, no una escala display general. Las cifras grandes del afinador y ejercicios representan datos musicales.

**The Semantic Heading Rule.** El nivel semántico se pasa a Heading; el tamaño visual se determina con el estilo correspondiente.

## Layout

La estructura principal pasa a barra lateral a partir de 1000 px. La barra mide 238 px; el encabezado tiene altura mínima de 77 px. El contenido usa ancho completo, máximo de 1510 px, centrado y padding según los tokens desktop-page o compact-page, con 50 px inferiores.

Por debajo de ese umbral, la navegación principal se dispone horizontalmente con desplazamiento y cada destino compacto reserva al menos 68 px de ancho. Las tres herramientas se muestran en una segunda fila. Las filas compartidas admiten salto de línea cuando corresponde.

El inicio dispone la columna auxiliar de 290 px junto al contenido a partir de 1200 px; por debajo ocupa el ancho completo. El catálogo muestra tarjetas al 48,5 % por encima de 1000 px. El acceso cambia a dos columnas por encima de 900 px. Estos umbrales describen cada superficie, no una cuadrícula global impuesta a otras vistas. El ritmo usa separaciones recurrentes de los tokens y ajustes locales.

## Elevation & Depth

Los componentes compartidos y la estructura no definen sombras. La profundidad procede de blanco sobre fondo claro, bordes finos y rellenos de selección. El foco web usa un contorno verde de 2 px con separación de 4 px. No hay elevación al pasar el puntero.

**The Tonal Surface Rule.** Los paneles se separan del fondo mediante tono y borde, sin sombras añadidas.

## Shapes

Los controles tienen esquinas suaves; chips y navegación usan selection, campos y botones usan control y paneles usan panel. Los badges son más compactos. Los divisores y bordes habituales tienen 1 px. Las tarjetas de práctica usan practice-card; las imágenes de pentagrama y figuras rítmicas se dibujan mediante SVG, sin raster de producto.

## Components

### Buttons

Primary usa green sobre blanco de texto; secondary invierte el énfasis mediante pale y texto verde. Ghost conserva el fondo transparente; danger usa texto error. La altura mínima es 44 px; small usa padding vertical de 8 px y horizontal de 12 px y altura mínima de 36 px. Los iconos de acción miden 16 px.

Hover reduce la opacidad a 0,84; pressed a 0,65; disabled y busy a 0,45. Busy muestra un indicador y bloquea la acción. En web los cambios de fondo y opacidad duran 150 ms con ease solamente cuando no se solicita movimiento reducido.

### Chips and Badges

Chips permite opciones envueltas en varias líneas, con selección verde y texto blanco; la opción sin seleccionar cambia al tono chip-hover con el puntero. Badge es informativo y permite recibir el par de color de un módulo. El badge de demo usa un par local ocre para identificar el modo.

### Cards / Containers

Panel usa fondo blanco, borde line, padding panel y separación panel-gap. Las tarjetas interactivas de práctica cambian al fondo de su módulo al pasar el puntero. Las filas de tareas se separan con divisores y muestran icono, título, contexto y flecha.

### Inputs / Fields

Field mantiene etiqueta visible, pista y borde field-border. La altura mínima es 44 px; multiline reserva 110 px y alinea el texto arriba. Los mensajes de error aparecen como texto error junto al formulario; el componente no define un borde especial de error ni una apariencia disabled propia.

### Navigation

El destino activo cambia relleno, color y peso a 600; el inactivo usa peso 400. Escritorio dispone icono y etiqueta en fila; compacto los apila. La navegación mantiene el estado seleccionado accesible. El foco web comparte el contorno descrito en Elevation & Depth.

### Musical notation and pulse

Staff y RhythmFigure dibujan notación vectorial. El tablero de GrooveTrain usa el amarillo del original (`groove-stage`) y alterna sus ocho `groove-tile`. La casilla activa usa `groove-cream` con contorno `groove-ink`. Lectura rítmica conserva el verde y su barra de avance.

La locomotora SVG usa `groove-coral`, `groove-blue`, `groove-mint`, `groove-amber`, `groove-gold`, `groove-rose` y `groove-green`. Se desplaza linealmente por los 16 pulsos según el reloj de audio. Con movimiento reducido queda fija y las traviesas siguen indicando el pulso activo y los recorridos con `groove-cream` y `groove-green`. Las pendientes usan `groove-sleeper`. El medidor de entrada usa `groove-paper`, `groove-blue` y `groove-green`.

ChordLine agrupa los cuatro pulsos de cada compás en un vagón. El cifrado del compás se muestra a 24 puntos y la función se indica con texto y color. Tónica usa `harmonic-ink` sobre `harmonic-tonic`, subdominante usa `harmonic-subdominant-ink` sobre `harmonic-subdominant` y dominante usa `harmonic-dominant-ink` sobre `harmonic-dominant`. El cifrado introducido por pulso usa el fondo blanco. El pulso activo conserva un contorno visible y su relleno aparece con un fundido de 140 ms. Con movimiento reducido el cambio es inmediato. En el blues, el tablero avanza en grupos de cuatro compases.

### Escritura en Transcribir

La partitura se desplaza en su área de contenido y el panel de entrada permanece anclado encima de la navegación. Las figuras se dibujan en SVG en teclas de al menos 44 × 44 pt. El verde indica la figura y los modificadores activos. El mástil de entrada muestra los trastes 0–12 inicialmente, conserva casillas de 44 × 44 pt y distingue la cuerda del cursor y la última nota con relleno y contorno respectivamente.

El compás seleccionado usa fondo `pale` y borde verde. Un indicador sobre la casilla señala el punto de inserción. La barra de llenado usa verde para el avance y `error` para el exceso, con el estado escrito junto a la métrica. El reproductor sitúa el volumen junto al transporte. Bucle, Sonido y Secciones despliegan sus controles bajo la partitura. Si una figura cruza la barra, el panel indica la división y la partitura dibuja las ligaduras. Los compases guardados con exceso muestran la acción «Corregir compás pasado».


### Lesson diagrams

Los diagramas del curso de armonía se dibujan con SVG sobre el panel blanco, con líneas de pentagrama `#A9B4A8`, tinta `ink` y verde para el paso activo. Las funciones tonales usan pares locales que reutilizan valores existentes y siempre acompañan a su nombre escrito: tónica `#295E43/#E8EFE7`, subdominante `#375B76/#E7EFF5`, dominante `#745437/#F3EBDF` y dominante secundario `#5B547E/#EDEAF5`. El semitono se distingue en ocre `#8A5A2E`.

En los diagramas, el cursor de paso es un fondo `pale` que viaja 260 ms con `cubic-bezier(0.16, 1, 0.3, 1)` hasta el elemento que suena, y un cabezal lineal en los ritmos. Con movimiento reducido salta sin desplazarse. La escala mínima es 0,8 para que el texto del diagrama no baje de unos 10 px; por debajo, el diagrama se desplaza en horizontal.

## Do's and Don'ts

### Do:

- Do reutilizar los componentes y estilos compartidos antes de introducir variantes locales.
- Do mantener el foco visible y diferenciar selección, pulsación y deshabilitado.
- Do usar los pares de color del módulo junto a su nombre e icono.
- Do conservar encabezados con nivel semántico mediante Heading.

### Don't:

- Don't añadir eslóganes ni texto ornamental.
- Don't convertir una composición particular del inicio en requisito de todas las pantallas.
- Don't presentar los valores extraídos como aprobación de una nueva identidad o como certificación completa de accesibilidad.

Documentado a partir de App.tsx, src/components/ui.tsx, Heading y Heading.web, bootstrap.web, src/core/types.ts y una muestra de src/screens. Las capturas desktop.png y mobile.png verifican visualmente el inicio; el dictamen ship posterior a la corrección de niveles de encabezado tiene ese alcance y no certifica todos los estados ni navegadores. Los tratamientos locales de acceso, cifras y textos auxiliares no se canonizan como reglas de identidad.
