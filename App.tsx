import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { StoreProvider, useStore } from './src/data/Store';
import { Module, Page } from './src/core/types';
import { attemptBpm } from './src/core/dailyPractice';
import { formatTime } from './src/core/transcription';
import {
  Badge,
  Button,
  Field,
  Heading,
  Icon,
  Label,
  colors,
  fonts,
  styles,
} from './src/components/ui';
import { ThemeProvider, useTheme } from './src/components/theme';
import { BetaNotice } from './src/components/BetaNotice';
import { ThemeButton } from './src/components/ThemeButton';
import { ToolsHome } from './src/screens/ToolsHome';
import { Transcribe } from './src/screens/Transcribe';
import { Learn } from './src/screens/Learn';
import { Practice } from './src/screens/Practice';
import { Progress } from './src/screens/Progress';
import { Today } from './src/screens/Today';
import { FretboardTool } from './src/screens/FretboardTool';
import { useGuidedPractice } from './src/screens/useGuidedPractice';
import { Exercise } from './src/screens/Exercise';
import { Onboarding, Settings } from './src/screens/Settings';
import { Tool, Tools } from './src/screens/Tools';
import { bootstrap } from './src/platform/bootstrap';
import { audio } from './src/platform/audio';
import { supabase } from './src/data/supabase';

const navigation: { id: Page; label: string; icon: string }[] = [
  { id: 'today', label: 'Hoy', icon: 'calendar' },
  { id: 'tools', label: 'Herramientas', icon: 'tuner' },
  { id: 'transcribe', label: 'Transcribir', icon: 'wave' },
  { id: 'learn', label: 'Aprender', icon: 'library' },
  { id: 'practice', label: 'Practicar', icon: 'practice' },
  { id: 'progress', label: 'Progreso', icon: 'progress' },
];

export default function App() {
  return (
    <StoreProvider>
      <Themed />
    </StoreProvider>
  );
}

function Themed() {
  const { profile } = useStore();
  return (
    <ThemeProvider preference={profile.theme}>
      <Shell />
    </ThemeProvider>
  );
}

