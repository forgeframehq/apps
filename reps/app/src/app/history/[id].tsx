import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Share, View } from 'react-native';

import { shareText } from '@/lib/coach';

import { cap, fmtDate, fmtMinutes, fmtVolume, fmtWeight, trimNum } from '@/lib/format';
import { deleteWorkout, exercise, saveRoutine, useStore, workout, workoutMinutes, workoutRecords, workoutSetCount, workoutVolumeKg } from '@/lib/store';
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
    const pickd = await menu(w.name, [{ label: 'Edit workout', icon: 'create-outline' }, { label: 'Save as routine', icon: 'clipboard-outline' }, { label: 'Delete workout', icon: 'trash-outline', danger: true }]);
    if (pickd === 0) return router.push(`/edit-workout?id=${w.id}`);
    const i = pickd - 1;
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

  // Share of working sets per muscle; a set counts half for each muscle that assists.
  const split = new Map<string, number>();
  for (const e of w.exercises) {
    const ex = exercise(e.exercise_id);
    const n = e.sets.filter((x) => x.set_type !== 'warmup').length;
    split.set(ex?.muscle_group ?? e.muscle_group, (split.get(ex?.muscle_group ?? e.muscle_group) ?? 0) + n);
    for (const m of ex?.secondary ?? []) split.set(m, (split.get(m) ?? 0) + n / 2);
  }
  const total = [...split.values()].reduce((a, v) => a + v, 0) || 1;
  const muscles = [...split.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);

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
        {muscles.length > 0 && (
          <View style={{ gap: 8, marginTop: 4 }}>
            <Txt size={18} bold>Muscle split</Txt>
            {muscles.map(([name, v]) => (
              <Row key={name} gap={10}>
                <Txt size={14} style={{ width: 104 }} lines={1}>{cap(name)}</Txt>
                <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: C.card }}><View style={{ height: 10, borderRadius: 5, backgroundColor: C.accent, width: `${(v / muscles[0][1]) * 100}%` }} /></View>
                <Txt size={14} color={C.muted} style={{ width: 40, textAlign: 'right' }}>{Math.round((v / total) * 100)}%</Txt>
              </Row>
            ))}
          </View>
        )}
        <Row style={{ marginTop: 4 }}><Txt size={18} bold style={{ flex: 1 }}>Workout</Txt><Btn title="Edit workout" kind="text" onPress={() => router.push(`/edit-workout?id=${w.id}`)} /></Row>
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
                    <Txt style={{ flex: 1 }}>{s.seconds ? `${s.seconds}s${s.weight_kg ? ` · ${fmtWeight(s.weight_kg, u)} ${u}` : ''}` : `${fmtWeight(s.weight_kg, u)} ${u} x ${s.reps}`}{s.rpe ? `   @ ${trimNum(s.rpe, 1)} RPE` : ''}</Txt>
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
