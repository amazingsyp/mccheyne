export const TRANSLATIONS = [
  { id: 'nkrv', label: '개역개정', lang: 'ko' },
  { id: 'nksv', label: '새번역', lang: 'ko' },
  { id: 'kkjv', label: '한킹제임스', lang: 'ko' },
  { id: 'nlt', label: 'NLT', lang: 'en' },
  { id: 'kjv', label: 'KJV', lang: 'en' },
];

const bookCache = new Map();

export function loadBook(translation, book) {
  const key = `${translation}/${book}`;
  if (!bookCache.has(key)) {
    bookCache.set(key, fetch(`./data/bible/${translation}/${book}.json`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`${key}: HTTP ${r.status}`)))
      .catch(err => {
        bookCache.delete(key);
        throw err;
      }));
  }
  return bookCache.get(key);
}

export async function loadChapter(translation, book, chapter) {
  try {
    const data = await loadBook(translation, book);
    return data?.chapters?.[String(chapter)] ?? null;
  } catch {
    return null;
  }
}

/** Load chapter across multiple translations in parallel. Returns
 * { [translationId]: { [verseNum]: text } | null }
 */
export async function loadChapters(translations, book, chapter) {
  const entries = await Promise.all(
    translations.map(async t => [t, await loadChapter(t, book, chapter)])
  );
  return Object.fromEntries(entries);
}

/** Get sorted list of all verse numbers (as integers) appearing in any translation. */
export function unionVerseNumbers(chapterMap) {
  const set = new Set();
  for (const tid of Object.keys(chapterMap)) {
    const ch = chapterMap[tid];
    if (ch) for (const v of Object.keys(ch)) set.add(parseInt(v, 10));
  }
  return Array.from(set).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
}

const PREF_KEY = 'mccheyne.translations.v1';
const PRIMARY_KEY = 'mccheyne.translation.primary.v1';

export function getSelectedTranslations() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(t => TRANSLATIONS.some(x => x.id === t));
      }
    }
  } catch {}
  return ['nkrv', 'nksv', 'kkjv', 'nlt', 'kjv'];
}

export function setSelectedTranslations(ids) {
  const valid = ids.filter(t => TRANSLATIONS.some(x => x.id === t));
  if (valid.length === 0) return; // never allow zero
  // Ensure primary is in the selection — if not, fall back to first selected.
  const primary = getPrimaryTranslation();
  if (!valid.includes(primary)) {
    setPrimaryTranslation(valid[0]);
  }
  localStorage.setItem(PREF_KEY, JSON.stringify(valid));
}

export function getPrimaryTranslation() {
  try {
    const raw = localStorage.getItem(PRIMARY_KEY);
    if (raw && TRANSLATIONS.some(t => t.id === raw)) return raw;
  } catch {}
  return 'nkrv';
}

export function setPrimaryTranslation(id) {
  if (!TRANSLATIONS.some(t => t.id === id)) return;
  try { localStorage.setItem(PRIMARY_KEY, id); } catch {}
}

/** Search a translation for substring matches.
 * @param {string} query - search term (case-sensitive for now)
 * @param {string} translationId - one of TRANSLATIONS ids
 * @param {function(loaded, total)} onProgress - called after each book loaded
 * @returns {Promise<Array<{book, chapter, verse, text, matchIndex, matchLen}>>}
 */
export async function searchTranslation(query, translationId, onProgress) {
  if (!query || !translationId) return [];
  const { BOOKS } = await import('./books.js');
  const total = BOOKS.length;
  let loaded = 0;
  const results = [];

  // Concurrency-controlled fan-out across books.
  const queue = BOOKS.slice();
  async function worker() {
    while (queue.length > 0) {
      const book = queue.shift();
      if (!book) break;
      try {
        const data = await loadBook(translationId, book.code);
        if (data?.chapters) {
          for (const chapKey of Object.keys(data.chapters)) {
            const verses = data.chapters[chapKey];
            for (const vKey of Object.keys(verses)) {
              const text = verses[vKey];
              const idx = text.indexOf(query);
              if (idx !== -1) {
                results.push({
                  book: book.code,
                  chapter: parseInt(chapKey, 10),
                  verse: parseInt(vKey, 10),
                  text,
                  matchIndex: idx,
                  matchLen: query.length,
                });
              }
            }
          }
        }
      } catch { /* skip missing books silently */ }
      loaded++;
      onProgress?.(loaded, total);
    }
  }
  const CONCURRENCY = 6;
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // Sort results in canonical book order, then chapter, then verse.
  const order = new Map(BOOKS.map((b, i) => [b.code, i]));
  results.sort((a, b) => {
    const oa = order.get(a.book) ?? 999;
    const ob = order.get(b.book) ?? 999;
    if (oa !== ob) return oa - ob;
    if (a.chapter !== b.chapter) return a.chapter - b.chapter;
    return a.verse - b.verse;
  });
  return results;
}
