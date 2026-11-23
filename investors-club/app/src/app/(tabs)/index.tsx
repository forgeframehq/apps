import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { SECTORS, STOCKS } from '@/data/stocks';
import { ago, money } from '@/lib/format';
import { marketOpen, refreshQuotes, source } from '@/lib/market';
import { dayChangePct, useStore } from '@/lib/store';
import { Btn, C, Card, Chip, Delta, Empty, Icon, IconBtn, Row, SearchField, TabHeader, TapCard, Tile, Txt } from '@/ui/kit';
import { pick } from '@/ui/overlay';
import { Ticker } from '@/ui/ticker';

const SORTS = ['By group', 'Biggest rise today', 'Biggest fall today', 'Lowest price', 'Highest price', 'A to Z'] as const;
type Sort = (typeof SORTS)[number];

/** Every stock with its live price. The app opens here. */
export default function Market() {
  const router = useRouter();
  const { quotes, watch, net } = useStore();
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState<Sort>('By group');
  const [query, setQuery] = useState('');
  const src = source();
  const open = (symbol: string) => router.push(`/stock/${symbol}`);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = STOCKS.filter((s) => (filter === 'All' ? true : filter === 'Watchlist' ? watch.includes(s.symbol) : s.sector === filter));
    if (q) rows = rows.filter((s) => s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q));
    const change = (sym: string) => dayChangePct(quotes[sym]);
    const price = (sym: string) => quotes[sym]?.price ?? Infinity;
    if (sort === 'Biggest rise today') rows = [...rows].sort((a, b) => change(b.symbol) - change(a.symbol));
    if (sort === 'Biggest fall today') rows = [...rows].sort((a, b) => change(a.symbol) - change(b.symbol));
    if (sort === 'Lowest price') rows = [...rows].sort((a, b) => price(a.symbol) - price(b.symbol));
    if (sort === 'Highest price') rows = [...rows].sort((a, b) => (quotes[b.symbol]?.price ?? -1) - (quotes[a.symbol]?.price ?? -1));
    if (sort === 'A to Z') rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [filter, sort, query, quotes, watch]);

  const tape = STOCKS.filter((s) => quotes[s.symbol]).map((s) => ({ symbol: s.symbol, price: quotes[s.symbol].price, change: dayChangePct(quotes[s.symbol]) }));
  const chooseSort = async () => {
    const v = await pick('Sort the list', [...SORTS], sort);
    if (v) setSort(v);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TabHeader title="Market">
        <IconBtn name="swap-vertical" label="Sort" onPress={chooseSort} />
        <IconBtn name="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
      </TabHeader>
      <Ticker items={tape} onPress={open} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: 28, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={net.loading} onRefresh={() => refreshQuotes(true)} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.card} />}>
        {src === 'none' ? (
          <Card>
            <Row>
              <Icon name="pulse-outline" color={C.accent} />
              <Txt size={17} bold>Turn on live prices</Txt>
            </Row>
            <Txt size={15} color={C.muted}>Investors Club uses real stock prices. Join your class, or add a free market data key, to see them.</Txt>
            <Btn title="Set up market data" onPress={() => router.push('/market-data')} />
          </Card>
        ) : (
          <Row gap={8}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: net.error ? C.bad : marketOpen() ? C.good : C.muted }} />
            <Txt size={13} color={C.muted} style={{ flex: 1 }}>
              {net.error || `${marketOpen() ? 'Market open' : 'Market closed, showing the last prices'}${net.at ? ` · updated ${ago(net.at)}` : ''}`}
            </Txt>
          </Row>
        )}

        <SearchField placeholder="Search the 30 stocks" value={query} onChangeText={setQuery} accessibilityLabel="Search stocks" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {['All', 'Watchlist', ...SECTORS].map((f) => <Chip key={f} title={f} selected={filter === f} onPress={() => setFilter(f)} />)}
        </ScrollView>

        {list.length === 0 && (filter === 'Watchlist' && !query
          ? <Empty icon="star-outline" title="Nothing on your watchlist" body="Open a stock and tap the star to keep an eye on it here." />
          : <Empty icon="search" title="No stocks match" body="Try a different word or group." />)}
        {list.map((s) => {
          const q = quotes[s.symbol];
          return (
            <TapCard key={s.symbol} label={s.name} onPress={() => open(s.symbol)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
              <Tile symbol={s.symbol} />
              <View style={{ flex: 1, gap: 1 }}>
                <Txt size={16} bold lines={1}>{s.name}</Txt>
                <Txt size={13} color={C.muted} lines={1}>{s.sector}</Txt>
              </View>
              {q ? (
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <Txt size={16} bold>{money(q.price)}</Txt>
                  <Delta value={dayChangePct(q)} size={13} />
                </View>
              ) : <Txt size={14} color={C.muted}>No price yet</Txt>}
            </TapCard>
          );
        })}
        <Txt size={12} color={C.muted} center>Pretend money only. Prices are real and may be a few minutes behind.</Txt>
      </ScrollView>
    </View>
  );
}
