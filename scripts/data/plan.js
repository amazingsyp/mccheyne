let planPromise = null;

export function loadPlan() {
  if (!planPromise) {
    planPromise = fetch('./data/mccheyne-plan.json')
      .then(r => {
        if (!r.ok) throw new Error(`plan.json: HTTP ${r.status}`);
        return r.json();
      });
  }
  return planPromise;
}

export function dayOfYear(date = new Date()) {
  const y = date.getFullYear();
  const start = new Date(y, 0, 1);
  const ms = date - start;
  let day = Math.floor(ms / 86400000) + 1;
  // McCheyne plan skips Feb 29: in leap years, after Feb 28 shift by 1
  const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (isLeap) {
    const feb29 = new Date(y, 1, 29);
    if (date >= feb29) day -= 1;
  }
  return Math.min(Math.max(day, 1), 365);
}

export async function entryForDay(day) {
  const plan = await loadPlan();
  return plan[day - 1] ?? null;
}

export function formatKoreanDate(date) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}년 ${m}월 ${d}일 (${days[date.getDay()]})`;
}

export function dateForDay(day, year = new Date().getFullYear()) {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const base = new Date(year, 0, 1);
  let target = day - 1;
  if (isLeap && day >= 60) target += 1; // skip Feb 29
  base.setDate(base.getDate() + target);
  return base;
}

export const SLOT_KEYS = ['family_ot', 'family_nt', 'secret_ot', 'secret_nt'];
export const SLOT_LABELS = {
  family_ot: { label: '구약', tag: 'ot' },
  family_nt: { label: '신약', tag: 'nt' },
  secret_ot: { label: '구약', tag: 'ot' },
  secret_nt: { label: '신약', tag: 'nt' },
};

import { bookKo } from './books.js';
export { bookKo };

export function formatRefKo(slot) {
  const ko = bookKo(slot.book);
  if (slot.chapters) {
    return `${ko} ${slot.chapters.join(',')}장`;
  }
  if (slot.chapter_end) {
    if (slot.verse_end && slot.verse_start) {
      return `${ko} ${slot.chapter}:${slot.verse_start} - ${slot.chapter_end}:${slot.verse_end}`;
    }
    return `${ko} ${slot.chapter}-${slot.chapter_end}장`;
  }
  if (slot.verse_start && slot.verse_end) {
    return `${ko} ${slot.chapter}:${slot.verse_start}-${slot.verse_end}`;
  }
  return `${ko} ${slot.chapter}장`;
}

export function chaptersInSlot(slot) {
  if (slot.chapters) return slot.chapters.slice();
  const start = slot.chapter;
  const end = slot.chapter_end || start;
  const out = [];
  for (let c = start; c <= end; c++) out.push(c);
  return out;
}
