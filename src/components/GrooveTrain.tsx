import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useTheme } from './theme';
import { audio } from '../platform/audio';
import { grooveColors as c } from '../theme/groove';

const trainWidth = 100;
const inset = trainWidth / 2;
const beats = Array.from({ length: 16 }, (_, beat) => beat);

export function GrooveTrain({
  active,
  segment,
}: {
  active: number;
  segment: { start: number; end: number } | null;
}) {
  const [width, setWidth] = useState(0);
  const [reduced, setReduced] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (Platform.OS === 'web') {
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReduced(preference.matches);
      preference.addEventListener('change', update);
      update();
      return () => preference.removeEventListener('change', update);
    }
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduced || !segment) {
      progress.setValue(0);
      return;
    }
    const now = audio.now();
    progress.setValue(
      Math.max(0, Math.min(1, (now - segment.start) / (segment.end - segment.start))),
    );
    const motion = Animated.timing(progress, {
      toValue: 1,
      duration: Math.max(0, (segment.end - now) * 1000),
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    motion.start();
    return () => motion.stop();
  }, [segment, reduced, progress]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Avance por los pulsos"
      accessibilityValue={{ min: 0, max: 16, now: Math.max(0, active + 1) }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ minHeight: 57 }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: inset,
          right: inset,
          bottom: 2,
          flexDirection: 'row',
          gap: 2,
        }}
      >
        {beats.map((beat) => (
          <View
            key={beat}
            style={{
              flex: 1,
              height: 16,
              borderWidth: 1,
              borderRadius: 2,
              borderColor: c.ink,
              backgroundColor: beat === active ? c.cream : beat < active ? c.green : c.sleeper,
            }}
          />
        ))}
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: inset,
          right: inset,
          bottom: 5,
          height: 9,
          borderTopWidth: 2,
          borderBottomWidth: 2,
          borderColor: c.ink,
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          bottom: 8,
          transform: [
            {
              translateX: reduced
                ? 0
                : progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.max(0, width - trainWidth)],
                  }),
            },
          ],
        }}
      >
        <Locomotive />
      </Animated.View>
    </View>
  );
}

const Locomotive = React.memo(function Locomotive() {
  useTheme();
  return (
    <Svg width={trainWidth} height={43} viewBox="0 0 188 80" accessible={false}>
      <G stroke={c.ink} strokeWidth={3} strokeLinejoin="round">
        <Path d="M3 58V34H50V58ZM52 58V28H99V58Z" fill={c.coral} />
        <Path d="M4 33H50M52 27H99M99 52h13M50 57h2" strokeWidth={5} />
        <Rect x={13} y={40} width={24} height={12} rx={4} fill={c.amber} />
        <Rect x={62} y={36} width={27} height={15} rx={4} fill={c.mint} />
        <Path d="M22 49v-6m0 1 7-2v6M70 40v9m0-9 8-2v9" fill="none" />
        <Rect x={116} y={38} width={42} height={24} rx={7} fill={c.blue} />
        <Rect x={144} y={19} width={29} height={43} rx={4} fill={c.green} />
        <Rect x={150} y={26} width={16} height={13} rx={2} fill={c.gold} />
        <Path d="M141 18h34M116 36h43" strokeWidth={5} strokeLinecap="round" />
        <Path d="M124 37V22h10v15" fill={c.ink} />
        <Circle cx={114} cy={50} r={6} fill={c.yellow} />
        <Path d="M173 50h7l6 12h-13z" fill={c.rose} />
      </G>
      <G fill={c.ink}>
        {[13, 41, 62, 90].map((x) => (
          <Circle key={x} cx={x} cy={65} r={9} />
        ))}
        <Circle cx={126} cy={66} r={11} />
        <Circle cx={162} cy={66} r={11} />
      </G>
      <Path
        d="M13 59v12m-6-6h12M41 59v12m-6-6h12M62 59v12m-6-6h12M90 59v12m-6-6h12M126 58v16m-8-8h16M162 58v16m-8-8h16"
        stroke={c.gold}
        strokeWidth={2.3}
        strokeLinecap="round"
      />
    </Svg>
  );
});
