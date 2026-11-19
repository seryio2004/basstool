import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Chips,
  Field,
  Heading,
  Label,
  Toggle,
  colors,
  styles,
} from '../components/ui';
import { BassPreview } from '../components/BassPreview';
import { tunings } from '../core/instrument';
import {
  BassScale,
  Level,
  Profile,
  ThemePreference,
  TuningId,
  bassScales,
  levels,
  themePreferences,
  tuningIds,
} from '../core/profile';
import { useStore } from '../data/Store';
import { PracticeSettings } from './PracticeSettings';

type InstrumentDraft = Pick<Profile, 'tuning' | 'scale' | 'level' | 'nomenclature' | 'leftHanded'>;

/** Formulario compartido por la configuración inicial y los ajustes. */
export function InstrumentForm({
  value,
  onChange,
}: {
  value: InstrumentDraft;
  onChange: (next: InstrumentDraft) => void;
}) {
  return (
    <View style={{ gap: 24 }}>
      <Group title="Bajo y afinación">
        <Chips<TuningId>
          value={value.tuning}
          onChange={(tuning) => onChange({ ...value, tuning })}
          options={tuningIds.map((id) => ({ value: id, label: tunings[id].name }))}
        />
      </Group>
      <Group title="Escala">
        <Chips<BassScale>
          label="Escala del bajo"
          value={value.scale}
          onChange={(scale) => onChange({ ...value, scale })}
          options={bassScales.map((scale) => ({ value: scale, label: `${scale}″` }))}
        />
      </Group>
      <Toggle
        label="Zurdo"
        detail="El clavijero pasa a la derecha en el dibujo y en el mástil interactivo."
        value={value.leftHanded}
        onChange={(leftHanded) => onChange({ ...value, leftHanded })}
      />
      <BassPreview tuning={value.tuning} scale={value.scale} leftHanded={value.leftHanded} />
      <Group title="Nivel">
        <Chips<Level>
          value={value.level}
          onChange={(level) => onChange({ ...value, level })}
          options={levels}
        />
      </Group>
      <Group title="Nombres de las notas">
        <Chips
          value={value.nomenclature}
          onChange={(nomenclature) => onChange({ ...value, nomenclature })}
          options={[
            { value: 'latin', label: 'Do, Re, Mi' },
            { value: 'english', label: 'C, D, E' },
          ]}
        />
      </Group>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.legend}>{title}</Text>
      {children}
    </View>
  );
}

const draftOf = (p: Profile): InstrumentDraft => ({
  tuning: p.tuning,
  scale: p.scale,
  level: p.level,
  nomenclature: p.nomenclature,
  leftHanded: p.leftHanded,
});

