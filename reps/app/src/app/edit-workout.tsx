import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { fmtWeight, toKg } from '@/lib/format';
import { updateWorkout, useStore, workout } from '@/lib/store';
import type { LoggedSet } from '@/lib/types';
import { Btn, C, Card, Empty, Field, IconBtn, Page, Row, Txt } from '@/ui/kit';
import { toast } from '@/ui/overlay';

interface Row_ { weight: string; reps: string; src: LoggedSet }

/** Fix a finished workout: change its name, any set's weight or reps, or remove a set. Records are recalculated on save. */
export default function EditWorkout() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings } = useStore();
  const u = settings.unit;
  const w = workout(id);
  const [name, setName] = useState(w?.name ?? '');
  const [items, setItems] = useState(() => (w?.exercises ?? []).map((e) => ({ e, rows: e.sets.map((s): Row_ => ({ weight: fmtWeight(s.weight_kg, u), reps: String(s.reps), src: s })) })));
  if (!w) return <View style={{ flex: 1, backgroundColor: C.bg }}><Empty icon="close" title="Workout not found" body="It may have been deleted." /></View>;

  const change = (k: number, i: number, patch: Partial<Row_>) => setItems((list) => list.map((it, a) => (a !== k ? it : { ...it, rows: it.rows.map((r, b) => (b === i ? { ...r, ...patch } : r)) })));
  const drop = (k: number, i: number) => setItems((list) => list.map((it, a) => (a !== k ? it : { ...it, rows: it.rows.filter((_, b) => b !== i) })));
  const save = () => {
    const n = (t: string) => parseFloat(t.replace(',', '.')) || 0;
    updateWorkout(w.id, {
      name: name.trim() || w.name, started_at: w.started_at, ended_at: w.ended_at,
      exercises: items.map(({ e, rows }) => ({ ...e, sets: rows.map((r) => ({ ...r.src, weight_kg: r.weight === fmtWeight(r.src.weight_kg, u) ? r.src.weight_kg : toKg(n(r.weight), u), reps: Math.round(n(r.reps)) })).filter((s) => s.reps > 0 || (s.seconds ?? 0) > 0) })),
    });
    toast('Workout updated');
    router.back();
  };

  return (
    <Page>
      <Stack.Screen options={{ headerRight: () => <Btn title="Save" kind="text" onPress={save} /> }} />
      <Field value={name} onChangeText={setName} accessibilityLabel="Workout name" />
      {items.map(({ e, rows }, k) => (
        <Card key={k}>
          <Txt size={16} bold color={C.accent} lines={1}>{e.exercise_name}</Txt>
          {rows.map((r, i) => (
            <Row key={i} gap={8}>
              <Txt size={14} color={C.muted} center style={{ width: 22 }}>{i + 1}</Txt>
              <Field value={r.weight} onChangeText={(t) => change(k, i, { weight: t })} keyboardType="decimal-pad" selectTextOnFocus accessibilityLabel={`${e.exercise_name} set ${i + 1} weight`} style={{ flex: 1, backgroundColor: C.cardHi, textAlign: 'center' }} />
              <Txt size={14} color={C.muted}>{u} x</Txt>
              <Field value={r.reps} onChangeText={(t) => change(k, i, { reps: t })} keyboardType="number-pad" selectTextOnFocus accessibilityLabel={`${e.exercise_name} set ${i + 1} reps`} style={{ flex: 1, backgroundColor: C.cardHi, textAlign: 'center' }} />
              <IconBtn name="trash-outline" label={`Delete ${e.exercise_name} set ${i + 1}`} color={C.muted} size={20} onPress={() => drop(k, i)} />
            </Row>
          ))}
          {!rows.length && <Txt size={13} color={C.muted}>No sets left. This exercise is removed when you save.</Txt>}
        </Card>
      ))}
      <Btn title="Save changes" onPress={save} />
    </Page>
  );
}
