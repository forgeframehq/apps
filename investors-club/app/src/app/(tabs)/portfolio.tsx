import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { SECTORS } from '@/data/stocks';
import { fmtDate, fmtDayKey, fmtShares, money, pct, signedMoney } from '@/lib/format';
import { badges, gainPct, holdingValue, inClass, investedValue, level, portfolio, stock, totalValue, useStore } from '@/lib/store';
import { PriceChart } from '@/ui/chart';
import { Bar, Btn, C, Card, Delta, Divider, Empty, Icon, Page, Row, Stat, TabHeader, TapCard, Tile, Txt, type IconName } from '@/ui/kit';

const MIX_COLOURS = ['#4CC2FF', '#2EE6A6', '#B79CFF', '#FFB454', '#FF7A90', '#7CE0E6', '#C8F031', '#FF9D5C', '#8E8E96'];

/** What you own, what it is worth, and how you are doing. */
export default function PortfolioTab() {
  const router = useRouter();
  const { cls } = useStore();
  const p = portfolio();
  const total = totalValue(p);
  const gain = total - p.start;
  const lv = level();
  const earned = badges();
  const holdings = [...p.holdings].sort((a, b) => holdingValue(b) - holdingValue(a));
  const mix = SECTORS.map((sector, i) => ({ sector, colour: MIX_COLOURS[i], value: p.holdings.filter((h) => stock(h.symbol).sector === sector).reduce((sum, h) => sum + holdingValue(h), 0) })).filter((m) => m.value > 0);
  const parts = [...mix, { sector: 'Cash', colour: C.cardHi, value: p.cash }];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TabHeader title="Portfolio" />
      <Page>
        <Card>
          <Row gap={8}>
            <Icon name={inClass() ? 'trophy-outline' : 'flask-outline'} size={16} color={C.muted} />
            <Txt size={13} color={C.muted}>{inClass() ? `${cls?.className} · class portfolio` : 'Practice portfolio'}</Txt>
          </Row>
          <Txt size={36} bold>{money(total)}</Txt>
          <Row gap={8}>
            <Delta value={gainPct(p)} pill />
            <Txt size={14} color={Math.abs(gain) < 0.005 ? C.muted : gain > 0 ? C.good : C.bad}>{signedMoney(gain)}</Txt>
            <Txt size={14} color={C.muted}>since you started with {money(p.start, false)}</Txt>
          </Row>
          <Divider />
          <Row gap={28}>
            <Stat title="Cash" value={money(p.cash)} />
            <Stat title="In stocks" value={money(investedValue(p))} />
            <Stat title="Stocks" value={String(p.holdings.length)} />
          </Row>
        </Card>

        <Card>
          <Row>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center' }}>
              <Txt size={17} bold color={C.accent}>{lv.number}</Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={16} bold>{lv.name}</Txt>
              <Txt size={13} color={C.muted}>{lv.next ? `${lv.points} points · ${lv.next - lv.points} to the next level` : `${lv.points} points · top level`}</Txt>
            </View>
          </Row>
          <Bar value={lv.progress} />
        </Card>

        {p.snapshots.length > 1 && (
          <Card>
            <Txt size={17} bold>Your value over time</Txt>
            <PriceChart values={p.snapshots.map((x) => x.v)} labels={p.snapshots.map((x) => fmtDayKey(x.d))} height={170} />
          </Card>
        )}

        {holdings.length === 0 ? (
          <Card>
            <Empty icon="wallet-outline" title={`You have ${money(p.cash, false)} to invest`} body="It is pretend money, so this is the place to try things out. Pick a stock, read its markers, and buy your first shares." />
            <Btn title="Go to the Market" onPress={() => router.push('/')} />
          </Card>
        ) : (
          <>
            <Card>
              <Txt size={17} bold>Your mix</Txt>
              <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden' }}>
                {parts.map((m) => <View key={m.sector} style={{ flex: m.value / total, backgroundColor: m.colour }} />)}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, rowGap: 6 }}>
                {parts.map((m) => (
                  <Row key={m.sector} gap={6}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.colour }} />
                    <Txt size={13} color={C.muted}>{m.sector} {Math.round((m.value / total) * 100)}%</Txt>
                  </Row>
                ))}
              </View>
              {mix.length < 3 && <Txt size={13} color={C.muted}>Tip: owning stocks from three or more groups spreads your risk.</Txt>}
            </Card>

            <Txt size={18} bold>Your stocks</Txt>
            {holdings.map((h) => {
              const value = holdingValue(h);
              return (
                <TapCard key={h.symbol} label={`Holding ${stock(h.symbol).name}`} onPress={() => router.push(`/stock/${h.symbol}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
                  <Tile symbol={h.symbol} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Txt size={16} bold lines={1}>{stock(h.symbol).name}</Txt>
                    <Txt size={13} color={C.muted}>{fmtShares(h.shares)}</Txt>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Txt size={16} bold>{money(value)}</Txt>
                    <Delta value={h.cost ? ((value - h.cost) / h.cost) * 100 : 0} size={13} />
                  </View>
                </TapCard>
              );
            })}
          </>
        )}

        <Txt size={18} bold>Badges</Txt>
        <Card>
          <Txt size={13} color={C.muted}>{earned.filter((b) => b.earned).length} of {earned.length} earned</Txt>
          {earned.map((b) => (
            <Row key={b.id} gap={12}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: b.earned ? C.accentDim : C.cardHi, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={b.icon as IconName} size={20} color={b.earned ? C.accent : C.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt size={15} bold color={b.earned ? C.text : C.muted}>{b.title}</Txt>
                <Txt size={13} color={C.muted}>{b.how}</Txt>
              </View>
              {b.earned && <Icon name="checkmark-circle" size={20} color={C.accent} />}
            </Row>
          ))}
        </Card>

        {p.trades.length > 0 && (
          <>
            <Txt size={18} bold>Recent trades</Txt>
            <Card>
              {p.trades.slice(0, 12).map((t) => (
                <Row key={t.id} gap={10}>
                  <Icon name={t.side === 'buy' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={20} color={t.side === 'buy' ? C.accent : C.bad} />
                  <View style={{ flex: 1 }}>
                    <Txt size={15}>{t.side === 'buy' ? 'Bought' : 'Sold'} {fmtShares(t.shares)} of {t.symbol}</Txt>
                    <Txt size={12} color={C.muted}>{fmtDate(t.at, true)} · {money(t.price)} a share</Txt>
                  </View>
                  <Txt size={15} color={C.muted}>{money(t.shares * t.price)}</Txt>
                </Row>
              ))}
            </Card>
          </>
        )}
      </Page>
    </View>
  );
}
