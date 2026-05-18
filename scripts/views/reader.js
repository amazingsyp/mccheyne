import {
  TRANSLATIONS, loadChapters, unionVerseNumbers,
  getSelectedTranslations, setSelectedTranslations,
  getPrimaryTranslation, setPrimaryTranslation,
} from '../data/bible.js';
import { bookKo, chapterCount } from '../data/books.js';
import { navigate } from '../router.js';

export async function renderReader(params) {
  const book = (params.book || '').toUpperCase();
  const chapter = parseInt(params.chapter, 10);
  const maxChap = chapterCount(book);
  if (!maxChap || !Number.isFinite(chapter) || chapter < 1 || chapter > maxChap) {
    throw new Error(`잘못된 본문 위치: ${book} ${chapter}`);
  }

  const root = document.createElement('section');
  root.className = 'reader-view';

  root.innerHTML = `
    <div class="reader-head">
      <div class="reader-title">
        <h1>${bookKo(book)} ${chapter}장</h1>
        <span class="reader-sub">${book} ${chapter}</span>
      </div>
      <button type="button" class="reader-back" data-action="back">← 뒤로</button>
    </div>
    <div class="translation-toolbar" id="translation-toolbar"></div>
    <div id="verse-area"><div class="loading">본문 불러오는 중…</div></div>
    <nav class="chapter-nav" aria-label="장 이동">
      <button type="button" data-action="prev-ch" ${chapter === 1 ? 'disabled' : ''}>← 이전 장</button>
      <span class="chapter-title">${bookKo(book)} ${chapter}장</span>
      <button type="button" data-action="next-ch" ${chapter === maxChap ? 'disabled' : ''}>다음 장 →</button>
    </nav>
  `;

  refreshToolbar(root, book, chapter);

  root.querySelector('[data-action="prev-ch"]').addEventListener('click', () => {
    if (chapter > 1) navigate(`/read/${book}/${chapter - 1}`);
  });
  root.querySelector('[data-action="next-ch"]').addEventListener('click', () => {
    if (chapter < maxChap) navigate(`/read/${book}/${chapter + 1}`);
  });
  root.querySelector('[data-action="back"]').addEventListener('click', () => {
    if (history.length > 1) history.back();
    else navigate(`/bible/${book}`);
  });

  await refreshVerseArea(root, book, chapter);

  const onKey = (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft' && chapter > 1) navigate(`/read/${book}/${chapter - 1}`);
    else if (e.key === 'ArrowRight' && chapter < maxChap) {
      navigate(`/read/${book}/${chapter + 1}`);
    }
  };
  window.addEventListener('keydown', onKey);
  const cleanup = () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', cleanup);
  };
  window.addEventListener('hashchange', cleanup);

  return root;
}

function refreshToolbar(root, book, chapter) {
  const tb = root.querySelector('#translation-toolbar');
  tb.replaceChildren(buildTranslationToolbar(root, book, chapter));
}

function buildTranslationToolbar(root, book, chapter) {
  const wrap = document.createDocumentFragment();
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = '역본';
  wrap.appendChild(label);

  const pills = document.createElement('div');
  pills.className = 'translation-pills';
  const selected = new Set(getSelectedTranslations());
  const primary = getPrimaryTranslation();

  for (const t of TRANSLATIONS) {
    const isOn = selected.has(t.id);
    const isPrimary = isOn && t.id === primary;
    const pill = document.createElement('div');
    pill.className = 'translation-pill'
      + (isOn ? ' is-active' : '')
      + (isPrimary ? ' is-primary' : '');
    pill.innerHTML = `
      <button type="button" class="pill-toggle" data-tid="${t.id}"
              aria-pressed="${isOn}">${t.label}</button>
      <button type="button" class="pill-star" data-tid="${t.id}"
              aria-label="${t.label}을(를) 주 역본으로 지정"
              aria-pressed="${isPrimary}"
              title="${isPrimary ? '주 역본 (기준)' : '주 역본으로 지정'}">★</button>
    `;

    const toggleBtn = pill.querySelector('.pill-toggle');
    toggleBtn.addEventListener('click', async () => {
      const cur = new Set(getSelectedTranslations());
      const currentPrimary = getPrimaryTranslation();
      if (cur.has(t.id)) {
        // Trying to deselect
        if (t.id === currentPrimary) return; // primary cannot be turned off
        if (cur.size <= 1) return;
        cur.delete(t.id);
      } else {
        cur.add(t.id);
      }
      setSelectedTranslations(Array.from(cur));
      refreshToolbar(root, book, chapter);
      await refreshVerseArea(root, book, chapter);
    });

    const starBtn = pill.querySelector('.pill-star');
    starBtn.addEventListener('click', async () => {
      if (t.id === getPrimaryTranslation()) return;
      // Ensure the new primary is selected
      const cur = new Set(getSelectedTranslations());
      if (!cur.has(t.id)) {
        cur.add(t.id);
        setSelectedTranslations(Array.from(cur));
      }
      setPrimaryTranslation(t.id);
      refreshToolbar(root, book, chapter);
      await refreshVerseArea(root, book, chapter);
    });

    pills.appendChild(pill);
  }
  wrap.appendChild(pills);
  return wrap;
}

