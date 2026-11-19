import React, { useState } from 'react';
import { Text, View } from 'react-native';
import {
  Badge,
  Button,
  Chips,
  Empty,
  Field,
  Heading,
  Icon,
  Label,
  colors,
  styles,
} from '../components/ui';
import { Module } from '../core/types';
import { Note, notes } from '../content/notes';
import { HarmonyCourse } from './HarmonyCourse';

export function Learn({
  practice,
  scrollToTop,
}: {
  practice: (module: Module) => void;
  scrollToTop: () => void;
}) {
  const [tab, setTab] = useState<'course' | 'notes'>('course');
  return (
    <View style={{ gap: 24 }}>
      <Chips
        value={tab}
        onChange={(value) => {
          setTab(value);
          requestAnimationFrame(scrollToTop);
        }}
        options={[
          { value: 'course', label: 'Curso de armonía' },
          { value: 'notes', label: 'Apuntes' },
        ]}
      />
      {tab === 'course' ? (
        <HarmonyCourse practice={practice} scrollToTop={scrollToTop} />
      ) : (
        <Notes />
      )}
    </View>
  );
}

function Notes() {
  const [query, setQuery] = useState(''),
    [selected, setSelected] = useState<Note | null>(null);
  const visible = notes.filter((n) =>
    `${n.title} ${n.category}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  if (selected)
    return (
      <View style={{ gap: 25 }}>
        <Button
          variant="ghost"
          icon="back"
          onPress={() => setSelected(null)}
          style={{ alignSelf: 'flex-start' }}
        >
          Volver a apuntes
        </Button>
        <View style={styles.panel}>
          <Badge>{selected.category}</Badge>
          <Heading level={1} style={styles.title}>
            {selected.title}
          </Heading>
          <Label muted>{selected.reviewed ? 'Revisado' : 'Pendiente de revisión musical'}</Label>
          <Text style={[styles.text, { lineHeight: 27, maxWidth: 720 }]}>{selected.content}</Text>
        </View>
      </View>
    );
  return (
    <View style={{ gap: 25 }}>
      <View style={{ gap: 8 }}>
        <Heading level={1} style={styles.title}>
          Apuntes
        </Heading>
        <Label muted>Conceptos breves para consultar mientras practicas.</Label>
      </View>
      <Field
        label="Buscar apuntes"
        value={query}
        onChangeText={setQuery}
        placeholder="Título o tema"
      />
      <View style={styles.panel}>
        {visible.length ? (
          visible.map((n) => (
            <View
              key={n.id}
              style={[
                styles.between,
                { paddingVertical: 18, borderBottomColor: colors.line, borderBottomWidth: 1 },
              ]}
            >
              <View style={[styles.row, { flex: 1, minWidth: 200 }]}>
                <Icon name="library" size={26} color={colors.accentText} />
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={styles.h3}>{n.title}</Text>
                  <Label muted>
                    {n.category} · {n.reviewed ? 'Revisado' : 'Pendiente de revisión'}
                  </Label>
                </View>
              </View>
              <Button variant="secondary" small onPress={() => setSelected(n)}>
                Leer
              </Button>
            </View>
          ))
        ) : (
          <Empty title="No hay apuntes con ese término" detail="Prueba con otra palabra." />
        )}
      </View>
    </View>
  );
}
