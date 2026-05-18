import { loadPlan, dayOfYear, dateForDay, formatRefKo } from '../data/plan.js';
import { getDayProgress } from '../state/progress.js';
import { navigate } from '../router.js';

export async function renderCalendar(params) {
  const today = new Date();
  const ym = params?.ym || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [yearStr, monthStr] = ym.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error(`잘못된 연월: ${ym}`);
  }
  const plan = await loadPlan();
  const todayDay = dayOfYear(today);

  const root = document.createElement('section');
  root.className = 'calendar-view';

  const head = document.createElement('div');
  head.className = 'calendar-head';
  const prevYm = stepMonth(year, month, -1);
  const nextYm = stepMonth(year, month, 1);
  head.innerHTML = `
    <button class="reader-back" data-action="prev">← ${prevYm.label}</button>
    <h1>${year}년 ${month}월</h1>
    <button class="reader-back" data-action="next">${nextYm.label} →</button>
  `;
  head.querySelector('[data-action="prev"]').addEventListener('click', () => {
    navigate(`/calendar/${prevYm.ym}`);
  });
  head.querySelector('[data-action="next"]').addEventListener('click', () => {
    navigate(`/calendar/${nextYm.ym}`);
  });
  root.appendChild(head);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'calendar-grid';
  for (const w of ['일','월','화','수','목','금','토']) {
    const cell = document.createElement('div');
    cell.className = 'calendar-weekday';
    cell.textContent = w;
    grid.appendChild(cell);
  }
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = first.getDay();
  for (let i = 0; i < firstWeekday; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-cell empty';
    grid.appendChild(empty);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month - 1, d);
    const dayNum = dayOfYearOf(cellDate);
    if (!dayNum || dayNum < 1 || dayNum > 365) {
      const cell = document.createElement('div');
      cell.className = 'calendar-cell empty';
      grid.appendChild(cell);
      continue;
    }
    const entry = plan[dayNum - 1];
    const progress = getDayProgress(dayNum);
    const allRead = progress.every(Boolean);
    const isToday = sameDay(cellDate, today);
    const weekday = cellDate.getDay();

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'calendar-cell';
    if (isToday) cell.classList.add('is-today');
    if (allRead) cell.classList.add('is-fully-read');
    if (weekday === 0) cell.classList.add('is-sun');
    if (weekday === 6) cell.classList.add('is-sat');

    const refsKo = [entry.family_ot, entry.family_nt, entry.secret_ot, entry.secret_nt]
      .map(formatRefKo).join(' · ');

    cell.innerHTML = `
      <span class="day-num">${d}</span>
      <span class="progress-dots" aria-label="진도 ${progress.filter(Boolean).length}/4">
        ${progress.map(p => `<span class="${p ? 'done' : ''}"></span>`).join('')}
      </span>
      <span class="refs">${refsKo}</span>
    `;
    cell.setAttribute('aria-label', `${month}월 ${d}일 (${dayNum}일째) - ${refsKo}`);
    cell.addEventListener('click', () => navigate(`/today/${dayNum}`));
    grid.appendChild(cell);
  }
  root.appendChild(grid);

  return root;
}

function dayOfYearOf(date) {
  const y = date.getFullYear();
  const start = new Date(y, 0, 1);
  const ms = date - start;
  let day = Math.floor(ms / 86400000) + 1;
  const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (isLeap) {
    const feb29 = new Date(y, 1, 29);
    if (date >= feb29) day -= 1;
  }
  return day;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function stepMonth(year, month, delta) {
  let m = month + delta;
  let y = year;
  while (m < 1) { m += 12; y -= 1; }
  while (m > 12) { m -= 12; y += 1; }
  return {
    ym: `${y}-${String(m).padStart(2, '0')}`,
    label: `${y}.${m}`,
  };
}
