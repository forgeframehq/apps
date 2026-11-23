// The trading rules. Shared by the app (practice trades) and the class server (class trades), so both always agree.
// Keep this file free of React Native imports: the server bundles it too.
import { isoNow, newId } from './format';
import type { Portfolio, Trade } from './types';

const cents = (v: number) => Math.round(v * 100) / 100;
const STEP = 1e4; // shares are kept to 4 decimal places
export const roundShares = (n: number) => Math.floor(n * STEP + 1e-6) / STEP;

/** Works out the portfolio after a trade, or returns a sentence saying why it cannot happen. There are no fees. */
export function applyTrade<P extends Pick<Portfolio, 'cash' | 'holdings' | 'trades'>>(p: P, symbol: string, side: 'buy' | 'sell', rawShares: number, price: number): P | string {
  const shares = roundShares(rawShares);
  if (!(shares > 0)) return 'Enter how many shares.';
  if (!(price > 0)) return 'There is no price for this stock right now.';
  const amount = cents(shares * price);
  const held = p.holdings.find((h) => h.symbol === symbol);
  const holdings = p.holdings.filter((h) => h.symbol !== symbol);
  let cash = p.cash;
  if (side === 'buy') {
    if (amount > cash + 0.001) return 'That costs more than your cash.';
    cash = cents(cash - amount);
    holdings.push({ symbol, shares: Math.round(((held?.shares ?? 0) + shares) * STEP) / STEP, cost: cents((held?.cost ?? 0) + amount) });
  } else {
    if (!held || shares > held.shares + 1e-6) return held ? `You only have ${held.shares} to sell.` : 'You do not own this stock.';
    cash = cents(cash + amount);
    const left = Math.round((held.shares - shares) * STEP) / STEP;
    if (left > 0) holdings.push({ symbol, shares: left, cost: cents(held.cost * (left / held.shares)) });
  }
  holdings.sort((a, b) => a.symbol.localeCompare(b.symbol));
  const trade: Trade = { id: newId(), symbol, side, shares, price, at: isoNow() };
  return { ...p, cash, holdings, trades: [trade, ...p.trades] };
}
