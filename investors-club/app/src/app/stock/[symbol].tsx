import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { term } from '@/data/glossary';
import { markerViews, type MarkerView } from '@/data/markers';
import { fmtDayKey, fmtShares, dayKey, money, pct, signedMoney } from '@/lib/format';
import { loadHistory, loadMarkers, refreshQuotes, source } from '@/lib/market';
import { dayChangePct, holdingOf, holdingValue, markTerm, portfolio, stock, toggleWatch, useStore } from '@/lib/store';
import type { HistoryPoint } from '@/lib/types';
import { PriceChart } from '@/ui/chart';
import { watchBadges } from '@/ui/celebrate';
import { Bar, Btn, C, Caption, Card, Chip, Delta, Empty, Icon, IconBtn, Page, Row, Stat, Tile, Txt } from '@/ui/kit';
import { alertBox } from '@/ui/overlay';
import { TradeSheet } from '@/ui/trade';

const RANGES = { '1W': 5, '1M': 22, '3M': 66, '1Y': 400 } as const;
type Range = keyof typeof RANGES;

/** One stock: price, graph, markers to read before choosing, and the buy and sell buttons. */
export default function StockScreen() {
  const { symbol: raw } = useLocalSearchParams<{ symbol: string }>();
  const symbol = String(raw ?? '').toUpperCase();
  const insets = useSafeAreaInsets();
  const { quotes, markers, watch, settings } = useStore();
  const s = stock(symbol);
  const q = quotes[symbol];
  const p = portfolio();
  const held = holdingOf(p, symbol);
  const [range, setRange] = useState<Range>('1M');
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);
  const [graphError, setGraphError] = useState('');
  const [side, setSide] = useState<'buy' | 'sell' | null>(null);

  useEffect(() => {
    let live = true;
    refreshQuotes();
    loadMarkers(symbol);
    loadHistory(symbol).then((pts) => live && setPoints(pts)).catch((e: Error) => live && setGraphError(e.message));
    return () => { live = false; };
  }, [symbol]);

  if (!s.about) return <Empty icon="help-circle-outline" title="Stock not found" body="That stock is not in the Investors Club list." />;

  // Add today's live price to the end of the daily history so the graph and the big number agree.
  const series = points ? [...points] : [];
  if (q && series.length && series[series.length - 1].d < dayKey()) series.push({ d: dayKey(), c: q.price });
  else if (q && series.length) series[series.length - 1] = { ...series[series.length - 1], c: q.price };
  const shown = series.slice(-RANGES[range]);
  const moved = shown.length > 1 ? ((shown[shown.length - 1].c - shown[0].c) / shown[0].c) * 100 : 0;
  const views = markerViews(markers[symbol] ?? null, q);

  const explain = async (m: MarkerView) => {
    const t = term(m.term);
    if (!t) return;
    const celebrate = watchBadges();
    markTerm(t.id);
    await alertBox(t.word, `${settings.level === 'simple' ? t.simple : t.detailed}\n\n${s.name}: ${m.value}. ${m.hint}`);
    celebrate();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ title: symbol, headerRight: () => <IconBtn name={watch.includes(symbol) ? 'star' : 'star-outline'} color={watch.includes(symbol) ? C.accent : C.text} label={watch.includes(symbol) ? 'Remove from watchlist' : 'Add to watchlist'} onPress={() => toggleWatch(symbol)} /> }} />
      <Page bottom={24}>
        <Card style={{ borderWidth: 1, borderColor: C.border }}>
          <Row gap={14}>
            <Tile symbol={symbol} size={60} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt size={21} bold>{s.name}</Txt>
              <Txt size={13} color={C.muted}>{s.sector}</Txt>
            </View>
          </Row>
          <Txt size={15} color={C.muted}>{s.about}</Txt>
          {q ? (
            <Row gap={12} style={{ alignItems: 'flex-end' }}>
              <Txt size={34} bold>{money(q.price)}</Txt>
              <View style={{ paddingBottom: 7, gap: 2 }}>
                <Delta value={dayChangePct(q)} pill />
              </View>
              <Txt size={13} color={C.muted} style={{ paddingBottom: 9 }}>today</Txt>
            </Row>
          ) : (
            <Txt size={15} color={C.muted}>{source() === 'none' ? 'Set up market data in Settings to see the price.' : 'Getting the price...'}</Txt>
          )}
        </Card>

        <Card>
          <Row gap={8}>
            {(Object.keys(RANGES) as Range[]).map((r) => <Chip key={r} title={r} selected={range === r} onPress={() => setRange(r)} />)}
            <View style={{ flex: 1 }} />
            {shown.length > 1 && <Delta value={moved} />}
          </Row>
          {shown.length > 1 ? (
            <PriceChart values={shown.map((x) => x.c)} labels={shown.map((x) => fmtDayKey(x.d))} />
          ) : (
            <View style={{ height: 120, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
              <Txt size={14} color={C.muted} center>{graphError || 'Drawing the graph...'}</Txt>
            </View>
          )}
        </Card>

        <View style={{ gap: 4, marginTop: 4 }}>
          <Txt size={18} bold>Markers</Txt>
          <Txt size={14} color={C.muted}>Read these before you choose. Tap one to learn what it means.</Txt>
        </View>
        {views.length === 0 && <Card><Txt size={14} color={C.muted}>{source() === 'none' ? 'Markers appear once market data is set up.' : 'Getting the markers...'}</Txt></Card>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {views.map((m) => {
            const colour = m.tone === 'up' ? C.good : m.tone === 'down' ? C.bad : C.accent;
            return (
              <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={`Marker ${m.title}`} onPress={() => explain(m)}
                style={({ pressed }) => ({ flexBasis: m.id === 'range' ? '100%' : '47%', flexGrow: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, gap: 6, opacity: pressed ? 0.7 : 1 })}>
                <Row gap={6}>
                  <Caption>{m.title}</Caption>
                  <View style={{ flex: 1 }} />
                  <Icon name="information-circle-outline" size={16} color={C.muted} />
                </Row>
                <Txt size={19} bold>{m.value}</Txt>
                <View style={{ alignSelf: 'flex-start', backgroundColor: `${colour}22`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Txt size={13} color={colour} bold>{m.word}</Txt>
                </View>
                {m.meter !== null && <Bar value={m.meter} color={colour} height={6} />}
              </Pressable>
            );
          })}
        </View>
        {views.length > 0 && <Txt size={12} color={C.muted}>Markers describe a company. No single marker tells you to buy or sell.</Txt>}

        {held && (
          <Card>
            <Txt size={17} bold>You own</Txt>
            <Row gap={22} style={{ flexWrap: 'wrap' }}>
              <Stat title="Shares" value={fmtShares(held.shares).replace(/ shares?$/, '')} />
              <Stat title="Worth now" value={money(holdingValue(held))} />
              <Stat title="You paid" value={money(held.cost)} />
              <Stat title="Gain or loss" value={`${signedMoney(holdingValue(held) - held.cost)} (${pct(held.cost ? ((holdingValue(held) - held.cost) / held.cost) * 100 : 0)})`} color={holdingValue(held) >= held.cost ? C.good : C.bad} />
            </Row>
          </Card>
        )}
      </Page>
      <View style={{ flexDirection: 'row', gap: 10, padding: 12, paddingBottom: insets.bottom + 12, backgroundColor: C.bar }}>
        {held && <Btn title="Sell" kind="ghost" color={C.bad} style={{ flex: 1 }} onPress={() => setSide('sell')} />}
        <Btn title="Buy" style={{ flex: 2 }} disabled={!q} onPress={() => setSide('buy')} />
      </View>
      <TradeSheet symbol={symbol} side={side} onClose={() => setSide(null)} />
    </View>
  );
}
