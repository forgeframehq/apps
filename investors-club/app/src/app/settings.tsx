import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { money } from '@/lib/format';
import { source } from '@/lib/market';
import { ACCENTS, DEFAULT_ACCENT } from '@/lib/theme';
import { db, resetSolo, setSetting, START_CASH, useStore } from '@/lib/store';
import { Btn, C, Card, Icon, LinkRow, Page, Row, Txt } from '@/ui/kit';
import { confirm, toast } from '@/ui/overlay';

export default function Settings() {
  const router = useRouter();
  const { settings } = useStore();
  const accent = settings.accent ?? DEFAULT_ACCENT;
  const src = source();

  const reset = async () => {
    if (!(await confirm('Start the practice portfolio again?', `Your practice stocks and trades are cleared and you get ${money(START_CASH, false)} of pretend money. Class portfolios and badges from learning are not affected.`, 'Start again', { danger: true }))) return;
    resetSolo();
    toast('Practice portfolio reset');
  };

  return (
    <Page>
      <Txt size={18} bold>Reading level</Txt>
      <Row>
        <Btn title="Simple" kind={settings.level === 'simple' ? 'primary' : 'ghost'} style={{ flex: 1 }} height={44} onPress={() => setSetting('level', 'simple')} />
        <Btn title="Detailed" kind={settings.level === 'detailed' ? 'primary' : 'ghost'} style={{ flex: 1 }} height={44} onPress={() => setSetting('level', 'detailed')} />
      </Row>
      <Txt size={13} color={C.muted}>Simple suits younger students. Detailed adds the proper terms for older ones.</Txt>

      <Txt size={18} bold>Colour</Txt>
      <Row gap={12} style={{ flexWrap: 'wrap' }}>
        {Object.entries(ACCENTS).map(([name, a]) => (
          <Pressable key={name} accessibilityRole="button" accessibilityLabel={`${name} colour`} onPress={() => setSetting('accent', name)}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: a.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: accent === name ? C.text : 'transparent' }}>
            {accent === name && <Icon name="checkmark" color={a.onAccent} />}
          </Pressable>
        ))}
      </Row>

      <Txt size={18} bold>Setup</Txt>
      <View>
        <LinkRow icon="pulse-outline" title="Market data" value={src === 'server' ? 'Class server' : src === 'direct' ? 'Your own key' : 'Not set up'} onPress={() => router.push('/market-data')} />
        <LinkRow icon="school-outline" title="For teachers" value={db.cls?.role === 'teacher' ? db.cls.className : ''} onPress={() => router.push('/teacher')} />
        <LinkRow icon="refresh-outline" title="Reset practice portfolio" onPress={reset} />
      </View>

      <Card>
        <Txt size={15} bold>About Investors Club</Txt>
        <Txt size={14} color={C.muted}>A stock market game for schools in Bermuda. All money here is pretend. Prices are real US market prices and can be a few minutes behind. Nothing in this app is advice to buy or sell real investments.</Txt>
      </Card>
    </Page>
  );
}
