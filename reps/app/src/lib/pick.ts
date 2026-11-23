import type { Exercise } from './types';

// The exercise picker is its own screen; whoever opens it registers what to do with the choice.
let handler: ((e: Exercise) => void) | null = null;
export const setPickHandler = (fn: ((e: Exercise) => void) | null) => { handler = fn; };
export const deliverPick = (e: Exercise) => { const h = handler; handler = null; h?.(e); };
