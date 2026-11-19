# Prueba de concepto: audio nativo (tarea 6)

Fecha: 2026-11-19. Estado: **recomendación pendiente de aprobación** y de medición en un iPhone real.

## Resumen

Se recomienda **`react-native-audio-api` 1.0.1** (Software Mansion, licencia MIT). Es la única opción evaluada que cubre las cinco necesidades con una sola API, y esa API es la de Web Audio, que la app ya usa en `src/platform/audio.web.ts`. Expo también la recomienda para controlar el audio a bajo nivel.

El prototipo está en [spikes/audio/](../spikes/audio/). Es una app Expo independiente llamada «Bajo Lab», con tres pruebas: metrónomo, afinador y reproductor. Su tipado y sus bundles de iOS y Android compilan, y `expo prebuild` genera los permisos nativos correctos. **No se ha ejecutado en ningún dispositivo**: esa medición es el siguiente paso (ver más abajo).

## Necesidades y candidatos

| Necesidad | `expo-audio` 58 (actual) | `react-native-audio-api` 1.0.1 | Módulo nativo propio (Signalsmith, Rubber Band…) |
| --- | --- | --- | --- |
| 1. Sonidos programados con precisión de muestra | No. La app usa `setTimeout` en el hilo JS. | Sí. `currentTime` y `start(when)` sobre el reloj de audio. | Sí, pero hay que escribirlo. |
| 2. Micrófono PCM en tiempo real | Sí, con `useAudioStream` (desde la versión 56). | Sí. `AudioRecorder.onAudioReady` entrega bloques en coma flotante. | Sí, pero hay que escribirlo. |
| 3a. Velocidad sin cambiar el tono | Parcial. `setPlaybackRate` con `shouldCorrectPitch`. | Sí. `createBufferSource({ pitchCorrection: true })` (WSOLA y Signalsmith Stretch); velocidad entre −4 y 4. | Sí. |
| 3b. Transportar sin cambiar la velocidad | No. | Sí. `detune` en cents sobre la fuente con corrección de tono. | Sí. |
| 3c. Bucle A–B preciso | Manual, con temporizadores. | Sí. `loop`, `loopStart` y `loopEnd` a nivel de muestra. | Sí. |
| 4. Filtro de graves en tiempo real | No. | Sí. `BiquadFilterNode` (lowpass, peaking, lowshelf…). | Sí. |
| 5. Misma API en web | No; la web ya usa Web Audio por separado. | Sí; en web usa el Web Audio del navegador, incluida la corrección de tono. **Excepción**: `AudioRecorder` no existe en web, así que el afinador web mantiene `getUserMedia`. | No. |
| Development build | No hace falta. | **Sí** (no funciona en Expo Go). | Sí. |
| Licencia | MIT | MIT | Signalsmith: MIT. Rubber Band: GPL o comercial. SoundTouch: LGPL. |
| Coste de desarrollo | — | Bajo: integrar y adaptar. | Alto: C++, puentes JSI y mantenimiento en dos plataformas. |

**Conclusión**: `expo-audio` sirve para el afinador, pero no para el metrónomo preciso ni para la transcripción. Un módulo propio solo compensa si `react-native-audio-api` falla en la medición real.

## Riesgos de la recomendación

