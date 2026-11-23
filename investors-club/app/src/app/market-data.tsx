import { useState } from 'react';
import { View } from 'react-native';

import { ago } from '@/lib/format';
import { refreshQuotes, serverUrl, source } from '@/lib/market';
import { db, setSetting, useStore } from '@/lib/store';
import { Btn, C, Card, Icon, LinkRow, Page, Row, Txt } from '@/ui/kit';
import { prompt } from '@/ui/overlay';

const mask = (key: string) => (key ? `${key.slice(0, 4)}...` : 'Not set');

/** Where prices come from: a class server, or free keys typed in here. The one screen that needs setting up. */
export default function MarketData() {
  const { settings, net, quotes, cls } = useStore();
  const [checking, setChecking] = useState(false);
  const src = source();
  const count = Object.keys(quotes).length;

  const edit = async (key: 'server' | 'finnhubKey' | 'twelveKey', title: string, placeholder: string) => {
    const v = await prompt(title, settings[key], placeholder, { okText: 'Save' });
    if (v === null) return;
    setSetting(key, v.trim());
    db.net.at = 0;
    check();
  };
  const check = async () => {
    setChecking(true);
    await refreshQuotes(true);
    setChecking(false);
  };

  return (
    <Page>
      <Card>
        <Row>
          <Icon name={src === 'none' ? 'cloud-offline-outline' : net.error ? 'warning-outline' : 'checkmark-circle-outline'} color={src === 'none' ? C.muted : net.error ? C.bad : C.good} />
          <Txt size={17} bold style={{ flex: 1 }}>
            {src === 'server' ? 'Prices come from the class server' : src === 'direct' ? 'Prices come from your own key' : 'Prices are not set up'}
          </Txt>
        </Row>
        <Txt size={14} color={C.muted}>
          {src === 'none'
            ? 'Add a class server address or a free Finnhub key below. Until then the app shows the last prices it saw, and lessons still work.'
            : net.error || (net.at ? `${count} prices, updated ${ago(net.at)}.` : 'Not checked yet.')}
        </Txt>
        {src !== 'none' && <Btn title="Check now" kind="ghost" busy={checking} onPress={check} />}
      </Card>

      <Txt size={18} bold>Class server</Txt>
      <Txt size={14} color={C.muted}>Best for schools: one address for everyone, shared prices, classes and the leaderboard.</Txt>
      <View>
        <LinkRow icon="server-outline" title="Server address" value={cls ? cls.server.replace(/^https?:\/\//, '') : settings.server ? settings.server.replace(/^https?:\/\//, '') : serverUrl() ? 'Built in' : 'Not set'} onPress={() => edit('server', 'Class server address', 'https://...')} />
      </View>

      <Txt size={18} bold>Your own keys</Txt>
      <Txt size={14} color={C.muted}>For trying the app on one device without a server. Both keys are free. Finnhub (finnhub.io) gives prices and markers. Twelve Data (twelvedata.com) gives the graphs.</Txt>
      <View>
        <LinkRow icon="key-outline" title="Finnhub key" value={mask(settings.finnhubKey)} onPress={() => edit('finnhubKey', 'Finnhub key', 'Paste the key')} />
        <LinkRow icon="analytics-outline" title="Twelve Data key" value={mask(settings.twelveKey)} onPress={() => edit('twelveKey', 'Twelve Data key', 'Paste the key')} />
      </View>
      <Txt size={12} color={C.muted}>Keys stay on this device. A class server, when set, is used instead of them.</Txt>
    </Page>
  );
}
