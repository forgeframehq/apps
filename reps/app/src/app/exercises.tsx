import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { cap } from '@/lib/format';
import { deliverPick } from '@/lib/pick';
import { allExercises, equipmentTypes, exercise, muscles, recentExerciseIds, useStore } from '@/lib/store';
import type { Exercise } from '@/lib/types';
import { Avatar, Btn, C, Divider, Empty, IconBtn, Row, SearchField, TapCard, Txt } from '@/ui/kit';
import { pick } from '@/ui/overlay';

type Item = { header: string } | { ex: Exercise; key: string };

/**
 * Search the exercise library, filter it, or create your own exercise.
 * Opened as /exercises?pick=1 it returns a choice to the caller; otherwise tapping a row opens the exercise.
 */
export default function Exercises() {
  const router = useRouter();
  useStore();
  const picking = useLocalSearchParams<{ pick?: string }>().pick === '1';
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const all = allExercises().filter((e) => (!muscle || e.muscle_group === muscle) && (!equipment || e.equipment === equipment) && (!q || e.name.toLowerCase().includes(q)));
    const rows: Item[] = all.map((ex) => ({ ex, key: ex.id }));
    if (q || muscle || equipment) return rows;
    const recent = recentExerciseIds(8).map(exercise).filter((e): e is Exercise => !!e);
    return [
      ...(recent.length ? [{ header: 'Recent Exercises' }, ...recent.map((ex) => ({ ex, key: `recent-${ex.id}` }))] : []),
      { header: 'All Exercises' },
      ...rows,
    ];
  }, [query, muscle, equipment]);

  const open = (id: string) => router.push(`/exercise/${encodeURIComponent(id)}`);
  const choose = (e: Exercise) => {
    if (!picking) return open(e.id);
    router.back();
    deliverPick(e);
  };
  const create = () => {
    // Keep the caller's handler: a newly created exercise is delivered straight to it.
    router.push(`/create-exercise?name=${encodeURIComponent(query.trim())}${picking ? '&pick=1' : ''}`);
  };
  const pickEquipment = async () => {
    const v = await pick('Equipment', ['', ...equipmentTypes()], equipment, (o) => (o ? cap(o) : 'All Equipment'));
    if (v !== null) setEquipment(v);
  };
  const pickMuscle = async () => {
    const v = await pick('Muscle Group', ['', ...muscles()], muscle, (o) => (o ? cap(o) : 'All Muscles'));
    if (v !== null) setMuscle(v);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen
        options={{
          title: picking ? 'Add Exercise' : 'Exercises',
          headerRight: () => <Btn title="Create" kind="text" onPress={create} />,
        }}
      />
      <View style={{ padding: 16, paddingBottom: 8, gap: 10 }}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Search exercise" accessibilityLabel="Search exercise" />
        <Row gap={12}>
          <Btn title={equipment ? cap(equipment) : 'All Equipment'} kind="card" height={44} color={equipment ? C.accent : undefined} style={{ flex: 1 }} onPress={pickEquipment} />
          <Btn title={muscle ? cap(muscle) : 'All Muscles'} kind="card" height={44} color={muscle ? C.accent : undefined} style={{ flex: 1 }} onPress={pickMuscle} />
        </Row>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => ('header' in it ? `h-${it.header}` : it.key)}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        ItemSeparatorComponent={() => <Divider color={C.card} />}
        ListEmptyComponent={<Empty icon="search" title="No matches" body="Try a different search, or create this exercise with Create at the top." />}
        renderItem={({ item }) =>
          'header' in item ? (
            <Txt size={17} bold style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>{item.header}</Txt>
          ) : (
            <Row gap={0}>
              <TapCard bare label={item.ex.name} onPress={() => choose(item.ex)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 16, paddingVertical: 9 }}>
                <Avatar id={item.ex.id} name={item.ex.name} size={52} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt lines={1}>{item.ex.name}</Txt>
                  <Row gap={8}>
                    <Txt size={14} color={C.muted}>{cap(item.ex.muscle_group)}</Txt>
                    {item.ex.custom && <View style={{ backgroundColor: C.cardHi, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}><Txt size={12}>Custom</Txt></View>}
                  </Row>
                </View>
              </TapCard>
              {picking && <IconBtn name="information-circle-outline" label={`Details for ${item.ex.name}`} color={C.muted} size={22} onPress={() => open(item.ex.id)} />}
              <View style={{ width: 8 }} />
            </Row>
          )
        }
      />
    </View>
  );
}
