import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { View } from 'react-native';

import { fmtRelative, isoNow } from '@/lib/format';
import { isLinked, useStore } from '@/lib/store';
import { connectClaude, disconnectClaude, syncNow } from '@/lib/sync';
import { Btn, C, Caption, Card, Chip, Field, Icon, Page, Row, Txt } from '@/ui/kit';
import { alertBox, confirm, toast } from '@/ui/overlay';

// All three assistants can add an outside tool by its address, so one connection serves any of them.
const ASSISTANTS = [
  { name: 'Claude', steps: '1. Copy your connector address.\n2. Open claude.ai, go to Customize, then Connectors, and choose Add, then Add custom connector.\n3. Name it Reps, paste the address and add it.\n4. In any chat, turn Reps on and ask about your training.', note: "Works on Claude's free plan, which allows one custom connector." },
  { name: 'ChatGPT', steps: '1. Copy your connector address.\n2. In ChatGPT, open Settings, then Apps & Connectors, and add a custom connector (it may sit behind Developer mode).\n3. Paste the address, choose no authentication, and save.', note: 'Custom connectors need a paid ChatGPT plan, and some plans can read but not write.' },
  { name: 'Gemini', steps: '1. Copy your connector address.\n2. In Gemini, open Settings, then Connected Apps, and add a custom app.\n3. Paste the address and approve.', note: 'Google limits custom apps by region and account type, so the option may not appear for you.' },
];
const IDEAS = ['"Review my last workout."', '"What should I lift next session?"', '"Which muscles am I neglecting?"', '"Give me alternatives to bench press and update my routine."', '"Plan my next week and save it to Reps."'];

/** Optional: connect the app to your Reps server so an AI assistant can read and write your training data. */
export default function Assistant() {
  const { link, syncing } = useStore();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [which, setWhich] = useState(0);

  if (!isLinked()) {
    const connect = async () => {
      if (!url.trim() || !token.trim()) return alertBox('Missing details', 'Enter both the server address and your token.');
      setBusy(true);
      const res = await connectClaude(url, token);
      setBusy(false);
      if (isLinked()) {
        setToken('');
        return toast(res.ok ? 'Connected' : 'Connected, but the first sync failed');
      }
      alertBox("Couldn't connect", res.status === 401 ? 'That token was not accepted. Check it and try again.' : "The server didn't respond. Check the address and your connection.");
    };
    return (
      <Page>
        <Card style={{ gap: 8 }}>
          <Icon name="sparkles" size={28} color={C.accent} />
          <Txt size={19} bold>Connect Claude (optional)</Txt>
          <Txt size={15} color={C.muted}>Reps keeps everything on this phone and needs no account. Connect it to your Reps server and Claude becomes your Reps coach: it reads your workouts and check-ins, suggests targets and alternatives, and saves routines back into the app. The conversation happens in the Claude app, so it costs nothing extra here.</Txt>
        </Card>
        <View style={{ gap: 6 }}>
          <Caption>Server address</Caption>
          <Field value={url} onChangeText={setUrl} placeholder="reps.your-name.workers.dev" autoCapitalize="none" autoCorrect={false} keyboardType="url" accessibilityLabel="Server address" />
        </View>
        <View style={{ gap: 6 }}>
          <Caption>Token</Caption>
          <Field value={token} onChangeText={setToken} placeholder="fl_..." autoCapitalize="none" autoCorrect={false} secureTextEntry accessibilityLabel="Token" />
        </View>
        <Btn title="Connect" busy={busy} onPress={connect} />
        <Txt size={13} color={C.muted}>Connecting uploads the workouts and routines already on this phone, then keeps both sides in step.</Txt>
      </Page>
    );
  }

  const mins = Math.floor((Date.now() - link.last_sync) / 60000);
  const status = syncing ? 'Syncing...'
    : link.error ? `Last sync failed: ${link.error}`
    : !link.last_sync ? 'Not synced yet'
    : mins < 1 ? 'Synced just now' : mins < 120 ? `Synced ${mins} min ago` : `Synced ${fmtRelative(isoNow(link.last_sync))}`;
  const sync = async () => {
    const r = await syncNow();
    toast(r.ok ? 'Synced' : 'Sync failed');
  };
  const copy = async () => {
    await Clipboard.setStringAsync(`${link.base_url}/mcp/${link.token}`);
    toast('Connector address copied');
  };
  const disconnect = async () => {
    if (await confirm('Disconnect?', 'Syncing stops. Everything stays on this phone, and what is already on the server stays there.', 'Disconnect', { danger: true })) disconnectClaude();
  };
  const a = ASSISTANTS[which];

  return (
    <Page>
      <Card style={{ gap: 6 }}>
        <Caption>Connected</Caption>
        <Txt size={15}>{link.base_url}</Txt>
        <Txt size={14} color={link.error && !syncing ? C.bad : C.muted}>{status}</Txt>
        <Btn title="Sync now" kind="ghost" icon="sync" disabled={syncing} onPress={sync} />
      </Card>
      <Card>
        <Caption>Add Reps to Claude</Caption>
        <Row gap={8}>{ASSISTANTS.map((x, i) => <Chip key={x.name} title={x.name} selected={i === which} onPress={() => setWhich(i)} />)}</Row>
        <Txt size={15}>{a.steps}</Txt>
        {!!a.note && <Txt size={13} color={which ? C.warm : C.muted}>{a.note}</Txt>}
        <Btn title="Copy connector address" icon="copy-outline" onPress={copy} />
        <Txt size={13} color={C.muted}>The address contains your token, so treat it like a password. The same address also works in ChatGPT and Gemini (not yet tested).</Txt>
      </Card>
      <Card style={{ gap: 6 }}>
        <Caption>Things to ask</Caption>
        {IDEAS.map((t) => <Txt key={t} size={15}>{t}</Txt>)}
      </Card>
      <Btn title="Disconnect" kind="danger" onPress={disconnect} />
    </Page>
  );
}
