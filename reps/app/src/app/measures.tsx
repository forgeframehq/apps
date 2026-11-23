import { useState } from 'react';
import { View } from 'react-native';

import { cap, fmtDate, fmtWeight, fromKg, isoNow, toKg, trimNum } from '@/lib/format';
import { deleteMeasure, saveMeasure, useStore } from '@/lib/store';
import type { Measure } from '@/lib/types';
import { Chart } from '@/ui/chart';
import { Btn, C, Caption, Card, Chip, Divider, Empty, Field, Page, Row, TapCard, Txt } from '@/ui/kit';
import { confirm, toast } from '@/ui/overlay';

const PARTS = ['neck', 'shoulder', 'chest', 'left_bicep', 'right_bicep', 'left_forearm', 'right_forearm', 'abdomen', 'waist', 'hips', 'left_thigh', 'right_thigh', 'left_calf', 'right_calf'];
const label = (k: string) => cap(k.replace('_', ' '));
const CM_PER_IN = 2.54;

/** Body weight, body fat and tape measurements over time. */
export default function Measures() {
  const { measures, settings } = useStore();
  const u = settings.unit;
  const lu = settings.length_unit ?? 'cm';
  const len = (cm: number) => trimNum(lu === 'in' ? cm / CM_PER_IN : cm, 1);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [metric, setMetric] = useState('weight');

  const value = (m: Measure, key: string) => (key === 'weight' ? (m.weight_kg ? fromKg(m.weight_kg, u) : 0) : key === 'fat' ? m.fat_percent ?? 0 : m.parts?.[key] ? (lu === 'in' ? m.parts[key] / CM_PER_IN : m.parts[key]) : 0);
  const tracked = ['weight', 'fat', ...PARTS].filter((k) => measures.some((m) => value(m, k) > 0));
  const series = [...measures].reverse().filter((m) => value(m, metric) > 0).slice(-12);
  const unitOf = (k: string) => (k === 'weight' ? u : k === 'fat' ? '%' : lu);
  const name = (k: string) => (k === 'weight' ? 'Weight' : k === 'fat' ? 'Body fat' : label(k));

  const save = () => {
    const n = (k: string) => parseFloat((form[k] ?? '').replace(',', '.')) || 0;
    const parts: Record<string, number> = {};
    for (const p of PARTS) if (n(p) > 0) parts[p] = lu === 'in' ? n(p) * CM_PER_IN : n(p);
    if (!n('weight') && !n('fat') && !Object.keys(parts).length) return toast('Enter at least one number');
    saveMeasure({ date: isoNow(), weight_kg: n('weight') ? toKg(n('weight'), u) : undefined, fat_percent: n('fat') || undefined, parts });
    setForm({});
    setAdding(false);
    toast('Measurement saved');
  };
  const input = (k: string, title: string, unit: string) => (
    <Row key={k}>
      <Txt size={15} style={{ flex: 1 }}>{title}</Txt>
      <Field value={form[k] ?? ''} onChangeText={(t) => setForm((f) => ({ ...f, [k]: t }))} keyboardType="decimal-pad" placeholder={unit} accessibilityLabel={title} style={{ width: 110, textAlign: 'right', backgroundColor: C.cardHi }} />
    </Row>
  );
  const remove = async (m: Measure) => {
    if (await confirm('Delete this entry?', fmtDate(m.date), 'Delete', { danger: true })) deleteMeasure(m.id);
  };

  const first = series[0], last = series[series.length - 1];
  const diff = first && last && first !== last ? value(last, metric) - value(first, metric) : 0;

  return (
    <Page>
      {adding ? (
        <Card>
          <Caption>New measurement</Caption>
          {input('weight', 'Weight', u)}
          {input('fat', 'Body fat', '%')}
          <Divider />
          {PARTS.map((p) => input(p, label(p), lu))}
          <Row><Btn title="Cancel" kind="ghost" style={{ flex: 1 }} onPress={() => setAdding(false)} /><Btn title="Save measurement" style={{ flex: 1 }} onPress={save} /></Row>
        </Card>
      ) : <Btn title="Add measurement" icon="add" onPress={() => setAdding(true)} />}

      {!measures.length && !adding && <Empty icon="body-outline" title="Track your body, not just your lifts" body="Add your weight or a tape measurement and it charts here over time." />}

      {tracked.length > 0 && (
        <Card>
          <Row gap={8}><Txt size={18} bold>{last ? `${trimNum(value(last, metric), 1)} ${unitOf(metric)}` : ''}</Txt>{diff !== 0 && <Txt size={14} color={C.muted}>{diff > 0 ? '+' : ''}{trimNum(diff, 1)} since {fmtDate(first.date)}</Txt>}</Row>
          {series.length > 1 && <Chart bars={false} height={170} values={series.map((m) => value(m, metric))} labels={series.map((m, i) => (i === 0 || i === series.length - 1 ? fmtDate(m.date).replace(/,? \d{4}$/, '') : ''))} yFormat={(v) => trimNum(v, 0)} />}
          <Row gap={8} style={{ flexWrap: 'wrap' }}>{tracked.map((k) => <Chip key={k} title={name(k)} selected={k === metric} onPress={() => setMetric(k)} />)}</Row>
        </Card>
      )}

      {measures.length > 0 && <Txt size={18} bold>History</Txt>}
      {measures.map((m) => (
        <TapCard key={m.id} label={`Measurement from ${fmtDate(m.date)}`} onPress={() => remove(m)}>
          <Txt size={13} color={C.muted}>{fmtDate(m.date)}</Txt>
          <Txt size={16}>{[m.weight_kg && `${fmtWeight(m.weight_kg, u)} ${u}`, m.fat_percent && `${trimNum(m.fat_percent, 1)}% fat`, ...Object.entries(m.parts ?? {}).map(([k, v]) => `${label(k)} ${len(v)} ${lu}`)].filter(Boolean).join(' · ')}</Txt>
        </TapCard>
      ))}
      {measures.length > 0 && <Txt size={12} color={C.muted}>Tap an entry to delete it.</Txt>}
    </Page>
  );
}