- **Versión muy reciente.** La 1.0.0 salió el 3 de noviembre y trae cambios incompatibles; la 1.0.1, el 16 de noviembre. Hay una incidencia abierta ([#1448](https://github.com/software-mansion/react-native-audio-api/issues/1448)) con Expo 58 y RN 0.88.1: un fallo en compilación de depuración al conectar un nodo al `AudioParam` de una fuente. El prototipo no usa ese patrón. Fijar la versión exacta y revisar el changelog antes de cada actualización.
- **Memoria al decodificar.** `decodeAudioData` carga toda la canción como PCM en coma flotante: una canción estéreo de 4 minutos a 44,1 kHz ocupa unos 85 MB. El prototipo muestra la cifra real de cada archivo. Si es demasiado, hay que evaluar `AudioFileSourceNode` (reproducción en streaming, con `playbackRate` desde la 0.13), pero no está comprobado que conserve la corrección de tono.
- **Detector en el hilo JS.** `pitchFromSamples` es O(N × retardo) y se ejecuta en JavaScript. El prototipo mide su tiempo por análisis. Si supera unos 40 ms, conviene usar `AnalyserNode`, worklets o un algoritmo más barato (YIN o autocorrelación por FFT).
- **Tamaño de la app.** Sin medir. La librería exporta `isFfmpegEnabled`, así que puede incluir FFmpeg para decodificar. Hay que confirmar el tamaño en la compilación de EAS y la licencia de FFmpeg (LGPL) antes de publicar.
- **Sesión de audio de iOS.** El afinador usa la categoría `playAndRecord` con modo `measurement` para desactivar el control automático de ganancia y la supresión de ruido. Hay que comprobar que, después, el reproductor no suena más bajo ni por el auricular.

## Qué hay que medir en el iPhone

Anota los resultados aquí o pásaselos al agente.

| Prueba | Cómo | Resultado esperado | Resultado |
| --- | --- | --- | --- |
| Metrónomo estable | 100 BPM durante 5 minutos sin tocar nada | «Pulsos programados tarde» = 0 | |
| Metrónomo con carga | Pulsar «Bloquear JS 300 ms» varias veces | Algún pulso tarde, sin cuelgues; luego vuelve a 0 | |
| Deriva | Grabar el iPhone junto a un metrónomo de referencia durante 5 minutos | Menos de 10 ms de diferencia al final | |
| Latencia de toque | Pulsar «Empezar» y escuchar | El primer clic suena en unos 100 ms | |
| Afinador Mi1 | Cuerda Mi al aire, sin amplificar y luego con amplificador | Mi1 sin saltos de octava | |
| Afinador La1, Re2, Sol2 | Cuerdas al aire | Nota correcta, cents estables (±3) | |
| Afinador Si0 | Bajo de 5 cuerdas, si tienes | Hoy **no** se detecta (tarea 2); anotar qué muestra | |
| Coste del análisis | Ver «Tiempo de análisis (JS)» | Menos de 40 ms | |
| Permiso denegado | Denegar el micrófono la primera vez | Mensaje claro y la app sigue funcionando | |
| Decodificar | Importar un MP3 o M4A de 3–5 minutos | Menos de 3 s; anotar los MB | |
| Velocidad al 50 % | Reproducir al 50 % | El tono no baja y no hay artefactos molestos en el bajo | |
| Transporte | ±1 semitono | Cambia el tono, no la velocidad | |
| Bucle | A y B sobre un compás, durante 2 minutos | Sin saltos audibles al volver a A | |
| Solo graves | Activar con una canción con bajo claro | Se oye la línea de bajo | |
| Afinador y reproductor | Usar el afinador y después el reproductor | Volumen normal por el altavoz | |

## Cómo instalarlo en el iPhone (desde Linux)

Las librerías de audio nativas no funcionan en Expo Go, así que hay que compilar una «development build» propia. Sin Mac, se compila en los servidores de Expo (EAS).

### Requisitos

1. **Apple Developer Program** (99 USD al año). Apple exige una cuenta de pago para firmar apps que se instalan en un iPhone si no se compila con Xcode en un Mac. Darse de alta: <https://developer.apple.com/programs/enroll/>. La activación puede tardar de horas a un par de días.
2. **Cuenta de Expo** gratuita: <https://expo.dev/signup>. El plan gratuito incluye un número limitado de compilaciones de iOS al mes (unas 15) en una cola de baja prioridad, que puede tardar.
3. El ordenador y el iPhone en la **misma red wifi** para cargar el JavaScript.

### Pasos (una sola vez)

```bash
npm install --global eas-cli
eas login                      # tu cuenta de Expo
cd spikes/audio
npm install                    # si aún no están instaladas las dependencias
eas init                       # crea el proyecto en Expo y guarda su id en app.json
eas device:create              # registra tu iPhone
```

`eas device:create` muestra un enlace o un código QR:

1. Ábrelo **con Safari** en el iPhone e instala el perfil (Ajustes → General → VPN y gestión de dispositivos).
2. Compila:

   ```bash
   npm run build:ios              # = eas build --profile development --platform ios
   ```

   - La primera vez te pedirá iniciar sesión con tu Apple ID de desarrollador. Deja que EAS gestione certificados y perfiles: responde «sí» a todo.
   - Si el identificador `com.clasro.audiolab` está cogido, cámbialo en `app.json` (`ios.bundleIdentifier`) por otro único, por ejemplo `com.<tunombre>.bajolab`.
3. Cuando termine, abre el enlace o escanea el QR con la cámara del iPhone e instala **Bajo Lab**.
4. Activa el **modo de desarrollador**: Ajustes → Privacidad y seguridad → Modo de desarrollador → activar. El iPhone se reinicia; después confirma «Activar».

### Uso diario

```bash
cd spikes/audio
npm start                      # = expo start --dev-client
```

Abre Bajo Lab en el iPhone: detectará el servidor de tu ordenador. Si no lo detecta, escanea con la cámara el QR que aparece en la terminal. Si tu red bloquea la conexión, usa `npx expo start --dev-client --tunnel`.

- Los cambios en `App.tsx` o en `src/core/` se recargan solos, **sin compilar de nuevo**.
- Solo hay que repetir `npm run build:ios` si cambian las dependencias nativas o `app.json`.
- Para las pruebas de afinación, desactiva el modo silencio y sube el volumen. El micrófono del iPhone capta mal Mi1 sin amplificador: prueba también con el bajo amplificado.

## Siguiente paso tras la medición

Si los resultados son buenos y apruebas la librería:

1. Añadir `react-native-audio-api` y `expo-dev-client` a la app principal y crear su `eas.json`.
2. Reescribir `src/platform/audio.ts` (nativo) sobre la nueva API. Unificarlo con `audio.web.ts` cuando sea razonable: la API es la misma.
3. Implementar el afinador nativo con `AudioRecorder` (y la tarea 2 para el rango grave).
4. Adaptador nativo del reproductor de la tarea 7.

Si fallan el metrónomo, la corrección de tono o el consumo de memoria, se evaluará `AudioFileSourceNode` o un módulo nativo propio con Signalsmith Stretch (MIT).

## Fuentes

- [Releases de react-native-audio-api](https://github.com/software-mansion/react-native-audio-api/releases)
- [Documentación: AudioBufferSourceNode](https://docs.swmansion.com/react-native-audio-api/docs/sources/audio-buffer-source-node), [AudioRecorder](https://docs.swmansion.com/react-native-audio-api/docs/inputs/audio-recorder), [Getting started](https://docs.swmansion.com/react-native-audio-api/docs/fundamentals/getting-started), [BaseAudioContext](https://docs.swmansion.com/react-native-audio-api/docs/core/base-audio-context)
- [Incidencia #1448](https://github.com/software-mansion/react-native-audio-api/issues/1448)
- [expo-audio](https://docs.expo.dev/versions/latest/sdk/audio/) y [su changelog](https://github.com/expo/expo/blob/main/packages/expo-audio/CHANGELOG.md)
- [Expo SDK 58](https://expo.dev/changelog/sdk-58)
- [Crear una development build](https://docs.expo.dev/develop/development-builds/create-a-build/)
- [Apple Developer Program gratuito frente a pago (Expo)](https://expo.dev/blog/apple-developer-program-explained-free-vs-paid)
- [Precios de EAS](https://expo.dev/pricing)
