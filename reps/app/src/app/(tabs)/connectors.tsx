import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { isLinked, useStore } from '@/lib/store';
import { Btn, C, Caption, Card, Icon, Page, Row, TabHeader, Txt } from '@/ui/kit';
import { MiniBar } from '@/ui/minibar';

/** Connectors tab: optional links between Reps and other services. */
export default function Connectors() {
  const router = useRouter();
  const { link, syncing } = useStore();
  const linked = isLinked();
  let status = 'Not connected';
  let color: string = C.muted;
  if (linked) {
    const mins = Math.floor((Date.now() - link.last_sync) / 60000);
    if (syncing) status = 'Syncing...';
    else if (link.error) { status = `Last sync failed: ${link.error}`; color = C.bad; }
    else if (!link.last_sync) status = 'Connected, not synced yet';
    else { status = mins < 1 ? 'Connected · synced just now' : `Connected · synced ${mins < 120 ? `${mins} min` : `${Math.floor(mins / 60)} h`} ago`; color = C.good; }
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TabHeader title="Connectors" />
      <Page>
        <Txt size={15} color={C.muted}>Reps works fully on its own and keeps everything on this phone. Connectors are optional extras.</Txt>
        <Card>
          <Row gap={14}>
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkles" size={24} color={C.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt size={18} bold>Claude</Txt>
              <Txt size={14} color={color}>{status}</Txt>
            </View>
          </Row>
          <Txt size={15} color={C.muted}>Let Claude read your training history, write routines into the app and log workouts you describe.</Txt>
          <Btn title={linked ? 'Manage' : 'Connect'} kind={linked ? 'ghost' : 'primary'} onPress={() => router.push('/claude')} />
        </Card>
        <Card style={{ opacity: 0.6 }}>
          <Caption>Coming later</Caption>
          <Row gap={12}><Icon name="heart-outline" color={C.muted} /><Txt color={C.muted} style={{ flex: 1 }}>Health Connect: save workouts and read body weight</Txt></Row>
          <Row gap={12}><Icon name="pulse-outline" color={C.muted} /><Txt color={C.muted} style={{ flex: 1 }}>Heart-rate strap during workouts</Txt></Row>
        </Card>
      </Page>
      <MiniBar />
    </View>
  );
}
