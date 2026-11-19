import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Platform, View, type ImageSourcePropType } from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import type { BassScale, Profile } from '../core/profile';
import { tunings } from '../core/instrument';
import { Label, useTheme } from './ui';
import { useReducedMotion } from './harmony/DiagramCanvas';
import {
  FRAME_COUNT,
  VIEW_H,
  VIEW_W,
  bassFrame,
  bassModel,
  frameAngle,
  type Frame,
  type Paint,
  type Shape,
} from './bassGeometry';

type Props = Pick<Profile, 'tuning' | 'scale' | 'leftHanded'>;
type RenderKey = `bass-${4 | 5 | 6}st-${BassScale}in-${'rh' | 'lh'}`;
/** Renders opcionales de la vista frontal (ver assets/README.md). El giro usa siempre el SVG. */
const renders: Partial<Record<RenderKey, ImageSourcePropType>> = {};

/** Píxeles de arrastre por fotograma: una vuelta en unos 290 px. */
const DRAG_STEP = 18;
const SPIN_MS = 85;
const HOLD_MS = 180;

// ------------------------------------------------------------------ colores

const hex = (c: string) => {
  const v = c.replace('#', '');
  const n = parseInt(v.length === 3 ? v.replace(/./g, (x) => x + x) : v.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const toHex = (rgb: readonly number[]) =>
  '#' +
  rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
/** Mezcla dos tokens del tema: los materiales se derivan, no se inventan colores. */
const mix = (a: string, b: string, t: number) => {
  const x = hex(a),
    y = hex(b);
  return toHex(x.map((v, i) => v + (y[i]! - v) * t));
};
/**
 * Aclara (k > 1) u oscurece (k < 1) un color según la luz que recibe la cara.
 * La sombra tira hacia el negro cálido del tema, no hacia el gris.
 */
const shade = (color: string, k: number, dark: string, light: string) => {
  if (k === 1) return color;
  return k < 1 ? mix(color, dark, Math.min(1, (1 - k) * 1.1)) : mix(color, light, (k - 1) * 0.6);
};

type Colors = ReturnType<typeof useTheme>['colors'];

function materials(colors: Colors) {
  const { accent, keyWhite, keyBlack, fret } = colors;
  const maple = mix(keyWhite, accent, 0.32);
  const solid: Record<Paint, string> = {
    burst: accent,
    lacquer: mix(accent, keyBlack, 0.72),
    maple,
    mapleRound: maple,
    board: mix(keyBlack, accent, 0.26),
    guard: mix(keyWhite, accent, 0.14),
    guardEdge: mix(keyBlack, accent, 0.2),
    black: mix(keyBlack, keyWhite, 0.06),
    metal: mix(fret, keyWhite, 0.25),
    chrome: mix(keyWhite, fret, 0.35),
    string: mix(fret, keyWhite, 0.3),
    shine: keyWhite,
    inlay: mix(keyWhite, accent, 0.06),
    bone: keyWhite,
    shadow: keyBlack,
    edge: mix(keyBlack, fret, 0.3),
  };
  return {
    shade: (color: string, k: number) => shade(color, k, keyBlack, keyWhite),
    solid,
    burstCenter: mix(accent, keyWhite, 0.3),
    burstMid: accent,
    burstEdge: mix(accent, keyBlack, 0.62),
    burstRim: mix(accent, keyBlack, 0.86),
    maple,
    chromeLight: mix(keyWhite, fret, 0.12),
    chromeDark: mix(fret, keyBlack, 0.45),
  };
}

type Materials = ReturnType<typeof materials>;

const FrameArt = React.memo(function FrameArt({
  frame,
  mat,
  id,
}: {
  frame: Frame;
  mat: Materials;
  id: string;
}) {
  const gradient: Partial<Record<Paint, string>> = {
    burst: `url(#${id}-burst)`,
    mapleRound: `url(#${id}-round)`,
    chrome: `url(#${id}-chrome)`,
  };
  const paint = (p: Paint | undefined, k = 1) => (p ? mat.shade(mat.solid[p], k) : 'none');
  const draw = (sh: Shape, i: number) => {
    const k = sh.k ?? 1;
    const grad = sh.fill && gradient[sh.fill];
    const common = {
      d: sh.d,
      stroke: sh.stroke ? paint(sh.stroke, sh.stroke === sh.fill || !sh.fill ? k : 1) : undefined,
      strokeWidth: sh.width,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      opacity: sh.opacity,
      clipPath: sh.clip ? `url(#${id}-clip)` : undefined,
    };
    if (!grad) return <Path key={i} {...common} fill={paint(sh.fill, k)} />;
    // Degradado del material y, encima, la luz de la cara como velo.
    return (
      <G key={i}>
        <Path {...common} fill={grad} />
        {k !== 1 ? (
          <Path
            d={sh.d}
            fill={k < 1 ? mat.solid.shadow : mat.solid.shine}
            opacity={k < 1 ? (1 - k) * 0.95 : (k - 1) * 0.5}
          />
        ) : null}
      </G>
    );
  };
  return (
    <>
      <Defs>
        <RadialGradient id={`${id}-burst`} cx="44%" cy="50%" r="62%" fx="40%" fy="44%">
          <Stop offset="0" stopColor={mat.burstCenter} />
          <Stop offset="0.42" stopColor={mat.burstMid} />
          <Stop offset="0.78" stopColor={mat.burstEdge} />
          <Stop offset="1" stopColor={mat.burstRim} />
        </RadialGradient>
        <LinearGradient id={`${id}-round`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={mat.shade(mat.maple, 0.62)} />
          <Stop offset="0.45" stopColor={mat.shade(mat.maple, 1.12)} />
          <Stop offset="1" stopColor={mat.shade(mat.maple, 0.7)} />
        </LinearGradient>
        <LinearGradient id={`${id}-chrome`} x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={mat.chromeLight} />
          <Stop offset="0.5" stopColor={mat.solid.chrome} />
          <Stop offset="0.56" stopColor={mat.chromeDark} />
          <Stop offset="1" stopColor={mat.solid.chrome} />
        </LinearGradient>
        <ClipPath id={`${id}-clip`}>
          <Path d={frame.clip} />
        </ClipPath>
      </Defs>
      {frame.shapes.map(draw)}
    </>
  );
});

// --------------------------------------------------------------- componente

type Timers = {
  hold?: ReturnType<typeof setTimeout>;
  spin?: ReturnType<typeof setInterval>;
  back?: ReturnType<typeof setTimeout>;
};

export function BassPreview({ tuning, scale, leftHanded }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { strings, frets } = tunings[tuning];
  const count = strings.length as 4 | 5 | 6;
  const render = renders[`bass-${count}st-${scale}in-${leftHanded ? 'lh' : 'rh'}`];
  const label = `Bajo de ${count} cuerdas, escala de ${scale} pulgadas, para ${leftHanded ? 'zurdos' : 'diestros'}`;

  const [frame, setFrame] = useState(0);
  const model = useMemo(() => bassModel(count, scale, frets), [count, scale, frets]);
  // Cada fotograma se calcula una vez por configuración y se reutiliza.
  const frames = useMemo(() => new Map<number, Frame>(), [model, leftHanded]);
  let current = frames.get(frame);
  if (!current) {
    current = bassFrame(model, frameAngle(frame), !leftHanded);
    frames.set(frame, current);
  }
  const themeKey = `${colors.accent}${colors.keyWhite}${colors.keyBlack}${colors.fret}`;
  const mat = useMemo(() => materials(colors), [themeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gestos: mantener pulsado gira solo; arrastrar en horizontal gira a mano.
  const frameRef = useRef(0);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const timers = useRef<Timers>({});
  const drag = useRef({ active: false, from: 0, dx0: 0 });
  const actions = useMemo(() => {
    const show = (f: number) => {
      const next = ((f % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
      frameRef.current = next;
      setFrame(next);
    };
    const stop = () => {
      const t = timers.current;
      if (t.hold) clearTimeout(t.hold);
      if (t.spin) clearInterval(t.spin);
      if (t.back) clearTimeout(t.back);
      timers.current = {};
    };
    const home = () => {
      stop();
      drag.current.active = false;
      if (reducedRef.current) return show(0);
      // Vuelve por el camino corto y frena al llegar a la vista frontal.
      const step = () => {
        const f = frameRef.current;
        if (f === 0) return;
        const half = FRAME_COUNT / 2;
        const left = f <= half ? f : FRAME_COUNT - f;
        show(f <= half ? f - 1 : f + 1);
        timers.current.back = setTimeout(step, 28 + 80 / left);
      };
      timers.current.back = setTimeout(step, 60);
    };
    return { show, stop, home };
  }, []);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
        // Sin arrastre horizontal, el desplazamiento vertical de la pantalla sigue mandando.
        onPanResponderTerminationRequest: () => !drag.current.active,
        onPanResponderGrant: () => {
          actions.stop();
          drag.current = { active: false, from: frameRef.current, dx0: 0 };
          if (!reducedRef.current)
            timers.current.hold = setTimeout(() => {
              timers.current.spin = setInterval(() => actions.show(frameRef.current + 1), SPIN_MS);
            }, HOLD_MS);
        },
        onPanResponderMove: (_, g) => {
          if (!drag.current.active && Math.abs(g.dx) > 6) {
            actions.stop();
            drag.current = { active: true, from: frameRef.current, dx0: g.dx };
          }
          if (drag.current.active)
            actions.show(drag.current.from + Math.round((g.dx - drag.current.dx0) / DRAG_STEP));
        },
        onPanResponderRelease: actions.home,
        onPanResponderTerminate: actions.home,
      }),
    [actions],
  );
  useEffect(() => actions.stop, [actions]);
  useEffect(() => {
    // Otro bajo u otra mano: vuelve de frente.
    actions.stop();
    actions.show(0);
  }, [actions, model, leftHanded]);

  const style = { width: '100%', aspectRatio: VIEW_W / VIEW_H } as const;
  const web =
    Platform.OS === 'web'
      ? ({ cursor: 'grab', userSelect: 'none', touchAction: 'pan-y' } as object)
      : null;
  return (
    <View style={{ gap: 4 }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        style={[style, web]}
        {...pan.panHandlers}
      >
        {render && frame === 0 ? (
          <Image source={render} style={style} resizeMode="contain" />
        ) : (
          <Svg viewBox={`${current.viewX} 0 ${VIEW_W} ${VIEW_H}`} height="100%" width="100%">
            <FrameArt frame={current} mat={mat} id={id} />
          </Svg>
        )}
      </View>
      <View aria-hidden importantForAccessibility="no-hide-descendants">
        <Label muted style={{ textAlign: 'center', fontSize: 13 }}>
          {reduced
            ? 'Arrastra a los lados para girarlo.'
            : 'Mantén pulsado o arrastra para girarlo.'}
        </Label>
      </View>
    </View>
  );
}
