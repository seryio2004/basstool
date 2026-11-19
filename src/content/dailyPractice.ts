import type { Level } from '../core/profile';
import type { Module } from '../core/types';

export type StudyFocus = 'technique' | 'groove' | 'theory' | 'ear' | 'song';
export type StudyExercise = Module | 'scale' | 'warmup' | 'song';
type PlanDay = readonly [exercise: StudyExercise, objective: string, seconds?: number];

export const warmups = [
  { tonic: 'C', scale: 'major', instruction: 'Sube y baja en negras. Alterna índice y medio.' },
  {
    tonic: 'A',
    scale: 'minorPentatonic',
    instruction: 'Toca dos corcheas por nota y apaga la cuerda anterior.',
  },
  { tonic: 'G', scale: 'major', instruction: 'Toca grupos de tres notas y vuelve a la tónica.' },
] as const;

// Borrador de contenido para revisar con los profesores.
export const studyPlans: Record<Level, { days: readonly PlanDay[]; milestone: string }> = {
  beginner: {
    days: [
      ['notes', 'Encuentra Mi y La en las cuerdas al aire y en el mástil.'],
      ['warmup', 'Alterna índice y medio con un ataque uniforme.'],
      ['groove', 'Mantén cuatro negras por compás.'],
      ['notes', 'Encuentra las notas naturales en primera posición.'],
      ['listen-repeat', 'Canta una frase de un compás antes de tocarla.'],
      ['song', 'Elige un fragmento fácil y toca sus primeras notas despacio.'],
      ['groove', 'Repite un patrón de negras con un silencio.'],
      ['warmup', 'Cruza dos cuerdas y apaga la que dejas.'],
      ['notes', 'Localiza dos posiciones para la misma nota.'],
      ['intervals', 'Escucha dos notas e identifica la distancia entre ellas.'],
      ['groove', 'Alterna negras y parejas de corcheas.'],
      ['song', 'Repite el fragmento al mismo tempo con un ataque uniforme.'],
      ['scale', 'Sigue las notas de la escala y vuelve a la tónica.'],
      ['reading', 'Lee una frase corta en clave de fa.'],
      ['warmup', 'Repite una escala y reduce la presión de la mano izquierda.'],
      ['groove', 'Vuelve a entrar a tiempo después de un silencio.'],
      ['scale', 'Encuentra la tónica al cambiar de cuerda.'],
      ['listen-repeat', 'Toca de oído una frase corta.'],
      ['song', 'Ajusta un bucle y aumenta el tempo un paso.'],
      ['groove', 'Encadena dos patrones conservando el pulso.'],
      ['song', 'Toca cuatro vueltas de tu fragmento con pulso estable.'],
    ],
    milestone: 'Tocar cuatro vueltas de un fragmento fácil con pulso estable.',
  },
  intermediate: {
    days: [
      ['warmup', 'Calienta con una escala en negras y cruces limpios.'],
      ['groove', 'Repite una síncopa sin acelerar el pulso.'],
      ['chord-train', 'Toca tónica, tercera y quinta de los acordes.'],
      ['listen-repeat', 'Repite de oído dos compases y comprueba el final.'],
      ['song', 'Elige un pasaje de dos compases y aísla su cambio más difícil.'],
      ['groove', 'Mantén las corcheas con ataques de volumen uniforme.'],
      ['chord-train', 'Ubica terceras y quintas desde dos posiciones.'],
      ['warmup', 'Calienta en corcheas y controla el apagado al cruzar cuerdas.'],
      ['groove', 'Anticipa una entrada sin desplazar el pulso.'],
      ['intervals', 'Identifica terceras mayores y menores por su sonido.'],
      ['song', 'Une el pasaje con el compás que lo precede.'],
      ['chord-train', 'Sigue una progresión usando notas de cada acorde.'],
      ['groove', 'Repite un patrón con silencios sobre la batería.'],
      ['reading', 'Lee una línea corta y contrasta tu fraseo con el ejemplo.'],
      ['warmup', 'Calienta con grupos de tres notas y cruces de cuerda.'],
      ['chord-train', 'Conecta dos acordes pasando por la nota más cercana.'],
      ['groove', 'Conserva el pulso al combinar negras, corcheas y silencios.'],
      ['song', 'Sube el tempo un paso cuando la transición salga limpia.'],
      ['listen-repeat', 'Repite dos compases sin consultar la tablatura.'],
      ['chord-train', 'Construye una línea sencilla que marque los cambios de acorde.'],
      ['song', 'Toca cuatro compases enlazados al tempo que hayas consolidado.'],
    ],
    milestone: 'Enlazar cuatro compases de una canción con pulso y articulación estables.',
  },
  advanced: {
    days: [
      ['warmup', 'Iguala ataque y apagado al cambiar de registro.'],
      ['groove', 'Alterna ataques con altura y notas muertas.'],
      ['chord-train', 'Conecta terceras y séptimas sobre una cadencia.'],
      ['listen-repeat', 'Repite una frase sincopada sin ver el mástil.'],
      ['song', 'Aísla un fragmento exigente y fija un tempo de partida.'],
      ['groove', 'Conserva el pulso al desplazar los acentos.'],
      ['scale', 'Prueba dos digitaciones para una escala modal.'],
      ['warmup', 'Controla los cruces con articulación corta y larga.'],
      ['groove', 'Contrasta subdivisión recta y ternaria.'],
      ['listen-repeat', 'Repite una frase con silencios y notas muertas.'],
      ['song', 'Une dos fragmentos y comprueba la entrada de cada uno.'],
      ['chord-train', 'Enlaza las notas guía de acordes con séptima.'],
      ['groove', 'Toca semicorcheas sin acentuar las notas de paso.'],
      ['reading', 'Lee la frase y canta los ataques antes de tocar.'],
      ['warmup', 'Conserva la articulación al mover una figura entre cuerdas.'],
      ['scale', 'Relaciona la tónica con las notas guía en otra posición.'],
      ['groove', 'Alterna densidad rítmica sin cambiar de subdivisión.'],
      ['song', 'Aumenta el tempo del bucle manteniendo los detalles de articulación.'],
      ['listen-repeat', 'Repite una frase y después comprueba sus notas en el mástil.'],
      ['chord-train', 'Marca cada acorde con una conexión melódica distinta.'],
      ['song', 'Toca una sección completa y revisa pulso, dinámica y articulación.'],
    ],
    milestone: 'Tocar una sección completa con la articulación y el tempo objetivo.',
  },
};
