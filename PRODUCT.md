# Producto

<!-- impeccable:product-schema 1 -->

## Platform

ios, android, web

## Stack

Expo + React Native + TypeScript con código compartido entre plataformas y development builds para el audio nativo. Supabase para identidad, datos y sincronización. Compras integradas de cada tienda en móvil y Stripe en la web (pendiente).

## Usuarios

Bajistas de nivel principiante e intermedio que practican por su cuenta y sacan líneas de oído.

## Propósito

Reunir en una app las herramientas, la transcripción, la teoría aplicada al mástil y el entrenamiento que necesita un bajista. Las herramientas y la transcripción local funcionan sin cuenta.

## Capacidades y restricciones

Afinador para 4, 5 y 6 cuerdas, metrónomo, caja de ritmos y mástil interactivo. Reproductor de transcripción con cambio de velocidad sin alterar el tono, transporte, bucle A–B, marcadores y realce de graves, con el audio procesado en el dispositivo. Teoría aplicada al mástil, con cuestionarios y prácticas autoevaluadas. Entrenamiento de ritmo (GrooveTrain), notas, intervalos y lectura en clave de fa y en tablatura.

La detección de notas es una sugerencia editable. La app no califica interpretaciones. El curso basado en Enric Herrera no se publica hasta resolver su licencia. Precios y reparto del premium pendientes. Ver REQUISITOS.md.

## Principios

- Móvil primero, con controles usables con el instrumento colgado.
- Interfaz simple, concisa y sin eslóganes.
- El audio del usuario no sale del dispositivo sin consentimiento.
- Compartir la presentación y la lógica musical entre plataformas; aislar las APIs del dispositivo.
- Diferenciar claramente los datos de ejemplo del uso real.

## Evidencia disponible

Requisitos en REQUISITOS.md. Código reutilizable de la primera fase (núcleo musical, GrooveTrain, afinador web, metrónomo, curso y diagramas). El usuario es bajista y cuenta con profesores para validar el temario. No hay datos de usuarios reales.
