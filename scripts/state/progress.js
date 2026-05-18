const KEY = 'mccheyne.progress.v1';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function write(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch (err) {
    console.warn('localStorage write failed:', err);
  }
}

function key(day) { return String(day); }

export function getDayProgress(day) {
  const all = read();
  const v = all[key(day)];
  if (!Array.isArray(v) || v.length !== 4) return [false, false, false, false];
  return v.map(Boolean);
}

export function setSlotRead(day, slotIndex, isRead) {
  const all = read();
  const k = key(day);
  const current = Array.isArray(all[k]) && all[k].length === 4
    ? all[k].slice() : [false, false, false, false];
  current[slotIndex] = Boolean(isRead);
  if (current.every(v => !v)) {
    delete all[k];
  } else {
    all[k] = current;
  }
  write(all);
  return current;
}

export function getReadCount(day) {
  return getDayProgress(day).filter(Boolean).length;
}

export function overallStats() {
  const all = read();
  let readSlots = 0;
  for (const k in all) {
    if (Array.isArray(all[k])) readSlots += all[k].filter(Boolean).length;
  }
  const total = 365 * 4;
  return { readSlots, total, ratio: readSlots / total };
}
