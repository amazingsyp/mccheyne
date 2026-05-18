# 맥체인 성경읽기 (McCheyne Bible Reading)

365일 맥체인 성경읽기표를 4역본(개역개정 · 새번역 · NLT · KJV)으로 비교하며 읽는 정적 웹앱.

## 특징

- **365일 맥체인 표** — 매일 4구절(가족 OT/NT, 개인 OT/NT)
- **캘린더 뷰** — 월별 진도 시각화, 어느 날이든 점프
- **4역본 비교** — 절 단위 가로 정렬, 1~4개 자유 선택
- **진도 추적** — 슬롯 단위 체크, localStorage 자동 저장
- **빌드 도구 없음** — `index.html`만 있으면 동작

## 사용

### 정적 호스팅에 배포
`index.html`, `styles/`, `scripts/`, `data/`를 그대로 업로드. GitHub Pages, Vercel, Netlify 등 어디든 가능.

### 로컬 실행
`file://` 프로토콜에서는 CORS로 fetch가 막힘. 간단한 정적 서버를 띄운다.

```bash
# Python 3 (대부분 설치되어 있음)
python3 -m http.server 8000
# 또는 Node
npx serve .
```

브라우저에서 `http://localhost:8000` 접속.

### 키보드 단축키
- `←` / `→` — 이전/다음 날 (Today 뷰) 또는 이전/다음 장 (Reader 뷰)
- `T` — 오늘로
- `C` — 캘린더로

## 데이터 다운로드

저장소에 포함된 데이터(`data/bible/`)는 일부(첫 며칠치)만 있을 수 있다.
전체 365일치를 받으려면:

```bash
# 모든 역본, 모든 장 (약 30-40분 소요)
python3 scripts/build/fetch_bible.py --skip-existing

# 특정 역본만
python3 scripts/build/fetch_bible.py --translations kjv,nlt --skip-existing

# 첫 30일치만 (테스트용)
python3 scripts/build/fetch_bible.py --days 30 --skip-existing
```

진행 로그: `_workspace/data/fetch.log`

## 파일 구조

```
mccheyne/
├── index.html
├── styles/
│   ├── tokens.css       # CSS 변수 (디자인 시스템)
│   ├── base.css         # reset + 타이포
│   ├── layout.css       # 헤더/푸터/뷰 레이아웃
│   └── components.css   # 카드, 캘린더, 비교 테이블
├── scripts/
│   ├── main.js          # 진입점
│   ├── router.js        # 해시 라우터
│   ├── data/
│   │   ├── plan.js      # 맥체인 plan 로딩
│   │   └── bible.js     # 본문 lazy loading + 캐싱
│   ├── state/
│   │   └── progress.js  # localStorage 진도 저장
│   ├── views/
│   │   ├── today.js     # 일별 뷰
│   │   ├── calendar.js  # 캘린더 뷰
│   │   └── reader.js    # 본문 + 역본 비교
│   └── build/           # 데이터 빌드 도구 (Python)
│       ├── parse_plan.py
│       └── fetch_bible.py
└── data/
    ├── mccheyne-plan.json
    └── bible/
        ├── kjv/{BOOK}.json
        ├── nlt/{BOOK}.json
        ├── nkrv/{BOOK}.json
        └── nksv/{BOOK}.json
```

## 라이선스

본문 데이터의 저작권은 각 발행처에 있습니다.
- 개역개정·새번역: 대한성서공회
- NLT: Tyndale House Publishers
- KJV: 퍼블릭 도메인

개인적 묵상·학습 목적으로만 사용하세요.
