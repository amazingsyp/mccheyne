import {
  TRANSLATIONS, searchTranslation, getPrimaryTranslation,
} from '../data/bible.js';
import { bookKo } from '../data/books.js';
import { navigate } from '../router.js';

export async function renderSearch(params) {
  const root = document.createElement('section');
  root.className = 'search-view';

  const initialQuery = params?.q ? decodeURIComponent(params.q) : '';
  const initialTranslation = (params?.t && TRANSLATIONS.some(t => t.id === params.t))
    ? params.t : getPrimaryTranslation();

  root.innerHTML = `
    <div class="search-head">
      <h1>구절 검색</h1>
      <p class="search-hint">선택한 역본 전체에서 검색어가 포함된 절을 찾습니다.</p>
    </div>
    <form class="search-form" autocomplete="off">
      <input type="search" class="search-input" placeholder="검색어 (예: 사랑, kingdom)" required>
      <select class="search-translation" aria-label="검색 역본">
        ${TRANSLATIONS.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}
      </select>
      <button type="submit" class="search-submit">검색</button>
    </form>
    <div class="search-status" aria-live="polite"></div>
    <div class="search-results"></div>
  `;

  const input = root.querySelector('.search-input');
  const select = root.querySelector('.search-translation');
  const form = root.querySelector('.search-form');
  const status = root.querySelector('.search-status');
  const resultsEl = root.querySelector('.search-results');

  select.value = initialTranslation;
  if (initialQuery) input.value = initialQuery;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    doSearch();
  });

  // Auto-run if URL had query (deep link or back-nav)
  if (initialQuery) {
    queueMicrotask(doSearch);
  } else {
    // Focus the search input on first visit
    setTimeout(() => input.focus(), 0);
  }

  let searchToken = 0;

  async function doSearch() {
    const query = input.value.trim();
    const translation = select.value;
    if (!query) return;

    const myToken = ++searchToken;

    // Update URL silently so back/forward works
    const newHash = `#/search/${translation}/${encodeURIComponent(query)}`;
    if (location.hash !== newHash) {
      history.replaceState(null, '', newHash);
    }

    status.textContent = '검색 시작…';
    resultsEl.innerHTML = '';

    const start = performance.now();
    const results = await searchTranslation(query, translation, (loaded, total) => {
      if (myToken !== searchToken) return;
      const pct = Math.round(loaded / total * 100);
      status.textContent = `검색 중… ${loaded}/${total} 책 (${pct}%)`;
    });

    if (myToken !== searchToken) return; // user started another search

    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    const tName = TRANSLATIONS.find(t => t.id === translation)?.label ?? translation;
    if (results.length === 0) {
      status.textContent = `[${tName}] "${query}" — 결과 없음 (${elapsed}초)`;
    } else {
      status.textContent = `[${tName}] "${query}" — ${results.length}건 (${elapsed}초)`;
    }

    renderResults(resultsEl, results, query, translation);
  }

  return root;
}

const MAX_RESULTS_DISPLAYED = 500;

function renderResults(container, results, query, translation) {
  container.innerHTML = '';
  if (results.length === 0) return;

  const lang = TRANSLATIONS.find(t => t.id === translation)?.lang || 'ko';
  const limited = results.slice(0, MAX_RESULTS_DISPLAYED);

  for (const r of limited) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'search-result lang-' + lang;
    card.setAttribute('aria-label', `${bookKo(r.book)} ${r.chapter}장 ${r.verse}절`);

    const refEl = document.createElement('div');
    refEl.className = 'result-ref';
    refEl.textContent = `${bookKo(r.book)} ${r.chapter}:${r.verse}`;

    const textEl = document.createElement('div');
    textEl.className = 'result-text';
    const before = r.text.slice(0, r.matchIndex);
    const match = r.text.slice(r.matchIndex, r.matchIndex + r.matchLen);
    const after = r.text.slice(r.matchIndex + r.matchLen);
    textEl.appendChild(document.createTextNode(before));
    const mark = document.createElement('mark');
    mark.textContent = match;
    textEl.appendChild(mark);
    textEl.appendChild(document.createTextNode(after));

    card.appendChild(refEl);
    card.appendChild(textEl);
    card.addEventListener('click', () => {
      navigate(`/read/${r.book}/${r.chapter}/${r.verse}`);
    });
    container.appendChild(card);
  }

  if (results.length > MAX_RESULTS_DISPLAYED) {
    const more = document.createElement('div');
    more.className = 'search-more';
    more.textContent = `… 그 외 ${results.length - MAX_RESULTS_DISPLAYED}건. 검색어를 더 구체적으로 입력해보세요.`;
    container.appendChild(more);
  }
}
