import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { discardWorkout, useStore } from '@/lib/store';

import { Btn, C, Txt } from './kit';
import { confirm } from './overlay';

/** "Workout in progress" bar shown above the tabs whenever you leave the workout screen mid-session. */
export function MiniBar() {
  const router = useRouter();
  const { active } = useStore();
  if (!active) return null;
  const discard = async () => {
    if (await confirm('Discard workout?', 'Everything logged in this session will be lost.', 'Discard', { danger: true })) discardWorkout();
  };
  return (
    <View style={{ backgroundColor: C.bar, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, paddingVertical: 6, borderBottomWidth: 1, borderColor: C.border }}>
      <Txt size={15} lines={1} style={{ flex: 1 }}>{active.name} in progress</Txt>
      <Btn title="Resume" kind="text" onPress={() => router.push('/session')} />
      <Btn title="Discard" kind="plain" color={C.bad} onPress={discard} />
    </View>
  );
}
