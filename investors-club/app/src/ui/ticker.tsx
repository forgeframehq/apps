import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';

import { money } from '@/lib/format';

import { C, Icon } from './kit';

export interface TickerItem { symbol: string; price: number; change: number }

/** The scrolling tape of prices along the top of the Market tab. Tap a symbol to open it. */
export function Ticker({ items, onPress }: { items: TickerItem[]; onPress: (symbol: string) => void }) {
  const x = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!width) return;
    x.setValue(0);
    // Two copies sit side by side; sliding left by one copy's width and jumping back looks endless.
    const loop = Animated.loop(Animated.timing(x, { toValue: -width, duration: width * 26, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [width, x]);

  const copy = (hidden: boolean) => (
    <View
      onLayout={hidden ? undefined : (e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={{ flexDirection: 'row' }}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      aria-hidden={hidden}>
      {items.map((it) => {
        const colour = it.change >= 0 ? C.good : C.bad;
        return (
          <Pressable key={it.symbol} accessibilityRole="button" accessibilityLabel={hidden ? undefined : `Ticker ${it.symbol}`} onPress={() => onPress(it.symbol)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{it.symbol}</Text>
            <Text style={{ color: C.muted, fontSize: 13 }}>{money(it.price)}</Text>
            <Icon name={it.change >= 0 ? 'caret-up' : 'caret-down'} size={11} color={colour} />
            <Text style={{ color: colour, fontSize: 13, fontWeight: '600' }}>{Math.abs(it.change).toFixed(2)}%</Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (!items.length) return null;
  return (
    <View style={{ height: 40, overflow: 'hidden', backgroundColor: C.bar }}>
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, flexDirection: 'row', transform: [{ translateX: x }] }}>
        {copy(false)}
        {copy(true)}
      </Animated.View>
    </View>
  );
}
