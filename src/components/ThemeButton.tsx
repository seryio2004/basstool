import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, useTheme } from './theme';

const shapes = {
  dark: 'M13 15 3 12 8 23 2 32 13 28 18 35 19 23 30 10 35 8 38 2 31 3 27 8 16 19Z',
  light:
    'M13 17C8 13 4 18 7 23C0 26 2 35 8 36C14 38 19 32 17 27C23 26 24 21 20 19L30 9L34 8L37 3L32 2L28 6L17 18C16 17 14 17 13 17Z',
};

export function ThemeButton({ onChange }: { onChange: (theme: 'dark' | 'light') => void }) {
  const { name } = useTheme();
  const next = name === 'dark' ? 'light' : 'dark';
  const [reduced, setReduced] = useState(true);
  const light = useRef(new Animated.Value(name === 'light' ? 1 : 0)).current;
  const dark = useRef(Animated.subtract(1, light)).current;
  useEffect(() => {
    if (Platform.OS === 'web') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReduced(media.matches);
      update();
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    const toValue = name === 'light' ? 1 : 0;
    if (reduced) {
      light.setValue(toValue);
      return;
    }
    const animation = Animated.timing(light, {
      toValue,
      duration: 150,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [light, name, reduced]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={next === 'light' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      onPress={() => onChange(next)}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed || hovered ? colors.raised : 'transparent',
      })}
    >
      {(['dark', 'light'] as const).map((shape) => (
        <Animated.View
          key={shape}
          pointerEvents="none"
          aria-hidden
          style={[
            StyleSheet.absoluteFill,
            {
              alignItems: 'center',
              justifyContent: 'center',
              opacity: reduced ? Number(name === shape) : shape === 'light' ? light : dark,
            },
          ]}
        >
          <Svg width={30} height={30} viewBox="0 0 40 40">
            <Path d={shapes[shape]} fill={colors.ink} stroke={colors.ink} strokeLinejoin="round" />
            <Path d="M10 29L33 5M12 30L34 6" stroke={colors.chrome} strokeWidth={1.2} />
          </Svg>
        </Animated.View>
      ))}
    </Pressable>
  );
}
