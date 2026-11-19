import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button, Label, styles } from '../components/ui';
import { useTheme } from '../components/theme';
import { practiceNoteLimit } from '../core/dailyPractice';
import { useStore } from '../data/Store';

export function NoteEditor({
  id,
  note,
  attempt,
}: {
  id: string;
  note?: string;
  attempt?: boolean;
}) {
  const { colors } = useTheme();
  const { savePracticeNote } = useStore();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    try {
      await savePracticeNote(id, value, attempt);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return open ? (
    <View style={{ gap: 8 }}>
      <TextInput
        accessibilityLabel="Nota opcional"
        placeholder="Nota opcional"
        placeholderTextColor={colors.faint}
        value={value}
        editable={!busy}
        onChangeText={setValue}
        maxLength={practiceNoteLimit}
        multiline
        style={styles.field}
      />
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Button variant="secondary" small busy={busy} onPress={() => void save()}>
          Guardar nota
        </Button>
        <Button variant="ghost" small disabled={busy} onPress={() => setOpen(false)}>
          Cancelar
        </Button>
      </View>
      {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
    </View>
  ) : (
    <View style={{ alignItems: 'flex-start' }}>
      {note ? <Label>{note}</Label> : null}
      <Button
        variant="ghost"
        small
        onPress={() => {
          setValue(note ?? '');
          setError('');
          setOpen(true);
        }}
      >
        {note ? 'Editar nota' : 'Añadir nota (opcional)'}
      </Button>
    </View>
  );
}
