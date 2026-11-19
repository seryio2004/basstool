import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Chips, Field, Label, styles } from './ui';
import { inferChord, type ChordGuess } from '../core/chroma';
import type { Instrument } from '../core/instrument';
import { chordSegment } from '../core/scoreAudio';
import type { Measure, Meter } from '../core/scoreTypes';

export function ChordEditor({
  bar,
  meter,
  instrument,
  suggestAudio,
  onSave,
}: {
  bar: Measure;
  meter: Meter;
  instrument: Instrument;
  suggestAudio: ((start: number, end: number) => ChordGuess | null) | null;
  onSave: (beat: number, symbol: string) => void;
}) {
  const [beat, setBeat] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const [audioGuess, setAudioGuess] = useState<ChordGuess | null>(null);
  const { start, end, notes } = useMemo(
    () => chordSegment(bar, meter, beat, instrument),
    [bar, meter, beat, instrument],
  );
  const writtenGuess = inferChord(notes);
  useEffect(() => {
    setAudioGuess(null);
    if (!suggestAudio) return;
    const timer = setTimeout(() => setAudioGuess(suggestAudio(start, end)), 0);
    return () => clearTimeout(timer);
  }, [suggestAudio, start, end]);
  const written = bar.chords?.find((c) => c.beat === beat)?.symbol ?? '';
  const value = draft ?? written;
  const agree = !!writtenGuess && writtenGuess.split('/')[0] === audioGuess?.symbol;
  return (
    <View style={{ gap: 8 }}>
      <Label>Pulso</Label>
      <Chips
        value={String(beat)}
        options={Array.from({ length: meter.beats }, (_, i) => ({
          value: String(i),
          label: String(i + 1),
        }))}
        onChange={(v) => {
          setBeat(Number(v));
          setDraft(null);
        }}
      />
      {writtenGuess || audioGuess ? (
        <View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>
          {writtenGuess ? (
            <Button variant="secondary" onPress={() => setDraft(writtenGuess)}>
              {writtenGuess} · {agree ? 'Notas y audio' : 'Notas escritas'}
            </Button>
          ) : null}
          {audioGuess && !agree ? (
            <Button variant="secondary" onPress={() => setDraft(audioGuess.symbol)}>
              {audioGuess.symbol} · Audio
            </Button>
          ) : null}
        </View>
      ) : null}
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
    </View>
  );
}
