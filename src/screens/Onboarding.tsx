import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type DimensionValue,
} from 'react-native';
import { BassPreview } from '../components/BassPreview';
import { Button, Chips, Heading, Label, Toggle, styles } from '../components/ui';
import { useTheme } from '../components/theme';
import { useReducedMotion } from '../components/harmony/DiagramCanvas';
import { practiceGoals, practiceMinutes, weekDays } from '../core/dailyPractice';
import {
  onboardingDraft,
  onboardingGoalLimit,
  onboardingResult,
  onboardingSteps,
  toggleGoal,
  type OnboardingDraft,
} from '../core/onboarding';
import type { Level } from '../core/profile';
import { useStore } from '../data/Store';
import { FavoriteSongFields } from './FavoriteSongs';
import { BassForm, Group, NomenclatureChips } from './Settings';

const levelCards: { value: Level; label: string; detail: string }[] = [
  {
    value: 'beginner',
    label: 'Iniciación',
    detail: 'Estoy empezando o vuelvo tras un tiempo: notas, pulso, primeras líneas.',
  },
  {
    value: 'intermediate',
    label: 'Intermedio',
    detail: 'Toco canciones; quiero groove, escalas y leer mejor.',
  },
  { value: 'advanced', label: 'Avanzado', detail: 'Busco técnica, armonía y velocidad.' },
];
const dayNames: Record<number, string> = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
  0: 'domingo',
};
const nativeDriver = Platform.OS !== 'web';