async function refreshVerseArea(root, book, chapter) {
  const area = root.querySelector('#verse-area');
  area.innerHTML = '<div class="loading">본문 불러오는 중…</div>';
  const selected = getSelectedTranslations();
  const primary = getPrimaryTranslation();
  const chapterMap = await loadChapters(selected, book, chapter);

  const verseNums = unionVerseNumbers(chapterMap);
  if (verseNums.length === 0) {
    area.innerHTML = `
      <div class="error-box">
        <strong>본문 데이터를 찾을 수 없습니다.</strong>
        <p>${bookKo(book)} ${chapter}장 - ${book} ${chapter}</p>
        <p style="margin-top:8px;font-size:0.9em">
          데이터 다운로드가 아직 끝나지 않았을 수 있습니다.
          <code>python3 scripts/build/fetch_bible.py --skip-existing</code> 실행 또는 README의 다운로드 안내 참고.
        </p>
      </div>`;
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'verse-area-inner';
  wrap.appendChild(buildVerseTable(selected, primary, verseNums, chapterMap));
  wrap.appendChild(buildVerseStack(selected, primary, verseNums, chapterMap));
  area.replaceChildren(wrap);
}

function buildVerseTable(selected, primary, verseNums, chapterMap) {
  const table = document.createElement('table');
  table.className = 'verse-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const numTh = document.createElement('th');
  numTh.className = 'verse-num-col';
  numTh.textContent = '#';
  headRow.appendChild(numTh);
  for (const tid of selected) {
    const t = TRANSLATIONS.find(x => x.id === tid);
    const th = document.createElement('th');
    if (tid === primary) th.classList.add('is-primary');
    th.textContent = t.label;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const v of verseNums) {
    const tr = document.createElement('tr');
    const numTd = document.createElement('td');
    numTd.className = 'verse-num';
    numTd.textContent = v;
    tr.appendChild(numTd);
    for (const tid of selected) {
      const t = TRANSLATIONS.find(x => x.id === tid);
      const td = document.createElement('td');
      td.className = 'lang-' + t.lang;
      if (tid === primary) td.classList.add('is-primary');
      const text = chapterMap[tid]?.[String(v)];
      if (text) td.textContent = text;
      else { td.classList.add('missing'); td.textContent = '—'; }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

function buildVerseStack(selected, primary, verseNums, chapterMap) {
  const stack = document.createElement('div');
  stack.className = 'verse-stack';
  // Order: primary first, then others in selection order
  const ordered = [primary, ...selected.filter(t => t !== primary)];

  for (const v of verseNums) {
    const group = document.createElement('div');
    group.className = 'verse-group';

    const numRow = document.createElement('div');
    numRow.className = 'verse-num-row';
    const numSpan = document.createElement('span');
    numSpan.className = 'verse-num';
    numSpan.textContent = v;
    numRow.appendChild(numSpan);
    group.appendChild(numRow);

    for (const tid of ordered) {
      if (!selected.includes(tid)) continue;
      const t = TRANSLATIONS.find(x => x.id === tid);
      const text = chapterMap[tid]?.[String(v)];
      const line = document.createElement('div');
      line.className = 'verse-line lang-' + t.lang + (tid === primary ? ' is-primary' : '');

      const tag = document.createElement('span');
      tag.className = 'verse-tag';
      tag.textContent = t.label;

      const txt = document.createElement('span');
      txt.className = 'verse-text' + (text ? '' : ' missing');
      txt.textContent = text || '—';

      line.appendChild(tag);
      line.appendChild(txt);
      group.appendChild(line);
    }
    stack.appendChild(group);
  }
  return stack;
}
