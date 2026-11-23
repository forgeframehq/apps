import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { newId } from '@/lib/format';
import { setPickHandler } from '@/lib/pick';
import { deleteRoutine, folders, routine, saveRoutine } from '@/lib/store';
import { Avatar, Btn, C, Caption, Card, Empty, Field, IconBtn, Page, Row, Txt } from '@/ui/kit';
import { alertBox, confirm, pick } from '@/ui/overlay';

interface Item { key: string; exercise_id: string; name: string; sets: string; reps: string; rest: string; notes: string }

/** Create or edit a routine: name, folder and an ordered list of exercises with targets. */
export default function RoutineEditor() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; folder?: string }>();
  const existing = params.id === 'new' ? undefined : routine(params.id);
  const [name, setName] = useState(existing?.name ?? '');
  const [folder, setFolder] = useState(existing?.folder ?? params.folder ?? '');
  const [items, setItems] = useState<Item[]>(
    () => existing?.exercises.map((e) => ({ key: newId(), exercise_id: e.exercise_id, name: e.exercise_name, sets: String(e.target_sets), reps: e.target_reps, rest: String(e.rest_seconds), notes: e.notes })) ?? [],
  );

  const patch = (key: string, p: Partial<Item>) => setItems((l) => l.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const move = (index: number, by: number) => setItems((l) => {
    const to = index + by;
    if (to < 0 || to >= l.length) return l;
    const next = [...l];
    [next[index], next[to]] = [next[to], next[index]];
    return next;
  });
  const add = () => {
    setPickHandler((e) => setItems((l) => [...l, { key: newId(), exercise_id: e.id, name: e.name, sets: '3', reps: '8-12', rest: '120', notes: '' }]));
    router.push('/exercises?pick=1');
  };
  const pickFolder = async () => {
    const f = await pick('Folder', ['', ...folders()], folder, (o) => o || 'No folder');
    if (f !== null) setFolder(f);
  };
  const save = () => {
    if (!name.trim()) return alertBox('Name your routine', 'Give it a title like "Push A".');
    if (!items.length) return alertBox('Add an exercise', 'A routine needs at least one exercise.');
    saveRoutine({
      id: existing?.id ?? '', name: name.trim(), folder, notes: existing?.notes ?? '',
      exercises: items.map((i) => ({
        exercise_id: i.exercise_id, exercise_name: i.name,
        target_sets: Math.min(20, Math.max(1, parseInt(i.sets, 10) || 3)),
        target_reps: i.reps.trim() || '8-12',
        rest_seconds: Math.min(1800, Math.max(0, parseInt(i.rest, 10) || 0)),
        notes: i.notes,
      })),
    });
    router.back();
  };
  const remove = async () => {
    if (existing && (await confirm('Delete routine?', 'Workouts you already logged stay in your history.', 'Delete routine', { danger: true }))) {
      deleteRoutine(existing.id);
      router.back();
    }
  };

  const num = (label: string, item: Item, field: 'sets' | 'reps' | 'rest', numeric: boolean) => (
    <View style={{ flex: 1, gap: 6 }}>
      <Caption>{label}</Caption>
      <Field value={item[field]} onChangeText={(t) => patch(item.key, { [field]: t })} keyboardType={numeric ? 'number-pad' : 'default'}
        accessibilityLabel={`${item.name} ${label}`} style={{ backgroundColor: C.cardHi, minHeight: 44 }} />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: existing ? 'Edit Routine' : 'New Routine', headerRight: () => <Btn title="Save" height={38} onPress={save} /> }} />
      <Page bottom={60}>
        <Field value={name} onChangeText={setName} placeholder="Routine title" accessibilityLabel="Routine title" style={{ fontSize: 20 }} />
        <Btn title={folder || 'No folder'} kind="card" icon="folder-outline" left onPress={pickFolder} />
        {items.length === 0 && <Empty icon="barbell-outline" title="Add exercises" body="Pick the exercises for this routine and set your target sets and reps." />}
        {items.map((it, i) => (
          <Card key={it.key} style={{ gap: 12 }}>
            <Row gap={8}>
              <Avatar id={it.exercise_id} name={it.name} size={40} />
              <Txt size={17} color={C.accent} lines={1} style={{ flex: 1 }}>{it.name}</Txt>
              <IconBtn name="chevron-up" label={`Move ${it.name} up`} side={36} size={18} bg={C.cardHi} disabled={i === 0} onPress={() => move(i, -1)} />
              <IconBtn name="chevron-down" label={`Move ${it.name} down`} side={36} size={18} bg={C.cardHi} disabled={i === items.length - 1} onPress={() => move(i, 1)} />
              <IconBtn name="close" label={`Remove ${it.name}`} side={36} size={18} bg={C.cardHi} color={C.bad} onPress={() => setItems((l) => l.filter((x) => x.key !== it.key))} />
            </Row>
            <Row>{num('Sets', it, 'sets', true)}{num('Reps', it, 'reps', false)}{num('Rest (s)', it, 'rest', true)}</Row>
          </Card>
        ))}
        <Btn title="Add Exercise" icon="add" onPress={add} />
        {existing && <Btn title="Delete Routine" kind="danger" onPress={remove} />}
      </Page>
    </KeyboardAvoidingView>
  );
}
