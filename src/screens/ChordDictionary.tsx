import React, { useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { DegreeLegend } from '../components/DegreeLegend';
import { Fretboard } from '../components/Fretboard';
import { Button, Chips, Label, MoreMenu, colors, space, styles } from '../components/ui';
import { chordRoots, chordShapes, type ChordRoot, type ChordQuality } from '../core/chordShapes';
import { tunings } from '../core/instrument';
import { pitchName } from '../core/notation';
import { dictionaryArpeggios } from '../core/theory';
import { useStore } from '../data/Store';
import { useReferencePlayback } from './useReferencePlayback';

const qualityOptions = Object.entries(dictionaryArpeggios).map(([value, pattern]) => ({
  value: value as ChordQuality,
  label: value ? value.replace('b5', '♭5') : pattern.name,
}));

export function ChordDictionary() {
  const { profile } = useStore();
  const { leftHanded, nomenclature, scale } = profile;
  const instrument = tunings[profile.tuning];
  const [root, setRoot] = useState<ChordRoot>('C');
  const [quality, setQuality] = useState<ChordQuality>('');
  const [index, setIndex] = useState(0);
  const [colored, setColored] = useState(true);
  const player = useReferencePlayback(profile.referenceHz);
  const web = Platform.OS === 'web';
  const { spelling, legend, shapes } = useMemo(
    () => chordShapes(root, quality, instrument, scale, nomenclature),
    [root, quality, instrument, scale, nomenclature],
  );
  const shape = shapes[index] ?? shapes[0];
  const name = pitchName(spelling + '4', false, nomenclature);
  const sections = !shape
    ? []
    : shape.splitAt
      ? [shape.notes.slice(0, shape.splitAt), shape.notes.slice(shape.splitAt)]
      : [shape.notes];
  const suffix = qualityOptions.find((option) => option.value === quality)?.label;

  function play(mode: 'arpeggio' | 'block') {
    if (!shape) return;
    if (player.playing === mode) {
      player.stop();
      return;
    }
    const notes = shape.notes;
    const oneOctave = notes.filter((note) => note.midi < notes[0]!.midi + 12);
    const sequence = mode === 'arpeggio' ? [...notes, ...notes.slice(0, -1).reverse()] : oneOctave;
    // A shape may reuse a string. In that case a fast rake keeps all voices audible.
    const together = new Set(sequence.map((note) => note.string)).size === sequence.length;
    const spacing = mode === 'arpeggio' ? 0.24 : together ? 0 : 0.045;
    const duration = mode === 'arpeggio' ? 0.21 : 0.7;
    void player.play(
      mode,
      sequence.map(({ midi }, i) => ({ midi, at: i * spacing, seconds: duration })),
    );
  }

  return (
    <View style={{ gap: space.l }}>
      <View style={[styles.panel, { gap: space.m }]}>
        <Chips<ChordRoot>
          label="Raíz"
          minHeight={44}
          value={root}
          onChange={(next) => {
            player.stop();
            setRoot(next);
            setIndex(0);
          }}
          options={chordRoots.map((value) => ({
            value,
            label: pitchName(value + '4', false, nomenclature),
          }))}
        />
        <MoreMenu label={`Calidad · ${dictionaryArpeggios[quality].name}`}>
          <Chips<ChordQuality>
            label="Calidad del acorde"
            minHeight={44}
            value={quality}
            onChange={(next) => {
              player.stop();
              setQuality(next);
              setIndex(0);
            }}
            options={qualityOptions}
          />
        </MoreMenu>
        <Text style={styles.h2}>
          {name}
          {quality ? suffix : ' mayor'}
        </Text>
        <DegreeLegend colored={colored} tones={legend} />
        <Chips
          label="Color de la digitación"
          value={colored ? 'degree' : 'plain'}
          minHeight={44}
          onChange={(mode) => setColored(mode === 'degree')}
          options={[
            { value: 'degree', label: 'Color por grado' },
            { value: 'plain', label: 'Sin color' },
          ]}
        />
        {web && shape ? (
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            <Button
              icon={player.playing === 'arpeggio' ? 'pause' : 'play'}
              onPress={() => play('arpeggio')}
            >
              {player.playing === 'arpeggio' ? 'Detener arpegio' : 'Arpegio'}
            </Button>
            <Button variant="secondary" onPress={() => play('block')}>
              {player.playing === 'block' ? 'Detener bloque' : 'Bloque'}
            </Button>
          </View>
        ) : !web ? (
          <Label muted>Disponible en la versión web</Label>
        ) : null}
        {player.error ? <Label style={{ color: colors.error }}>{player.error}</Label> : null}
      </View>
      <View style={[styles.panel, { gap: space.m, paddingHorizontal: space.l }]}>
        <Label muted>
          {instrument.name} · {scale}″{leftHanded ? ' · Zurdo' : ''}
        </Label>
        <Chips<number>
          label="Digitación"
          minHeight={44}
          value={index}
          onChange={(next) => {
            player.stop();
            setIndex(next);
          }}
          options={shapes.map(({ kind, firstFret, lastFret }, value) => ({
            value,
            label:
              kind === 'open'
                ? 'Abierta'
                : kind === 'twoOctaves'
                  ? 'Dos octavas'
                  : `Caja ${firstFret}–${lastFret}`,
          }))}
        />
        {sections.map((notes, i) => (
          <View key={`${index}:${i}`} style={{ gap: space.s }}>
            {sections.length > 1 && (
              <Label muted>
                {i === 0 ? 'Primera octava' : 'Segunda octava · Cambio de posición'}
              </Label>
            )}
            <Fretboard
              compact
              instrument={instrument}
              nomenclature={nomenclature}
              monochrome={!colored}
              leftHanded={leftHanded}
              fretWindow={{
                min: Math.min(...notes.map((note) => note.fret)),
                max: Math.max(...notes.map((note) => note.fret)),
              }}
              marks={notes.map((note) => ({
                ...note,
                root: note.isRoot,
                degree: colored ? note.degree : undefined,
                label: note.degreeLabel,
                description: `${note.name}, grado ${note.degreeLabel}`,
              }))}
              onPress={
                web
                  ? (_string, _fret, midi) =>
                      void player.play('note', [{ midi, at: 0, seconds: 0.55 }])
                  : undefined
              }
            />
          </View>
        ))}
        {!shape && <Label muted>El acorde completo no cabe en esta afinación.</Label>}
      </View>
    </View>
  );
}
