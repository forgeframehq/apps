// Dialogs, bottom sheets and toasts with a promise API, so screens can write
// `if (await confirm(...))` instead of juggling modal state.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Btn, C, Txt, type IconName } from './kit';

type Request =
  | { kind: 'dialog'; title: string; body: string; buttons: { label: string; style: 'primary' | 'danger' | 'ghost' }[] }
  | { kind: 'menu'; title: string; items: MenuItem[] }
  | { kind: 'pick'; title: string; options: unknown[]; current: unknown; multi: boolean; label: (o: any) => string }
  | { kind: 'prompt'; title: string; initial: string; placeholder: string; okText: string; secure: boolean; multiline: boolean };
type Pending = Request & { resolve: (value: any) => void };
export interface MenuItem { label: string; icon?: IconName; danger?: boolean }

let show: (r: Pending) => void = () => {};
let showToast: (text: string) => void = () => {};
const ask = <T,>(r: Request) => new Promise<T>((resolve) => show({ ...r, resolve } as Pending));

/** Returns the index of the button pressed, or -1 if dismissed. */
export const dialog = (title: string, body: string, buttons: { label: string; style: 'primary' | 'danger' | 'ghost' }[]) => ask<number>({ kind: 'dialog', title, body, buttons });
export const alertBox = (title: string, body = '') => dialog(title, body, [{ label: 'OK', style: 'ghost' }]).then(() => {});
export const confirm = (title: string, body: string, okText: string, opts: { danger?: boolean; cancelText?: string } = {}) =>
  dialog(title, body, [{ label: okText, style: opts.danger ? 'danger' : 'primary' }, { label: opts.cancelText ?? 'Cancel', style: 'ghost' }]).then((i) => i === 0);
/** Bottom sheet of actions. Returns the index chosen, or -1. */
export const menu = (title: string, items: MenuItem[]) => ask<number>({ kind: 'menu', title, items });
/** Bottom sheet list. Returns the chosen option, or null if cancelled. */
export const pick = <T,>(title: string, options: T[], current: T | null, label: (o: T) => string = String) =>
  ask<T | null>({ kind: 'pick', title, options, current, multi: false, label });
export const pickMany = (title: string, options: string[], current: string[], label: (o: string) => string = String) =>
  ask<string[] | null>({ kind: 'pick', title, options, current, multi: true, label });
/** Asks for a line of text. Returns it, or null if cancelled. */
export const prompt = (title: string, initial = '', placeholder = '', opts: { okText?: string; secure?: boolean; multiline?: boolean } = {}) =>
  ask<string | null>({ kind: 'prompt', title, initial, placeholder, okText: opts.okText ?? 'Save', secure: !!opts.secure, multiline: !!opts.multiline });
export const toast = (text: string) => showToast(text);

export function OverlayHost() {
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<Pending[]>([]);
  const [note, setNote] = useState<{ text: string; id: number } | null>(null);
  const [text, setText] = useState('');
  const [chosen, setChosen] = useState<unknown[]>([]);
  const current = queue[0];

  useEffect(() => {
    show = (r) => setQueue((q) => [...q, r]);
    showToast = (t) => setNote({ text: t, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 2200);
    return () => clearTimeout(t);
  }, [note]);
  useEffect(() => {
    if (current?.kind === 'prompt') setText(current.initial);
    if (current?.kind === 'pick') setChosen(current.multi && Array.isArray(current.current) ? [...current.current] : []);
  }, [current]);

  const done = (value: unknown) => {
    current?.resolve(value);
    setQueue((q) => q.slice(1));
  };
  const cancel = () => done(current?.kind === 'dialog' || current?.kind === 'menu' ? -1 : null);
  const sheet = current?.kind === 'menu' || current?.kind === 'pick';

  return (
    <>
      <Modal visible={!!current} transparent animationType="fade" onRequestClose={cancel} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable accessibilityLabel="Dismiss" onPress={cancel} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: sheet ? 'flex-end' : 'center', padding: sheet ? 0 : 20 }}>
            {current && (
              <Pressable
                onPress={() => {}}
                style={sheet
                  ? { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: insets.bottom + 12, gap: 8, maxHeight: '80%' }
                  : { backgroundColor: C.card, borderRadius: 18, padding: 20, gap: 10, borderWidth: 1, borderColor: C.border, width: '100%', maxWidth: 380, alignSelf: 'center' }}>
                {sheet && <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: C.cardHi, alignSelf: 'center' }} />}
                {!!current.title && <Txt size={sheet ? 17 : 19} bold center={sheet}>{current.title}</Txt>}

                {current.kind === 'dialog' && (
                  <>
                    {!!current.body && <Txt size={15} color={C.muted}>{current.body}</Txt>}
                    <View style={{ height: 4 }} />
                    {current.buttons.map((b, i) => (
                      <Btn key={b.label} title={b.label} kind={b.style === 'primary' ? 'primary' : 'ghost'} color={b.style === 'danger' ? C.bad : undefined} onPress={() => done(i)} />
                    ))}
                  </>
                )}

                {current.kind === 'menu' && (
                  <>
                    {current.items.map((it, i) => (
                      <Btn key={it.label} title={it.label} icon={it.icon} kind="ghost" left color={it.danger ? C.bad : undefined} onPress={() => done(i)} />
                    ))}
                    <Btn title="Cancel" kind="plain" onPress={cancel} />
                  </>
                )}

                {current.kind === 'pick' && (
                  <>
                    <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
                      {current.options.map((o) => {
                        const on = current.multi ? chosen.includes(o) : current.current !== null && current.current === o;
                        return (
                          <Btn key={String(o)} title={current.label(o)} kind="ghost" left height={46} color={on ? C.accent : undefined}
                            icon={on ? 'checkmark' : undefined}
                            onPress={() => (current.multi ? setChosen((c) => (c.includes(o) ? c.filter((x) => x !== o) : [...c, o])) : done(o))} />
                        );
                      })}
                    </ScrollView>
                    {current.multi && <Btn title="Done" onPress={() => done(chosen)} />}
                    <Btn title="Cancel" kind="plain" onPress={cancel} />
                  </>
                )}

                {current.kind === 'prompt' && (
                  <>
                    <TextInput
                      value={text}
                      onChangeText={setText}
                      placeholder={current.placeholder}
                      placeholderTextColor={C.muted}
                      selectionColor={C.accent}
                      secureTextEntry={current.secure}
                      multiline={current.multiline}
                      autoFocus
                      autoCapitalize={current.secure ? 'none' : 'sentences'}
                      onSubmitEditing={current.multiline ? undefined : () => done(text)}
                      style={{ backgroundColor: C.cardHi, color: C.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: current.multiline ? 120 : 48, maxHeight: 220, fontSize: 16, textAlignVertical: current.multiline ? 'top' : 'center' }}
                    />
                    <View style={{ height: 4 }} />
                    <Btn title={current.okText} onPress={() => done(text)} />
                    <Btn title="Cancel" kind="ghost" onPress={cancel} />
                  </>
                )}
              </Pressable>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      {note && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 96, alignItems: 'center' }}>
          <View style={{ backgroundColor: C.cardHi, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 12, maxWidth: '90%' }}>
            <Text style={{ color: C.text, fontSize: 14 }}>{note.text}</Text>
          </View>
        </View>
      )}
    </>
  );
}
