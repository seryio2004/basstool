import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Chips, Label, colors, styles } from '../components/ui';
import { FretMark, Fretboard, plainName } from '../components/Fretboard';
import { tunings } from '../core/instrument';
import { parsePitch, pitchName } from '../core/notation';
import { arpeggios, positionsFor, scales, TheoryPattern } from '../core/theory';
import { useStore } from '../data/Store';
import { audio } from '../platform/audio';

const tonics = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
type Tonic = (typeof tonics)[number];
type Kind = 'scale' | 'arpeggio';
type LabelMode = 'note' | 'degree' | 'none';
type ScaleKey = keyof typeof scales;
type ArpeggioKey = keyof typeof arpeggios;

/** Selección curada: las más útiles primero, sin duplicar Mayor/Jónico ni Menor/Eólico. */
const scaleKeys: ScaleKey[] = [
  'major',
  'naturalMinor',
  'majorPentatonic',
  'minorPentatonic',
  'blues',
  'dorian',
  'mixolydian',
  'phrygian',
  'lydian',
  'locrian',
  'harmonicMinor',
  'melodicMinor',
];
const arpeggioKeys: ArpeggioKey[] = [
  'major',
  'minor',
  'dominant7',
  'major7',
  'minor7',
  'halfDiminished7',
  'diminished7',
  'diminished',
  'augmented',
  'sus2',
  'sus4',
  'minorMajor7',
  'augmentedMajor7',
];

export function FretboardTool() {
  const { profile } = useStore();
  const compact = useWindowDimensions().width < 700;
  const instrument = tunings[profile.tuning];
  const nomenclature = profile.nomenclature;
  const [tonic, setTonic] = useState<Tonic>('A');
  const [kind, setKind] = useState<Kind>('scale');
  const [scale, setScale] = useState<ScaleKey>('minorPentatonic');
  const [arpeggio, setArpeggio] = useState<ArpeggioKey>('minor7');
  const [labelMode, setLabelMode] = useState<LabelMode>('note');
  const [active, setActive] = useState<{ string: number; fret: number; midi: number } | null>(null);
  const [audioError, setAudioError] = useState('');

  const pattern: TheoryPattern = kind === 'scale' ? scales[scale] : arpeggios[arpeggio];
  const result = useMemo(() => {
    try {
      return { positions: positionsFor(tonic, pattern, instrument, undefined, nomenclature) };
    } catch {
      return { positions: null };
    }
  }, [tonic, pattern, instrument, nomenclature]);

  const marks: FretMark[] = (result.positions ?? []).map((p) => ({
    string: p.string,
    fret: p.fret,
    root: p.isRoot,
    label: labelMode === 'note' ? p.name : labelMode === 'degree' ? p.degreeLabel : '',
    description: `${p.name}, grado ${p.degreeLabel}`,
  }));
  // Notas de la escala en orden, una vez cada una, para leerlas de un vistazo.
  const tonicClass = parsePitch(`${tonic}4`).midi % 12;
  const sequence = pattern.tones.flatMap((tone) => {
    const p = result.positions?.find(
      (x) => (((x.midi - tonicClass) % 12) + 12) % 12 === tone.semitones,
    );
    return p ? [{ name: p.name, degree: p.degreeLabel }] : [];
  });

  async function play(string: number, fret: number, midi: number) {
    setActive({ string, fret, midi });
    try {
      await audio.ready();
      audio.tone(midi, audio.now() + 0.01, 0.9, 0.22);
      setAudioError('');
    } catch (e) {
      setAudioError((e as Error).message || 'No se pudo reproducir el sonido.');
    }
  }

  const tonicLabel = (t: Tonic) => pitchName(`${t}4`, false, nomenclature);
  const patternName = pattern.name.toLowerCase();

  return (
    <View style={{ gap: 22 }}>
      <View style={{ gap: 14 }}>
        <OptionRow compact={compact}>
          <Chips<Tonic>
            value={tonic}
            onChange={setTonic}
            options={tonics.map((t) => ({ value: t, label: tonicLabel(t) }))}
          />
        </OptionRow>
        <Chips<Kind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'scale', label: 'Escalas' },
            { value: 'arpeggio', label: 'Arpegios' },
          ]}
        />
        <OptionRow compact={compact}>
          {kind === 'scale' ? (
            <Chips<ScaleKey>
              value={scale}
              onChange={setScale}
              options={scaleKeys.map((k) => ({ value: k, label: scales[k].name }))}
            />
          ) : (
            <Chips<ArpeggioKey>
              value={arpeggio}
              onChange={setArpeggio}
              options={arpeggioKeys.map((k) => ({ value: k, label: arpeggios[k].name }))}
            />
          )}
        </OptionRow>
      </View>

      <View style={[styles.panel, { gap: 16, paddingHorizontal: 16 }]}>
        <View style={[styles.between, { paddingHorizontal: 8 }]}>
          <Text style={styles.h3}>
            {tonicLabel(tonic)} {kind === 'scale' ? patternName : `· arpegio ${patternName}`}
          </Text>
          <Chips<LabelMode>
            value={labelMode}
            onChange={setLabelMode}
            options={[
              { value: 'note', label: 'Notas' },
              { value: 'degree', label: 'Grados' },
              { value: 'none', label: 'Sin texto' },
            ]}
          />
        </View>
        {result.positions ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 8 }}>
              {sequence.map((n) => (
                <View
                  key={n.degree}
                  style={{
                    paddingVertical: 5,
                    paddingHorizontal: 9,
                    borderRadius: 6,
                    backgroundColor: n.degree === '1' ? colors.green : colors.pale,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: n.degree === '1' ? colors.white : colors.green,
                    }}
                  >
                    {n.name}
                    <Text style={{ fontWeight: '400' }}> · {n.degree}</Text>
                  </Text>
                </View>
              ))}
            </View>
            <Fretboard
              instrument={instrument}
              marks={marks}
              nomenclature={nomenclature}
              leftHanded={profile.leftHanded}
              active={active}
              onPress={(s, f, midi) => void play(s, f, midi)}
            />
          </>
        ) : (
          <Label muted style={{ paddingHorizontal: 8 }}>
            Esta combinación necesitaría alteraciones triples. Prueba con la tónica enarmónica (por
            ejemplo, Do♯ en lugar de Re♭).
          </Label>
        )}
        <Label muted style={{ paddingHorizontal: 8 }}>
          {active
            ? `Sonando: ${plainName(active.midi, nomenclature)} · ${active.fret === 0 ? 'cuerda al aire' : `traste ${active.fret}`}.`
            : 'Toca una casilla para escuchar la nota.'}{' '}
          {instrument.name}
          {profile.leftHanded ? ', zurdo' : ''}. Se cambia en Ajustes.
        </Label>
        {audioError ? (
          <Label style={{ color: colors.error, paddingHorizontal: 8 }}>{audioError}</Label>
        ) : null}
      </View>
    </View>
  );
}

/** En pantallas estrechas, una fila desplazable en lugar de varias líneas de opciones. */
function OptionRow({ compact, children }: { compact: boolean; children: React.ReactNode }) {
  if (!compact) return <>{children}</>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -20 }}
      contentContainerStyle={{ paddingHorizontal: 20 }}
    >
      {children}
    </ScrollView>
  );
}
