import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { deload, ENERGY, FEEL, monthReport, review, suggest, upNext, watchList, week } from '@/lib/coach';
import { fmtRelative, fmtVolume, plural } from '@/lib/format';
import { isLinked, saveCheckin, startWorkout, useStore, workoutRecords } from '@/lib/store';
import type { Workout } from '@/lib/types';
import { Btn, C, Caption, Card, Chip, Empty, Icon, Page, Row, TabHeader, TapCard, Txt } from '@/ui/kit';
import { MiniBar } from '@/ui/minibar';
import { confirm, prompt, toast } from '@/ui/overlay';

/** "How was it?" for the latest workout. Saved with the workout, and shared with a connected assistant. */
function CheckIn({ workout }: { workout: Workout }) {
  const [feel, setFeel] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [note, setNote] = useState('');
  const addNote = async () => {
    const text = await prompt('Anything to remember?', note, 'e.g. left shoulder felt tight on presses', { multiline: true });
    if (text !== null) setNote(text.trim());
  };
  return (
    <Card style={{ borderWidth: 1, borderColor: C.accent }}>
      <Caption>Check in</Caption>
      <Txt size={19} bold>How was {workout.name}?</Txt>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {FEEL.map((f, i) => <Chip key={f} title={f} selected={feel === i + 1} onPress={() => setFeel(i + 1)} />)}
      </Row>
      <Txt size={15} color={C.muted}>Energy</Txt>
      <Row gap={8}>
        {ENERGY.map((e, i) => <Chip key={e} title={e} selected={energy === i + 1} onPress={() => setEnergy(i + 1)} />)}
      </Row>
      <Btn title={note || 'Add a note'} kind="ghost" icon="create-outline" left onPress={addNote} />
      <Btn title="Save check-in" disabled={!feel} onPress={() => { saveCheckin(workout.id, { feel, energy: energy || 2, note }); toast('Check-in saved'); }} />
    </Card>
  );
}

