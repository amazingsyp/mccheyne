# 맥체인 성경읽기표 웹앱

365일 맥체인 성경읽기표를 4개 역본(개역개정, 새번역, NLT, KJV)으로 비교하며 읽을 수 있는 Vanilla HTML/CSS/JS 정적 웹앱.

## 하네스: 맥체인 웹앱

**목표:** Vanilla HTML/CSS/JS만으로 작동하는 맥체인 성경읽기표 웹앱을 구축·운영한다. 빌드 도구 없이 정적 호스팅에 배포 가능해야 한다.

**트리거:** 맥체인 표·성경 역본 비교·웹앱 관련 작업 요청 시 `mccheyne-orchestrator` 스킬을 사용하라. 단순 질문(예: "이 코드 무슨 뜻이야?")은 직접 응답 가능.

**스택 결정 (불변):**
- 데이터 소스 우선 조사 후 결정 (저작권 이슈는 사용자 명시 지시로 무시)
- Vanilla HTML/CSS/JS (빌드 도구 없음)
- 정적 호스팅 배포 (Hash 기반 라우팅)
- 절 단위 정렬 비교 UI

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-05-18 | 초기 구성 | 전체 | 맥체인 웹앱 하네스 구축 |
| 2026-05-18 | 1차 구현 완료 | index.html, styles/, scripts/, data/ | Today/Calendar/Reader 3개 뷰, 4역본 비교 작동 |
| 2026-05-18 | 4역본 전체 데이터 수집 (4756 chapter) | data/bible/{kjv,nlt,nkrv,nksv}/ | KJV/NLT bolls.life, NKRV/NKSV bskorea.or.kr |
| 2026-05-18 | bskorea 요나서 코드 패치 | scripts/build/fetch_bible.py | bskorea가 'jon' 대신 'jnh' 사용 |
| 2026-05-18 | Reader 로딩 메시지 잔존 버그 수정 | scripts/views/reader.js | appendChild → replaceChildren |
| 2026-05-18 | 성경 본문 메뉴 추가 (책→장 드릴다운) | scripts/views/bible.js, scripts/data/books.js, index.html, components.css | 맥체인 표 외 자유 탐색 |
| 2026-05-18 | 주/부 역본 개념 + 모바일 적층 레이아웃 | scripts/data/bible.js, scripts/views/reader.js, styles/components.css | 모바일 가로스크롤 대신 절마다 적층, 주 역본 강조 |
| 2026-05-18 | GitHub 배포 (public repo + Pages) | .gitignore, .nojekyll | Free plan은 private+Pages 미지원 → public 전환, https://amazingsyp.github.io/mccheyne/ |
