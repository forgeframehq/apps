// Colours. Everything reads C at render time, so changing the accent and remounting the screens re-themes the app.
export const ACCENTS = {
  Volt: { accent: '#C8F031', accentDim: '#2A3308', onAccent: '#141A00' },
  Mint: { accent: '#2EE6A6', accentDim: '#0A3024', onAccent: '#00241A' },
  Violet: { accent: '#8F7BFF', accentDim: '#221C4D', onAccent: '#0E0A2B' },
  Crimson: { accent: '#FF3B5C', accentDim: '#3D0F18', onAccent: '#FFFFFF' },
  Ice: { accent: '#4CC2FF', accentDim: '#0E2E40', onAccent: '#001B2B' },
  Orange: { accent: '#FF6B2C', accentDim: '#3B1D10', onAccent: '#FFFFFF' },
} as const;
export type AccentName = keyof typeof ACCENTS;
export const DEFAULT_ACCENT: AccentName = 'Volt';

export const C = {
  bg: '#000000',
  bar: '#161618',
  card: '#1C1C1F',
  cardHi: '#2A2A2E',
  border: '#2C2C31',
  text: '#FFFFFF',
  muted: '#8E8E96',
  accent: ACCENTS.Volt.accent as string,
  accentDim: ACCENTS.Volt.accentDim as string,
  onAccent: ACCENTS.Volt.onAccent as string, // text and icons drawn on top of the accent colour
  warm: '#7CC4FF', // second highlight: warm-up sets, records, cautions
  third: '#B79CFF', // third series colour in charts
  good: '#2FBF71',
  goodDim: '#0F2A1B',
  bad: '#F0524F',
  dark: '#0B0B0C',
};

export function applyAccent(name: string | undefined) {
  Object.assign(C, ACCENTS[(name && name in ACCENTS ? name : DEFAULT_ACCENT) as AccentName]);
}
