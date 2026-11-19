import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Module, modules } from '../core/types';
import { Badge, Button, Heading, Icon, Label, Staff, colors, styles } from '../components/ui';

export function Practice({ practice }: { practice: (module: Module) => void }) {
  const { width } = useWindowDimensions();
  return (
    <View style={{ gap: 26 }}>
      <View style={{ gap: 8 }}>
        <Heading level={1} style={styles.title}>
          Practicar
        </Heading>
        <Label muted>Ritmo, oído y lectura. Elige qué quieres trabajar hoy.</Label>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
        {modules.map((m) => (
          <View
            key={m.id}
            style={{
              width: width > 1000 ? '48.5%' : '100%',
              backgroundColor: colors.white,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: 120,
                backgroundColor: m.background,
                padding: 24,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {m.id === 'groove' ? (
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
            <View style={{ padding: 24, gap: 13 }}>
              <Heading level={2} style={styles.h2}>
                {m.title}
              </Heading>
              <Label muted>{m.subtitle}</Label>
              <View style={styles.between}>
                <Badge color={m.color} background={m.background}>
                  {m.category}
                </Badge>
                <Button icon="play" onPress={() => practice(m.id)}>
                  Empezar
                </Button>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
