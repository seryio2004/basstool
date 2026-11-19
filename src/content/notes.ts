/**
 * Apuntes breves para bajistas. Son contenido de ejemplo sin revisión musical
 * acreditada: la interfaz debe indicarlo hasta que pasen la revisión.
 */
export type Note = {
  id: string;
  title: string;
  category: string;
  content: string;
  reviewed: boolean;
};

export const notes: Note[] = [
  {
    id: 'pulse',
    title: 'El pulso, el tempo y el compás',
    category: 'Ritmo',
    reviewed: false,
    content:
      'El pulso es la referencia regular de la música. El tempo indica su velocidad en pulsos por minuto (BPM).\n\nEn un compás de 4/4 contamos cuatro pulsos de negra. Una negra ocupa un pulso, dos corcheas lo dividen en dos partes iguales y cuatro semicorcheas, en cuatro.\n\nPrueba con el metrónomo a 60 BPM: toca la cuerda La al aire en cada pulso y después dos notas iguales por pulso.',
  },
  {
    id: 'fretboard',
    title: 'Las notas en el mástil',
    category: 'Mástil',
    reviewed: false,
    content:
      'En un bajo de cuatro cuerdas con afinación estándar, las cuerdas al aire son, de grave a aguda, Mi, La, Re y Sol. Entre cada cuerda y la siguiente hay una cuarta justa.\n\nCada traste sube un semitono. Por eso, la nota del traste 5 de una cuerda es la misma que la de la cuerda siguiente al aire, y el traste 12 repite la nota al aire una octava más aguda.\n\nEjercicio: toca Do en el traste 3 de la cuerda La y búscalo también en el traste 8 de la cuerda Mi.',
  },
  {
    id: 'bass-clef',
    title: 'La clave de fa',
    category: 'Lectura',
    reviewed: false,
    content:
      'El bajo se escribe en clave de fa en cuarta línea. Las líneas del pentagrama, de abajo arriba, son Sol, Si, Re, Fa y La. Los espacios son La, Do, Mi y Sol.\n\nEl bajo suena una octava más grave de lo que se escribe: así sus notas caben en el pentagrama sin demasiadas líneas adicionales.',
  },
];
