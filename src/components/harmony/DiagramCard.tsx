import React, { useState } from 'react';
import { View } from 'react-native';
import { diagramSteps, LessonDiagram, stepCaption } from '../../core/diagrams';
import { fifthsCircle, signatureNotes, signatureText } from '../../core/notation';
import { Button, Heading, Label, colors, styles } from '../ui';
import { DiagramView } from './Diagrams';

export function initialStep(diagram: LessonDiagram) {
  return diagram.kind === 'fifths'
    ? Math.max(
        0,
        fifthsCircle.findIndex((k) => k.major === diagram.selected),
      )
    : 0;
}

function caption(diagram: LessonDiagram, step: number) {
  if (diagram.kind === 'fifths' && !diagram.path) {
    const key = fifthsCircle[step]!;
    const notes = signatureNotes(key.accidentals);
    return `${key.name} mayor: ${signatureText(key.accidentals)}${notes.length ? ` (${notes.join(', ')})` : ''}. Relativa menor: ${key.minor} menor. Un paso en sentido horario suma un sostenido o quita un bemol.`;
  }
  return stepCaption(diagram, step);
}

/**
 * A lesson diagram with its caption and step controls. The step can be
 * controlled by the lesson (to follow the example audio) or kept locally.
 */
export function DiagramCard({
  diagram,
  step: controlled,
  onStep,
  sweep,
  action,
}: {
  diagram: LessonDiagram;
  step?: number;
  onStep?: (step: number) => void;
  sweep?: { step: number; ms: number; key: number } | null;
  action?: React.ReactNode;
}) {
  const [local, setLocal] = useState(() => initialStep(diagram));
  const step = controlled ?? local;
  const total = diagramSteps(diagram);
  const go = (next: number) => {
    const value = (next + total) % total;
    if (onStep) onStep(value);
    else setLocal(value);
  };
  const cyclic = diagram.kind === 'fifths';
  return (
    <View style={{ gap: 12 }}>
      <Heading level={3} style={styles.h3}>
        {diagram.title}
      </Heading>
      <DiagramView
        diagram={diagram}
        step={step}
        sweep={sweep}
        onStep={total > 1 ? go : undefined}
      />
      <View
        accessibilityLiveRegion="polite"
        style={{
          backgroundColor: colors.bg,
          borderRadius: 8,
          paddingVertical: 10,
          paddingHorizontal: 12,
          minHeight: 64,
          justifyContent: 'center',
          gap: 4,
        }}
      >
        {total > 1 ? (
          <Label muted style={{ fontSize: 12 }}>
            {cyclic ? `Tonalidad ${step + 1} de ${total}` : `Paso ${step + 1} de ${total}`}
          </Label>
        ) : null}
        <Label style={{ fontSize: 15, lineHeight: 23 }}>{caption(diagram, step)}</Label>
      </View>
      <View style={[styles.between, { justifyContent: 'flex-start' }]}>
        {action}
        {total > 1 ? (
          <View style={styles.row}>
            <Button
              small
              variant="ghost"
              icon="back"
              disabled={!cyclic && step === 0}
              onPress={() => go(step - 1)}
            >
              {cyclic ? 'Una quinta abajo' : 'Paso anterior'}
            </Button>
            <Button
              small
              variant="ghost"
              icon="arrow"
              disabled={!cyclic && step === total - 1}
              onPress={() => go(step + 1)}
            >
              {cyclic ? 'Una quinta arriba' : 'Paso siguiente'}
            </Button>
          </View>
        ) : null}
      </View>
    </View>
  );
}
