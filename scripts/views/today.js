import {
  entryForDay, dayOfYear, dateForDay, formatKoreanDate,
  SLOT_KEYS, SLOT_LABELS, formatRefKo, chaptersInSlot,
} from '../data/plan.js';
import { getDayProgress, setSlotRead, overallStats } from '../state/progress.js';
import { navigate } from '../router.js';

export async function renderToday(params) {
  const requestedDay = params?.day ? parseInt(params.day, 10) : null;
  const day = Number.isFinite(requestedDay) && requestedDay >= 1 && requestedDay <= 365
    ? requestedDay : dayOfYear();
  const entry = await entryForDay(day);
  if (!entry) {
    throw new Error(`day ${day} not found in plan`);
  }
  const date = dateForDay(day);
  const progress = getDayProgress(day);

  const root = document.createElement('section');
  root.className = 'today-view';

  // Header
  const head = document.createElement('div');
  head.className = 'today-head';
  head.innerHTML = `
    <div class="today-date">
      <span class="date-main">${formatKoreanDate(date)}</span>
      <span class="date-sub">${day}일째 · 365일 중</span>
    </div>
    <div class="day-nav" role="group" aria-label="날짜 이동">
      <button type="button" data-action="prev" ${day === 1 ? 'disabled' : ''} aria-label="이전 날">‹</button>
      <button type="button" data-action="today" class="day-today">오늘로</button>
      <button type="button" data-action="next" ${day === 365 ? 'disabled' : ''} aria-label="다음 날">›</button>
    </div>
  `;
  root.appendChild(head);

  head.querySelector('[data-action="prev"]').addEventListener('click', () => {
    navigate(`/today/${day - 1}`);
  });
  head.querySelector('[data-action="next"]').addEventListener('click', () => {
    navigate(`/today/${day + 1}`);
  });
  head.querySelector('[data-action="today"]').addEventListener('click', () => {
    navigate('/today');
  });

  // Cards
  const grid = document.createElement('div');
  grid.className = 'card-grid';
  SLOT_KEYS.forEach((key, idx) => {
    const slot = entry[key];
    const meta = SLOT_LABELS[key];
    const isRead = progress[idx];
    grid.appendChild(makeCard(day, idx, key, slot, meta, isRead));
  });
  root.appendChild(grid);

  // Progress
  const stats = overallStats();
  const bar = document.createElement('div');
  bar.className = 'progress-bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuenow', String(Math.round(stats.ratio * 100)));
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.innerHTML = `<span style="width:${(stats.ratio * 100).toFixed(1)}%"></span>`;
  const label = document.createElement('div');
  label.className = 'progress-label';
  label.textContent = `전체 진도: ${(stats.ratio * 100).toFixed(1)}% (${stats.readSlots}/${stats.total})`;
  root.appendChild(bar);
  root.appendChild(label);

  // Keyboard shortcuts (one-time per render)
  const onKey = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft' && day > 1) navigate(`/today/${day - 1}`);
    else if (e.key === 'ArrowRight' && day < 365) navigate(`/today/${day + 1}`);
    else if (e.key.toLowerCase() === 't') navigate('/today');
    else if (e.key.toLowerCase() === 'c') navigate('/calendar');
  };
  window.addEventListener('keydown', onKey, { once: false });
  // Remove on next navigation: the router replaces #view so listeners on window
  // accumulate. Track listener to remove on hashchange.
  const cleanup = () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', cleanup);
  };
  window.addEventListener('hashchange', cleanup);

  return root;
}

function makeCard(day, slotIndex, slotKey, slot, meta, isRead) {
  const card = document.createElement('article');
  card.className = 'reading-card' + (isRead ? ' is-read' : '');
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${meta.label} ${formatRefKo(slot)} 읽기`);

  const refKo = formatRefKo(slot);
  const refEn = slot.ref || slot.name;
  card.innerHTML = `
    <label class="card-check" title="읽음 표시">
      <input type="checkbox" ${isRead ? 'checked' : ''} aria-label="${meta.label} 읽음">
      <span>${isRead ? '읽음' : '읽기'}</span>
    </label>
    <span class="slot-label">
      <span class="tag ${meta.tag}">${meta.label}</span>
    </span>
    <h2 class="ref">${refKo}</h2>
    <p class="ref-en">${refEn}</p>
  `;

  // Click → reader. But not when interacting with checkbox.
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-check')) return;
    const chapters = chaptersInSlot(slot);
    const startCh = chapters[0];
    navigate(`/read/${slot.book}/${startCh}`);
  });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target.closest('.card-check')) return;
      e.preventDefault();
      card.click();
    }
  });
  const checkbox = card.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('click', e => e.stopPropagation());
  checkbox.addEventListener('change', () => {
    setSlotRead(day, slotIndex, checkbox.checked);
    card.classList.toggle('is-read', checkbox.checked);
    card.querySelector('.card-check span').textContent = checkbox.checked ? '읽음' : '읽기';
    // Update progress bar live
    const stats = overallStats();
    const bar = document.querySelector('.progress-bar > span');
    const label = document.querySelector('.progress-label');
    if (bar) bar.style.width = (stats.ratio * 100).toFixed(1) + '%';
    if (label) label.textContent = `전체 진도: ${(stats.ratio * 100).toFixed(1)}% (${stats.readSlots}/${stats.total})`;
  });

  return card;
}
