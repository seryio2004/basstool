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
import { Button, Field, Heading, Icon, Label, colors, styles } from './src/components/ui';
import { ToolsHome } from './src/screens/ToolsHome';
import { Transcribe } from './src/screens/Transcribe';
import { Learn } from './src/screens/Learn';
import { Practice } from './src/screens/Practice';
import { Progress } from './src/screens/Progress';
import { Exercise } from './src/screens/Exercise';
import { Onboarding, Settings } from './src/screens/Settings';
import { Tool, Tools } from './src/screens/Tools';
import { bootstrap } from './src/platform/bootstrap';
import { audio } from './src/platform/audio';
import { supabase } from './src/data/supabase';

const navigation: { id: Page; label: string; icon: string }[] = [
  { id: 'tools', label: 'Herramientas', icon: 'tuner' },
  { id: 'transcribe', label: 'Transcribir', icon: 'wave' },
  { id: 'learn', label: 'Aprender', icon: 'library' },
  { id: 'practice', label: 'Practicar', icon: 'practice' },
  { id: 'progress', label: 'Progreso', icon: 'progress' },
];

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const contentScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const store = useStore(),
    { profile, mode, loading } = store;
  const { width } = useWindowDimensions(),
    desktop = width >= 1000;
  const [page, setPage] = useState<Page>('tools'),
    [exercise, setExercise] = useState<Module | null>(null),
    [tool, setTool] = useState<Tool | null>(null);
  const [recovery, setRecovery] = useState(false);

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
  const navigate = (id: Page) => {
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
        <ActivityIndicator color={colors.green} />
        <Label>Cargando…</Label>
      </View>
    );

  const sectionLabel =
    page === 'settings' ? 'Ajustes' : navigation.find((n) => n.id === page)?.label || '';
  const content = !profile.configured ? (
    <Onboarding />
  ) : tool ? (
    <Tools tool={tool} onBack={() => setTool(null)} />
  ) : exercise ? (
    <Exercise module={exercise} onBack={() => setExercise(null)} />
  ) : page === 'tools' ? (
    <ToolsHome openTool={openTool} />
  ) : page === 'transcribe' ? (
    <Transcribe />
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
      {desktop ? (
        <View
          style={{
            width: 232,
            backgroundColor: '#F0F3EC',
            borderRightWidth: 1,
            borderRightColor: colors.line,
            paddingHorizontal: 20,
            paddingTop: 31,
            paddingBottom: 23,
            gap: 32,
          }}
        >
          <Brand />
          <View style={{ gap: 6 }}>
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
            minHeight: desktop ? 64 : 58,
            paddingHorizontal: desktop ? 38 : 20,
            backgroundColor: colors.white,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          {desktop ? (
            <Text style={{ color: colors.muted, fontSize: 13 }}>{sectionLabel}</Text>
          ) : (
            <Brand compact />
          )}
          <View style={styles.row}>
            {width >= 650 ? (
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {mode === 'remote' ? profile.email : 'Sin cuenta · datos en este dispositivo'}
              </Text>
            ) : null}
            {!desktop ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir ajustes"
                onPress={() => navigate('settings')}
                style={{ padding: 10 }}
              >
                <Icon
                  name="settings"
                  size={22}
                  color={page === 'settings' ? colors.green : colors.muted}
                />
              </Pressable>
            ) : null}
          </View>
        </View>
        {store.message ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              backgroundColor: '#E5EFDF',
              paddingVertical: 10,
              paddingHorizontal: desktop ? 38 : 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: colors.green, fontSize: 13, flex: 1 }}>{store.message}</Text>
            <Button variant="ghost" small onPress={store.clearMessage}>
              Cerrar
            </Button>
          </View>
        ) : null}
        <ScrollView
          ref={contentScroll}
          key={`${page}-${tool || ''}-${exercise || ''}`}
          contentContainerStyle={{
            padding: desktop ? 36 : 20,
            paddingBottom: 50,
            maxWidth: 1400,
            width: '100%',
            alignSelf: 'center',
          }}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
        {!desktop && profile.configured ? (
          <View
            accessibilityRole="tablist"
            style={{
              flexDirection: 'row',
              backgroundColor: colors.white,
              borderTopWidth: 1,
              borderTopColor: colors.line,
              paddingHorizontal: 4,
              paddingTop: 6,
              paddingBottom: Platform.OS === 'ios' ? 24 : 8,
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

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.row, { gap: 9, paddingHorizontal: compact ? 0 : 10 }]}>
      <Icon name="practice" color={colors.green} size={compact ? 24 : 29} />
      <Text
        style={{
          fontSize: compact ? 21 : 28,
          color: colors.green,
          fontWeight: '700',
          letterSpacing: -1,
        }}
      >
        clasRo
      </Text>
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
    <View style={{ flex: 1, justifyContent: 'center', padding: 30, backgroundColor: colors.bg }}>
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
        gap: compact ? 4 : 12,
        minHeight: compact ? 52 : 44,
        paddingVertical: compact ? 6 : 12,
        paddingHorizontal: compact ? 2 : 12,
        ...(compact ? { flex: 1 } : {}),
        backgroundColor: active ? '#DDE8D5' : hovered ? '#E8EDE2' : 'transparent',
        borderRadius: 8,
      })}
    >
      <Icon name={icon} size={compact ? 20 : 19} color={active ? '#2D5738' : '#6C7866'} />
      <Text
        numberOfLines={1}
        style={{
          color: active ? '#2D5738' : '#5E6B59',
          fontSize: compact ? 10.5 : 13,
          fontWeight: active ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
