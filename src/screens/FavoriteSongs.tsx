import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button, Heading, Label, styles } from '../components/ui';
import { useTheme } from '../components/theme';
import { favoriteSongLength, favoriteSongLimit, parseFavoriteSongs } from '../core/dailyPractice';
import { useStore } from '../data/Store';

/** Rellena hasta cinco campos para editar la lista. */
export const songSlots = (songs: readonly string[]) =>
  Array.from({ length: favoriteSongLimit }, (_, i) => songs[i] ?? '');

/** Hasta cinco campos «Canción — artista», todos opcionales. */
export function FavoriteSongFields({
  value,
  onChange,
}: {
  value: string[];
  onChange: (songs: string[]) => void;
}) {
  const { colors } = useTheme();
  const slots = songSlots(value);
  return (
    <View style={{ gap: 10 }}>
      {slots.map((song, i) => (
        <TextInput
          key={i}
          accessibilityLabel={`Canción favorita ${i + 1} de ${favoriteSongLimit}`}
          value={song}
          maxLength={favoriteSongLength}
          onChangeText={(text) => onChange(slots.map((s, j) => (j === i ? text : s)))}
          placeholder="Canción — artista"
          placeholderTextColor={colors.faint}
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType={i + 1 < favoriteSongLimit ? 'next' : 'done'}
          style={[styles.field, { minHeight: 48 }]}
        />
      ))}
    </View>
  );
}

/** Panel de Ajustes: misma lista que en la configuración inicial. */
export function FavoriteSongsPanel() {
  const { colors } = useTheme();
  const { daily, updatePracticeSettings } = useStore();
  const [draft, setDraft] = useState(() => songSlots(daily.settings.favoriteSongs));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changed =
    JSON.stringify(parseFavoriteSongs(draft)) !== JSON.stringify(daily.settings.favoriteSongs);

  async function save() {
    setBusy(true);
    setError('');
    try {
      await updatePracticeSettings({ ...daily.settings, favoriteSongs: parseFavoriteSongs(draft) });
      setDraft(songSlots(parseFavoriteSongs(draft)));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.panel}>
      <Heading level={2} style={styles.h2}>
        Canciones favoritas
      </Heading>
      <Label muted>
        Aparecen en el bloque «Tu canción» de tus rutinas. Cuando tengas el audio, impórtalo en
        Transcribir.
      </Label>
      <FavoriteSongFields value={draft} onChange={setDraft} />
      <Button
        variant="secondary"
        style={{ alignSelf: 'flex-start' }}
        disabled={!changed}
        busy={busy}
        onPress={() => void save()}
      >
        Guardar canciones
      </Button>
      {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
    </View>
  );
}
