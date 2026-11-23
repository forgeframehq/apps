import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pct } from '@/lib/format';
import { C } from '@/lib/theme';

export { C };

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const Icon = ({ name, size = 22, color = C.text }: { name: IconName; size?: number; color?: string }) => <Ionicons name={name} size={size} color={color} />;

export function Txt({ children, size = 16, color = C.text, bold, center, lines, style }: {
  children: React.ReactNode; size?: number; color?: string; bold?: boolean; center?: boolean; lines?: number; style?: StyleProp<TextStyle>;
}) {
  return (
    <Text numberOfLines={lines} style={[{ color, fontSize: size, lineHeight: Math.round(size * 1.35), fontWeight: bold ? '700' : '400', textAlign: center ? 'center' : undefined }, style]}>
      {children}
    </Text>
  );
}

type Kind = 'primary' | 'card' | 'ghost' | 'good' | 'danger' | 'text' | 'plain';
// Read at render time so a theme change takes effect.
const kindOf = (kind: Kind): { bg: string; fg: string } => ({
  primary: { bg: C.accent, fg: C.onAccent },
  card: { bg: C.card, fg: C.text },
  ghost: { bg: C.cardHi, fg: C.text },
  good: { bg: C.good, fg: C.dark },
  danger: { bg: C.card, fg: C.bad },
  text: { bg: 'transparent', fg: C.accent },
  plain: { bg: 'transparent', fg: C.muted },
}[kind]);

export function Btn({ title, onPress, kind = 'primary', icon, disabled, busy, left, height, color, style, testID }: {
  title: string; onPress?: () => void; kind?: Kind; icon?: IconName; disabled?: boolean; busy?: boolean;
  left?: boolean; height?: number; color?: string; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const k = kindOf(kind);
  const fg = color ?? k.fg;
  const link = kind === 'text' || kind === 'plain';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: k.bg, minHeight: height ?? (link ? 38 : 50), opacity: disabled ? 0.45 : pressed ? 0.7 : 1, justifyContent: left ? 'flex-start' : 'center' },
        link && { paddingHorizontal: 8 },
        style,
      ]}>
      {busy ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Icon name={icon} size={20} color={fg} />}
          <Text numberOfLines={1} style={{ color: fg, fontSize: link ? 15 : 16, fontWeight: kind === 'primary' || kind === 'good' ? '700' : '500', flexShrink: 1 }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconBtn({ name, onPress, color = C.text, size = 24, side = 44, bg = 'transparent', disabled, label }: {
  name: IconName; onPress?: () => void; color?: string; size?: number; side?: number; bg?: string; disabled?: boolean; label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ width: side, height: side, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : pressed ? 0.6 : 1 })}>
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Chip({ title, selected, onPress }: { title: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected }} onPress={onPress}
      style={({ pressed }) => [s.chip, { backgroundColor: selected ? C.accent : C.cardHi, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={{ color: selected ? C.onAccent : C.text, fontSize: 14, fontWeight: '500' }}>{title}</Text>
    </Pressable>
  );
}

export const Card = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[s.card, style]}>{children}</View>;

export function TapCard({ children, onPress, style, bare, label }: { children: React.ReactNode; onPress: () => void; style?: StyleProp<ViewStyle>; bare?: boolean; label?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [!bare && s.card, { opacity: pressed ? 0.7 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={C.muted} selectionColor={C.accent} {...props} style={[s.field, props.style]} />;
}

export function SearchField(props: TextInputProps) {
  return (
    <View style={s.search}>
      <Icon name="search" size={20} color={C.muted} />
      <TextInput placeholderTextColor={C.muted} selectionColor={C.accent} autoCorrect={false} returnKeyType="search" {...props} style={{ flex: 1, color: C.text, fontSize: 16, minHeight: 48, minWidth: 0 }} />
    </View>
  );
}

export const Caption = ({ children }: { children: string }) => <Text style={s.caption}>{children.toUpperCase()}</Text>;
export const Divider = ({ color = C.border }: { color?: string }) => <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: color }} />;
export const Row = ({ children, gap = 10, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) => <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;

export function Empty({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 12, gap: 8 }}>
      <Icon name={icon} size={44} color={C.muted} />
      <Txt size={19} bold center>{title}</Txt>
      <Txt size={15} color={C.muted} center>{body}</Txt>
    </View>
  );
}

