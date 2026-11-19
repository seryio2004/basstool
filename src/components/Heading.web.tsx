import React from 'react';
import { Text, TextProps } from 'react-native';

export function Heading({ level = 1, ...props }: TextProps & { level?: 1 | 2 | 3 }) {
  const semantics = { 'aria-level': level };
  return <Text {...props} {...semantics} accessibilityRole="header" />;
}
