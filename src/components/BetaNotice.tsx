import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Label, colors, space } from './ui';

const SEEN_KEY = 'clasro.beta-notice.v1';

export function BetaNotice({ padding }: { padding: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(SEEN_KEY)
      .catch(() => null)
      .then((seen) => {
        if (mounted && seen !== '1') setVisible(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!visible) return null;
  return (
    <View
      style={{
        backgroundColor: colors.raised,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
        paddingHorizontal: padding,
        paddingVertical: space.s,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s,
      }}
    >
      <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
        <Label>
          Esta es una versión de prueba de clasRo para practicar con el bajo y transcribir de oído.
          Tus datos se guardan solo en este navegador. Si usas el micrófono, el navegador te pedirá
          permiso.
        </Label>
      </View>
      <Button
        variant="ghost"
        small
        onPress={() => {
          setVisible(false);
          void AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
        }}
      >
        Entendido
      </Button>
    </View>
  );
}
