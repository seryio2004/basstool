import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, ScrollView, View } from 'react-native';
import Svg from 'react-native-svg';
import { colors } from '../ui';

export type Box = { x: number; y: number; w: number; h: number };
export type Sweep = { from: number; to: number; y: number; h: number; ms: number; key: number };

const nativeDriver = Platform.OS !== 'web';
const arrive = Easing.bezier(0.16, 1, 0.3, 1);

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduced(value))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

/**
 * Scales a diagram drawn in viewBox units to the available width. Wide
 * diagrams keep a legible minimum size and scroll horizontally on phones.
 * The cursor travels to the active element; the sweep is a playhead that
 * crosses a rhythm event while it sounds. Both stay in place with reduced
 * motion, where the highlight jumps instead of travelling.
 */
export function DiagramCanvas({
  width: vbW,
  height: vbH,
  label,
  cursor,
  sweep,
  minScale = 0.8,
  maxScale = 1.35,
  children,
}: {
  width: number;
  height: number;
  label: string;
  cursor?: Box | null;
  sweep?: Sweep | null;
  minScale?: number;
  maxScale?: number;
  children: React.ReactNode;
}) {
  const [available, setAvailable] = useState(0);
  const reduced = useReducedMotion();
  const width = available
    ? Math.round(Math.min(Math.max(available, vbW * minScale), vbW * maxScale))
    : 0;
  const scale = width / vbW,
    height = vbH * scale;
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const scrolls = width > available;
  // Keep the active element in view when the diagram is wider than the screen.
  useEffect(() => {
    if (!scrolls || !cursor) return;
    const x = Math.max(0, cursor.x * scale - available / 2 + (cursor.w * scale) / 2);
    scroller.current?.scrollTo({ x, animated: !reduced });
  }, [scrolls, cursor?.x, scale, available, reduced]);
  const content = width ? (
    <View style={{ width, height }}>
      {cursor ? <Cursor box={cursor} scale={scale} reduced={reduced} /> : null}
      {/* Positioned after the cursor so the drawing paints above it. */}
      <View style={{ position: 'absolute', left: 0, top: 0, width, height }}>
        <Svg width={width} height={height} viewBox={`0 0 ${vbW} ${vbH}`}>
          {children}
        </Svg>
      </View>
      {sweep && !reduced ? <Playhead sweep={sweep} scale={scale} /> : null}
    </View>
  ) : null;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(e) => setAvailable(Math.floor(e.nativeEvent.layout.width))}
      style={{ width: '100%', minHeight: available ? undefined : vbH * minScale }}
    >
      {scrolls ? (
        <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </View>
  );
}

function Cursor({ box, scale, reduced }: { box: Box; scale: number; reduced: boolean }) {
  const position = useRef(new Animated.ValueXY({ x: box.x * scale, y: box.y * scale })).current;
  useEffect(() => {
    const target = { x: box.x * scale, y: box.y * scale };
    if (reduced) {
      position.setValue(target);
      return;
    }
    const animation = Animated.timing(position, {
      toValue: target,
      duration: 260,
      easing: arrive,
      useNativeDriver: nativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [box.x, box.y, scale, reduced]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: box.w * scale,
        height: box.h * scale,
        borderRadius: 8,
        backgroundColor: colors.pale,
        transform: position.getTranslateTransform(),
      }}
    />
  );
}

function Playhead({ sweep, scale }: { sweep: Sweep; scale: number }) {
  const x = useRef(new Animated.Value(sweep.from * scale)).current;
  useEffect(() => {
    x.setValue(sweep.from * scale);
    const animation = Animated.timing(x, {
      toValue: sweep.to * scale,
      duration: sweep.ms,
      easing: Easing.linear,
      useNativeDriver: nativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [sweep.key, scale]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: sweep.y * scale,
        width: 2,
        height: sweep.h * scale,
        borderRadius: 1,
        backgroundColor: colors.green,
        transform: [{ translateX: x }],
      }}
    />
  );
}