function Shell() {
  const { colors } = useTheme();
  const contentScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const store = useStore(),
    { profile, mode, loading } = store;
  const { width } = useWindowDimensions(),
    desktop = width >= 1000;
  const [page, setPage] = useState<Page>('today'),
    [exercise, setExercise] = useState<Module | null>(null),
    [tool, setTool] = useState<Tool | null>(null);
  const [recovery, setRecovery] = useState(false);
  const guide = useGuidedPractice();
  const block = guide.block;

  useEffect(() => {
    bootstrap();
    const listener = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => listener?.data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!store.message) return;
    const t = setTimeout(store.clearMessage, 5500);
    return () => clearTimeout(t);
  }, [store.message]);

  const reset = () => {
    audio.stop();
    store.clearMessage();
  };
  const navigate = async (id: Page) => {
    if (block && !(await guide.advance('exit'))) return;
    reset();
    setExercise(null);
    setTool(null);
    setPage(id);
  };
  const practice = (module: Module) => {
    reset();
    setTool(null);
    setPage('practice');
    setExercise(module);
  };
  const openTool = (id: Tool) => {
    reset();
    setExercise(null);
    setPage('tools');
    setTool(id);
  };

  if (recovery) return <PasswordRecovery onDone={() => setRecovery(false)} />;
  if (loading)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <ActivityIndicator color={colors.accent} />
        <Label>Cargando…</Label>
      </View>
    );

  const pad = desktop ? 40 : 20;
  const content = !profile.configured ? (
    <Onboarding />
  ) : block ? (
    block.kind === 'song' ? (
      <Transcribe
        key={guide.key}
        pagePadding={pad}
        onSongProgress={({ playing, ...metrics }) => guide.report(metrics, playing)}
      />
    ) : block.kind === 'scale' ? (
      <FretboardTool
        key={guide.key}
        practice={{ preset: block.preset, bpm: block.bpm, onBpm: (bpm) => guide.report({ bpm }) }}
      />
    ) : (
      <Exercise
        key={guide.key}
        module={block.module}
        preset={block.preset}
        onBack={() => void guide.advance('exit')}
        onPracticeResult={(result) =>
          guide.report({
            correct: result.correct,
            total: result.total,
            bpm: attemptBpm(result),
          })
        }
        onActivity={guide.activity}
      />
    )
  ) : tool ? (
    <Tools tool={tool} onBack={() => setTool(null)} />
  ) : exercise ? (
    <Exercise module={exercise} onBack={() => setExercise(null)} />
  ) : page === 'today' ? (
    <Today
      onStart={(kind, blocks, planDay) => guide.start(kind, profile.level, blocks, planDay)}
      onSettings={() => void navigate('settings')}
      finished={guide.finished}
      onDismiss={guide.clearFinished}
    />
  ) : page === 'tools' ? (
    <ToolsHome openTool={openTool} />
  ) : page === 'transcribe' ? (
    <Transcribe pagePadding={pad} />
  ) : page === 'learn' ? (
    <Learn
      practice={practice}
      scrollToTop={() => contentScroll.current?.scrollTo({ y: 0, animated: false })}
    />
  ) : page === 'practice' ? (
    <Practice practice={practice} />
  ) : page === 'progress' ? (
    <Progress openCourse={() => navigate('learn')} />
  ) : (
    <Settings />
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: Platform.OS === 'web' ? 0 : 45,
        flexDirection: desktop ? 'row' : 'column',
      }}
    >
      {desktop && profile.configured ? (
        <View
          style={{
            width: 240,
            backgroundColor: colors.chrome,
            borderRightWidth: 1,
            borderRightColor: colors.line,
            paddingHorizontal: 16,
            paddingTop: 32,
            paddingBottom: 24,
            gap: 36,
          }}
        >
          <Brand />
          <View style={{ gap: 4 }}>
            {navigation.map((n) => (
              <Nav
                key={n.id}
                label={n.label}
                icon={n.icon}
                active={page === n.id}
                onPress={() => navigate(n.id)}
              />
            ))}
          </View>
          <View style={{ flex: 1 }} />
          <Text style={[styles.muted, { fontSize: 12, lineHeight: 17, paddingHorizontal: 12 }]}>
            {mode === 'remote' ? profile.email : 'Sin cuenta · datos en este dispositivo'}
          </Text>
          <Nav
            label="Ajustes"
            icon="settings"
            active={page === 'settings'}
            onPress={() => navigate('settings')}
          />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            minHeight: desktop ? 48 : 56,
            paddingHorizontal: pad,
            backgroundColor: colors.chrome,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: desktop && profile.configured ? 'flex-end' : 'space-between',
            gap: 12,
          }}
        >
          {!desktop || !profile.configured ? <Brand compact /> : null}
          {desktop && profile.configured && Platform.OS === 'web' ? <BetaBadge /> : null}
          <View style={[styles.row, { gap: 4 }]}>
            {!desktop && profile.configured ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir ajustes"
                onPress={() => navigate('settings')}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon
                  name="settings"
                  size={22}
                  color={page === 'settings' ? colors.accentText : colors.muted}
                />
              </Pressable>
            ) : null}
            <ThemeButton
              onChange={(theme) => void store.updateProfile({ theme }).catch(() => {})}
            />
          </View>
        </View>
        {Platform.OS === 'web' ? <BetaNotice padding={pad} /> : null}
        {store.message ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              backgroundColor: colors.raised,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
              paddingVertical: 6,
              paddingLeft: pad,
              paddingRight: pad - 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Icon name="check" size={18} color={colors.success} />
            <Text style={[styles.text, { fontSize: 14, flex: 1 }]}>{store.message}</Text>
            <Button variant="ghost" small onPress={store.clearMessage}>
              Cerrar
            </Button>
          </View>
        ) : null}
        {block ? (
          <View
            style={{
              paddingHorizontal: pad,
              paddingVertical: 10,
              gap: 8,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            }}
          >
            <View style={styles.between}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.legend}>
                  {guide.title} · {guide.index + 1}/{guide.count}
                </Text>
                <Text style={styles.h3}>{block.title}</Text>
              </View>
              <Text
                style={[styles.data, { fontSize: 22, color: colors.accentText }]}
                accessibilityLabel={`Tiempo restante ${formatTime(block.seconds - guide.seconds)}`}
              >
                {formatTime(block.seconds - guide.seconds)}
              </Text>
            </View>
            {block.instruction ? <Label muted>{block.instruction}</Label> : null}
            {guide.seconds >= block.seconds && guide.needsResult ? (
              <Label muted>Completa un intento para continuar.</Label>
            ) : null}
            <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>
              <Button
                small
                onPress={() => void guide.advance('next')}
                disabled={!guide.canAdvance}
                busy={guide.busy}
              >
                {guide.index + 1 === guide.count ? 'Terminar sesión' : 'Siguiente bloque'}
              </Button>
              <Button
                small
                variant="secondary"
                disabled={guide.busy}
                onPress={() => void guide.advance('skip')}
              >
                Saltar bloque
              </Button>
              <Button
                small
                variant="ghost"
                disabled={guide.busy}
                onPress={() => void guide.advance('exit')}
              >
                Salir
              </Button>
            </View>
            {guide.error ? <Label style={{ color: colors.error }}>{guide.error}</Label> : null}
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          {profile.configured &&
          (block?.kind === 'song' || (page === 'transcribe' && !tool && !exercise)) ? (
            content
          ) : (
            <ScrollView
              ref={contentScroll}
              key={guide.key || `${page}-${tool || ''}-${exercise || ''}`}
              contentContainerStyle={{
                padding: pad,
                paddingTop: desktop ? 44 : 24,
                paddingBottom: 56,
                maxWidth: 1200,
                width: '100%',
                alignSelf: 'center',
              }}
              keyboardShouldPersistTaps="handled"
            >
              {content}
            </ScrollView>
          )}
        </View>
        {!desktop && profile.configured ? (
          <View
            accessibilityRole="tablist"
            style={{
              flexDirection: 'row',
              backgroundColor: colors.chrome,
              borderTopWidth: 1,
              borderTopColor: colors.line,
              paddingHorizontal: 4,
              paddingTop: 4,
              paddingBottom: Platform.OS === 'ios' ? 24 : 6,
            }}
          >
            {navigation.map((n) => (
              <Nav
                key={n.id}
                label={n.label}
                icon={n.icon}
                active={page === n.id}
                onPress={() => navigate(n.id)}
                compact
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Marca: piloto de ampli encendido y el nombre en la serif de títulos. */
function Brand({ compact = false }: { compact?: boolean }) {
  const lamp = compact ? 10 : 12;
  return (
    <View style={[styles.row, { gap: 10, paddingHorizontal: compact ? 0 : 12 }]}>
      <View
        style={{
          width: lamp + 8,
          height: lamp + 8,
          borderRadius: lamp,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: lamp,
            height: lamp,
            borderRadius: lamp / 2,
            backgroundColor: colors.accent,
          }}
        />
      </View>
      <Text
        style={{
          fontSize: compact ? 23 : 28,
          lineHeight: compact ? 28 : 34,
          color: colors.ink,
          fontFamily: fonts.display,
          fontWeight: '600',
          letterSpacing: -0.5,
        }}
      >
        clasRo
      </Text>
      {compact && Platform.OS === 'web' ? <BetaBadge /> : null}
    </View>
  );
}

function BetaBadge() {
  return (
    <View style={{ alignSelf: 'center' }}>
      <Badge color={colors.accentText} background={colors.accentSoft}>
        Beta
      </Badge>
    </View>
  );
}

function PasswordRecovery({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save() {
    if (password.length < 8) return setError('Usa al menos 8 caracteres.');
    setBusy(true);
    const result = await supabase!.auth.updateUser({ password });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else onDone();
  }
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg }}>
      <View style={[styles.panel, { maxWidth: 480, width: '100%', alignSelf: 'center' }]}>
        <Heading level={1} style={styles.title}>
          Nueva contraseña
        </Heading>
        <Field
          label="Contraseña (mínimo 8 caracteres)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Button busy={busy} onPress={() => void save()}>
          Guardar contraseña
        </Button>
        {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
      </View>
    </View>
  );
}

function Nav({
  label,
  icon,
  active,
  onPress,
  compact = false,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const { width } = useWindowDimensions();
  const tint = active ? colors.accentText : colors.muted;
  return (
    <Pressable
      accessibilityRole={compact ? 'tab' : 'button'}
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
        flexDirection: compact ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: compact ? 'center' : 'flex-start',
        gap: compact ? 3 : 12,
        minHeight: compact ? 56 : 46,
        paddingVertical: compact ? 6 : 12,
        paddingHorizontal: compact ? 2 : 12,
        ...(compact ? { flex: 1 } : {}),
        backgroundColor: compact
          ? 'transparent'
          : active
            ? colors.accentSoft
            : hovered
              ? colors.raised
              : 'transparent',
        borderRadius: 10,
      })}
    >
      {compact ? (
        // Piloto encendido sobre la pestaña activa.
        <View
          style={{
            width: 18,
            height: 3,
            borderRadius: 2,
            marginBottom: 3,
            backgroundColor: active ? colors.accent : 'transparent',
          }}
        />
      ) : null}
      <Icon name={icon} size={compact ? 21 : 20} color={tint} />
      <Text
        numberOfLines={1}
        style={{
          color: active ? colors.accentText : compact ? colors.muted : colors.ink,
          fontFamily: fonts.body,
          fontSize: compact ? (label === 'Herramientas' && width < 400 ? 9 : 11) : 15,
          fontWeight: active ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
