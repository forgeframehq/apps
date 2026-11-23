import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { fmtDate, fmtMinutes, fmtVolume, MONTH_NAMES, plural } from '@/lib/format';
import { useStore, workoutMinutes, workoutVolumeKg } from '@/lib/store';
import { C, IconBtn, Page, Row, TapCard, Txt } from '@/ui/kit';

/** Month view: the days you trained, and that month's workouts. */
export default function Calendar() {
  const router = useRouter();
  const { workouts, settings } = useStore();
  const today = new Date();
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const shift = (by: number) => setYm(({ y, m }) => { const d = new Date(y, m + by, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  const mine = workouts.filter((w) => { const d = new Date(w.started_at); return d.getFullYear() === ym.y && d.getMonth() === ym.m; });
  const trained = new Set(mine.map((w) => new Date(w.started_at).getDate()));
  const lead = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7; // Monday-first
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <Page>
      <Row>
        <IconBtn name="chevron-back" label="Previous month" onPress={() => shift(-1)} />
        <Txt size={19} bold center style={{ flex: 1 }}>{MONTH_NAMES[ym.m]} {ym.y}</Txt>
        <IconBtn name="chevron-forward" label="Next month" onPress={() => shift(1)} />
      </Row>
      <View style={{ gap: 6 }}>
        <Row gap={4}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <Txt key={i} size={13} color={C.muted} center style={{ flex: 1 }}>{d}</Txt>)}</Row>
        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <Row key={r} gap={4}>
            {cells.slice(r * 7, r * 7 + 7).map((day, i) => {
              const on = day !== null && trained.has(day);
              const isToday = day !== null && today.getFullYear() === ym.y && today.getMonth() === ym.m && today.getDate() === day;
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.accent : 'transparent', borderWidth: isToday && !on ? 1 : 0, borderColor: C.muted }}>
                    {day !== null && <Txt size={15} bold={on} color={on || isToday ? C.text : C.muted}>{day}</Txt>}
                  </View>
                </View>
              );
            })}
          </Row>
        ))}
      </View>
      <Txt size={18} bold style={{ marginTop: 4 }}>{plural(mine.length, 'workout')} this month</Txt>
      {mine.map((w) => (
        <TapCard key={w.id} label={`Open ${w.name}`} onPress={() => router.push(`/history/${w.id}`)} style={{ gap: 4 }}>
          <Txt size={17} bold lines={1}>{w.name}</Txt>
          <Txt size={14} color={C.muted}>{fmtDate(w.started_at)} · {fmtMinutes(workoutMinutes(w))} · {fmtVolume(workoutVolumeKg(w), settings.unit)}</Txt>
        </TapCard>
      ))}
    </Page>
  );
}