/** Coach tab: check in after a session, see what changed, and get targets for the next one. */
export default function Coach() {
  const router = useRouter();
  const { workouts, active, settings } = useStore();
  const last = workouts[0];
  const next = upNext();
  const linked = isLinked();

  const begin = async () => {
    if (!next) return;
    if (active && !(await confirm('Workout in progress', 'Starting a new one discards the workout you have open.', 'Discard and start', { danger: true, cancelText: 'Keep current' }))) return;
    startWorkout(next);
    router.push('/session');
  };

  const lastCard = () => {
    const r = review(last);
    const records = workoutRecords(last);
    const bits = [
      r.volumeChange !== null && `volume ${r.volumeChange >= 0 ? 'up' : 'down'} ${Math.abs(r.volumeChange)}%`,
      records > 0 && plural(records, 'record'),
      last.checkin && `felt ${FEEL[last.checkin.feel - 1].toLowerCase()}`,
    ].filter(Boolean);
    return (
      <Card>
        <Caption>Last workout</Caption>
        <Txt size={19} bold>{last.name}</Txt>
        <Txt size={14} color={C.muted}>{fmtRelative(last.started_at)}{bits.length ? ` · ${bits.join(' · ')}` : ''}</Txt>
        {!r.prev && <Txt size={14} color={C.muted}>Nothing to compare with yet. Next time you run this, the changes show here.</Txt>}
        {r.rows.map((row, i) => (
          <Row key={i} gap={10}>
            <Icon name={row.dir > 0 ? 'arrow-up' : row.dir < 0 ? 'arrow-down' : 'remove'} size={18} color={row.dir > 0 ? C.good : row.dir < 0 ? C.bad : C.muted} />
            <View style={{ flex: 1 }}>
              <Txt size={15} lines={1}>{row.name}</Txt>
              <Txt size={13} color={C.muted}>{row.before && row.dir !== 0 ? `${row.before} → ${row.now}` : row.now}</Txt>
            </View>
          </Row>
        ))}
        <Btn title="Open workout" kind="ghost" onPress={() => router.push(`/history/${last.id}`)} />
      </Card>
    );
  };

  const nextCard = () => next && (
    <Card>
      <Caption>Up next</Caption>
      <Txt size={19} bold>{next.name}</Txt>
      {next.exercises.map((e, i) => {
        const s = suggest(e.exercise_id, e.target_reps);
        return (
          <View key={i} style={{ gap: 2 }}>
            <Txt size={15} lines={1}>{e.exercise_name}</Txt>
            {s ? (
              <>
                <Txt size={15} color={C.accent}>{s.next}</Txt>
                <Txt size={13} color={C.muted}>Last: {s.last}. {s.why}</Txt>
              </>
            ) : <Txt size={13} color={C.muted}>{e.target_sets} x {e.target_reps}. No history yet, so start light and find your weight.</Txt>}
          </View>
        );
      })}
      <Btn title={`Start ${next.name}`} onPress={begin} />
    </Card>
  );

  const wk = week();
  const watch = workouts.length ? watchList() : [];
  const month = monthReport();
  const rest = workouts.length ? deload() : { suggest: false, reasons: [] };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TabHeader title="Coach" />
      <Page>
        {!last && <Empty icon="fitness-outline" title="Your coach starts after your first workout" body="Log a session and this tab reviews it, suggests weights for next time and keeps an eye on your week." />}
        {last && !last.checkin && <CheckIn workout={last} />}
        {rest.suggest && (
          <Card style={{ borderWidth: 1, borderColor: C.warm }}>
            <Caption>Time for a lighter week</Caption>
            {rest.reasons.map((x) => <Txt key={x} size={15}>{x}</Txt>)}
            <Txt size={14} color={C.muted}>Keep the same exercises, cut your sets by about a third and stop each set a few reps short.</Txt>
          </Card>
        )}
        {last && lastCard()}
        {nextCard()}
        {last && (
          <Card>
            <Caption>This week</Caption>
            <Row gap={28}>
              <View><Txt size={13} color={C.muted}>Sessions</Txt><Txt size={20} bold>{wk.sessions}</Txt></View>
              <View><Txt size={13} color={C.muted}>Your usual</Txt><Txt size={20} bold>{wk.usual}</Txt></View>
              <View><Txt size={13} color={C.muted}>Week streak</Txt><Txt size={20} bold>{wk.streak}</Txt></View>
            </Row>
            {watch.length > 0 && <Txt size={15} bold style={{ marginTop: 4 }}>Worth a look</Txt>}
            {watch.map((line) => <Row key={line} gap={10} style={{ alignItems: 'flex-start' }}><Icon name="alert-circle-outline" size={18} color={C.warm} /><Txt size={15} style={{ flex: 1 }}>{line}</Txt></Row>)}
          </Card>
        )}
        {last && (
          <TapCard label="Open monthly report" onPress={() => router.push('/report')}>
            <Row><View style={{ flex: 1 }}><Caption>{month.title}</Caption></View><Icon name="chevron-forward" size={18} color={C.muted} /></Row>
            <Txt size={17} bold>{plural(month.workouts.now, 'workout')} · {fmtVolume(month.volume.now, settings.unit)} · {plural(month.records.now, 'record')}</Txt>
            {month.notes.slice(0, 2).map((n) => <Txt key={n} size={14} color={C.muted}>{n}</Txt>)}
            <Txt size={14} color={C.accent}>See the full report and muscle balance</Txt>
          </TapCard>
        )}
        <Card>
          <Caption>Claude (optional)</Caption>
          <Txt size={15} color={C.muted}>
            {linked
              ? 'Connected. Open Claude and ask about your training: it reads your workouts and check-ins from Reps and can save routines back here.'
              : 'Everything above works on this phone with no account. Connect Claude if you also want to talk your training through: it reads your workouts from Reps, suggests changes and saves routines back here.'}
          </Txt>
          <Btn title={linked ? 'Manage connection' : 'Connect Claude'} kind="ghost" icon="sparkles-outline" onPress={() => router.push('/assistant')} />
        </Card>
      </Page>
      <MiniBar />
    </View>
  );
}
