import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Chips, Field, Label, styles } from './ui';
import type { Measure } from '../core/scoreTypes';
import type { ChordGuess } from '../core/chroma';
export function ChordEditor({
  bar,
  beats,
  suggest,
  onSave,
}: {
  bar: Measure;
  beats: number;
  suggest: (() => ChordGuess | null) | null;
  onSave: (beat: number, symbol: string) => void;
}) {
  const [beat, setBeat] = useState(0),
    [draft, setDraft] = useState<string | null>(null);
  const [guess, setGuess] = useState<ChordGuess | null | undefined>();
  useEffect(() => {
    if (!suggest) return;
    const timer = setTimeout(() => setGuess(suggest()), 0);
    return () => clearTimeout(timer);
  }, [suggest]);
  const written = bar.chords?.find((c) => c.beat === beat)?.symbol ?? '';
  const value = draft ?? written;
  return (
    <View style={{ gap: 8 }}>
      <Label>Pulso</Label>
      <Chips
        value={String(beat)}
        options={Array.from({ length: beats }, (_, i) => ({
          value: String(i),
          label: String(i + 1),
        }))}
        onChange={(v) => {
          setBeat(Number(v));
          setDraft(null);
        }}
      />
      <Field label="Cifrado" value={value} onChangeText={setDraft} placeholder="Am7" />
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Button
          disabled={!value.trim() || value.trim() === written}
          onPress={() => {
            onSave(beat, value.trim());
            setDraft(null);
          }}
        >
          Guardar acorde
        </Button>
        <Button
          variant="ghost"
          disabled={!written}
          onPress={() => {
            onSave(beat, '');
            setDraft(null);
          }}
        >
          Quitar
        </Button>
      </View>
      {guess ? (
        <View style={styles.row}>
          <Label>
            Sugerencia {guess.symbol} · Confianza {Math.round(guess.confidence * 100)} %
          </Label>
          <Button variant="ghost" onPress={() => setDraft(guess.symbol)}>
            Usar sugerencia
          </Button>
        </View>
      ) : guess === null ? (
        <Label muted>Sin acorde reconocible.</Label>
      ) : suggest ? (
        <Label muted>Analizando el compás…</Label>
      ) : null}
      {!suggest ? <Label muted>Marca el compás en el audio para analizarlo.</Label> : null}
    </View>
  );
}
