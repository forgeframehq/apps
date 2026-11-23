import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtClock, fmtVolume, fmtWeight, newId, plural, trimNum } from '@/lib/format';
import { setPickHandler } from '@/lib/pick';
import { cancelRestAlert, scheduleRestAlert } from '@/lib/rest';
import { activeTotals, addExercise, discardWorkout, finishWorkout, touch, useStore, workoutRecords } from '@/lib/store';
import type { ActiveExercise, ActiveSet, SetType } from '@/lib/types';
import { Avatar, Btn, C, Empty, Icon, IconBtn, Row, TapCard, Txt } from '@/ui/kit';
import { alertBox, confirm, menu, pick, prompt, toast } from '@/ui/overlay';

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];
const RPE_OPTIONS = [0, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const TYPES: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
const LETTER: Partial<Record<SetType, string>> = { warmup: 'W', drop: 'D', failure: 'F' };
const TYPE_COLOR: Partial<Record<SetType, string>> = { warmup: C.warm, drop: '#5AA9FF', failure: C.bad };

interface Rest { end: number; total: number; name: string }

function useNow(ms: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Duration / volume / sets strip. Ticks on its own so the set list is not redrawn every second. */
function Totals({ startedAt, unit }: { startedAt: number; unit: 'kg' | 'lb' }) {
  const now = useNow(1000);
  const t = activeTotals();
  return (
    <View style={st.strip}>
      <View style={{ flex: 1 }}><Txt size={13} color={C.muted}>Duration</Txt><Txt size={18} color={C.accent}>{fmtClock((now - startedAt) / 1000)}</Txt></View>
      <View style={{ flex: 1 }}><Txt size={13} color={C.muted}>Volume</Txt><Txt size={18}>{fmtVolume(t.volumeKg, unit)}</Txt></View>
      <View style={{ flex: 1 }}><Txt size={13} color={C.muted}>Sets</Txt><Txt size={18}>{t.sets}</Txt></View>
    </View>
  );
}

function RestBar({ rest, onChange }: { rest: Rest; onChange: (r: Rest | null) => void }) {
  const insets = useSafeAreaInsets();
  const now = useNow(250);
  const left = Math.ceil((rest.end - now) / 1000);
  useEffect(() => {
    if (left <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onChange(null);
    }
  }, [left, onChange]);
  const shift = (by: number) => onChange({ ...rest, end: rest.end + by * 1000, total: Math.max(rest.total + (by > 0 ? by : 0), 1) });
  return (
    <View style={[st.rest, { paddingBottom: insets.bottom + 10 }]}>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: C.cardHi }}>
        <View style={{ height: 5, borderRadius: 3, backgroundColor: C.accent, width: `${Math.max(0, Math.min(100, (left / rest.total) * 100))}%` }} />
      </View>
      <Row gap={6}>
        <Btn title="-15s" kind="ghost" onPress={() => shift(-15)} />
        <Txt size={22} bold center style={{ flex: 1 }}>Rest {fmtClock(left)}</Txt>
        <Btn title="+15s" kind="ghost" onPress={() => shift(15)} />
        <Btn title="Skip" kind="text" onPress={() => onChange(null)} />
      </Row>
    </View>
  );
}

