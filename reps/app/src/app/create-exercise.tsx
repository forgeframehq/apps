import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { cap } from '@/lib/format';
import { deliverPick } from '@/lib/pick';
import { allExercises, createExercise } from '@/lib/store';
import { Btn, C, Divider, Field, Icon, Page, Row, TapCard, Txt } from '@/ui/kit';
import { alertBox, pick, pickMany } from '@/ui/overlay';

const MUSCLES = ['abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes', 'hamstrings', 'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps', 'cardio', 'other'];
const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'ez bar', 'medicine ball', 'exercise ball', 'foam roll', 'other'];

/** Add your own exercise to the library. */
export default function CreateExercise() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; pick?: string }>();
  const [name, setName] = useState(params.name ?? '');
  const [equipment, setEquipment] = useState('');
  const [muscle, setMuscle] = useState('');
  const [others, setOthers] = useState<string[]>([]);

  const save = () => {
    const n = name.trim();
    if (!n) return alertBox('Name your exercise', 'Give it a name so you can find it later.');
    const clash = allExercises().find((e) => e.name.toLowerCase() === n.toLowerCase());
    if (clash) return alertBox('Already in your library', `There is already an exercise called "${clash.name}".`);
    if (!muscle) return alertBox('Pick a muscle group', 'Choose the main muscle this exercise works, so it counts in your statistics.');
    const e = createExercise(n, muscle, equipment || 'other', others);
    if (params.pick) {
      router.dismiss(2); // close this screen and the picker, then hand the new exercise to whoever asked
      deliverPick(e);
    } else router.back();
  };

  const row = (caption: string, value: string, optional: boolean, onPress: () => void) => (
    <View>
      <TapCard bare label={caption} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt>{caption}</Txt>
          <Txt color={C.accent}>{value || (optional ? 'Select (optional)' : 'Select')}</Txt>
        </View>
        <Icon name="chevron-forward" size={20} color={C.muted} />
      </TapCard>
      <Divider />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerRight: () => <Btn title="Save" height={38} onPress={save} /> }} />
      <Page gap={6}>
        <Field value={name} onChangeText={setName} placeholder="Exercise Name" accessibilityLabel="Exercise name" style={{ fontSize: 20 }} />
        <Row style={{ height: 6 }}><View /></Row>
        {row('Equipment', cap(equipment), false, async () => { const v = await pick('Equipment', EQUIPMENT, equipment || null, cap); if (v) setEquipment(v); })}
        {row('Primary Muscle Group', cap(muscle), false, async () => {
          const v = await pick('Primary Muscle Group', MUSCLES, muscle || null, cap);
          if (v) { setMuscle(v); setOthers((o) => o.filter((m) => m !== v)); }
        })}
        {row('Other Muscles', others.map(cap).join(', '), true, async () => { const v = await pickMany('Other Muscles', MUSCLES.filter((m) => m !== muscle), others, cap); if (v) setOthers(v); })}
      </Page>
    </View>
  );
}
