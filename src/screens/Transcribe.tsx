import React from 'react';
import { View } from 'react-native';
import { Empty, Heading, Label, styles } from '../components/ui';

/** Marcador de la sección. El reproductor de transcripción es la tarea 7 (docs/TAREAS.md). */
export function Transcribe() {
  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 8 }}>
        <Heading level={1} style={styles.title}>
          Transcribir
        </Heading>
        <Label muted>Saca líneas de bajo de tus propias canciones.</Label>
      </View>
      <View style={styles.panel}>
        <Empty
          title="Reproductor en preparación"
          detail="Podrás importar una canción de tu dispositivo, ralentizarla sin cambiar el tono, repetir un fragmento y realzar los graves. El audio no saldrá de tu dispositivo."
        />
      </View>
    </View>
  );
}
