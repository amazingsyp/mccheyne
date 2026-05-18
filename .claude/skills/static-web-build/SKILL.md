---
name: static-web-build
description: 빌드 도구 없이 Vanilla HTML/CSS/JS만으로 정적 웹앱을 구축하는 패턴. web-implementer 에이전트가 맥체인 웹앱의 HTML/CSS/JavaScript 코드를 작성하거나, ES Module 구조를 설계하거나, JSON 데이터를 lazy loading 하거나, 클라이언트 라우팅을 구현할 때 반드시 사용한다. "vanilla JS", "정적 웹앱", "빌드 없이", "ES Module", "hash router", "JSON lazy load", "localStorage" 관련 작업 시 트리거.
---

# Static Web Build

빌드 도구(webpack, vite, tsc, etc.) 없이 정적 파일만으로 작동하는 웹앱 구축 패턴.

## 핵심 제약

1. **No build step** — `index.html`을 정적 호스팅에 올리면 끝. `npm install` 불필요.
2. **ES Modules** — `<script type="module">`로 모듈 시스템 활용. import map은 사용 안 함(불필요한 복잡도).
3. **외부 의존성 최소** — 폰트 CDN(Google Fonts) 정도. JS 라이브러리는 원칙적으로 X. 꼭 필요하면 ESM CDN(esm.sh, jsdelivr) 통해 import.
4. **Browser-native API 우선** — fetch, localStorage, URL, IntersectionObserver, ResizeObserver 등.

## 파일 구조 (권장)

```
mccheyne/
├── index.html
├── styles/
│   ├── tokens.css
│   ├── base.css
│   ├── layout.css
│   └── components.css
├── scripts/
│   ├── main.js            # 진입점
│   ├── router.js
│   ├── views/
│   │   ├── today.js
│   │   ├── calendar.js
│   │   └── reader.js
│   ├── data/
│   │   ├── plan.js
│   │   └── bible.js
│   └── state/
│       └── progress.js
├── data/                  # 큐레이터 산출 JSON
│   ├── mccheyne-plan.json
│   └── bible/
│       └── {translation}/
│           └── {book}.json
└── README.md
```

## HTML 진입점

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>맥체인 성경읽기표</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&family=Noto+Sans+KR:wght@400;500&family=Lora:wght@400;700&display=swap">
  <link rel="stylesheet" href="./styles/tokens.css">
  <link rel="stylesheet" href="./styles/base.css">
  <link rel="stylesheet" href="./styles/layout.css">
  <link rel="stylesheet" href="./styles/components.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./scripts/main.js"></script>
</body>
</html>
```

## 라우팅 (Hash-based)

History API는 정적 호스팅(예: GitHub Pages)에서 404를 일으킬 수 있다. **Hash 기반 라우팅을 기본으로 한다.**

```js
// scripts/router.js
const routes = new Map();

export function register(pattern, handler) {
  // pattern: '/today', '/calendar/:ym', '/read/:book/:chapter'
  routes.set(pattern, handler);
}

function parseHash() {
  const hash = location.hash.slice(1) || '/today';
  return hash;
}

function matchRoute(path) {
  for (const [pattern, handler] of routes) {
    const params = matchPattern(pattern, path);
    if (params) return { handler, params };
  }
  return null;
}

function matchPattern(pattern, path) {
  const pParts = pattern.split('/').filter(Boolean);
  const aParts = path.split('/').filter(Boolean);
  if (pParts.length !== aParts.length) return null;
  const params = {};
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) {
      params[pParts[i].slice(1)] = decodeURIComponent(aParts[i]);
    } else if (pParts[i] !== aParts[i]) {
      return null;
    }
  }
  return params;
}

export function start() {
  const dispatch = () => {
    const path = parseHash();
    const match = matchRoute(path);
    if (match) {
      match.handler(match.params);
    } else {
      location.hash = '#/today';
    }
  };
  window.addEventListener('hashchange', dispatch);
  dispatch();
}

export function navigate(path) {
  location.hash = '#' + path;
}
```

## 데이터 Lazy Loading

4역본 전체를 한 번에 로딩하면 수십 MB. **책 단위로 lazy load + 메모리 캐싱.**

```js
// scripts/data/bible.js
const cache = new Map();  // key: "krv/GEN" → Promise<book data>

export async function loadBook(translation, bookCode) {
  const key = `${translation}/${bookCode}`;
  if (!cache.has(key)) {
    const promise = fetch(`./data/bible/${translation}/${bookCode}.json`)
      .then(r => {
        if (!r.ok) throw new Error(`Failed to load ${key}: ${r.status}`);
        return r.json();
      });
    cache.set(key, promise);
  }
  return cache.get(key);
}

