import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Button, Chips, Label, colors, styles } from '../components/ui';
import { DegreeLegend } from '../components/DegreeLegend';
import { FretMark, Fretboard, plainName } from '../components/Fretboard';
import { tunings } from '../core/instrument';
import { pitchName } from '../core/notation';
import { arpeggios, namedTones, positionsFor, scales, TheoryPattern } from '../core/theory';
import { useStore } from '../data/Store';
import type { ScalePreset } from '../core/dailyPractice';
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

export function FretboardTool({
  practice,
}: {
  practice?: { preset: ScalePreset; bpm: number; onBpm: (bpm: number) => void };
} = {}) {
  const { profile } = useStore();
  const compact = useWindowDimensions().width < 700;
  const instrument = tunings[profile.tuning];
  const nomenclature = profile.nomenclature;
  const [tonic, setTonic] = useState<Tonic>(practice?.preset.tonic ?? 'A');
  const [kind, setKind] = useState<Kind>('scale');
  const [scale, setScale] = useState<ScaleKey>(practice?.preset.scale ?? 'minorPentatonic');
  const [arpeggio, setArpeggio] = useState<ArpeggioKey>('minor7');
  const [colored, setColored] = useState(true);
  const [labelMode, setLabelMode] = useState<LabelMode>('degree');
  const [active, setActive] = useState<{ string: number; fret: number; midi: number } | null>(null);
  const [audioError, setAudioError] = useState('');
  const [pulse, setPulse] = useState(false);
  const playingTone = useRef(0);
  const practiceBpm = practice?.bpm;
  const reached = useRef(practice?.onBpm);
  reached.current = practice?.onBpm;

  useEffect(() => {
    if (!practiceBpm || !pulse) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let next = 0;
    const schedule = () => {
      const time = audio.now();
      if (next < time) next = time + 0.02;
      while (next < time + 0.1) {
        audio.click(next, false);
        next += 60 / practiceBpm;
      }
    };
    void audio
      .ready()
      .then(() => {
        if (cancelled) return;
        schedule();
        timer = setInterval(schedule, 25);
        reached.current?.(practiceBpm);
      })
      .catch((cause) => {
        if (cancelled) return;
        setAudioError((cause as Error).message);
        setPulse(false);
      });
    return () => {
      cancelled = true;
      clearInterval(timer);
      audio.stop();
    };
  }, [practiceBpm, pulse]);

  useEffect(
    () => () => {
      playingTone.current++;
    },
    [],
  );

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
    degree: colored ? p.degree : undefined,
    degreeLabel: p.degreeLabel,
    label: colored
      ? p.degreeLabel
      : labelMode === 'note'
        ? p.name
        : labelMode === 'degree'
          ? p.degreeLabel
          : '',
    description: `${p.name}, grado ${p.degreeLabel}`,
  }));
  const sequence = result.positions ? namedTones(tonic, pattern, nomenclature) : [];

  async function play(string: number, fret: number, midi: number) {
    const token = ++playingTone.current;
    setActive({ string, fret, midi });
    try {
      await audio.ready();
      if (token !== playingTone.current) return;
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
      {practice ? (
        <Button
          variant="secondary"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => {
            setAudioError('');
            setPulse(!pulse);
          }}
        >
          {pulse ? 'Detener pulso' : `Marcar pulso · ${practice.bpm} BPM`}
        </Button>
      ) : (
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
      )}

      <View style={[styles.panel, { gap: 16, paddingHorizontal: 16 }]}>
        <View style={[styles.between, { paddingHorizontal: 8 }]}>
          <Text style={styles.h3}>
            {tonicLabel(tonic)} {kind === 'scale' ? patternName : `· arpegio ${patternName}`}
          </Text>
          {!colored && (
            <Chips<LabelMode>
              value={labelMode}
              onChange={setLabelMode}
              options={[
                { value: 'note', label: 'Notas' },
                { value: 'degree', label: 'Grados' },
                { value: 'none', label: 'Sin texto' },
              ]}
            />
          )}
        </View>
        {result.positions ? (
          <>
            <Chips
              label="Color del mástil"
              value={colored ? 'degree' : 'plain'}
              minHeight={44}
              onChange={(mode) => setColored(mode === 'degree')}
              options={[
                { value: 'degree', label: 'Color por grado' },
                { value: 'plain', label: 'Sin color' },
              ]}
            />
            <DegreeLegend tones={sequence} colored={colored} />
            <Fretboard
              instrument={instrument}
              marks={marks}
              nomenclature={nomenclature}
              monochrome={!colored}
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
