export type Sector = 'Tech' | 'Games & Fun' | 'Food & Drink' | 'Shops & Style' | 'Travel & Cars' | 'Money' | 'Health' | 'Bermuda' | 'Funds';

export interface Stock {
  symbol: string;
  name: string;
  sector: Sector;
  /** One or two plain sentences on what the company does. */
  about: string;
}

export interface Quote {
  price: number;
  /** Yesterday's closing price, used for "today's change". */
  prev: number;
  /** When the price was fetched (ms). */
  at: number;
}

export interface Holding {
  symbol: string;
  shares: number;
  /** Total paid for the shares still held. */
  cost: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number;
  at: string; // ISO UTC
}

export interface Portfolio {
  /** Pretend dollars you started with. */
  start: number;
  cash: number;
  holdings: Holding[];
  trades: Trade[]; // newest first
  /** One total value per day, oldest first, for the "how am I doing" graph. */
  snapshots: { d: string; v: number }[];
}

export type Level = 'simple' | 'detailed';

export interface Settings {
  name: string;
  accent?: string;
  level: Level;
  /** Optional keys for getting prices straight from the data providers when there is no class server. */
  finnhubKey: string;
  twelveKey: string;
  /** Address of the class server. Empty means "use the built-in one, if any". */
  server: string;
}

/** Set once this device has joined (or created) a class. */
export interface ClassLink {
  server: string;
  code: string;
  className: string;
  role: 'student' | 'teacher';
  /** Student token, or the teacher key. Treat like a password. */
  token: string;
  name: string;
}

export interface Learned {
  terms: string[];
  /** Lesson id -> best quiz score. */
  lessons: Record<string, number>;
}

export interface HistoryPoint { d: string; c: number }

export interface Standing {
  id: string;
  name: string;
  value: number;
  cash: number;
  gainPct: number;
  trades: number;
  companies: number;
  me?: boolean;
}

export interface StudentDetail extends Standing {
  holdings: Holding[];
  recent: Trade[];
}

/** Facts shown on a stock before buying. Any of them can be missing (funds have few). */
export interface Markers {
  /** Company value in millions of US dollars. */
  cap?: number;
  pe?: number;
  /** Yearly dividend as a percentage of the price. */
  div?: number;
  beta?: number;
  hi?: number;
  lo?: number;
  /** Price change over the past 52 weeks, in percent. */
  yr?: number;
  /** Sales compared with a year earlier, in percent. */
  growth?: number;
  at: number;
}
