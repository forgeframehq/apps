import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { joinClass, leaderboard, leaveClass, syncPortfolio } from '@/lib/classroom';
import { money } from '@/lib/format';
import { serverUrl } from '@/lib/market';
import { useStore } from '@/lib/store';
import type { Standing } from '@/lib/types';
import { Btn, C, Card, Delta, Empty, Field, Icon, Row, TabHeader, Txt } from '@/ui/kit';
import { confirm, toast } from '@/ui/overlay';

const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4]}`;

/** Join a class with a code, then see how everyone's portfolio compares. Optional: the app works without it. */
export default function ClassTab() {
  const router = useRouter();
  const { cls } = useStore();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Standing[] | null>(null);

  const refresh = useCallback(async () => {
    if (!cls) return;
    setBusy(true);
    try {
      if (cls.role === 'student') await syncPortfolio();
      setRows((await leaderboard()).standings);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [cls]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const join = async () => {
    setBusy(true);
    setError('');
    try {
      await joinClass(code, name, pin);
      setPin('');
      toast('You are in. Your class portfolio starts now.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const leave = async () => {
    if (!(await confirm('Leave this class?', cls?.role === 'student' ? 'Your class portfolio stays on the class server. You can come back with the same name and PIN.' : 'You can open the teacher view again with the class code and teacher key.', 'Leave', { danger: true }))) return;
    leaveClass();
    setRows(null);
  };

  const me = rows?.findIndex((r) => r.me) ?? -1;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TabHeader title="Class" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: 28, gap: 14 }} keyboardShouldPersistTaps="handled"
        refreshControl={cls ? <RefreshControl refreshing={busy} onRefresh={refresh} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.card} /> : undefined}>
        {!cls && (
          <>
            <Card>
              <Row>
                <Icon name="trophy-outline" color={C.accent} />
                <Txt size={18} bold>Join your class</Txt>
              </Row>
              <Txt size={15} color={C.muted}>Everyone starts with the same pretend money. The leaderboard shows whose portfolio has grown the most.</Txt>
              {serverUrl() ? (
                <>
                  <Field accessibilityLabel="Class code" placeholder="Class code from your teacher" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={6} style={{ backgroundColor: C.cardHi }} />
                  <Field accessibilityLabel="Your name" placeholder="First name and last initial, like Sam T" value={name} onChangeText={setName} maxLength={20} autoCorrect={false} style={{ backgroundColor: C.cardHi }} />
                  <Field accessibilityLabel="PIN" placeholder="Choose a PIN (4 digits)" value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={8} style={{ backgroundColor: C.cardHi }} />
                  {!!error && <Txt size={14} color={C.bad}>{error}</Txt>}
                  <Btn title="Join class" busy={busy} disabled={!code.trim() || !name.trim() || pin.length < 4} onPress={join} />
                  <Txt size={12} color={C.muted}>Remember your PIN. You need your name and PIN to get back in on another device. No email or surname needed.</Txt>
                </>
              ) : (
                <>
                  <Txt size={15}>This app is not connected to a class server yet. Your teacher will give you the address, or you can keep using the practice portfolio.</Txt>
                  <Btn title="Set up the class server" kind="ghost" onPress={() => router.push('/market-data')} />
                </>
              )}
            </Card>
            <Btn title="I am a teacher" kind="text" onPress={() => router.push('/teacher')} />
          </>
        )}

        {cls && (
          <>
            <Card>
              <Txt size={13} color={C.muted}>{cls.role === 'teacher' ? 'You are the teacher' : `Signed in as ${cls.name}`}</Txt>
              <Txt size={22} bold>{cls.className}</Txt>
              {cls.role === 'student' && me >= 0 && rows && (
                <Row gap={8}>
                  <Icon name="podium-outline" color={C.accent} />
                  <Txt size={16}>You are <Txt size={16} bold color={C.accent}>{ordinal(me + 1)}</Txt> of {rows.length}</Txt>
                </Row>
              )}
              {cls.role === 'teacher' && <Btn title="Open the teacher view" onPress={() => router.push('/teacher')} />}
            </Card>

            <Txt size={18} bold>Leaderboard</Txt>
            {!!error && <Txt size={14} color={C.bad}>{error}</Txt>}
            {rows && rows.length === 0 && <Empty icon="people-outline" title="No students yet" body={`Share the class code ${cls.code} so students can join.`} />}
            {rows?.map((r, i) => (
              <Card key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: r.me ? C.accent : C.card }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: i < 3 ? C.accentDim : C.cardHi, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt size={15} bold color={i < 3 ? C.accent : C.text}>{i + 1}</Txt>
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Txt size={16} bold lines={1}>{r.name}{r.me ? ' (you)' : ''}</Txt>
                  <Txt size={13} color={C.muted}>{r.companies} {r.companies === 1 ? 'stock' : 'stocks'}</Txt>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <Txt size={16} bold>{money(r.value)}</Txt>
                  <Delta value={r.gainPct} size={13} />
                </View>
              </Card>
            ))}
            <Btn title="Leave this class" kind="plain" onPress={leave} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
