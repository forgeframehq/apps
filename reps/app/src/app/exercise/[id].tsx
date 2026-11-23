import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { cap, fmtDate, fmtDay, fmtWeight, fromKg, thousands, trimNum } from '@/lib/format';
import { exercise, frames, records, sessions, useStore } from '@/lib/store';
import type { PrKind } from '@/lib/types';
import { Chart } from '@/ui/chart';
import { C, Chip, Divider, Empty, Icon, IconBtn, Row, TapCard, Txt } from '@/ui/kit';

const TABS = ['Summary', 'History', 'How to'];
const METRICS: [string, 'heaviest' | 'one' | 'best_set' | 'volume'][] = [['Heaviest Weight', 'heaviest'], ['One Rep Max', 'one'], ['Best Set Volume', 'best_set'], ['Session Volume', 'volume']];
const PR_NAME: Record<PrKind, string> = { weight: 'Weight', '1rm': '1RM', volume: 'Volume' };
const LETTER: Record<string, string> = { warmup: 'W', drop: 'D', failure: 'F' };

/** Start and end position photos, alternating like a slow animation. */
function Photos({ id }: { id: string }) {
  const list = frames(id);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing || list.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % list.length), 900);
    return () => clearInterval(t);
  }, [playing, list.length]);
  if (!list.length) return null;
  return (
    <View style={{ backgroundColor: '#fff', height: 240 }}>
      <Image source={list[i % list.length]} resizeMode="contain" style={{ width: '100%', height: 240 }} />
      {list.length > 1 && (
        <View style={{ position: 'absolute', right: 8, top: 8 }}>
          <IconBtn name={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} side={34} size={16} bg="rgba(0,0,0,0.45)" onPress={() => setPlaying((p) => !p)} />
        </View>
      )}
    </View>
  );
}

