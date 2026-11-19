import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Module, modules } from '../core/types';
import {
  Badge,
  Heading,
  Icon,
  Label,
  Staff,
  colors,
  moduleTone,
  radius,
  space,
  styles,
} from '../components/ui';

const moduleIcon: Record<Module, string> = {
  groove: 'train',
  'chord-train': 'chord',
  'listen-repeat': 'ear',
  notes: 'note',
  intervals: 'music',
  reading: 'library',
};

export function Practice({ practice }: { practice: (module: Module) => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 600;
  return (
    <View style={{ gap: compact ? space.l : space.xxl }}>
      <View style={{ gap: 8 }}>
        <Heading level={1} style={styles.title}>
          Practicar
        </Heading>
        <Label muted>Ritmo, armonía, oído y lectura. Elige qué quieres trabajar hoy.</Label>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: compact ? space.s : 20 }}>
        {modules.map((base) => {
          const tone = moduleTone(base.id);
          const m = { ...base, color: tone.ink, background: tone.bg };
          return (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={`Empezar ${m.title}. ${m.subtitle}`}
              onPress={() => practice(m.id)}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
                width: width > 1000 ? '48.5%' : '100%',
                flexDirection: compact ? 'row' : 'column',
                alignItems: compact ? 'center' : 'stretch',
                backgroundColor: hovered ? colors.raised : colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                borderTopColor: colors.sheen,
                borderRadius: radius.panel,
                overflow: 'hidden',
              })}
            >
              <View
                style={{
                  alignSelf: 'stretch',
                  width: compact ? 64 : undefined,
                  minHeight: compact ? 64 : 112,
                  borderRightWidth: compact ? 1 : 0,
                  borderBottomWidth: compact ? 0 : 1,
                  borderBottomColor: colors.line,
                  backgroundColor: m.background,
                  padding: compact ? 0 : space.xl,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {compact ? (
                  <Icon name={moduleIcon[m.id]} color={m.color} size={28} />
                ) : m.id === 'groove' ? (
                  <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-end' }}>
                    {[18, 42, 28, 60, 38, 23, 48, 28, 50, 33, 20, 43].map((h, i) => (
                      <View
                        key={i}
                        style={{
                          width: 12,
                          height: h,
                          backgroundColor: m.color,
                          opacity: i % 3 === 0 ? 1 : 0.45,
                          borderRadius: 3,
                        }}
                      />
                    ))}
                  </View>
                ) : m.id === 'chord-train' || m.id === 'listen-repeat' ? (
                  <Icon
                    name={m.id === 'listen-repeat' ? 'ear' : 'note'}
                    color={m.color}
                    size={48}
                  />
                ) : m.id === 'intervals' ? (
                  <View style={[styles.row, { gap: 30 }]}>
                    <Icon name="note" color={m.color} size={45} />
                    <Icon name="arrow" color={m.color} size={25} />
                    <Icon name="note" color={m.color} size={55} />
                  </View>
                ) : (
                  <View style={{ width: 220 }}>
                    <Staff notes={m.id === 'notes' ? [67] : [64, 67, 69]} />
                  </View>
                )}
              </View>
              <View
                style={
                  compact
                    ? { flex: 1, minWidth: 0, padding: space.m, gap: space.xs }
                    : { padding: space.xl, gap: 13 }
                }
              >
                <Heading level={2} style={compact ? styles.h3 : styles.h2}>
                  {m.title}
                </Heading>
                <Label muted>{m.subtitle}</Label>
                {!compact && (
                  <View style={styles.between}>
                    <Badge color={m.color} background={m.background}>
                      {m.category}
                    </Badge>
                    <View style={[styles.row, { gap: 6 }]}>
                      <Text style={[styles.text, { color: colors.accentText, fontWeight: '600' }]}>
                        Empezar
                      </Text>
                      <Icon name="arrow" size={18} color={colors.accentText} />
                    </View>
                  </View>
                )}
              </View>
              {compact && (
                <View style={{ paddingRight: space.m }}>
                  <Icon name="arrow" size={18} color={colors.accentText} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
