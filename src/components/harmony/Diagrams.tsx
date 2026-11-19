import React from 'react';
import { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { LessonDiagram, HarmonicFunction } from '../../core/diagrams';
import { functionNames, pulsesOf, rowOfStep } from '../../core/diagrams';
import {
  fifthsCircle,
  isBlackKey,
  parsePitch,
  pitchName,
  signatureNotes,
  signatureText,
  stepName,
  SpelledPitch,
} from '../../core/notation';
import { colors } from '../ui';
import { Box, DiagramCanvas, Sweep } from './DiagramCanvas';

// Diagram-local palette. Function colours reuse existing ink/background pairs
// so text keeps its contrast; they always appear next to their written name.
export const tone = {
  staff: '#A9B4A8',
  soft: '#C8D1C7',
  key: '#FFFFFF',
  blackKey: '#2B3530',
  context: '#D5E4D3',
  contextBlack: '#557A63',
  semitone: '#8A5A2E',
};
export const functionTone: Record<HarmonicFunction | 'Dsec', { ink: string; bg: string }> = {
  T: { ink: '#295E43', bg: '#E8EFE7' },
  S: { ink: '#375B76', bg: '#E7EFF5' },
  D: { ink: '#745437', bg: '#F3EBDF' },
  Dsec: { ink: '#5B547E', bg: '#EDEAF5' },
};
const font = { fontFamily: 'System' } as const;

type Props<K extends LessonDiagram['kind']> = {
  diagram: Extract<LessonDiagram, { kind: K }>;
  step: number;
  sweep?: { step: number; ms: number; key: number } | null;
  onStep?: (step: number) => void;
};

export function DiagramView(props: Props<LessonDiagram['kind']>) {
  const { diagram } = props;
  switch (diagram.kind) {
    case 'staff':
      return <StaffDiagram {...(props as Props<'staff'>)} />;
    case 'keyboard':
      return <KeyboardDiagram {...(props as Props<'keyboard'>)} />;
    case 'rhythm':
      return <RhythmDiagram {...(props as Props<'rhythm'>)} />;
    case 'progression':
      return <ProgressionDiagram {...(props as Props<'progression'>)} />;
    case 'functions':
      return <FunctionsDiagram {...(props as Props<'functions'>)} />;
    case 'fifths':
      return <FifthsDiagram {...(props as Props<'fifths'>)} />;
    case 'form':
      return <FormDiagram {...(props as Props<'form'>)} />;
  }
}

/* ---------- Staff: grand staff, voice leading and contour ---------- */

const HALF = 5; // one diatonic step in viewBox units; lines are 10 apart
const TREBLE_TOP = 38; // F5
const BASS_TOP = 26; // A3
const onTreble = (p: SpelledPitch) => p.diatonic >= 28;

function sharpPath(x: number, y: number) {
  return `M${x - 2} ${y - 9}v18M${x + 2} ${y - 10}v18M${x - 5} ${y - 1}l10 -3M${x - 5} ${y + 5}l10 -3`;
}
function flatPath(x: number, y: number) {
  return `M${x - 3} ${y - 14}V${y + 4}C${x + 3} ${y + 1} ${x + 6} ${y - 2} ${x + 4} ${y - 5}C${x + 2} ${y - 7} ${x - 1} ${y - 5} ${x - 3} ${y - 2}`;
}

function StaffDiagram({ diagram, step }: Props<'staff'>) {
  const all = diagram.columns.flatMap((c) => c.notes.map(parsePitch));
  const treble = all.some(onTreble),
    bass = all.some((p) => !onTreble(p));
  const top = 42;
  const trebleTop = top,
    bassTop = treble ? top + 90 : top;
  const staffY = (p: SpelledPitch) =>
    onTreble(p) || !bass
      ? trebleTop + (TREBLE_TOP - p.diatonic) * HALF
      : bassTop + (BASS_TOP - p.diatonic) * HALF;
  const lowest = Math.max(...all.map(staffY)) + 6;
  const bottomLine = (bass ? bassTop : trebleTop) + 40;
  const labelY = Math.max(bottomLine, lowest) + 34;
  const colW = 84,
    x0 = 74;
  const vbW = x0 + colW * diagram.columns.length + 12,
    vbH = labelY + 14;
  const xOf = (i: number) => x0 + colW * (i + 0.5);

  const layout = diagram.columns.map((column, i) => {
    const pitches = column.notes.map(parsePitch).sort((a, b) => a.diatonic - b.diatonic);
    let shifted = false;
    let accidentalColumn = 0,
      lastAccidentalY = Infinity;
    return [...pitches]
      .reverse()
      .map((p) => {
        const y = staffY(p);
        let k = 0;
        if (p.alter) {
          k = Math.abs(lastAccidentalY - y) < 30 ? (accidentalColumn + 1) % 2 : 0;
          accidentalColumn = k;
          lastAccidentalY = y;
        }
        return { p, y, accidentalOffset: k };
      })
      .reverse()
      .map((note, j, arr) => {
        const prev = arr[j - 1];
        const second =
          prev && note.p.diatonic - prev.p.diatonic === 1 && onTreble(prev.p) === onTreble(note.p);
        shifted = second ? !shifted : false;
        return { ...note, x: xOf(i) + (shifted ? 12 : 0) };
      });
  });

  const ledgers = (p: SpelledPitch, x: number) => {
    const lines: number[] = [];
    const t = onTreble(p) || !bass;
    const [low, high] = t ? [30, 38] : [18, 26];
    for (let d = low - 2; d >= p.diatonic; d -= 2) lines.push(d);
    for (let d = high + 2; d <= p.diatonic; d += 2) lines.push(d);
    return lines.map((d) => {
      const y = t ? trebleTop + (TREBLE_TOP - d) * HALF : bassTop + (BASS_TOP - d) * HALF;
      return (
        <Line
          key={`l${d}`}
          x1={x - 11}
          x2={x + 11}
          y1={y}
          y2={y}
          stroke={colors.ink}
          strokeWidth={1.1}
        />
      );
    });
  };

  const pairs = (i: number) => {
    const from = layout[i - 1]!,
      to = layout[i]!;
    if (from.length === to.length) return to.map((n, j) => [from[j]!, n] as const);
    return to.map(
      (n) =>
        [
          from.reduce((best, c) =>
            Math.abs(c.p.midi - n.p.midi) < Math.abs(best.p.midi - n.p.midi) ? c : best,
          ),
          n,
        ] as const,
    );
  };

  return (
    <DiagramCanvas
      width={vbW}
      height={vbH}
      label={`${diagram.title}. ${diagram.summary}`}
      cursor={{ x: xOf(step) - colW / 2 + 6, y: 6, w: colW - 12, h: vbH - 10 }}
      maxScale={1.7}
    >
      {[treble ? trebleTop : null, bass ? bassTop : null].map((y, s) =>
        y === null ? null : (
          <G key={s}>
            {[0, 1, 2, 3, 4].map((l) => (
              <Line
                key={l}
                x1={8}
                x2={vbW - 8}
                y1={y + l * 10}
                y2={y + l * 10}
                stroke={tone.staff}
                strokeWidth={1}
              />
            ))}
          </G>
        ),
      )}
      {treble && bass ? (
        <Line
          x1={8}
          x2={8}
          y1={trebleTop}
          y2={bassTop + 40}
          stroke={tone.staff}
          strokeWidth={1.5}
        />
      ) : null}
      {treble ? (
        <Path
          d="M40 112C5 88 68 65 46 31 32 10 22 50 38 81c16 31 29 7 18-7-12-15-33 1-25 14m10-68 9 100c3 25-24 23-21 8"
          transform={`translate(4 ${trebleTop + 30 - 82 * 0.714}) scale(0.714)`}
          fill="none"
          stroke={colors.ink}
          strokeWidth={2.6}
        />
      ) : null}
      {bass ? (
        <G>
          <Path
            d={`M22 ${bassTop + 10}C21 ${bassTop - 1} 40 ${bassTop - 3} 42 ${bassTop + 10}C43 ${bassTop + 24} 31 ${bassTop + 33} 16 ${bassTop + 38}`}
            fill="none"
            stroke={colors.ink}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <Circle cx={23} cy={bassTop + 10} r={3.6} fill={colors.ink} />
          <Circle cx={49} cy={bassTop + 5} r={2} fill={colors.ink} />
          <Circle cx={49} cy={bassTop + 15} r={2} fill={colors.ink} />
        </G>
      ) : null}

      {diagram.voiceLeading
        ? layout.slice(1).map((_, k) => {
            const i = k + 1;
            return pairs(i).map(([a, b], j) => {
              const held = a.p.midi === b.p.midi;
              const entering = i === step;
              return (
                <Line
                  key={`v${i}-${j}`}
                  x1={a.x + 9}
                  y1={a.y}
                  x2={b.x - (b.p.alter ? 26 : 10)}
                  y2={b.y}
                  stroke={held ? colors.green : entering ? colors.ink : tone.soft}
                  strokeWidth={entering ? 1.8 : 1.2}
                  strokeDasharray={held ? undefined : '4 3'}
                  opacity={entering || held ? 1 : 0.8}
                />
              );
            });
          })
        : null}
      {diagram.contour
        ? layout.slice(1).map((notes, k) => {
            const a = layout[k]![0]!,
              b = notes[0]!;
            return (
              <Line
                key={`c${k}`}
                x1={a.x + 8}
                y1={a.y}
                x2={b.x - 8}
                y2={b.y}
                stroke={k + 1 === step ? colors.green : tone.soft}
                strokeWidth={k + 1 === step ? 2 : 1.4}
              />
            );
          })
        : null}

      {layout.map((notes, i) => {
        const active = i === step;
        const column = diagram.columns[i]!;
        return (
          <G key={i}>
            {notes.map(({ p, x, y, accidentalOffset }) => {
              const role = column.roles?.[p.spelling];
              const fill =
                role === 'added' ? functionTone.D.ink : active ? colors.green : colors.ink;
              const ax = xOf(i) - 17 - accidentalOffset * 10;
              const mark = column.marks?.[p.spelling];
              return (
                <G key={p.spelling}>
                  {ledgers(p, x)}
                  {p.alter > 0 ? (
                    <Path d={sharpPath(ax, y)} stroke={fill} strokeWidth={1.4} fill="none" />
                  ) : p.alter < 0 ? (
                    <Path d={flatPath(ax, y)} stroke={fill} strokeWidth={1.4} fill="none" />
                  ) : null}
                  <Ellipse
                    cx={x}
                    cy={y}
                    rx={6.4}
                    ry={4.7}
                    rotation={-20}
                    origin={`${x},${y}`}
                    fill={role === 'passing' ? 'white' : fill}
                    stroke={fill}
                    strokeWidth={role === 'passing' ? 1.8 : 0}
                  />
                  {role === 'melody' ? (
                    <Circle cx={x} cy={y} r={9.5} fill="none" stroke={fill} strokeWidth={1.2} />
                  ) : null}
                  {mark ? (
                    <SvgText
                      {...font}
                      x={x + (role === 'melody' ? 14 : 11)}
                      y={y + 4}
                      fontSize={11}
                      fontWeight="700"
                      fill={role === 'added' ? functionTone.D.ink : colors.green}
                    >
                      {mark}
                    </SvgText>
                  ) : null}
                </G>
              );
            })}
            <SvgText
              {...font}
              x={xOf(i)}
              y={labelY}
              fontSize={13}
              fontWeight={active ? '700' : '500'}
              fill={active ? colors.green : colors.ink}
              textAnchor="middle"
            >
              {column.label}
            </SvgText>
          </G>
        );
      })}
    </DiagramCanvas>
  );
}

/* ---------- Keyboard ---------- */

function KeyboardDiagram({ diagram, step }: Props<'keyboard'>) {
  const current = diagram.steps[step] ?? diagram.steps[0]!;
  const keyW = 30,
    keyH = 112,
    blackW = 18,
    blackH = 70;
  const top = diagram.showSteps || diagram.countSemitones ? 40 : 8;
  const whites: number[] = [];
  for (let m = diagram.from; m <= diagram.to; m++) if (!isBlackKey(m)) whites.push(m);
  const whiteX = (m: number) => 4 + whites.indexOf(m) * keyW;
  const centerX = (m: number) => (isBlackKey(m) ? whiteX(m + 1) : whiteX(m) + keyW / 2);
  const vbW = whites.length * keyW + 8,
    vbH = top + keyH + 26;

  const active = new Map(current.notes.map((s) => [parsePitch(s).midi, s]));
  const context = new Map((current.context || []).map((s) => [parsePitch(s).midi, s]));
  const named = (m: number) => active.get(m) ?? context.get(m);
  const collection = (current.context ?? current.notes)
    .map(parsePitch)
    .sort((a, b) => a.midi - b.midi);
  const label = (m: number, black: boolean) => {
    const s = named(m);
    if (!s) return null;
    const on = active.has(m);
    return (
      <SvgText
        {...font}
        key={`t${m}`}
        x={centerX(m)}
        y={black ? top + keyH + 18 : top + keyH - 12}
        fontSize={12}
        fontWeight={on ? '700' : '500'}
        fill={black ? (on ? colors.green : colors.ink) : on ? 'white' : colors.ink}
        textAnchor="middle"
      >
        {pitchName(s)}
      </SvgText>
    );
  };
  const counted = diagram.countSemitones
    ? (() => {
        const [lo, hi] = [collection[0]!.midi, collection[collection.length - 1]!.midi];
        return Array.from({ length: hi - lo }, (_, i) => lo + i + 1);
      })()
    : [];

  return (
    <DiagramCanvas
      width={vbW}
      height={vbH}
      label={`${diagram.title}. ${diagram.summary}`}
      maxScale={1.6}
    >
      {whites.map((m) => (
        <Rect
          key={m}
          x={whiteX(m)}
          y={top}
          width={keyW - 1}
          height={keyH}
          rx={4}
          fill={active.has(m) ? colors.green : context.has(m) ? tone.context : tone.key}
          stroke={tone.staff}
          strokeWidth={1}
        />
      ))}
      {whites.map((m) => label(m, false))}
      {Array.from({ length: diagram.to - diagram.from + 1 }, (_, i) => diagram.from + i)
        .filter((m) => isBlackKey(m) && m > diagram.from && m < diagram.to)
        .map((m) => (
          <G key={m}>
            <Rect
              x={centerX(m) - blackW / 2}
              y={top}
              width={blackW}
              height={blackH}
              rx={3}
              fill={
                active.has(m) ? colors.green : context.has(m) ? tone.contextBlack : tone.blackKey
              }
            />
            {label(m, true)}
          </G>
        ))}
      {diagram.showSteps
        ? collection.slice(1).map((p, i) => {
            const a = collection[i]!,
              semis = p.midi - a.midi;
            const x1 = centerX(a.midi),
              x2 = centerX(p.midi),
              mid = (x1 + x2) / 2;
            const entering = active.has(p.midi);
            const ink = semis === 1 ? tone.semitone : entering ? colors.green : colors.muted;
            return (
              <G key={`s${i}`}>
                <Path
                  d={`M${x1 + 2} ${top - 4}Q${mid} ${top - 26} ${x2 - 2} ${top - 4}`}
                  fill="none"
                  stroke={ink}
                  strokeWidth={entering ? 2 : 1.2}
                />
                <SvgText
                  {...font}
                  x={mid}
                  y={top - 20}
                  fontSize={11}
                  fontWeight="700"
                  fill={ink}
                  textAnchor="middle"
                >
                  {stepName(semis)}
                </SvgText>
              </G>
            );
          })
        : null}
      {counted.map((m, i) => (
        <G key={`n${m}`}>
          <Circle cx={centerX(m)} cy={top - 16} r={9} fill={colors.pale} />
          <SvgText
            {...font}
            x={centerX(m)}
            y={top - 12}
            fontSize={11}
            fontWeight="700"
            fill={colors.green}
            textAnchor="middle"
          >
            {i + 1}
          </SvgText>
        </G>
      ))}
    </DiagramCanvas>
  );
}

/* ---------- Rhythm timeline ---------- */

function RhythmDiagram({ diagram, step, sweep }: Props<'rhythm'>) {
  const left = 8,
    trackW = 584,
    rowH = 92,
    trackH = 36;
  const maxBeats = Math.max(...diagram.rows.map((r) => r.beats));
  const ppb = trackW / maxBeats;
  const vbW = left * 2 + trackW,
    vbH = diagram.rows.length * rowH + 4;
  const varied = diagram.rows.some((r) => r.events.some((e) => e.volume !== undefined));
  const active = rowOfStep(diagram, step);
  const boxes: Box[] = [];
  const rows = diagram.rows.map((row, r) => {
    const y = r * rowH + 24;
    const pulses = pulsesOf(row);
    return (
      <G key={r}>
        <SvgText
          {...font}
          x={left}
          y={y - 8}
          fontSize={13}
          fontWeight="600"
          fill={r === active.row ? colors.green : colors.ink}
        >
          {row.label}
        </SvgText>
        <Rect x={left} y={y} width={row.beats * ppb} height={trackH} rx={6} fill="#F1F3EE" />
        {Array.from({ length: row.beats * 2 + 1 }, (_, h) => h / 2)
          .filter((b) => !pulses.includes(b) && b < row.beats)
          .map((b) => (
            <Line
              key={`h${b}`}
              x1={left + b * ppb}
              x2={left + b * ppb}
              y1={y + 4}
              y2={y + trackH - 4}
              stroke={tone.soft}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          ))}
        {pulses.map((b, i) => (
          <G key={`p${b}`}>
            <Line
              x1={left + b * ppb}
              x2={left + b * ppb}
              y1={y - 2}
              y2={y + trackH + 2}
              stroke={colors.muted}
              strokeWidth={1.4}
            />
            <SvgText
              {...font}
              x={left + b * ppb + 4}
              y={y + trackH + 16}
              fontSize={11}
              fill={colors.muted}
            >
              {i + 1}
            </SvgText>
          </G>
        ))}
        <Line
          x1={left + row.beats * ppb}
          x2={left + row.beats * ppb}
          y1={y - 2}
          y2={y + trackH + 2}
          stroke={colors.muted}
          strokeWidth={1.4}
        />
        {row.events.map((e, i) => {
          const on = r === active.row && i === active.index;
          const h = varied ? 8 + (trackH - 12) * (e.volume ?? 0.6) : trackH - 12;
          const x = left + e.at * ppb + 1.5,
            w = Math.max(4, e.dur * ppb - 3),
            ey = y + trackH - 6 - h;
          if (on) boxes.push({ x: x - 4, y: y - 4, w: w + 8, h: trackH + 8 });
          const fill = on
            ? colors.green
            : e.tieFrom
              ? tone.soft
              : e.accent
                ? colors.ink
                : '#6F7F73';
          const prev = row.events[i - 1];
          return (
            <G key={i}>
              <Rect x={x} y={ey} width={w} height={h} rx={3} fill={fill} />
              {!e.tieFrom ? (
                <Rect x={x} y={ey} width={3} height={h} rx={1} fill={on ? '#173E2D' : colors.ink} />
              ) : null}
              {e.tieFrom && prev ? (
                <Path
                  d={`M${x - 18} ${y + 4}Q${x} ${y - 8} ${x + 18} ${y + 4}`}
                  fill="none"
                  stroke={on ? colors.green : colors.ink}
                  strokeWidth={1.6}
                />
              ) : null}
              {e.label ? (
                <SvgText
                  {...font}
                  x={x + 6}
                  y={ey + h / 2 + 4}
                  fontSize={11}
                  fontWeight="600"
                  fill={on || e.accent ? 'white' : e.tieFrom ? colors.ink : 'white'}
                >
                  {w > 44 ? e.label : ''}
                </SvgText>
              ) : null}
            </G>
          );
        })}
      </G>
    );
  });
  const box = boxes[0] ?? null;
  let playhead: Sweep | null = null;
  if (sweep && sweep.step === step) {
    const e = diagram.rows[active.row]!.events[active.index]!;
    const y = active.row * rowH + 24;
    playhead = {
      from: left + e.at * ppb,
      to: left + (e.at + e.dur) * ppb,
      y: y - 4,
      h: trackH + 8,
      ms: sweep.ms,
      key: sweep.key,
    };
  }
  return (
    <DiagramCanvas
      width={vbW}
      height={vbH}
      label={`${diagram.title}. ${diagram.summary}`}
      cursor={box}
      sweep={playhead}
    >
      {rows}
    </DiagramCanvas>
  );
}

/* ---------- Progression blocks ---------- */

function ProgressionDiagram({ diagram, step }: Props<'progression'>) {
  const left = 8,
    trackW = 584,
    rowH = 112,
    blockH = 58;
  const maxBeats = Math.max(...diagram.rows.map((r) => r.chords.reduce((n, c) => n + c.beats, 0)));
  const ppb = trackW / maxBeats;
  const vbW = left * 2 + trackW,
    vbH = diagram.rows.length * rowH;
  const active = rowOfStep(diagram, step);
  const activeRow = diagram.rows[active.row]!;
  const startBeat = activeRow.chords.slice(0, active.index).reduce((n, c) => n + c.beats, 0);
  const cursor: Box = {
    x: left + startBeat * ppb,
    y: active.row * rowH + 26,
    w: activeRow.chords[active.index]!.beats * ppb - 4,
    h: blockH,
  };
  return (
    <DiagramCanvas width={vbW} height={vbH} label={`${diagram.title}. ${diagram.summary}`}>
      {diagram.rows.map((row, r) => {
        const y = r * rowH + 26;
        let at = 0;
        const total = row.chords.reduce((n, c) => n + c.beats, 0);
        return (
          <G key={r}>
            <SvgText
              {...font}
              x={left}
              y={y - 9}
              fontSize={13}
              fontWeight="600"
              fill={r === active.row ? colors.green : colors.ink}
            >
              {row.label}
            </SvgText>
            {row.chords.map((c, i) => {
              const x = left + at * ppb;
              at += c.beats;
              const w = c.beats * ppb - 4;
              const on = r === active.row && i === active.index;
              const t = functionTone[c.func ?? 'T'];
              return (
                <G key={i}>
                  <Rect
                    x={x}
                    y={y}
                    width={w}
                    height={blockH}
                    rx={8}
                    fill={on ? t.ink : t.bg}
                    stroke={t.ink}
                    strokeWidth={on ? 0 : 1}
                  />
                  <SvgText
                    {...font}
                    x={x + 10}
                    y={y + 24}
                    fontSize={16}
                    fontWeight="700"
                    fill={on ? 'white' : t.ink}
                  >
                    {c.numeral}
                  </SvgText>
                  <SvgText
                    {...font}
                    x={x + 10}
                    y={y + 44}
                    fontSize={12}
                    fill={on ? 'white' : colors.ink}
                  >
                    {c.label}
                  </SvgText>
                  {c.chromatic ? (
                    <G>
                      <Rect
                        x={x + 4}
                        y={y + blockH + 6}
                        width={58}
                        height={20}
                        rx={5}
                        fill={functionTone.Dsec.bg}
                      />
                      <SvgText
                        {...font}
                        x={x + 33}
                        y={y + blockH + 20}
                        fontSize={11}
                        fontWeight="700"
                        fill={functionTone.Dsec.ink}
                        textAnchor="middle"
                      >
                        {pitchName(c.chromatic)}
                      </SvgText>
                    </G>
                  ) : null}
                </G>
              );
            })}
            {Array.from(
              { length: Math.floor(total / row.beatsPerBar) + 1 },
              (_, b) => b * row.beatsPerBar,
            ).map((b) => (
              <Line
                key={`b${b}`}
                x1={left + b * ppb - 2}
                x2={left + b * ppb - 2}
                y1={y - 4}
                y2={y + blockH + 4}
                stroke={colors.muted}
                strokeWidth={1.2}
              />
            ))}
          </G>
        );
      })}
      <ActiveOutline box={cursor} />
    </DiagramCanvas>
  );
}

function ActiveOutline({ box }: { box: Box }) {
  return (
    <Rect
      x={box.x - 3}
      y={box.y - 3}
      width={box.w + 6}
      height={box.h + 6}
      rx={10}
      fill="none"
      stroke={colors.green}
      strokeWidth={2}
    />
  );
}

/* ---------- Function map ---------- */

function FunctionsDiagram({ diagram, step }: Props<'functions'>) {
  const secondary = diagram.chords.some((c) => c.func === 'Dsec');
  const rowY = secondary ? 104 : 30;
  const nodeW = 150,
    nodeH = 70;
  const nodes: Record<string, { x: number; y: number }> = {
    T: { x: 20, y: rowY },
    S: { x: 225, y: rowY },
    D: { x: 430, y: rowY },
    Dsec: { x: 210, y: 10 },
  };
  const vbW = 600,
    vbH = rowY + nodeH + 100;
  const current = diagram.chords[step] ?? diagram.chords[0]!;
  const previous = step > 0 ? diagram.chords[step - 1] : undefined;
  const on = nodes[current.func]!;
  const keys: (HarmonicFunction | 'Dsec')[] = [
    'T',
    'S',
    'D',
    ...(secondary ? (['Dsec'] as const) : []),
  ];
  const arrow = (from: string, to: string) => previous?.func === from && current.func === to;
  const arrowInk = (from: string, to: string) => (arrow(from, to) ? colors.green : tone.soft);
  const midY = rowY + nodeH / 2;
  const chips = diagram.chords.map((c) => c.label);
  const chipW = Math.min(110, (vbW - 20) / chips.length - 8);
  return (
    <DiagramCanvas
      width={vbW}
      height={vbH}
      label={`${diagram.title}. ${diagram.summary}`}
      cursor={{
        x: on.x - 6,
        y: on.y - 6,
        w: (current.func === 'Dsec' ? 180 : nodeW) + 12,
        h: nodeH + 12,
      }}
    >
      <Arrow d={`M${20 + nodeW + 4} ${midY}H${225 - 8}`} ink={arrowInk('T', 'S')} />
      <Arrow d={`M${225 + nodeW + 4} ${midY}H${430 - 8}`} ink={arrowInk('S', 'D')} />
      <Arrow
        d={`M${430 + nodeW / 2} ${rowY + nodeH + 4}Q300 ${rowY + nodeH + 56} ${20 + nodeW / 2 + 6} ${rowY + nodeH + 8}`}
        ink={arrowInk('D', 'T')}
      />
      {secondary ? (
        <>
          <Arrow
            d={`M${20 + nodeW / 2} ${rowY - 6}Q${20 + nodeW / 2} 45 ${210 - 8} 45`}
            ink={arrowInk('T', 'Dsec')}
          />
          <Arrow
            d={`M${225 + nodeW / 2} ${10 + nodeH + 4}V${rowY - 8}`}
            ink={arrowInk('Dsec', 'S')}
          />
        </>
      ) : null}
      {keys.map((k) => {
        const n = nodes[k]!,
          t = functionTone[k],
          isOn = current.func === k;
        const here = diagram.chords.filter((c) => c.func === k).map((c) => c.numeral);
        const unique = [...new Set(here)];
        return (
          <G key={k}>
            <Rect
              x={n.x}
              y={n.y}
              width={k === 'Dsec' ? 180 : nodeW}
              height={nodeH}
              rx={10}
              fill={isOn ? t.ink : t.bg}
              stroke={t.ink}
              strokeWidth={1}
            />
            <SvgText
              {...font}
              x={n.x + 12}
              y={n.y + 24}
              fontSize={13}
              fontWeight="600"
              fill={isOn ? 'white' : t.ink}
            >
              {k === 'Dsec' ? 'Dominante secundario' : functionNames[k]}
            </SvgText>
            <SvgText
              {...font}
              x={n.x + 12}
              y={n.y + 52}
              fontSize={17}
              fontWeight="700"
              fill={isOn ? 'white' : colors.ink}
            >
              {isOn ? current.numeral : unique.join(' · ')}
            </SvgText>
          </G>
        );
      })}
      {chips.map((c, i) => {
        const x = 10 + i * (chipW + 8),
          y = vbH - 34,
          active = i === step;
        return (
          <G key={i}>
            <Rect
              x={x}
              y={y}
              width={chipW}
              height={26}
              rx={6}
              fill={active ? colors.green : '#F1F3EE'}
            />
            <SvgText
              {...font}
              x={x + chipW / 2}
              y={y + 17}
              fontSize={12}
              fontWeight={active ? '700' : '500'}
              fill={active ? 'white' : colors.ink}
              textAnchor="middle"
            >
              {c}
            </SvgText>
          </G>
        );
      })}
    </DiagramCanvas>
  );
}

function Arrow({ d, ink }: { d: string; ink: string }) {
  // Arrowhead drawn at the path end from its last segment direction.
  const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const [x2, y2] = [nums[nums.length - 2]!, nums[nums.length - 1]!];
  const isH = /H(-?\d+(\.\d+)?)$/.test(d),
    isV = /V(-?\d+(\.\d+)?)$/.test(d);
  let ex = x2,
    ey = y2,
    px: number,
    py: number;
  if (isH) {
    ex = nums[nums.length - 1]!;
    ey = nums[nums.length - 2]!;
    px = ex - 1;
    py = ey;
  } else if (isV) {
    ex = nums[nums.length - 3]!;
    ey = nums[nums.length - 1]!;
    px = ex;
    py = ey - 1;
  } else {
    px = nums[nums.length - 4]!;
    py = nums[nums.length - 3]!;
  }
  const a = Math.atan2(ey - py, ex - px),
    s = 8;
  const head = `M${ex} ${ey}L${ex - s * Math.cos(a - 0.45)} ${ey - s * Math.sin(a - 0.45)}M${ex} ${ey}L${ex - s * Math.cos(a + 0.45)} ${ey - s * Math.sin(a + 0.45)}`;
  return (
    <G>
      <Path d={d} fill="none" stroke={ink} strokeWidth={1.8} />
      <Path d={head} fill="none" stroke={ink} strokeWidth={1.8} strokeLinecap="round" />
    </G>
  );
}

/* ---------- Circle of fifths ---------- */

function FifthsDiagram({ diagram, step, onStep }: Props<'fifths'>) {
  const size = 340,
    c = size / 2;
  const rOut = 150,
    rMid = 104,
    rIn = 62;
  const polar = (r: number, i: number) => {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  };
  const wedge = (r1: number, r2: number, i: number) => {
    const a0 = i - 0.5,
      a1 = i + 0.5;
    const p = (r: number, k: number) => {
      const a = ((k * 30 - 90) * Math.PI) / 180;
      return `${c + r * Math.cos(a)} ${c + r * Math.sin(a)}`;
    };
    return `M${p(r1, a0)}L${p(r2, a0)}A${r2} ${r2} 0 0 1 ${p(r2, a1)}L${p(r1, a1)}A${r1} ${r1} 0 0 0 ${p(r1, a0)}Z`;
  };
  const key = fifthsCircle[step] ?? fifthsCircle[0];
  const pathIdx = (diagram.path || []).map((k) => fifthsCircle.findIndex((f) => f.major === k));
  return (
    <DiagramCanvas
      width={size}
      height={size}
      label={`${diagram.title}. ${diagram.summary}`}
      maxScale={1.15}
      minScale={0.85}
    >
      {fifthsCircle.map((f, i) => {
        const on = i === step;
        const outer = polar((rOut + rMid) / 2, i),
          inner = polar((rMid + rIn) / 2, i);
        return (
          <G key={f.major} onPress={onStep ? () => onStep(i) : undefined}>
            <Path
              d={wedge(rMid, rOut, i)}
              fill={on ? colors.green : 'white'}
              stroke={tone.soft}
              strokeWidth={1}
            />
            <Path
              d={wedge(rIn, rMid, i)}
              fill={on ? '#3F7258' : '#F1F3EE'}
              stroke={tone.soft}
              strokeWidth={1}
            />
            <SvgText
              {...font}
              x={outer.x}
              y={outer.y + 5}
              fontSize={14}
              fontWeight="700"
              fill={on ? 'white' : colors.ink}
              textAnchor="middle"
            >
              {f.name}
            </SvgText>
            <SvgText
              {...font}
              x={inner.x}
              y={inner.y + 4}
              fontSize={11}
              fill={on ? 'white' : colors.muted}
              textAnchor="middle"
            >
              {`${f.minor}m`}
            </SvgText>
          </G>
        );
      })}
      {pathIdx.slice(1).map((to, k) => {
        const from = pathIdx[k]!;
        const a = polar(rIn - 8, from),
          b = polar(rIn - 8, to);
        return (
          <Arrow key={k} d={`M${a.x} ${a.y}Q${c} ${c} ${b.x} ${b.y}`} ink={functionTone.Dsec.ink} />
        );
      })}
      {!diagram.path ? (
        <G>
          <SvgText
            {...font}
            x={c}
            y={c - 12}
            fontSize={14}
            fontWeight="700"
            fill={colors.ink}
            textAnchor="middle"
          >
            {`${key.name} mayor`}
          </SvgText>
          <SvgText {...font} x={c} y={c + 6} fontSize={11} fill={colors.muted} textAnchor="middle">
            {signatureText(key.accidentals)}
          </SvgText>
          <SvgText
            {...font}
            x={c}
            y={c + 22}
            fontSize={11}
            fontWeight="600"
            fill={colors.green}
            textAnchor="middle"
          >
            {signatureNotes(key.accidentals).join(' ')}
          </SvgText>
        </G>
      ) : null}
    </DiagramCanvas>
  );
}

/* ---------- Form roadmap ---------- */

function FormDiagram({ diagram, step }: Props<'form'>) {
  const vbW = 600,
    vbH = 168,
    left = 14,
    y = 40,
    h = 56;
  const blockW = (vbW - left * 2) / diagram.written.length;
  const xOf = (i: number) => left + i * blockW;
  const current = diagram.order[step] ?? 0;
  const repeatAt = diagram.written.findIndex((s) => s.ending === 1);
  return (
    <DiagramCanvas
      width={vbW}
      height={vbH}
      label={`${diagram.title}. ${diagram.summary}`}
      cursor={{ x: xOf(current) + 4, y: y - 6, w: blockW - 8, h: h + 12 }}
    >
      <Line x1={left} x2={vbW - left} y1={y} y2={y} stroke={tone.staff} />
      <Line x1={left} x2={vbW - left} y1={y + h} y2={y + h} stroke={tone.staff} />
      <Line x1={left} x2={left} y1={y} y2={y + h} stroke={colors.ink} strokeWidth={1.4} />
      {diagram.written.map((s, i) => {
        const x = xOf(i),
          on = i === current;
        return (
          <G key={i}>
            {i > 0 ? (
              <Line x1={x} x2={x} y1={y} y2={y + h} stroke={colors.ink} strokeWidth={1.2} />
            ) : null}
            {s.ending ? (
              <G>
                <Path
                  d={`M${x + 4} ${y - 4}V${y - 20}H${x + blockW - 10}${s.ending === 1 ? `V${y - 4}` : ''}`}
                  fill="none"
                  stroke={colors.ink}
                  strokeWidth={1.3}
                />
                <SvgText
                  {...font}
                  x={x + 10}
                  y={y - 7}
                  fontSize={12}
                  fontWeight="700"
                  fill={colors.ink}
                >
                  {`${s.ending}.`}
                </SvgText>
              </G>
            ) : null}
            <SvgText
              {...font}
              x={x + blockW / 2}
              y={y + h / 2 + 8}
              fontSize={22}
              fontWeight="700"
              fill={on ? colors.green : colors.ink}
              textAnchor="middle"
            >
              {s.name}
            </SvgText>
          </G>
        );
      })}
      {repeatAt >= 0 ? (
        <G>
          <Line
            x1={xOf(repeatAt + 1) - 6}
            x2={xOf(repeatAt + 1) - 6}
            y1={y}
            y2={y + h}
            stroke={colors.ink}
            strokeWidth={1.2}
          />
          <Line
            x1={xOf(repeatAt + 1) - 1}
            x2={xOf(repeatAt + 1) - 1}
            y1={y}
            y2={y + h}
            stroke={colors.ink}
            strokeWidth={3.5}
          />
          <Circle cx={xOf(repeatAt + 1) - 13} cy={y + h / 2 - 8} r={2.6} fill={colors.ink} />
          <Circle cx={xOf(repeatAt + 1) - 13} cy={y + h / 2 + 8} r={2.6} fill={colors.ink} />
        </G>
      ) : null}
      <Line
        x1={vbW - left - 6}
        x2={vbW - left - 6}
        y1={y}
        y2={y + h}
        stroke={colors.ink}
        strokeWidth={1.2}
      />
      <Line
        x1={vbW - left - 1}
        x2={vbW - left - 1}
        y1={y}
        y2={y + h}
        stroke={colors.ink}
        strokeWidth={3.5}
      />
      {diagram.order.map((index, i) => {
        const w = 52,
          gap = 30,
          x0 = (vbW - (diagram.order.length * w + (diagram.order.length - 1) * gap)) / 2,
          x = x0 + i * (w + gap),
          cy = 134,
          on = i === step,
          done = i < step;
        return (
          <G key={i}>
            {i > 0 ? (
              <Arrow
                d={`M${x - gap + 4} ${cy}H${x - 6}`}
                ink={done || on ? colors.green : tone.soft}
              />
            ) : null}
            <Rect
              x={x}
              y={cy - 15}
              width={w}
              height={30}
              rx={7}
              fill={on ? colors.green : done ? colors.pale : '#F1F3EE'}
            />
            <SvgText
              {...font}
              x={x + w / 2}
              y={cy + 5}
              fontSize={14}
              fontWeight="700"
              fill={on ? 'white' : colors.ink}
              textAnchor="middle"
            >
              {diagram.written[index]!.name}
            </SvgText>
          </G>
        );
      })}
    </DiagramCanvas>
  );
}
