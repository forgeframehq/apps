import { useState } from 'react';
import { View } from 'react-native';

import { cap, fmtMinutes, fmtVolume, trimNum } from '@/lib/format';
import { stats, useStore } from '@/lib/store';
import { C, Card, Chip, Divider, Empty, Page, Row, Txt } from '@/ui/kit';

const PERIODS: [string, number][] = [['30 days', 30], ['3 months', 90], ['Year', 365], ['All time', 36500]];

/** Totals and muscle-group balance over a chosen period. */
export default function Statistics() {
  const { workouts, settings } = useStore();
  const [period, setPeriod] = useState(0);
  const days = PERIODS[period][1];
  const s = stats(days);
  // Days since the first logged workout, so "per week" is fair for new users.
  const span = workouts.length ? Math.max(7, (Date.now() - Date.parse(workouts[workouts.length - 1].started_at)) / 86400000) : 7;
  const tiles: [string, string][] = [
    ['Workouts', String(s.workouts)], ['Time', fmtMinutes(s.minutes)], ['Volume', fmtVolume(s.volume_kg, settings.unit)],
    ['Working sets', String(s.sets)], ['Records', String(s.records)], ['Per week', trimNum(s.workouts / (Math.min(days, span) / 7), 1)],
  ];
  const top = s.muscles[0]?.sets ?? 1;
  return (
    <Page>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>{PERIODS.map(([t], i) => <Chip key={t} title={t} selected={i === period} onPress={() => setPeriod(i)} />)}</Row>
      {s.workouts === 0 ? <Empty icon="stats-chart-outline" title="Nothing logged in this period" body="Finish a workout and your totals show up here." /> : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {tiles.map(([title, value]) => (
              <Card key={title} style={{ flexBasis: '47%', flexGrow: 1, gap: 2 }}><Txt size={13} color={C.muted}>{title}</Txt><Txt size={20} bold>{value}</Txt></Card>
            ))}
          </View>
          <Txt size={18} bold style={{ marginTop: 2 }}>Sets per muscle group</Txt>
          {s.muscles.map((m) => (
            <View key={m.name} style={{ gap: 4 }}>
              <Row><Txt size={15} style={{ flex: 1 }}>{cap(m.name)}</Txt><Txt size={15} color={C.muted}>{m.sets}</Txt></Row>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: C.card }}><View style={{ height: 8, borderRadius: 4, backgroundColor: C.accent, width: `${(m.sets / top) * 100}%` }} /></View>
            </View>
          ))}
          <Txt size={18} bold style={{ marginTop: 2 }}>Most trained exercises</Txt>
          <View>
            {s.exercises.slice(0, 8).map((e) => (
              <View key={e.name}><Row style={{ minHeight: 42 }}><Txt size={15} lines={1} style={{ flex: 1 }}>{e.name}</Txt><Txt size={15} color={C.muted}>{e.sets} sets</Txt></Row><Divider /></View>
            ))}
          </View>
        </>
      )}
    </Page>
  );
}
