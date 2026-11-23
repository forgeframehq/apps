import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { fmtDay, fmtMinutes, fmtRelative, fmtVolume, fromKg, initials, thousands, trimNum } from '@/lib/format';
import { setName, useStore, weekly, workoutMinutes, workoutVolumeKg } from '@/lib/store';
import { Chart } from '@/ui/chart';
import { Btn, C, Chip, IconBtn, Page, Row, Stat, TabHeader, TapCard, Txt, type IconName } from '@/ui/kit';
import { MiniBar } from '@/ui/minibar';
import { prompt } from '@/ui/overlay';

const METRICS = ['Duration', 'Volume', 'Reps'];
const TILES: [string, IconName, string][] = [['Statistics', 'stats-chart-outline', '/statistics'], ['Exercises', 'barbell-outline', '/exercises'], ['Measures', 'body-outline', '/measures'], ['Calendar', 'calendar-outline', '/calendar']];

/** Profile tab: weekly training chart, dashboard shortcuts and recent workouts. */
export default function Profile() {
  const router = useRouter();
  const { settings, workouts, routines } = useStore();
  const [metric, setMetric] = useState(0);
  const u = settings.unit;
  const weeks = weekly(12);
  const now = weeks[weeks.length - 1];
  const values = weeks.map((w) => (metric === 0 ? w.minutes / 60 : metric === 1 ? fromKg(w.volume_kg, u) : w.reps));
  const big = metric === 0 ? fmtMinutes(now.minutes) : metric === 1 ? fmtVolume(now.volume_kg, u) : `${thousands(now.reps)} reps`;
  const yFormat = metric === 0 ? (v: number) => `${trimNum(v, 1)} hrs` : (v: number) => (v >= 1000 ? `${trimNum(v / 1000, 1)}k` : String(Math.round(v)));

  const rename = async () => {
    const name = await prompt('Your name', settings.name, 'Name');
    if (name !== null) setName(name);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TabHeader title="Profile">
        <IconBtn name="pencil" label="Edit name" onPress={rename} />
        <IconBtn name="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
      </TabHeader>
      <Page>
        <Row gap={18}>
          <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: C.cardHi, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={26} bold color={C.muted}>{settings.name ? initials(settings.name) : 'R'}</Txt>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Txt size={20} bold lines={1}>{settings.name || 'Add your name'}</Txt>
            <Row gap={28}>
              <Stat title="Workouts" value={String(workouts.length)} />
              <Stat title="Routines" value={String(routines.length)} />
            </Row>
          </View>
        </Row>

        <Row gap={6}>
          <Txt size={20} bold>{big}</Txt>
          <Txt size={17} color={C.muted} style={{ flex: 1 }}>this week</Txt>
          <Txt size={15} color={C.accent}>Last 12 weeks</Txt>
        </Row>
        <Chart values={values} labels={weeks.map((w, i) => (i % 2 === 0 ? fmtDay(w.start) : ''))} yFormat={yFormat} />
        <Row>{METRICS.map((m, i) => <Chip key={m} title={m} selected={i === metric} onPress={() => setMetric(i)} />)}</Row>

        <Txt size={20} bold style={{ marginTop: 2 }}>Dashboard</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {TILES.map(([title, icon, path]) => (
            <Btn key={title} title={title} kind="card" icon={icon} left height={58} style={{ flexBasis: '47%', flexGrow: 1 }} onPress={() => router.push(path)} />
          ))}
        </View>

        {workouts.length > 0 && <Txt size={20} bold style={{ marginTop: 2 }}>Workouts</Txt>}
        {workouts.slice(0, 5).map((w) => (
          <TapCard key={w.id} label={`Open ${w.name}`} onPress={() => router.push(`/history/${w.id}`)} style={{ gap: 4 }}>
            <Txt size={17} bold lines={1}>{w.name}</Txt>
            <Txt size={14} color={C.muted}>{fmtRelative(w.started_at)} · {fmtMinutes(workoutMinutes(w))} · {fmtVolume(workoutVolumeKg(w), u)}</Txt>
          </TapCard>
        ))}
      </Page>
      <MiniBar />
    </View>
  );
}