export function Stat({ title, value, color = C.text }: { title: string; value: string; color?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Txt size={13} color={C.muted}>{title}</Txt>
      <Row gap={5}>
        <Txt size={17} color={color}>{value}</Txt>
      </Row>
    </View>
  );
}

const TILE_COLOURS = ['#4CC2FF', '#2EE6A6', '#B79CFF', '#FFB454', '#FF7A90', '#7CE0E6', '#C8F031', '#FF9D5C'];
/** Square badge showing a stock's ticker symbol, in a colour that is always the same for that stock. */
export function Tile({ symbol, size = 46 }: { symbol: string; size?: number }) {
  let h = 0;
  for (const c of symbol) h = (h * 31 + c.charCodeAt(0)) % 997;
  const colour = TILE_COLOURS[h % TILE_COLOURS.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.26, backgroundColor: `${colour}26`, borderWidth: 1, borderColor: `${colour}66`, alignItems: 'center', justifyContent: 'center' }}>
      <Text numberOfLines={1} style={{ color: colour, fontWeight: '800', fontSize: size * (symbol.length > 4 ? 0.24 : symbol.length > 3 ? 0.27 : 0.31), letterSpacing: 0.3 }}>{symbol}</Text>
    </View>
  );
}

/** A percentage change with an arrow: green for up, red for down. */
export function Delta({ value, size = 14, pill }: { value: number; size?: number; pill?: boolean }) {
  const flat = Math.abs(value) < 0.005; // shows as 0.00%, so do not colour it as a gain or a loss
  const up = value >= 0;
  const colour = flat ? C.muted : up ? C.good : C.bad;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 2 }, pill && { backgroundColor: `${colour}22`, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }]}>
      {!flat && <Icon name={up ? 'caret-up' : 'caret-down'} size={size - 2} color={colour} />}
      <Text style={{ color: colour, fontSize: size, fontWeight: '600' }}>{pct(value).replace(/^[+-]/, '')}</Text>
    </View>
  );
}

/** A thin progress bar from 0 to 1. */
export function Bar({ value, color = C.accent, height = 8 }: { value: number; color?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: C.cardHi, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/** A settings-style row: icon, title, current value, chevron. */
export function LinkRow({ icon, title, value, onPress }: { icon: IconName; title: string; value?: string; onPress: () => void }) {
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, opacity: pressed ? 0.6 : 1 })}>
        <Icon name={icon} size={22} />
        <Txt size={16} style={{ flex: 1 }}>{title}</Txt>
        {!!value && <Txt size={15} color={C.muted} lines={1} style={{ maxWidth: '50%' }}>{value}</Txt>}
        <Icon name="chevron-forward" size={18} color={C.muted} />
      </Pressable>
      <Divider />
    </View>
  );
}

/** Scrolling page body with the standard padding. */
export function Page({ children, gap = 14, pad = 16, bottom = 28 }: { children: React.ReactNode; gap?: number; pad?: number; bottom?: number }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: pad, paddingTop: 12, paddingBottom: bottom, gap }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

/** Big left-aligned title with actions, used at the top of each tab. */
export function TabHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, minHeight: insets.top + 58 }}>
      <Txt size={28} bold style={{ flex: 1 }}>{title}</Txt>
      {children}
    </View>
  );
}

export const s = StyleSheet.create({
  btn: { borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  chip: { minHeight: 36, borderRadius: 18, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 10 },
  field: { backgroundColor: C.card, color: C.text, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16, minWidth: 0 },
  search: { backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  caption: { color: C.muted, fontSize: 12, letterSpacing: 0.4 },
});
