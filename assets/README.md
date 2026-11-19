# Procedencia de los recursos

- `favicon.svg`: marca geométrica dibujada en código para clasRo, con el mismo motivo de pulsos utilizado en la interfaz.
- `favicon.png`: rasterización de esa geometría a 64 × 64 píxeles para el formato admitido por Expo. No utiliza imágenes de terceros ni generación de imágenes mediante IA.
- `audio/c3.wav` a `audio/c7.wav`: ondas sinusoidales sintetizadas a 22.050 Hz, mono, 16 bits, con ataque breve y caída exponencial. Se usan como muestras de reproducción nativa; no contienen grabaciones externas.
- `fonts/Fraunces.ttf` (variable), `fonts/IBMPlexSans.ttf` (variable), `fonts/IBMPlexMono-Regular.ttf` y `fonts/IBMPlexMono-SemiBold.ttf`: descargadas del repositorio oficial google/fonts. Licencia SIL Open Font License 1.1; el texto de cada licencia está junto a las fuentes (`fonts/OFL-*.txt`).

## Ilustraciones y renders del bajo

El dibujo SVG de `src/components/BassPreview.tsx` es original. `src/components/bassGeometry.ts` lo genera en código como un modelo 3D sencillo (perfiles extruidos) a partir de la afinación, la escala y la mano: cuerpo de doble cutaway sin marca, golpeador, dos pastillas, puente de selletas, 24 trastes y una clavija por cuerda. Al mantenerlo pulsado o arrastrarlo gira en 16 fotogramas; los colores salen de los tokens del tema.

Para incorporar renders, usa `assets/bass/bass-{4|5|6}st-{30|32|34|35}in-{rh|lh}.webp`
(por ejemplo, `bass-5st-34in-lh.webp`). Añade a `renders` en `BassPreview.tsx` la clave sin
extensión y su `require('../../assets/bass/…')`. Cada combinación sin archivo conserva el SVG. El render solo sustituye la vista frontal en reposo; el giro sigue usando el SVG.
Las afinaciones de cuatro cuerdas comparten el render.

- Lienzo de 1560 × 440 px, WebP con transparencia. Conserva el encuadre y la línea de las
  cuerdas entre configuraciones para que el cambio de tamaño del mástil sea visible.
- Vista frontal horizontal con el cuerpo completo. `rh`: pala a la izquierda. `lh`: pala a
  la derecha. Mantén el puente en la misma posición relativa a su lado del lienzo.
- Cuerpo genérico sin logos, dos pastillas, 24 trastes y una clavija por cuerda. Escala
  proporcional a la distancia entre cejuela y puente.
- Registra junto a los recursos la procedencia y licencia de cada modelo y material
  antes de distribuir el render.
