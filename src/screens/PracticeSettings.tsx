import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Chips, Field, Heading, Label, Toggle, styles } from '../components/ui';
import { useTheme } from '../components/theme';
import {
  parsePracticeSettings,
  practiceGoals,
  practiceMinutes,
  weekDays,
} from '../core/dailyPractice';
import { useStore } from '../data/Store';

function toggle<T>(values: readonly T[], value: T) {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

export function PracticeSettings() {
  const { colors } = useTheme();
  const { daily, updatePracticeSettings } = useStore();
  const [draft, setDraft] = useState(daily.settings);
  const [minutes, setMinutes] = useState(String(draft.weeklyMinutes));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const weeklyMinutes = Number(minutes);
  const valid = Number.isInteger(weeklyMinutes) && weeklyMinutes >= 5 && weeklyMinutes <= 600;
  // Las canciones favoritas tienen su propio panel: se conservan las guardadas.
  const next = { ...draft, weeklyMinutes, favoriteSongs: daily.settings.favoriteSongs };
  const changed = JSON.stringify(parsePracticeSettings(next)) !== JSON.stringify(daily.settings);

  async function save() {
    setBusy(true);
    setError('');
    try {
      await updatePracticeSettings(next);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.panel}>
      <Heading level={2} style={styles.h2}>
        Práctica diaria
      </Heading>
      <Label>Tiempo por defecto</Label>
      <Chips
        label="Tiempo por defecto"
        minHeight={44}
        value={draft.minutes}
        options={practiceMinutes.map((value) => ({ value, label: `${value} min` }))}
        onChange={(minutes) => setDraft({ ...draft, minutes })}
      />
      <Label>Objetivos</Label>
      <Label muted>Los objetivos elegidos reciben más tiempo en tu rutina.</Label>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {practiceGoals.map(({ value, label }) => (
          <Option
            key={value}
            checked={draft.goals.includes(value)}
            label={label}
            onPress={() => setDraft({ ...draft, goals: toggle(draft.goals, value) })}
          />
        ))}
      </View>
      <Label>Días de práctica</Label>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {weekDays.map(({ value, label }) => (
          <Option
            key={value}
            checked={draft.days.includes(value)}
            label={label}
            onPress={() => setDraft({ ...draft, days: toggle(draft.days, value) })}
          />
        ))}
      </View>
      <Field
        label="Minutos semanales (5–600)"
        keyboardType="numeric"
        value={minutes}
        onChangeText={(value) => setMinutes(value.replace(/\D/g, '').slice(0, 3))}
      />
      {!valid ? <Label muted>Introduce entre 5 y 600 minutos.</Label> : null}
      <Toggle
        label="Proteger un día de descanso por semana"
        value={draft.restDay}
        onChange={(restDay) => setDraft({ ...draft, restDay })}
        detail="Puedes saltarte un solo día de lunes a domingo y retomar la racha al día siguiente."
      />
      <Button
        variant="secondary"
        style={{ alignSelf: 'flex-start' }}
        disabled={!valid || !changed}
        busy={busy}
        onPress={() => void save()}
      >
        Guardar práctica
      </Button>
      {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
    </View>
  );
}

function Option({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingVertical: 8,
        paddingHorizontal: 12,
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: 8,
        borderColor: checked ? colors.accent : colors.lineStrong,
        backgroundColor: checked ? colors.accentSoft : pressed ? colors.sunken : colors.raised,
      })}
    >
      <Text style={[styles.text, { color: checked ? colors.accentText : colors.ink }]}>
        {checked ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}