export async function loadChapter(translation, bookCode, chapter) {
  const book = await loadBook(translation, bookCode);
  return book.chapters[String(chapter)] ?? null;
}

export async function loadVerse(translation, bookCode, chapter, verse) {
  const ch = await loadChapter(translation, bookCode, chapter);
  return ch?.[String(verse)] ?? null;
}
```

### 동시 로딩 패턴 (역본 비교 시)
```js
async function loadAllSelected(bookCode, chapter, translations) {
  const results = await Promise.all(
    translations.map(t =>
      loadChapter(t, bookCode, chapter).then(ch => ({ translation: t, chapter: ch }))
    )
  );
  return Object.fromEntries(results.map(r => [r.translation, r.chapter]));
}
```

## 상태 저장 (localStorage)

진도와 사용자 설정을 localStorage에 저장.

```js
// scripts/state/progress.js
const STORAGE_KEY = 'mccheyne.progress.v1';

export function getProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

export function setSlotRead(day, slotIndex, isRead) {
  const progress = getProgress();
  progress[day] = progress[day] ?? [false, false, false, false];
  progress[day][slotIndex] = isRead;
  if (progress[day].every(v => !v)) delete progress[day];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function getProgressRatio() {
  const progress = getProgress();
  let read = 0;
  for (const day in progress) read += progress[day].filter(Boolean).length;
  return read / (365 * 4);
}
```

### 용량 관리
- localStorage 한도: 보통 5-10MB
- 진도 JSON 최대 크기: 365일 × 4슬롯 × ~10바이트 = ~15KB. 안전.
- 더 많은 데이터(메모 등) 추가 시 IndexedDB 고려.

## 절 단위 정렬 테이블

핵심 UI. CSS Grid 또는 Table로 구현 가능. Table이 의미론적으로 적절.

```html
<table class="verse-table">
  <thead>
    <tr>
      <th class="verse-num">#</th>
      <th>개역개정</th>
      <th>새번역</th>
      <th>NLT</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="verse-num">1</td>
      <td>태초에 하나님이 천지를 창조하시니라</td>
      <td>한처음에 하나님께서 하늘과 땅을 창조하셨다.</td>
      <td>In the beginning God created the heavens and the earth.</td>
    </tr>
    ...
  </tbody>
</table>
```

```css
.verse-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.verse-table th,
.verse-table td {
  vertical-align: top;
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--border);
  line-height: var(--line-body);
}
.verse-num {
  width: 3rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
@media (max-width: 600px) {
  .verse-table { display: block; overflow-x: auto; }
  .verse-table th, .verse-table td { min-width: 12rem; }
}
```

## 동적 렌더링 (프레임워크 없이)

뷰 함수는 DOM을 직접 만들어 `#app`에 주입한다. innerHTML 사용 시 XSS 주의 — 본문 데이터는 신뢰하더라도 사용자 입력은 escape.

```js
// scripts/views/today.js
import { loadPlan } from '../data/plan.js';
import { getProgress, setSlotRead } from '../state/progress.js';

export async function renderToday(params) {
  const app = document.getElementById('app');
  const today = new Date();
  const dayOfYear = getDayOfYear(today);
  const plan = await loadPlan();
  const entry = plan[dayOfYear - 1];

  app.innerHTML = `
    <header class="app-header">...</header>
    <main class="today-view">
      <h1>${formatDate(today)}</h1>
      <div class="card-grid">
        ${renderCard('가족 (구약)', entry.family_ot, dayOfYear, 0)}
        ${renderCard('가족 (신약)', entry.family_nt, dayOfYear, 1)}
        ${renderCard('개인 (구약)', entry.secret_ot, dayOfYear, 2)}
        ${renderCard('개인 (신약)', entry.secret_nt, dayOfYear, 3)}
      </div>
    </main>
  `;
  // 이벤트 바인딩...
}
```

## 로컬 실행

`file://` 프로토콜에서 fetch가 CORS로 막힘. README에 다음 안내:
```bash
# Python 3
python -m http.server 8000
# 또는 Node
npx serve .
# 브라우저에서 http://localhost:8000 열기
```

배포 시(GitHub Pages, Vercel, Netlify)는 위 안내 불필요.

## 성능 체크리스트

- [ ] 초기 JS 번들 < 50KB (vanilla니까 자연스럽게 작음)
- [ ] 초기 데이터 로드: plan.json만 (수십 KB). 본문은 Reader 진입 시 lazy.
- [ ] 폰트 `font-display: swap`
- [ ] 큰 본문은 가상 스크롤 불필요(맥체인은 장 단위라 충분)
- [ ] Lighthouse 90+ 점수 가능한 단순 구조