/** Primera experiencia: cinco pasos y llegada a Hoy con la rutina hecha. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const store = useStore();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const reduced = useReducedMotion();
  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    onboardingDraft(store.profile, store.daily.settings),
  );
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const title = useRef<React.ComponentRef<typeof View>>(null);
  const shown = useRef(new Animated.Value(1)).current;
  const direction = useRef(1);
  const first = useRef(true);
  const last = step === onboardingSteps.length - 1;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scroll.current?.scrollTo({ y: 0, animated: false });
    // El foco va al título del paso para que el lector de pantalla lo anuncie.
    const node = title.current as unknown as { focus?: () => void } | null;
    if (Platform.OS === 'web') node?.focus?.();
    else if (title.current) AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus');
    if (reduced) return shown.setValue(1);
    shown.setValue(0);
    const animation = Animated.timing(shown, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [step]);

  const go = (next: number) => {
    direction.current = next > step ? 1 : -1;
    setStep(next);
  };
  const finish = async () => {
    const result = onboardingResult(draft);
    setBusy(true);
    try {
      await store.updatePracticeSettings(result.practice);
      await store.updateProfile(result.profile);
      store.clearMessage();
      onDone();
    } catch {
      setBusy(false);
    }
  };
  const setProfile = (profile: Partial<OnboardingDraft['profile']>) =>
    setDraft((d) => ({ ...d, profile: { ...d.profile, ...profile } }));
  const setPractice = (practice: Partial<OnboardingDraft['practice']>) =>
    setDraft((d) => ({ ...d, practice: { ...d.practice, ...practice } }));

  const screens = [
    {
      title: 'Tu práctica diaria de bajo',
      body: (
        <View style={{ gap: 20 }}>
          <Label>
            Cada día te preparamos una rutina corta para tu nivel. Además puedes transcribir tus
            canciones y tienes a mano afinador, metrónomo y mástil.
          </Label>
          <BassPreview
            tuning={draft.profile.tuning}
            scale={draft.profile.scale}
            leftHanded={draft.profile.leftHanded}
          />
          <Label muted>Tus datos se quedan en este dispositivo.</Label>
        </View>
      ),
    },
    {
      title: 'Tu bajo',
      intro: 'El afinador, el mástil y los ejercicios se adaptan a tu instrumento.',
      body: <BassForm value={draft.profile} onChange={(p) => setProfile(p)} />,
    },
    {
      title: 'Tu nivel',
      intro: 'Ajusta el tempo y la dificultad de tus rutinas. Puedes cambiarlo cuando quieras.',
      body: (
        <View style={{ gap: 24 }}>
          <View accessibilityRole="radiogroup" accessibilityLabel="Nivel" style={{ gap: 12 }}>
            {levelCards.map((card) => (
              <Card
                key={card.value}
                selected={draft.profile.level === card.value}
                label={card.label}
                detail={card.detail}
                onPress={() => setProfile({ level: card.value })}
              />
            ))}
          </View>
          <Group title="Nombres de las notas">
            <NomenclatureChips
              value={draft.profile.nomenclature}
              onChange={(nomenclature) => setProfile({ nomenclature })}
            />
          </Group>
        </View>
      ),
    },
    {
      title: 'Tus objetivos y tu tiempo',
      intro: 'Tus objetivos reciben más minutos en la rutina.',
      body: (
        <View style={{ gap: 24 }}>
          <Group title={`Objetivos · hasta ${onboardingGoalLimit}`}>
            <View
              accessibilityLabel={`Objetivos, ${draft.practice.goals.length} de ${onboardingGoalLimit} elegidos`}
              style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}
            >
              {practiceGoals.map(({ value, label }) => {
                const checked = draft.practice.goals.includes(value);
                return (
                  <Option
                    key={value}
                    checked={checked}
                    disabled={!checked && draft.practice.goals.length >= onboardingGoalLimit}
                    label={label}
                    onPress={() => setPractice({ goals: toggleGoal(draft.practice.goals, value) })}
                  />
                );
              })}
            </View>
          </Group>
          <Group title="Tiempo al día">
            <Chips
              label="Tiempo al día"
              minHeight={44}
              value={draft.practice.minutes}
              options={practiceMinutes.map((value) => ({ value, label: `${value} min` }))}
              onChange={(minutes) => setPractice({ minutes })}
            />
          </Group>
          <Group title="Días de práctica">
            <View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>
              {weekDays.map(({ value, label }) => {
                const checked = draft.practice.days.includes(value);
                return (
                  <Option
                    key={value}
                    checked={checked}
                    label={label}
                    accessibilityLabel={dayNames[value]}
                    onPress={() =>
                      setPractice({
                        days: checked
                          ? draft.practice.days.filter((d) => d !== value)
                          : [...draft.practice.days, value],
                      })
                    }
                  />
                );
              })}
            </View>
          </Group>
          <Toggle
            label="Proteger un día de descanso"
            detail="Si un día no puedes, tu racha sigue. Uno por semana."
            value={draft.practice.restDay}
            onChange={(restDay) => setPractice({ restDay })}
          />
        </View>
      ),
    },
    {
      title: 'Canciones que te gustan',
      intro:
        'Las usaremos en el bloque «Tu canción» de tus rutinas: cuando tengas el audio, impórtalo en Transcribir.',
      body: (
        <View style={{ gap: 12 }}>
          <FavoriteSongFields
            value={draft.songs}
            onChange={(songs) => setDraft((d) => ({ ...d, songs }))}
          />
          <Label muted>Opcional. Puedes cambiarlas en Ajustes.</Label>
        </View>
      ),
    },
  ];
  const screen = screens[step]!;

  const actions = (
    <View style={[styles.row, { gap: 10 }]}>
      {step > 0 ? (
        <Button variant="secondary" disabled={busy} onPress={() => go(step - 1)}>
          Atrás
        </Button>
      ) : null}
      <Button
        style={{ flex: 1 }}
        busy={busy && last}
        disabled={busy}
        onPress={() => (last ? void finish() : go(step + 1))}
      >
        {step === 0 ? 'Empezar' : last ? 'Ver mi rutina' : 'Siguiente'}
      </Button>
    </View>
  );
  const pad = compact ? 20 : 40;
  const safeBottom = (
    Platform.OS === 'web'
      ? 'calc(12px + env(safe-area-inset-bottom))'
      : Platform.OS === 'ios'
        ? 28
        : 12
  ) as DimensionValue;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: pad,
          paddingTop: compact ? 16 : 40,
          paddingBottom: compact ? 32 : 56,
        }}
      >
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', gap: 24 }}>
          <View style={{ gap: 6 }}>
            <View style={styles.between}>
              <Text style={styles.legend}>
                {step + 1} de {onboardingSteps.length}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Saltar la configuración"
                accessibilityHint="Guarda lo elegido hasta ahora y abre Hoy"
                disabled={busy}
                onPress={() => void finish()}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
                  minHeight: 44,
                  minWidth: 44,
                  paddingHorizontal: 12,
                  marginRight: -12,
                  justifyContent: 'center',
                  borderRadius: 10,
                  backgroundColor: hovered ? colors.accentSoft : 'transparent',
                })}
              >
                <Text style={[styles.muted, { textDecorationLine: 'underline' }]}>Saltar</Text>
              </Pressable>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={`Paso ${step + 1} de ${onboardingSteps.length}`}
              accessibilityValue={{ min: 1, max: onboardingSteps.length, now: step + 1 }}
              style={{ height: 4, borderRadius: 2, backgroundColor: colors.sunken }}
            >
              <View
                style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.accent,
                  width: `${((step + 1) * 100) / onboardingSteps.length}%`,
                }}
              />
            </View>
          </View>
          <Animated.View
            style={{
              gap: 20,
              opacity: shown,
              transform: [
                {
                  translateX: shown.interpolate({
                    inputRange: [0, 1],
                    outputRange: [direction.current * 16, 0],
                  }),
                },
              ],
            }}
          >
            <View style={{ gap: 8 }}>
              <View
                ref={title}
                {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : { accessible: true })}
                style={Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : undefined}
              >
                <Heading level={1} style={styles.title}>
                  {screen.title}
                </Heading>
              </View>
              {screen.intro ? <Label muted>{screen.intro}</Label> : null}
            </View>
            {screen.body}
          </Animated.View>
          {!compact ? actions : null}
          {store.error ? <Label style={{ color: colors.error }}>{store.error}</Label> : null}
        </View>
      </ScrollView>
      {compact ? (
        <View
          style={{
            backgroundColor: colors.chrome,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            paddingHorizontal: pad,
            paddingTop: 12,
            paddingBottom: safeBottom,
          }}
        >
          <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center' }}>{actions}</View>
        </View>
      ) : null}
    </View>
  );
}

/** Tarjeta grande de opción única. */
function Card({
  selected,
  label,
  detail,
  onPress,
}: {
  selected: boolean;
  label: string;
  detail: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${label}. ${detail}`}
      accessibilityState={{ selected, checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
        minHeight: 72,
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 4,
        borderRadius: 14,
        borderWidth: selected ? 2 : 1,
        margin: selected ? 0 : 1,
        borderColor: selected ? colors.accent : colors.line,
        borderTopColor: selected ? colors.accent : colors.sheen,
        backgroundColor: selected ? colors.accentSoft : hovered ? colors.raised : colors.surface,
      })}
    >
      <View style={[styles.row, { gap: 10 }]}>
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 2,
            borderColor: selected ? colors.accent : colors.lineStrong,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? (
            <View
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }}
            />
          ) : null}
        </View>
        <Text style={[styles.h3, { color: selected ? colors.accentText : colors.ink }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.muted, { paddingLeft: 28 }]}>{detail}</Text>
    </Pressable>
  );
}

/** Casilla con forma de chip para selecciones múltiples. */
function Option({
  checked,
  disabled = false,
  label,
  accessibilityLabel,
  onPress,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked, disabled }}
      aria-checked={checked}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        minHeight: 44,
        minWidth: 44,
        paddingVertical: 8,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: 8,
        opacity: disabled ? 0.45 : 1,
        borderColor: checked ? colors.accent : colors.line,
        backgroundColor: checked
          ? colors.accentSoft
          : pressed || hovered
            ? colors.sunken
            : colors.raised,
      })}
    >
      <Text
        style={[
          styles.text,
          {
            fontSize: 14,
            color: checked ? colors.accentText : colors.ink,
            fontWeight: checked ? '600' : '400',
          },
        ]}
      >
        {checked ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}
