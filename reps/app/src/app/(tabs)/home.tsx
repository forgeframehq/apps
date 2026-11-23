import { useRouter } from 'expo-router';
import { FlatList, View } from 'react-native';

import { fmtMinutes, fmtRelative, fmtVolume, plural } from '@/lib/format';
import { useStore, workoutMinutes, workoutRecords, workoutVolumeKg } from '@/lib/store';
import type { Workout } from '@/lib/types';
import { Avatar, Btn, C, Divider, Empty, Row, Stat, TabHeader, TapCard, Txt } from '@/ui/kit';
import { MiniBar } from '@/ui/minibar';

/** Home tab: your finished workouts, newest first. */
export default function Home() {
  const router = useRouter();
  const { workouts, settings } = useStore();

  const card = ({ item: w }: { item: Workout }) => {
    const records = workoutRecords(w);
    return (
      <View>
        <TapCard bare label={`Open ${w.name}`} onPress={() => router.push(`/history/${w.id}`)} style={{ padding: 16, gap: 10 }}>
          <Row gap={8}>
            <Txt size={14} color={C.muted}>{fmtRelative(w.started_at)}</Txt>
            {w.source === 'claude' && <Txt size={13} color={C.accent}>Logged by Claude</Txt>}
          </Row>
          <Txt size={20} bold>{w.name}</Txt>
          <Row gap={28}>
            <Stat title="Time" value={fmtMinutes(workoutMinutes(w))} />
            <Stat title="Volume" value={fmtVolume(workoutVolumeKg(w), settings.unit)} />
            {records > 0 && <Stat title="Records" value={String(records)} medal />}
          </Row>
          <Divider />
          {w.exercises.slice(0, 3).map((e, i) => (
            <Row key={i} gap={14}>
              <Avatar id={e.exercise_id} name={e.exercise_name} size={44} />
              <Txt lines={1} style={{ flex: 1 }}>{plural(e.sets.length, 'set')} {e.exercise_name}</Txt>
            </Row>
          ))}
          {w.exercises.length > 3 && <Txt size={14} color={C.muted} center>See {plural(w.exercises.length - 3, 'more exercise')}</Txt>}
        </TapCard>
        <View style={{ height: 8, backgroundColor: C.bar }} />
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TabHeader title="Home" />
      <FlatList
        data={workouts}
        keyExtractor={(w) => w.id}
        renderItem={card}
        initialNumToRender={6}
        ListEmptyComponent={
          <View style={{ padding: 24, gap: 12 }}>
            <Empty icon="barbell-outline" title="No workouts yet" body="Finish a workout and it shows up here with your time, volume and any records you set." />
            <Btn title="Start a workout" onPress={() => router.push('/')} />
          </View>
        }
      />
      <MiniBar />
    </View>
  );
}
