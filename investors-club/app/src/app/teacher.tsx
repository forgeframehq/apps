import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { createClass, leaveClass, removeStudent, resetPin, restartClass, teacherClass, teacherSignIn } from '@/lib/classroom';
import { fmtDate, fmtShares, money } from '@/lib/format';
import { serverUrl } from '@/lib/market';
import { stock, useStore } from '@/lib/store';
import type { StudentDetail } from '@/lib/types';
import { Btn, C, Card, Delta, Divider, Empty, Field, Icon, Page, Row, Stat, Txt } from '@/ui/kit';
import { alertBox, confirm, menu, pick, toast } from '@/ui/overlay';

const CASH = [1000, 10000, 100000];

/** Start a class, or watch one: every student's portfolio, ranked, with their holdings and recent trades. */
export default function Teacher() {
  const { cls } = useStore();
  const [className, setClassName] = useState('');
  const [teacher, setTeacher] = useState('');
  const [cash, setCash] = useState(10000);
  const [schoolKey, setSchoolKey] = useState('');
  const [code, setCode] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [students, setStudents] = useState<StudentDetail[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const isTeacher = cls?.role === 'teacher';

  const refresh = useCallback(async () => {
    if (!isTeacher) return;
    try {
      setStudents((await teacherClass()).students);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [isTeacher]);
  useEffect(() => { refresh(); }, [refresh]);

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const create = () => run(async () => {
    const made = await createClass(className, teacher, cash, schoolKey);
    await alertBox('Your class is ready', `Class code: ${made.code}\nTeacher key: ${made.teacher_key}\n\nStudents join with the class code. Write down the teacher key: you need both to open this view on another device.`);
  });
  const signIn = () => run(() => teacherSignIn(code, key));
  const chooseCash = async () => {
    const v = await pick('Starting cash for each student', CASH, cash, (n) => money(n, false));
    if (v) setCash(v);
  };
  const copyCode = async () => {
    await Clipboard.setStringAsync(cls!.code);
    toast('Class code copied');
  };
  const actions = async (s: StudentDetail) => {
    const i = await menu(s.name, [{ label: 'Reset PIN', icon: 'key-outline' }, { label: 'Remove from class', icon: 'person-remove-outline', danger: true }]);
    if (i === 0 && (await confirm(`Reset ${s.name}'s PIN?`, 'They will choose a new PIN the next time they join with this name.', 'Reset PIN'))) await run(() => resetPin(s.id));
    if (i === 1 && (await confirm(`Remove ${s.name}?`, 'They disappear from the leaderboard and cannot rejoin with this name.', 'Remove', { danger: true }))) await run(() => removeStudent(s.id));
    refresh();
  };
  const restart = async () => {
    if (!(await confirm('Start a new round?', 'Every student goes back to the starting cash with no stocks and no trades. This cannot be undone.', 'Start a new round', { danger: true }))) return;
    await run(restartClass);
    refresh();
  };

  if (cls?.role === 'student') {
    return <Page><Empty icon="school-outline" title="You joined as a student" body="To start or open a class as a teacher, first leave the class on the Class tab." /></Page>;
  }

  if (!isTeacher) {
    return (
      <Page>
        {!serverUrl() && <Card><Txt size={15}>Classes need a class server. Add its address under Settings, then Market data.</Txt></Card>}
        <Card>
          <Txt size={18} bold>Start a class</Txt>
          <Field accessibilityLabel="Class name" placeholder="Class name, like P6 Blue" value={className} onChangeText={setClassName} maxLength={40} style={{ backgroundColor: C.cardHi }} />
          <Field accessibilityLabel="Teacher name" placeholder="Your name, like Ms Smith" value={teacher} onChangeText={setTeacher} maxLength={30} style={{ backgroundColor: C.cardHi }} />
          <Btn title={`Starting cash: ${money(cash, false)}`} kind="ghost" left icon="cash-outline" onPress={chooseCash} />
          <Field accessibilityLabel="School key" placeholder="School key (only if you were given one)" value={schoolKey} onChangeText={setSchoolKey} autoCapitalize="none" autoCorrect={false} style={{ backgroundColor: C.cardHi }} />
          <Btn title="Create class" busy={busy} disabled={className.trim().length < 2 || teacher.trim().length < 2} onPress={create} />
        </Card>
        <Card>
          <Txt size={18} bold>Open a class you already made</Txt>
          <Field accessibilityLabel="Existing class code" placeholder="Class code" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={6} style={{ backgroundColor: C.cardHi }} />
          <Field accessibilityLabel="Teacher key" placeholder="Teacher key" value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} secureTextEntry style={{ backgroundColor: C.cardHi }} />
          <Btn title="Open teacher view" kind="ghost" busy={busy} disabled={!code.trim() || !key.trim()} onPress={signIn} />
        </Card>
        {!!error && <Txt size={14} color={C.bad}>{error}</Txt>}
      </Page>
    );
  }

  const teacherKey = cls.token.split('.')[1] ?? '';
  return (
    <Page>
      <Card>
        <Txt size={13} color={C.muted}>{cls.className} · class code</Txt>
        <Row>
          <Txt size={34} bold style={{ flex: 1, letterSpacing: 4 }}>{cls.code}</Txt>
          <Btn title="Copy" kind="ghost" icon="copy-outline" height={42} onPress={copyCode} />
        </Row>
        <Txt size={14} color={C.muted}>Students open the Class tab and enter this code, a first name with last initial, and a PIN they choose.</Txt>
        <Btn title="Show my teacher key" kind="text" left onPress={() => alertBox('Teacher key', `${teacherKey}\n\nWith the class code, this opens the teacher view on another device. Keep it private.`)} />
      </Card>

      <Row>
        <Txt size={18} bold style={{ flex: 1 }}>Students{students ? ` (${students.length})` : ''}</Txt>
        <Btn title="Refresh" kind="text" icon="refresh" onPress={refresh} />
      </Row>
      {!!error && <Txt size={14} color={C.bad}>{error}</Txt>}
      {students?.length === 0 && <Empty icon="people-outline" title="Nobody has joined yet" body="Share the class code. Students appear here as they join." />}
      {students?.map((s, i) => (
        <Card key={s.id} style={{ padding: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Student ${s.name}`} onPress={() => setOpen(open === s.id ? null : s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.cardHi, alignItems: 'center', justifyContent: 'center' }}>
              <Txt size={15} bold>{i + 1}</Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={16} bold lines={1}>{s.name}</Txt>
              <Txt size={13} color={C.muted}>{s.companies} {s.companies === 1 ? 'stock' : 'stocks'} · {s.trades} {s.trades === 1 ? 'trade' : 'trades'}</Txt>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Txt size={16} bold>{money(s.value)}</Txt>
              <Delta value={s.gainPct} size={13} />
            </View>
            <Icon name={open === s.id ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
          </Pressable>
          {open === s.id && (
            <>
              <Divider />
              <Row gap={24}>
                <Stat title="Cash" value={money(s.cash)} />
                <Stat title="In stocks" value={money(s.value - s.cash)} />
              </Row>
              {s.holdings.length > 0 && <Txt size={13} color={C.muted}>Holds: {s.holdings.map((h) => `${stock(h.symbol).name} (${fmtShares(h.shares)})`).join(', ')}</Txt>}
              {s.recent.map((t) => (
                <Txt key={t.id} size={13} color={C.muted}>{fmtDate(t.at)} · {t.side === 'buy' ? 'bought' : 'sold'} {fmtShares(t.shares)} of {t.symbol} at {money(t.price)}</Txt>
              ))}
              {s.recent.length === 0 && <Txt size={13} color={C.muted}>No trades yet.</Txt>}
              <Btn title={`Manage ${s.name}`} kind="ghost" height={42} onPress={() => actions(s)} />
            </>
          )}
        </Card>
      ))}

      <Divider />
      <Btn title="Start a new round" kind="ghost" icon="reload" busy={busy} onPress={restart} />
      <Btn title="Close the teacher view on this device" kind="plain" onPress={async () => { if (await confirm('Close the teacher view?', 'The class keeps running. Open it again with the class code and teacher key.', 'Close')) leaveClass(); }} />
    </Page>
  );
}