/** One exercise: progress chart and records, session history, and how to do it. */
export default function ExerciseDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings } = useStore();
  const u = settings.unit;
  const [tab, setTab] = useState(0);
  const [metric, setMetric] = useState(0);
  const ex = exercise(id);
  if (!ex) return <View style={{ flex: 1, backgroundColor: C.bg }}><Empty icon="close" title="Exercise not found" body="It may have been removed." /></View>;

  const about = (
    <View style={{ gap: 4 }}>
      <Txt size={20} bold>{ex.name}</Txt>
      <Txt size={14} color={C.muted}>Primary: {cap(ex.muscle_group)}</Txt>
      {ex.secondary.length > 0 && <Txt size={14} color={C.muted}>Secondary: {ex.secondary.map(cap).join(', ')}</Txt>}
      <Txt size={14} color={C.muted}>Equipment: {cap(ex.equipment)}</Txt>
    </View>
  );

  const summary = () => {
    const r = records(ex.id);
    if (!r.sessions) return <Empty icon="stats-chart-outline" title="No history yet" body="Log this exercise in a workout and your progress and records appear here." />;
    const series = r.series.slice(-12);
    const key = METRICS[metric][1];
    const last = series[series.length - 1];
    const rec = (name: string, value: string) => (
      <View key={name}>
        <Row style={{ minHeight: 44 }}><Txt style={{ flex: 1 }}>{name}</Txt><Txt color={C.accent}>{value}</Txt></Row>
        <Divider />
      </View>
    );
    return (
      <>
        <Row gap={8}><Txt size={18} bold>{fmtWeight(last[key], u)} {u}</Txt><Txt size={15} color={C.accent}>{fmtDay(last.t)}</Txt></Row>
        <Chart
          bars={false}
          values={series.map((p) => fromKg(p[key], u))}
          labels={series.map((p, i) => (series.length <= 6 || i % 2 === (series.length - 1) % 2 ? fmtDay(p.t) : ''))}
          yFormat={(v) => `${thousands(v)} ${u}`}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {METRICS.map(([title], i) => <Chip key={title} title={title} selected={i === metric} onPress={() => setMetric(i)} />)}
        </ScrollView>
        <Row gap={8} style={{ marginTop: 6 }}><Icon name="ribbon" size={20} color={C.warm} /><Txt size={18} bold>Personal Records</Txt></Row>
        <View>
          {rec('Heaviest Weight', `${fmtWeight(r.heaviest_kg, u)}${u}`)}
          {rec('Best 1RM', `${fmtWeight(r.best_1rm_kg, u)}${u}`)}
          {rec('Best Set Volume', `${fmtWeight(r.best_set_kg, u)}${u} x ${r.best_set_reps}`)}
          {rec('Best Session Volume', `${thousands(fromKg(r.best_session_volume_kg, u))}${u}`)}
        </View>
        {r.set_records.length > 0 && (
          <View style={{ marginTop: 6 }}>
            <Txt size={18} bold>Set Records</Txt>
            <Row style={{ minHeight: 40 }}><Txt size={15} bold center style={{ width: 70 }}>Reps</Txt><Txt size={15} bold>Personal Best</Txt></Row>
            {r.set_records.map((x) => (
              <View key={x.reps}>
                <Row style={{ minHeight: 40 }}><Txt center style={{ width: 70 }}>{x.reps}</Txt><Txt>{fmtWeight(x.kg, u)}{u}</Txt></Row>
                <Divider />
              </View>
            ))}
          </View>
        )}
      </>
    );
  };

  const history = () => {
    const list = sessions(ex.id);
    if (!list.length) return <View style={{ padding: 16 }}><Empty icon="calendar-outline" title="No history yet" body="Every session of this exercise will be listed here." /></View>;
    return list.map(({ workout: w, sets }) => {
      let number = 0;
      return (
        <View key={w.id} style={{ marginBottom: 14 }}>
          <TapCard bare label={`Open ${w.name}`} onPress={() => router.push(`/history/${w.id}`)} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt size={18} bold lines={1}>{w.name}</Txt>
              <Txt size={13} color={C.muted}>{fmtDate(w.started_at, true)}</Txt>
            </View>
            <Icon name="chevron-forward" size={18} color={C.muted} />
          </TapCard>
          <Row gap={0} style={{ paddingHorizontal: 16, paddingVertical: 4 }}><Txt size={12} color={C.muted} center style={{ width: 56 }}>SET</Txt><Txt size={12} color={C.muted}>WEIGHT & REPS</Txt></Row>
          {sets.map((s, i) => {
            if (s.set_type === 'normal') number++;
            return (
              <Row key={i} gap={0} style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: i % 2 ? C.card : 'transparent' }}>
                <Txt size={17} bold center color={s.set_type === 'warmup' ? C.warm : C.text} style={{ width: 56 }}>{LETTER[s.set_type] ?? number}</Txt>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt size={17}>{fmtWeight(s.weight_kg, u)} {u} x {s.reps}{s.rpe ? `   @ ${trimNum(s.rpe, 1)} RPE` : ''}</Txt>
                  {s.prs?.length > 0 && <Row gap={6}><Icon name="ribbon" size={15} color={C.warm} /><Txt size={13} color={C.muted}>{s.prs.map((p) => PR_NAME[p]).join(', ')}</Txt></Row>}
                </View>
              </Row>
            );
          })}
        </View>
      );
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ title: ex.name }} />
      <View style={{ flexDirection: 'row', backgroundColor: C.bar }}>
        {TABS.map((t, i) => (
          <Pressable key={t} accessibilityRole="tab" accessibilityLabel={t} accessibilityState={{ selected: i === tab }} onPress={() => setTab(i)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 46, borderBottomWidth: 3, borderColor: i === tab ? C.accent : 'transparent' }}>
            <Txt color={i === tab ? C.accent : C.muted}>{t}</Txt>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {tab !== 1 && <Photos id={ex.id} />}
        {tab === 0 && <View style={{ padding: 16, gap: 12 }}>{about}{summary()}</View>}
        {tab === 1 && history()}
        {tab === 2 && (
          <View style={{ padding: 16, gap: 12 }}>
            {about}
            {ex.instructions.length === 0 && <Txt size={15} color={C.muted}>{ex.custom ? 'Custom exercises have no instructions.' : 'No instructions for this exercise.'}</Txt>}
            {ex.instructions.map((step, i) => (
              <Row key={i} gap={12} style={{ alignItems: 'flex-start' }}><Txt style={{ width: 26 }}>{i + 1}.</Txt><Txt style={{ flex: 1 }}>{step}</Txt></Row>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
