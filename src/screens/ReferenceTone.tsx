import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Button, Field, Label, Toggle, colors, space, styles } from '../components/ui';
import { tunings } from '../core/instrument';
import { plainName } from '../components/Fretboard';
import { validReferenceHz } from '../core/profile';
import { useStore } from '../data/Store';
import { useReferencePlayback } from './useReferencePlayback';

export function ReferenceTone() {
  const { profile, updateProfile } = useStore();
  const [draft, setDraft] = useState(String(profile.referenceHz));
  const [loop, setLoop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const referenceHz = Number(draft);
  const valid = validReferenceHz(referenceHz);
  const player = useReferencePlayback(valid ? referenceHz : profile.referenceHz);
  const strings = tunings[profile.tuning].strings;
  const web = Platform.OS === 'web';

  async function save() {
    setSaving(true);
    setSaveError('');
    try {
      await updateProfile({ referenceHz });
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.panel, { gap: space.m }]}>
      <Label muted>{tunings[profile.tuning].name}</Label>
      {!web && <Label>Disponible en la versión web</Label>}
      {web && (
        <Toggle
          label="Bucle"
          value={loop}
          onChange={(value) => {
            setLoop(value);
            player.stop();
          }}
        />
      )}
      {strings.map((midi, index) => {
        const id = String(index);
        const playing = player.playing === id;
        const note = plainName(midi, profile.nomenclature) + (Math.floor(midi / 12) - 1);
        return (
          <View key={id} style={styles.between}>
            <Text style={styles.h3}>
              Cuerda {strings.length - index} · {note}
            </Text>
            {web && (
              <Button
                variant="secondary"
                icon={playing ? 'pause' : 'play'}
                accessibilityLabel={
                  playing ? `Detener ${note}` : `Escuchar ${note}, cuerda ${strings.length - index}`
                }
                disabled={!valid}
                onPress={() => {
                  if (playing) player.stop();
                  else void player.play(id, [{ midi, at: 0, seconds: 4 }], loop ? 4.18 : undefined);
                }}
              >
                {playing ? 'Detener' : 'Escuchar'}
              </Button>
            )}
          </View>
        );
      })}
      {web && (
        <>
          <View style={styles.divider} />
          <Field
            label={
              profile.nomenclature === 'latin' ? 'Referencia de La4 (Hz)' : 'Referencia de A4 (Hz)'
            }
            value={draft}
            keyboardType="numeric"
            onChangeText={(value) => {
              player.stop();
              setDraft(value);
            }}
          />
          <Label muted>430–450 Hz · Habitual: 440 Hz.</Label>
          <Button
            variant="secondary"
            style={{ alignSelf: 'flex-start' }}
            disabled={!valid || saving || referenceHz === profile.referenceHz}
            onPress={() => void save()}
          >
            {saving ? 'Guardando…' : 'Guardar referencia'}
          </Button>
        </>
      )}
      {player.error || saveError ? (
        <Label style={{ color: colors.error }}>{player.error || saveError}</Label>
      ) : null}
    </View>
  );
}