/** Live workout: tick sets as you go, see last session's numbers, rest timer between sets. */
export default function Session() {
  useKeepAwake();
  const router = useRouter();
  const { active, settings } = useStore();
  const u = settings.unit;
  const [rest, setRestState] = useState<Rest | null>(null);

  // The phone notification mirrors the on-screen timer, so it still fires with the screen off.
  const setRest = (r: Rest | null) => {
    setRestState(r);
    if (r) void scheduleRestAlert((r.end - Date.now()) / 1000, r.name);
    else void cancelRestAlert();
  };
  useEffect(() => () => void cancelRestAlert(), []);
  // Discarding (here or from the bar on a tab) closes this screen; finishing navigates by itself.
  const leaving = useRef(false);
  useEffect(() => {
    if (!active && !leaving.current) router.back();
  }, [active, router]);
  if (!active) return null;

  const toggleDone = (ex: ActiveExercise, i: number) => {
    const set = ex.sets[i];
    if (set.done) {
      set.done = false;
      return touch();
    }
    // Empty fields fall back to last session's numbers, then to the set above.
    const prev = ex.previous[i];
    const above = ex.sets[i - 1];
    const weight = set.weight || (prev ? fmtWeight(prev.weight_kg, u) : above?.weight) || '0';
    const reps = set.reps || (prev ? String(prev.reps) : above?.reps) || '';
    if (!(parseInt(reps, 10) > 0)) return void alertBox('Enter reps', 'Add the reps for this set before ticking it off.');
    Object.assign(set, { weight, reps, done: true });
    touch();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (ex.rest_seconds > 0 && set.type !== 'warmup') setRest({ end: Date.now() + ex.rest_seconds * 1000, total: ex.rest_seconds, name: ex.name });
  };

  const setMenu = async (ex: ActiveExercise, set: ActiveSet) => {
    const i = await menu('Set type', [
      { label: 'Normal set', icon: 'checkmark' }, { label: 'Warm-up set', icon: 'flame-outline' }, { label: 'Drop set', icon: 'trending-down' },
      { label: 'Failure set', icon: 'close' }, { label: 'Delete set', icon: 'trash-outline', danger: true },
    ]);
    if (i < 0) return;
    if (i === 4) ex.sets = ex.sets.filter((x) => x !== set);
    else set.type = TYPES[i];
    touch();
  };
  const pickRpe = async (set: ActiveSet) => {
    const v = await pick('RPE (how hard it felt)', RPE_OPTIONS, set.rpe ?? 0, (o) => (o === 0 ? 'No RPE' : trimNum(o, 1)));
    if (v === null) return;
    set.rpe = v === 0 ? null : v;
    touch();
  };
  const pickRest = async (ex: ActiveExercise) => {
    const v = await pick('Rest timer', REST_OPTIONS, ex.rest_seconds, (o) => (o === 0 ? 'Off' : fmtClock(o)));
    if (v === null) return;
    ex.rest_seconds = v;
    touch();
  };
  const editNote = async (ex: ActiveExercise) => {
    const text = await prompt(`Note for ${ex.name}`, ex.note, 'e.g. seat height 4');
    if (text === null) return;
    ex.note = text.trim();
    touch();
  };
  const addSet = (ex: ActiveExercise) => {
    const last = ex.sets[ex.sets.length - 1];
    ex.sets.push({ key: newId(), weight: last?.weight ?? '', reps: last?.reps ?? '', rpe: null, done: false, type: 'normal' });
    touch();
  };
  const exerciseMenu = async (ex: ActiveExercise) => {
    const i = await menu(ex.name, [{ label: 'Exercise details', icon: 'information-circle-outline' }, { label: 'Remove exercise', icon: 'trash-outline', danger: true }]);
    if (i === 0) router.push(`/exercise/${encodeURIComponent(ex.exercise_id)}`);
    if (i === 1) {
      active.exercises = active.exercises.filter((e) => e !== ex);
      touch();
    }
  };
  const addEx = () => {
    setPickHandler(addExercise);
    router.push('/exercises?pick=1');
  };
  const manualRest = async () => {
    const v = await pick('Start a rest timer', REST_OPTIONS.slice(1), null, (o) => fmtClock(o));
    if (v) setRest({ end: Date.now() + v * 1000, total: v, name: 'your next set' });
  };
  const finish = async () => {
    const all = active.exercises.flatMap((e) => e.sets);
    const open = all.filter((x) => !x.done).length;
    if (open === all.length) return alertBox('Nothing to save', 'Tick off at least one set, or discard the workout.');
    if (open && !(await confirm('Finish workout?', `${plural(open, 'unticked set')} will not be saved.`, 'Finish', { cancelText: 'Keep going' }))) return;
    leaving.current = true;
    const w = finishWorkout();
    if (!w) return;
    const records = workoutRecords(w);
    router.replace('/home');
    toast(records ? `Workout saved · ${plural(records, 'new record')}` : 'Workout saved');
  };
  const discard = async () => {
    if (await confirm('Discard workout?', 'Everything logged in this session will be lost.', 'Discard', { danger: true })) discardWorkout();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: 'Log Workout',
          headerRight: () => (
            <Row gap={4}>
              <IconBtn name="timer-outline" label="Start a rest timer" onPress={manualRest} />
              <Btn title="Finish" height={38} onPress={finish} />
            </Row>
          ),
        }}
      />
      <Totals startedAt={active.started_at} unit={u} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 150, gap: 10 }} keyboardShouldPersistTaps="handled">
        <TextInput
          value={active.name}
          onChangeText={(t) => { active.name = t; touch(); }}
          placeholder="Workout name"
          placeholderTextColor={C.muted}
          selectionColor={C.accent}
          accessibilityLabel="Workout name"
          style={{ color: C.text, fontSize: 20, paddingVertical: 6 }}
        />
        {active.exercises.length === 0 && <Empty icon="barbell-outline" title="Get started" body="Add an exercise to start your workout" />}

        {active.exercises.map((ex) => {
          let number = 0;
          return (
            <View key={ex.key} style={{ gap: 8, marginTop: 4 }}>
              <Row gap={4}>
                <TapCard bare label={`Details for ${ex.name}`} onPress={() => router.push(`/exercise/${encodeURIComponent(ex.exercise_id)}`)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar id={ex.exercise_id} name={ex.name} size={44} />
                  <Txt size={18} color={C.accent} lines={1} style={{ flex: 1 }}>{ex.name}</Txt>
                </TapCard>
                <IconBtn name="ellipsis-vertical" label={`Options for ${ex.name}`} side={40} size={20} onPress={() => exerciseMenu(ex)} />
              </Row>
              {!!(ex.target_reps || ex.cue) && <Txt size={14} color={C.muted}>{[ex.target_reps && `Target ${ex.target_reps} reps`, ex.cue].filter(Boolean).join(' · ')}</Txt>}
              <Row gap={8}>
                <Btn title={`Rest: ${ex.rest_seconds ? fmtClock(ex.rest_seconds) : 'OFF'}`} kind="card" icon="timer-outline" height={40} onPress={() => pickRest(ex)} />
                <Btn title={ex.note || 'Note'} kind="card" icon="document-text-outline" height={40} left style={ex.note ? { flex: 1 } : undefined} onPress={() => editNote(ex)} />
              </Row>

              <View style={st.row}>
                <Text style={[st.head, st.cSet]}>SET</Text>
                <Text style={[st.head, st.cPrev]}>PREVIOUS</Text>
                <Text style={[st.head, st.cNum]}>{u.toUpperCase()}S</Text>
                <Text style={[st.head, st.cNum]}>REPS</Text>
                <Text style={[st.head, st.cBtn]}>RPE</Text>
                <View style={[st.cBtn, { alignItems: 'center' }]}><Icon name="checkmark" size={16} color={C.muted} /></View>
              </View>

              {ex.sets.map((set, i) => {
                if (set.type === 'normal') number++;
                const prev = ex.previous[i];
                return (
                  <View key={set.key} style={[st.row, set.done && { backgroundColor: C.goodDim }]}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Set ${i + 1} type`} onPress={() => setMenu(ex, set)} style={[st.box, st.cSet]}>
                      <Text style={{ color: TYPE_COLOR[set.type] ?? C.text, fontWeight: '700', fontSize: 16 }}>{LETTER[set.type] ?? number}</Text>
                    </Pressable>
                    <Text numberOfLines={1} style={[st.cPrev, { color: C.muted, fontSize: 13, textAlign: 'center' }]}>
                      {prev ? `${fmtWeight(prev.weight_kg, u)}${u} x ${prev.reps}` : '-'}
                    </Text>
                    <TextInput
                      style={[st.input, st.cNum]} value={set.weight} onChangeText={(t) => { set.weight = t; touch(); }}
                      keyboardType="decimal-pad" selectTextOnFocus maxLength={7} accessibilityLabel={`Set ${i + 1} weight`}
                      placeholder={prev ? fmtWeight(prev.weight_kg, u) : '0'} placeholderTextColor={C.muted} selectionColor={C.accent}
                    />
                    <TextInput
                      style={[st.input, st.cNum]} value={set.reps} onChangeText={(t) => { set.reps = t; touch(); }}
                      keyboardType="number-pad" selectTextOnFocus maxLength={4} accessibilityLabel={`Set ${i + 1} reps`}
                      placeholder={prev ? String(prev.reps) : '0'} placeholderTextColor={C.muted} selectionColor={C.accent}
                    />
                    <Pressable accessibilityRole="button" accessibilityLabel={`Set ${i + 1} RPE`} onPress={() => pickRpe(set)} style={[st.box, st.cBtn]}>
                      {set.rpe ? <Text style={{ color: C.text, fontSize: 15 }}>{trimNum(set.rpe, 1)}</Text> : <Icon name="speedometer-outline" size={20} color={C.muted} />}
                    </Pressable>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: set.done }} accessibilityLabel={`Set ${i + 1} done`} onPress={() => toggleDone(ex, i)}
                      style={[st.box, st.cBtn, set.done && { backgroundColor: C.good }]}>
                      <Icon name="checkmark" size={22} color={set.done ? C.dark : C.muted} />
                    </Pressable>
                  </View>
                );
              })}
              <Btn title="Add Set" kind="card" icon="add" height={44} onPress={() => addSet(ex)} />
            </View>
          );
        })}

        <Btn title="Add Exercise" icon="add" onPress={addEx} style={{ marginTop: 6 }} />
        <Btn title="Discard Workout" kind="danger" onPress={discard} />
      </ScrollView>
      {rest && <RestBar rest={rest} onChange={setRest} />}
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  strip: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4, borderRadius: 10 },
  head: { color: C.muted, fontSize: 12, textAlign: 'center' },
  cSet: { width: 40 },
  cPrev: { flex: 1.6, minWidth: 0 },
  cNum: { flex: 1, minWidth: 0 },
  cBtn: { width: 42 },
  box: { height: 40, borderRadius: 9, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  input: { height: 40, borderRadius: 9, borderWidth: 1, borderColor: C.border, color: C.text, textAlign: 'center', fontSize: 17, paddingVertical: 0, paddingHorizontal: 2 },
  rest: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.bar, paddingHorizontal: 16, paddingTop: 12, gap: 8 },
});
