import { BOOKS_OT, BOOKS_NT, bookInfo, chapterCount } from '../data/books.js';
import { navigate } from '../router.js';

export async function renderBible(params) {
  if (params?.book) {
    return renderChapterList(params.book.toUpperCase());
  }
  return renderBookList();
}

function renderBookList() {
  const root = document.createElement('section');
  root.className = 'bible-view';

  root.innerHTML = `
    <div class="bible-head">
      <h1>성경 본문</h1>
      <p class="bible-sub">책을 선택하면 장 목록이 나타납니다.</p>
    </div>
  `;

  for (const [title, books] of [['구약 (39권)', BOOKS_OT], ['신약 (27권)', BOOKS_NT]]) {
    const group = document.createElement('section');
    group.className = 'book-group';
    const h = document.createElement('h2');
    h.className = 'book-group-title';
    h.textContent = title;
    group.appendChild(h);

    const grid = document.createElement('div');
    grid.className = 'book-grid';
    for (const b of books) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'book-button';
      btn.innerHTML = `
        <span class="book-name">${b.ko}</span>
        <span class="book-meta">${b.chapters}장 · ${b.code}</span>
      `;
      btn.addEventListener('click', () => navigate(`/bible/${b.code}`));
      grid.appendChild(btn);
    }
    group.appendChild(grid);
    root.appendChild(group);
  }
  return root;
}

function renderChapterList(bookCode) {
  const info = bookInfo(bookCode);
  if (!info) {
    throw new Error(`알 수 없는 책 코드: ${bookCode}`);
  }
  const max = chapterCount(bookCode);

  const root = document.createElement('section');
  root.className = 'bible-view';

  root.innerHTML = `
    <div class="bible-head with-back">
      <button type="button" class="reader-back" data-action="back">← 책 목록</button>
      <div>
        <h1>${info.ko}</h1>
        <p class="bible-sub">${info.en} · ${max}장 · ${bookCode}</p>
      </div>
    </div>
  `;

  root.querySelector('[data-action="back"]').addEventListener('click', () => {
    navigate('/bible');
  });

  const grid = document.createElement('div');
  grid.className = 'chapter-grid';
  for (let c = 1; c <= max; c++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chapter-button';
    btn.textContent = String(c);
    btn.setAttribute('aria-label', `${info.ko} ${c}장`);
    btn.addEventListener('click', () => navigate(`/read/${bookCode}/${c}`));
    grid.appendChild(btn);
  }
  root.appendChild(grid);
  return root;
}
