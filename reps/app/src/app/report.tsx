import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { type Change, deload, liftStatus, monthReport } from '@/lib/coach';
import { cap, fmtMinutes, fmtVolume, thousands, trimNum } from '@/lib/format';
import { displayWeight, useStore } from '@/lib/store';
import { C, Caption, Card, Empty, Icon, IconBtn, Page, Row, TapCard, Txt } from '@/ui/kit';
import { Chart } from '@/ui/chart';

const LEVEL_COLOR = { Light: C.muted, Steady: C.text, 'Growth range': C.good, 'Very high': C.warm };

function Delta({ c }: { c: Change }) {
  if (c.pct === null || c.pct === 0) return <Txt size={12} color={C.muted}>{c.pct === 0 ? 'no change' : ' '}</Txt>;
  return <Txt size={12} color={c.pct > 0 ? C.good : C.bad}>{c.pct > 0 ? '▲' : '▼'} {Math.abs(c.pct)}%</Txt>;
}

/** Monthly report: totals against the month before, what moved, and how the work was spread across muscles. Worked out on the phone. */
export default function Report() {
  const router = useRouter();
  const { settings } = useStore();
  const [offset, setOffset] = useState(0);
  const r = monthReport(offset);
  const u = settings.unit;
  const tiles: [string, string, Change][] = [
    ['Workouts', String(r.workouts.now), r.workouts], ['Days trained', String(r.days.now), r.days],
    ['Time', fmtMinutes(r.minutes.now), r.minutes], ['Volume', fmtVolume(r.volume.now, u), r.volume],
    ['Working sets', String(r.sets.now), r.sets], ['Records', String(r.records.now), r.records],
  ];
  const top = Math.max(1, ...r.muscles.map((m) => Math.max(m.sets, m.before)));
  const all = r.split.push + r.split.pull + r.split.legs;
  const lifts = offset === 0 ? liftStatus().filter((l) => l.status !== 'up') : [];
  const rest = offset === 0 ? deload() : { suggest: false, reasons: [] };

  return (
    <Page>
      <Stack.Screen options={{ title: 'Monthly report' }} />
      <Row>
        <IconBtn name="chevron-back" label="Previous month" disabled={!r.older} color={r.older ? C.text : C.border} onPress={() => setOffset(offset + 1)} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Txt size={20} bold>{r.title}</Txt>
          <Txt size={13} color={C.muted}>{r.partial ? 'So far, ' : ''}{r.hasBefore ? r.compared : 'nothing earlier to compare with'}</Txt>
        </View>
        <IconBtn name="chevron-forward" label="Next month" disabled={offset === 0} color={offset ? C.text : C.border} onPress={() => setOffset(offset - 1)} />
      </Row>
      {r.workouts.now === 0 ? <Empty icon="calendar-outline" title="No workouts this month" body="Log a session and the report fills in." /> : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {tiles.map(([title, value, c]) => (
              <Card key={title} style={{ flexBasis: '47%', flexGrow: 1, gap: 2 }}>
                <Txt size={13} color={C.muted}>{title}</Txt><Txt size={20} bold>{value}</Txt>{r.hasBefore && <Delta c={c} />}
              </Card>
            ))}
          </View>

          {r.notes.length > 0 && (
            <Card>
              <Caption>What stands out</Caption>
              {r.notes.map((n) => <Row key={n} gap={10} style={{ alignItems: 'flex-start' }}><Txt color={C.accent}>•</Txt><Txt size={15} style={{ flex: 1 }}>{n}</Txt></Row>)}
            </Card>
          )}

          {rest.suggest && (
            <Card style={{ borderWidth: 1, borderColor: C.warm }}>
              <Caption>Time for a lighter week</Caption>
              {rest.reasons.map((x) => <Txt key={x} size={15}>{x}</Txt>)}
              <Txt size={14} color={C.muted}>Keep the same exercises, cut your sets by about a third and stop each set a few reps short. Then pick up where you left off.</Txt>
            </Card>
          )}

          <Card>
            <Caption>Muscle balance</Caption>
            <Txt size={13} color={C.muted}>Sets this month (a set counts half for muscles that assist). Thin line: the month before.</Txt>
            {r.muscles.filter((m) => m.sets || m.before).map((m) => (
              <View key={m.name} style={{ gap: 4 }}>
                <Row><Txt size={15} style={{ flex: 1 }}>{cap(m.name)}</Txt><Txt size={13} color={LEVEL_COLOR[m.level]}>{m.sets ? `${trimNum(m.perWeek, 1)}/wk · ${m.level}` : 'None'}</Txt><Txt size={15} color={C.muted} style={{ width: 34, textAlign: 'right' }}>{m.sets}</Txt></Row>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: C.cardHi }}><View style={{ height: 8, borderRadius: 4, backgroundColor: C.accent, width: `${(m.sets / top) * 100}%` }} /></View>
                {r.hasBefore && <View style={{ height: 3, borderRadius: 2, backgroundColor: C.muted, width: `${(m.before / top) * 100}%` }} />}
              </View>
            ))}
            <Txt size={12} color={C.muted}>Rough guide for building muscle: around 10 to 20 hard sets per muscle a week. Under 5 mostly maintains.</Txt>
          </Card>

          {all > 0 && (
            <Card>
              <Caption>Push / pull / legs</Caption>
              <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: C.cardHi }}>
                <View style={{ flex: r.split.push, backgroundColor: C.accent }} /><View style={{ flex: r.split.pull, backgroundColor: C.warm }} /><View style={{ flex: r.split.legs, backgroundColor: C.good }} />
              </View>
              <Row gap={18}>
                {([['Push', r.split.push, C.accent], ['Pull', r.split.pull, C.warm], ['Legs', r.split.legs, C.good]] as const).map(([name, n, color]) => (
                  <Row key={name} gap={6}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} /><Txt size={14}>{name} {Math.round((n / all) * 100)}%</Txt></Row>
                ))}
              </Row>
            </Card>
          )}

          {r.gains.length > 0 && (
            <Card>
              <Caption>Lifts that moved</Caption>
              {r.gains.map((g) => (
                <TapCard key={g.id} bare label={`Open ${g.name}`} onPress={() => router.push(`/exercise/${encodeURIComponent(g.id)}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Icon name="arrow-up" size={18} color={C.good} />
                  <View style={{ flex: 1 }}><Txt size={15} lines={1}>{g.name}</Txt><Txt size={13} color={C.muted}>Best set {g.best}</Txt></View>
                  <Txt size={15} color={C.good}>+{g.pct}%</Txt>
                </TapCard>
              ))}
              <Txt size={12} color={C.muted}>Change in estimated one-rep max against your best before this month.</Txt>
            </Card>
          )}

          {lifts.length > 0 && (
            <Card>
              <Caption>Lifts that need attention</Caption>
              {lifts.map((l) => (
                <TapCard key={l.id} bare label={`Open ${l.name}`} onPress={() => router.push(`/exercise/${encodeURIComponent(l.id)}`)} style={{ flexDirection: 'row', gap: 10 }}>
                  <Icon name={l.status === 'slipping' ? 'arrow-down' : 'remove'} size={18} color={l.status === 'slipping' ? C.bad : C.warm} />
                  <View style={{ flex: 1 }}><Txt size={15} lines={1}>{l.name}</Txt><Txt size={13} color={C.muted}>{cap(l.detail.slice(0, 1))}{l.detail.slice(1)}</Txt></View>
                </TapCard>
              ))}
            </Card>
          )}

          <Card>
            <Caption>Volume, last 6 months</Caption>
            <Chart values={r.trend.map((t) => displayWeight(t.volume_kg))} labels={r.trend.map((t) => t.label)} yFormat={(v) => (v >= 1000 ? `${trimNum(v / 1000, 1)}k` : thousands(v))} height={170} />
          </Card>
        </>
      )}
    </Page>
  );
}
