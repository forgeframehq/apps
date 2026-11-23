import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Share, View } from 'react-native';

import { shareText } from '@/lib/coach';

import { fmtDate, fmtMinutes, fmtVolume, fmtWeight, trimNum } from '@/lib/format';
import { deleteWorkout, saveRoutine, useStore, workout, workoutMinutes, workoutRecords, workoutSetCount, workoutVolumeKg } from '@/lib/store';
import { Avatar, Btn, C, Empty, Icon, IconBtn, Page, Row, Stat, TapCard, Txt } from '@/ui/kit';
import { confirm, menu, toast } from '@/ui/overlay';

const LETTER: Record<string, string> = { warmup: 'W', drop: 'D', failure: 'F' };

/** One finished workout, set by set. */
export default function WorkoutDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings } = useStore();
  const u = settings.unit;
  const w = workout(id);
  if (!w) return <View style={{ flex: 1, backgroundColor: C.bg }}><Empty icon="close" title="Workout not found" body="It may have been deleted." /></View>;
  const records = workoutRecords(w);

  // Hands the workout to any app as text (Claude, ChatGPT, Messages). Falls back to the clipboard where sharing is unavailable.
  const share = async () => {
    const message = shareText(w);
    try { await Share.share({ message }); } catch { await Clipboard.setStringAsync(message); toast('Workout copied'); }
  };
  const options = async () => {
    const i = await menu(w.name, [{ label: 'Save as routine', icon: 'clipboard-outline' }, { label: 'Delete workout', icon: 'trash-outline', danger: true }]);
    if (i === 0) {
      saveRoutine({
        id: '', name: w.name, folder: '', notes: '',
        exercises: w.exercises.map((e) => {
          const working = e.sets.filter((s) => s.set_type !== 'warmup');
          return { exercise_id: e.exercise_id, exercise_name: e.exercise_name, target_sets: Math.max(1, working.length), target_reps: String((working[0] ?? e.sets[0]).reps), rest_seconds: 120, notes: '' };
        }),
      });
      toast('Saved to your routines');
    }
    if (i === 1 && (await confirm('Delete workout?', 'This cannot be undone.', 'Delete', { danger: true }))) {
      router.back();
      deleteWorkout(w.id);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerRight: () => <IconBtn name="ellipsis-horizontal" label="Workout options" onPress={options} /> }} />
      <Page gap={12}>
        <Txt size={24} bold>{w.name}</Txt>
        <Txt size={14} color={C.muted}>{fmtDate(w.started_at, true)}{w.source === 'claude' ? ' · Logged by Claude' : ''}</Txt>
        <Row gap={26}>
          <Stat title="Time" value={fmtMinutes(workoutMinutes(w))} />
          <Stat title="Volume" value={fmtVolume(workoutVolumeKg(w), u)} />
          <Stat title="Sets" value={String(workoutSetCount(w))} />
          {records > 0 && <Stat title="Records" value={String(records)} medal />}
        </Row>
        {!!w.notes && <Txt size={15} color={C.muted}>{w.notes}</Txt>}
        <Btn title="Share to an assistant" kind="ghost" icon="share-outline" onPress={share} />
        {w.exercises.map((e, k) => {
          let number = 0;
          return (
            <View key={k} style={{ gap: 6, marginTop: 4 }}>
              <TapCard bare label={`Details for ${e.exercise_name}`} onPress={() => router.push(`/exercise/${encodeURIComponent(e.exercise_id)}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar id={e.exercise_id} name={e.exercise_name} size={44} />
                <Txt size={17} color={C.accent} lines={1} style={{ flex: 1 }}>{e.exercise_name}</Txt>
              </TapCard>
              {e.sets.map((s, i) => {
                if (s.set_type === 'normal') number++;
                return (
                  <Row key={i} gap={0}>
                    <Txt bold center color={s.set_type === 'warmup' ? C.warm : C.muted} style={{ width: 44 }}>{LETTER[s.set_type] ?? number}</Txt>
                    <Txt style={{ flex: 1 }}>{fmtWeight(s.weight_kg, u)} {u} x {s.reps}{s.rpe ? `   @ ${trimNum(s.rpe, 1)} RPE` : ''}</Txt>
                    {s.prs?.length > 0 && <Icon name="ribbon" size={18} color={C.warm} />}
                  </Row>
                );
              })}
            </View>
          );
        })}
      </Page>
    </View>
  );
}
