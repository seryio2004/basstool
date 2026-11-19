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
const DRAG_STEP = 290 / FRAME_COUNT;
/** Duración de una vuelta completa al mantener pulsado. */
const SPIN_REV_MS = 1800;
/** Duración máxima de la vuelta a la vista frontal al soltar. */
const HOME_MS = 420;
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
  /** requestAnimationFrame del giro o de la vuelta de frente. */
  raf?: number;
  warm?: ReturnType<typeof setTimeout>;
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
      if (t.raf !== undefined) cancelAnimationFrame(t.raf);
      timers.current = { warm: t.warm };
    };
    const home = () => {
      stop();
      drag.current.active = false;
      if (reducedRef.current) return show(0);
      // Vuelve por el camino corto y frena al llegar a la vista frontal.
      const f0 = frameRef.current;
      if (f0 === 0) return;
      const delta = f0 <= FRAME_COUNT / 2 ? -f0 : FRAME_COUNT - f0;
      const ms = Math.max(160, HOME_MS * (Math.abs(delta) / (FRAME_COUNT / 2)));
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / ms);
        const eased = 1 - (1 - p) ** 3;
        show(f0 + Math.round(delta * eased));
        if (p < 1) timers.current.raf = requestAnimationFrame(tick);
      };
      timers.current.raf = requestAnimationFrame(tick);
    };
    return { show, stop, home };
  }, []);
  // Gesto común: empezar (mantener gira solo), mover (arrastre horizontal) y soltar.
  const gesture = useMemo(
    () => ({
      begin: () => {
        actions.stop();
        drag.current = { active: false, from: frameRef.current, dx0: 0 };
        if (!reducedRef.current)
          timers.current.hold = setTimeout(() => {
            // Giro por tiempo: la velocidad no depende de cuántos fotogramas pinte el dispositivo.
            const from = frameRef.current;
            const t0 = performance.now();
            const tick = (now: number) => {
              actions.show(from + Math.floor(((now - t0) / SPIN_REV_MS) * FRAME_COUNT));
              timers.current.raf = requestAnimationFrame(tick);
            };
            timers.current.raf = requestAnimationFrame(tick);
          }, HOLD_MS);
      },
      move: (dx: number) => {
        if (!drag.current.active && Math.abs(dx) > 4) {
          actions.stop();
          drag.current = { active: true, from: frameRef.current, dx0: dx };
        }
        if (drag.current.active)
          actions.show(drag.current.from + Math.round((dx - drag.current.dx0) / DRAG_STEP));
      },
      end: actions.home,
    }),
    [actions],
  );
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
        // Sin arrastre horizontal, el desplazamiento vertical de la pantalla sigue mandando.
        onPanResponderTerminationRequest: () => !drag.current.active,
        onPanResponderGrant: gesture.begin,
        onPanResponderMove: (_, g) => gesture.move(g.dx),
        onPanResponderRelease: gesture.end,
        onPanResponderTerminate: gesture.end,
      }),
    [gesture],
  );
  // En web, eventos de puntero con captura: el ratón sigue mandando aunque salga del dibujo.
  const pointer = useRef<{ id: number; x0: number } | null>(null);
  const webHandlers =
    Platform.OS === 'web'
      ? {
          onPointerDown: (e: any) => {
            if (e.button !== undefined && e.button !== 0) return;
            if (e.pointerType === 'mouse') e.preventDefault();
            e.currentTarget.setPointerCapture?.(e.pointerId);
            pointer.current = { id: e.pointerId, x0: e.clientX };
            gesture.begin();
          },
          onPointerMove: (e: any) => {
            const p = pointer.current;
            if (!p || p.id !== e.pointerId) return;
            gesture.move(e.clientX - p.x0);
          },
          onPointerUp: (e: any) => {
            if (pointer.current?.id !== e.pointerId) return;
            pointer.current = null;
            gesture.end();
          },
          onPointerCancel: (e: any) => {
            if (pointer.current?.id !== e.pointerId) return;
            pointer.current = null;
            gesture.end();
          },
        }
      : pan.panHandlers;
  useEffect(() => actions.stop, [actions]);
  useEffect(() => {
    // Precalcula el resto de fotogramas en segundo plano para que el primer giro no dé tirones.
    let next = 0;
    const warm = () => {
      const end = Math.min(FRAME_COUNT, next + 4);
      for (; next < end; next++)
        if (!frames.has(next)) frames.set(next, bassFrame(model, frameAngle(next), !leftHanded));
      if (next < FRAME_COUNT) timers.current.warm = setTimeout(warm, 16);
    };
    timers.current.warm = setTimeout(warm, 300);
    return () => {
      if (timers.current.warm) clearTimeout(timers.current.warm);
    };
  }, [frames, model, leftHanded]);
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
        {...webHandlers}
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
