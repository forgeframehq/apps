import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { isLinked, useStore } from '@/lib/store';
import { Btn, C, Divider, Icon, Page, Row, Txt, type IconName } from '@/ui/kit';

/** Everything Reps can connect to. All optional: the app is complete on its own. */
export default function Integrations() {
  const router = useRouter();
  useStore();
  const linked = isLinked();
  const item = (icon: IconName, name: string, body: string, action: React.ReactNode) => (
    <View key={name} style={{ gap: 10 }}>
      <Row gap={14}>
        <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: C.cardHi, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={26} color={C.accent} /></View>
        <Txt size={18} style={{ flex: 1 }}>{name}</Txt>
        {action}
      </Row>
      <Txt size={14} color={C.muted}>{body}</Txt>
      <Divider />
    </View>
  );
  const soon = <Txt size={14} color={C.muted}>Coming</Txt>;
  return (
    <Page gap={16}>
      {item('sparkles-outline', 'Claude', 'Use the Reps coach in Claude: it reads your workouts and check-ins, suggests targets and alternatives, and saves routines back to Reps. Works on the free Claude plan.',
        <Btn title={linked ? 'Manage' : 'Connect'} kind="text" onPress={() => router.push('/assistant')} />)}
      {item('chatbubbles-outline', 'ChatGPT', 'The same Reps connector can be added to ChatGPT on plans that allow custom connectors. Set it up from the Claude screen, then follow the ChatGPT steps there. Not yet tested by us.',
        <Btn title={linked ? 'Steps' : 'Connect'} kind="text" onPress={() => router.push('/assistant')} />)}
      {item('heart-outline', 'Health Connect', "Log Reps workouts to Android's health hub and read your body weight from a scale or watch.", soon)}
      {item('download-outline', 'Hevy', 'Bring your whole workout history and measurements across from a Hevy export.',
        <Btn title="Import" kind="text" onPress={() => router.push('/import')} />)}
    </Page>
  );
}