export function Onboarding() {
  const store = useStore(),
    [draft, setDraft] = useState(draftOf(store.profile)),
    [busy, setBusy] = useState(false);
  const finish = (patch: Partial<Profile>) => {
    setBusy(true);
    void store
      .updateProfile({ ...patch, configured: true })
      .catch(() => {})
      .finally(() => setBusy(false));
  };
  return (
    <View style={{ gap: 24, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <View style={{ gap: 8 }}>
        <Heading level={1} style={styles.title}>
          Configura tu bajo
        </Heading>
        <Label muted>
          El afinador, el mástil y los ejercicios se adaptan a estos ajustes. Puedes cambiarlos
          después en Ajustes.
        </Label>
      </View>
      <View style={styles.panel}>
        <InstrumentForm value={draft} onChange={setDraft} />
      </View>
      <View style={styles.row}>
        <Button busy={busy} onPress={() => finish(draft)}>
          Empezar
        </Button>
        <Button variant="ghost" disabled={busy} onPress={() => finish({})}>
          Omitir
        </Button>
      </View>
      {store.error ? <Label style={{ color: colors.error }}>{store.error}</Label> : null}
    </View>
  );
}

export function Settings() {
  const store = useStore(),
    [draft, setDraft] = useState(draftOf(store.profile)),
    [busy, setBusy] = useState(false),
    [confirmClear, setConfirmClear] = useState(false);
  const saved = draftOf(store.profile);
  const { tuning, scale, level, nomenclature, leftHanded } = saved;
  useEffect(() => {
    setDraft({ tuning, scale, level, nomenclature, leftHanded });
  }, [store.profile.id, tuning, scale, level, nomenclature, leftHanded]);
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  return (
    <View style={{ gap: 28, maxWidth: 820 }}>
      <Heading level={1} style={styles.title}>
        Ajustes
      </Heading>
      <View style={styles.panel}>
        <Heading level={2} style={styles.h2}>
          Tu bajo
        </Heading>
        <InstrumentForm value={draft} onChange={setDraft} />
        <Button
          busy={busy}
          disabled={!changed}
          onPress={() => {
            setBusy(true);
            void store
              .updateProfile(draft)
              .catch(() => {})
              .finally(() => setBusy(false));
          }}
          style={{ alignSelf: 'flex-start' }}
        >
          Guardar ajustes
        </Button>
      </View>
      <PracticeSettings key={store.profile.id} />
      <Appearance />
      {Platform.OS !== 'web' ? <Account /> : null}
      {store.mode === 'local' ? (
        <View style={styles.panel}>
          <Heading level={2} style={styles.h2}>
            {Platform.OS === 'web' ? 'Datos de este navegador' : 'Datos de este dispositivo'}
          </Heading>
          <Label muted>
            Tus ajustes, resultados y progreso se guardan solo en
            {Platform.OS === 'web' ? ' este navegador.' : ' este dispositivo.'}
          </Label>
          <View style={styles.row}>
            <Button
              variant="danger"
              onPress={() => {
                if (!confirmClear) return setConfirmClear(true);
                setConfirmClear(false);
                void store.clearLocalData().catch(() => {});
              }}
            >
              {confirmClear ? 'Confirmar borrado' : 'Borrar ajustes y progreso'}
            </Button>
            {confirmClear ? (
              <Button variant="ghost" onPress={() => setConfirmClear(false)}>
                Cancelar
              </Button>
            ) : null}
          </View>
        </View>
      ) : null}
      {store.error ? <Label style={{ color: colors.error }}>{store.error}</Label> : null}
    </View>
  );
}

/** Tema de la interfaz: se aplica al momento y se guarda en el perfil local. */
function Appearance() {
  const store = useStore();
  return (
    <View style={styles.panel}>
      <Heading level={2} style={styles.h2}>
        Apariencia
      </Heading>
      <Chips<ThemePreference>
        label="Tema"
        minHeight={44}
        value={store.profile.theme}
        onChange={(theme) => void store.updateProfile({ theme }).catch(() => {})}
        options={themePreferences.map((t) => ({
          value: t.value,
          label: t.value === 'dark' ? `${t.label} (por defecto)` : t.label,
        }))}
      />
      <Label muted>
        «Sistema» sigue el modo claro u oscuro del dispositivo. Se guarda solo en este dispositivo.
      </Label>
    </View>
  );
}

function Account() {
  const store = useStore();
  const [signup, setSignup] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirmDelete, setConfirmDelete] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!store.accountsAvailable)
    return (
      <View style={styles.panel}>
        <Heading level={2} style={styles.h2}>
          Cuenta
        </Heading>
        <Label muted>
          Las cuentas para sincronizar entre dispositivos todavía no están disponibles. Puedes usar
          toda la app sin cuenta.
        </Label>
      </View>
    );
  if (store.mode === 'remote')
    return (
      <View style={styles.panel}>
        <View style={styles.between}>
          <Heading level={2} style={styles.h2}>
            Cuenta
          </Heading>
          <Badge>Sesión iniciada</Badge>
        </View>
        <Label>{store.profile.email}</Label>
        <Label muted>
          Mientras la sesión está iniciada se usan los datos de tu cuenta. Los datos que guardaste
          sin cuenta siguen en este dispositivo.
        </Label>
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          <Button
            variant="secondary"
            icon="logout"
            busy={busy}
            onPress={() => void run(store.logout)}
          >
            Cerrar sesión
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onPress={() => {
              if (!confirmDelete) return setConfirmDelete(true);
              setConfirmDelete(false);
              void run(store.deleteAccount);
            }}
          >
            {confirmDelete ? 'Confirmar: eliminar cuenta y sus datos' : 'Eliminar cuenta'}
          </Button>
          {confirmDelete ? (
            <Button variant="ghost" onPress={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
          ) : null}
        </View>
        {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
      </View>
    );
  return (
    <View style={styles.panel}>
      <Heading level={2} style={styles.h2}>
        {signup ? 'Crear cuenta' : 'Iniciar sesión'}
      </Heading>
      <Label muted>
        Opcional. La cuenta guarda tu progreso en el servidor. Los datos de este dispositivo no se
        copian a la cuenta todavía.
      </Label>
      <Field
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        placeholder="tu@correo.com"
      />
      <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Button
          busy={busy}
          onPress={() =>
            void run(() => (signup ? store.signup(email, password) : store.login(email, password)))
          }
        >
          {signup ? 'Crear cuenta' : 'Entrar'}
        </Button>
        <Button variant="ghost" disabled={busy} onPress={() => setSignup(!signup)}>
          {signup ? 'Ya tengo cuenta' : 'Crear una cuenta'}
        </Button>
        {!signup ? (
          <Button
            variant="ghost"
            disabled={busy}
            onPress={() => void run(() => store.resetPassword(email))}
          >
            He olvidado mi contraseña
          </Button>
        ) : null}
      </View>
      {error ? <Label style={{ color: colors.error }}>{error}</Label> : null}
    </View>
  );
}
