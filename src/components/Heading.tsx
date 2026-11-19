import React from 'react';
import { Text, TextProps } from 'react-native';

export function Heading({ level: _level = 1, ...props }: TextProps & { level?: 1 | 2 | 3 }) {
  return <Text {...props} accessibilityRole="header" />;
}
