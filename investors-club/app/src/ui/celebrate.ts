import { badges, level } from '@/lib/store';

import { alertBox } from './overlay';

/**
 * Call before something that might earn a badge, then call the returned function afterwards.
 * It congratulates the student on anything new.
 */
export function watchBadges() {
  const had = new Set(badges().filter((b) => b.earned).map((b) => b.id));
  const was = level().number;
  return async () => {
    const fresh = badges().filter((b) => b.earned && !had.has(b.id));
    for (const b of fresh) await alertBox(`Badge earned: ${b.title}`, `${b.how}. Nice work!`);
    const now = level();
    if (now.number > was) await alertBox(`Level ${now.number}: ${now.name}`, 'You moved up a level. Keep learning to reach the next one.');
  };
}
