import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Tab } from '../components/Tab';
import { Button, Chips, Field, Label, MoreMenu, colors, space, styles } from '../components/ui';
import { techniques, techniqueTab, type TechniqueId } from '../content/technique';
import type { PracticeSession } from '../core/dailyPractice';
import { tunings } from '../core/instrument';
import { levels } from '../core/profile';
import { techniquePracticeSession } from '../core/techniquePractice';
import { uid } from '../core/types';
import { useStore } from '../data/Store';
import { startMetronome, type Transport } from '../platform/drumMachine';
import { SpeedTrainerTool } from './RhythmTools';

type GuidedTechnique = { id: TechniqueId; bpm: number; onBpm: (bpm: number) => void };
type Run = {
  id: string;
  technique: TechniqueId;
  bpm: number;
  level: PracticeSession['level'];
  save: (session: PracticeSession) => Promise<void>;
  started?: { date: Date; clock: number };
  player?: Transport;
};

const tempoText = (id: TechniqueId, guided?: GuidedTechnique) =>
  String(guided?.bpm ?? techniques[id].bpm);
const exerciseIds = Object.keys(techniques) as TechniqueId[];

function finish(run: Run, guided: boolean) {
  run.player?.stop();
  if (!guided && run.started) {
    const seconds = Math.max(1, Math.round((performance.now() - run.started.clock) / 1000));
    return techniquePracticeSession(
      run.id,
      run.technique,
      run.level,
      run.started.date,
      seconds,
      run.bpm,
    );
  }
}

export function TechniqueTool({ practice }: { practice?: GuidedTechnique } = {}) {
  const { profile, savePractice } = useStore();
  const [id, setId] = useState<TechniqueId>(practice?.id ?? 'chromatic');
  const [tempo, setTempo] = useState(() => tempoText(id, practice));
  const [speed, setSpeed] = useState(false);
  const [tabWidth, setTabWidth] = useState(304);
  const [beat, setBeat] = useState<number>();
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<number>();
  const [retry, setRetry] = useState<PracticeSession>();
  const [error, setError] = useState('');
  const active = useRef<Run | null>(null);
  const mounted = useRef(false);
  const isGuided = Boolean(practice);
  const onBpm = useRef(practice?.onBpm);
  onBpm.current = practice?.onBpm;
  const maxGuidedBpm = useRef(0);
  const exercise = techniques[id];
  const instrument = tunings[profile.tuning];
  const notes = useMemo(() => techniqueTab(id, instrument), [id, instrument]);
  const bpm = Number(tempo);
  const valid = Number.isInteger(bpm) && bpm >= 40 && bpm <= 240;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const run = active.current;
      active.current = null;
      if (!run) return;
      const session = finish(run, isGuided);
      if (session) void run.save(session).catch(() => {}); // Store shows persistence errors.
    };
  }, [isGuided]);

  async function persist(session: PracticeSession, save = savePractice) {
    setSaving(true);
    setError('');
    try {
      await save(session);
      if (!mounted.current) return;
      setSaved(session.blocks[0]?.bpm);
      setRetry(undefined);
    } catch (failure) {
      if (!mounted.current) return;
      setRetry(session);
      setError((failure as Error).message);
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  function stop() {
    const run = active.current;
    if (!run) return;
    active.current = null;
    const session = finish(run, isGuided);
    setRunning(false);
    setBeat(undefined);
    if (session) void persist(session, run.save);
  }

  async function play() {
    if (!valid || active.current || saving || retry) return;
    const run: Run = { id: uid(), technique: id, bpm, level: profile.level, save: savePractice };
    active.current = run;
    setError('');
    setSaved(undefined);
    setRunning(true);
    const onError = (failure: Error) => {
      if (active.current !== run) return;
      stop();
      setError(failure.message);
    };
    try {
      const player = await startMetronome(bpm, 4, {
        onError,
        onStep({ step }) {
          if (active.current !== run) return;
          setBeat(step);
          if (!run.started) {
            run.started = { date: new Date(), clock: performance.now() };
            maxGuidedBpm.current = Math.max(maxGuidedBpm.current, bpm);
            onBpm.current?.(maxGuidedBpm.current);
          }
        },
      });
      if (active.current === run) run.player = player;
      else player.stop();
    } catch (failure) {
      onError(failure as Error);
    }
  }

  return (
    <View style={{ gap: space.l }}>
      <View style={[styles.panel, { gap: space.m }]}>
        {!practice && !speed && (
          <MoreMenu label="Elegir ejercicio">
            {running || saving || retry ? (
              <Label muted>Termina la sesión para cambiar de ejercicio.</Label>
            ) : (
              <Chips<TechniqueId>
                label="Ejercicios de técnica"
                minHeight={44}
                value={id}
                onChange={(next) => {
                  setId(next);
                  setTempo(tempoText(next));
                  setSaved(undefined);
                  setError('');
                }}
                options={exerciseIds.map((value) => ({ value, label: techniques[value].title }))}
              />
            )}
          </MoreMenu>
        )}
        <Text style={styles.h2}>{exercise.title}</Text>
        <Label muted>
          {levels.find(({ value }) => value === exercise.level)?.label} · {exercise.bpm} BPM
          recomendados
        </Label>
        <Label>{exercise.description}</Label>
        <Label muted>Un compás en corcheas · Repite al terminar.</Label>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          onLayout={({ nativeEvent }) => {
            setTabWidth(Math.min(304, Math.max(240, Math.floor(nativeEvent.layout.width))));
          }}
        >
          <Tab
            notes={notes}
            instrument={instrument}
            nomenclature={profile.nomenclature}
            annotations={notes.map(({ articulation }) => articulation)}
            width={tabWidth}
            active={beat === undefined ? -1 : beat * 2}
          />
        </ScrollView>
      </View>

      {speed ? (
        <>
          <Button
            variant="ghost"
            icon="back"
            style={{ alignSelf: 'flex-start' }}
            onPress={() => setSpeed(false)}
          >
            Volver al metrónomo
          </Button>
          <SpeedTrainerTool technique={{ id, bpm }} />
        </>
      ) : (
        <View style={[styles.panel, { gap: space.m }]}>
          {running ? (
            <Text style={styles.data}>
              {bpm} BPM{beat === undefined ? '' : ` · Pulso ${beat + 1} de 4`}
            </Text>
          ) : (
            <>
              <Field
                label="Tempo (BPM)"
                value={tempo}
                onChangeText={setTempo}
                keyboardType="numeric"
              />
              {!valid && <Label muted>Elige entre 40 y 240 BPM.</Label>}
            </>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            <Button
              icon={running ? 'pause' : 'metronome'}
              disabled={!valid || saving || !!retry}
              onPress={() => (running ? stop() : void play())}
            >
              {running
                ? practice
                  ? 'Detener metrónomo'
                  : 'Detener y guardar'
                : 'Iniciar metrónomo'}
            </Button>
            {!practice && !running && (
              <Button
                variant="secondary"
                icon="speed"
                disabled={!valid || saving || !!retry}
                onPress={() => setSpeed(true)}
              >
                Entrenar velocidad
              </Button>
            )}
            {retry && (
              <Button variant="secondary" onPress={() => void persist(retry)} disabled={saving}>
                Reintentar guardado
              </Button>
            )}
          </View>
          {saved !== undefined && <Label>Guardado en el diario · {saved} BPM</Label>}
          {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
        </View>
      )}
    </View>
  );
}
