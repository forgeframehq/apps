// The markers shown on every stock. Each one turns a number into a plain word and a 0-1 meter, and links to
// the glossary entry that explains it. The words describe; they never say "buy" or "sell".
import { money, pct } from '@/lib/format';
import type { Markers, Quote } from '@/lib/types';

export interface MarkerView {
  id: string;
  /** Glossary entry that explains this marker. */
  term: string;
  title: string;
  value: string;
  /** Plain-word reading of the number, e.g. "Giant" or "Jumpy". */
  word: string;
  /** Position of the meter from 0 to 1, or null for no meter. */
  meter: number | null;
  tone: 'neutral' | 'up' | 'down';
  hint: string;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

function size(millions: number) {
  const text = millions >= 1_000_000 ? `$${(millions / 1_000_000).toFixed(2)} trillion` : millions >= 1000 ? `$${Math.round(millions / 1000)} billion` : `$${Math.round(millions)} million`;
  const word = millions >= 200_000 ? 'Giant' : millions >= 10_000 ? 'Large' : millions >= 2000 ? 'Medium' : 'Small';
  // Log scale from $1 billion to $3 trillion.
  return { text, word, meter: clamp((Math.log10(Math.max(millions, 1000)) - 3) / 3.5) };
}

export function markerViews(m: Markers | null, q: Quote | undefined): MarkerView[] {
  if (!m) return [];
  const out: MarkerView[] = [];
  if (m.cap !== undefined && m.cap > 0) {
    const s = size(m.cap);
    out.push({ id: 'cap', term: 'cap', title: 'Company size', value: s.text, word: s.word, meter: s.meter, tone: 'neutral', hint: 'What the whole company is worth.' });
  }
  if (m.pe !== undefined && m.pe > 0) {
    out.push({ id: 'pe', term: 'pe', title: 'Price-to-earnings', value: m.pe.toFixed(1), word: m.pe < 15 ? 'Low' : m.pe <= 30 ? 'Middle' : 'High', meter: clamp(m.pe / 60), tone: 'neutral', hint: `Buyers pay $${m.pe.toFixed(0)} for each $1 of yearly profit.` });
  } else if (m.cap !== undefined) {
    out.push({ id: 'pe', term: 'pe', title: 'Price-to-earnings', value: 'None', word: 'No profit', meter: null, tone: 'neutral', hint: 'There is no P/E when a company made no profit this year, or for a fund.' });
  }
  const div = m.div ?? 0;
  out.push({ id: 'div', term: 'dividend', title: 'Dividend', value: div > 0 ? `${div.toFixed(2)}% a year` : 'None', word: div <= 0 ? 'No payout' : div < 2 ? 'Small payout' : 'Steady payout', meter: div > 0 ? clamp(div / 6) : null, tone: 'neutral', hint: div > 0 ? `About ${money(div)} a year for every $100 of shares.` : 'This company keeps its profits to grow instead of paying owners.' });
  if (m.beta !== undefined) {
    out.push({ id: 'beta', term: 'beta', title: 'Jumpiness', value: m.beta.toFixed(2), word: m.beta < 0.8 ? 'Calm' : m.beta <= 1.3 ? 'Average' : 'Jumpy', meter: clamp(m.beta / 2.5), tone: 'neutral', hint: 'How much the price swings compared with the whole market (1.00).' });
  }
  if (m.hi !== undefined && m.lo !== undefined && m.hi > m.lo) {
    const at = q ? clamp((q.price - m.lo) / (m.hi - m.lo)) : null;
    out.push({ id: 'range', term: 'range', title: '52-week range', value: `${money(m.lo)} to ${money(m.hi)}`, word: at === null ? 'Past year' : at > 0.8 ? 'Near its high' : at < 0.2 ? 'Near its low' : 'In the middle', meter: at, tone: 'neutral', hint: 'The lowest and highest price in the past year. The bar shows where today sits.' });
  }
  if (m.yr !== undefined) {
    out.push({ id: 'yr', term: 'return', title: 'Past year', value: pct(m.yr), word: m.yr >= 0 ? 'Up' : 'Down', meter: null, tone: m.yr >= 0 ? 'up' : 'down', hint: 'How the price changed over the last 12 months. The past does not predict the future.' });
  }
  if (m.growth !== undefined) {
    out.push({ id: 'growth', term: 'growth', title: 'Sales growth', value: pct(m.growth), word: m.growth >= 10 ? 'Growing fast' : m.growth >= 0 ? 'Growing' : 'Shrinking', meter: null, tone: m.growth >= 0 ? 'up' : 'down', hint: 'Sales this year compared with last year.' });
  }
  return out;
}
