---
name: bible-data-pipeline
description: 맥체인 성경읽기표와 4개 역본(개역개정, 새번역, NLT, KJV) 본문 데이터를 발굴·수집·정규화하기 위한 스킬. bible-data-curator 에이전트가 데이터 소스를 조사하거나, 새로운 역본을 추가하거나, JSON 스키마를 정의/갱신할 때 반드시 이 스킬을 사용한다. "성경 데이터", "역본 추가", "Bible API", "맥체인 데이터", "JSON 스키마" 관련 작업 시 트리거.
---

# Bible Data Pipeline

성경 본문 데이터와 맥체인 읽기표 데이터를 확보하고 표준화하는 파이프라인.

## 데이터 소스 후보

4개 역본을 모두 또는 일부 제공하는 알려진 소스를 우선 조사한다. 단일 소스로 4역본을 다 받을 수 없을 가능성이 높으므로, 한·영 분리 조합을 기본 전략으로 둔다.

### 영문 (NLT, KJV)
- **bolls.life API** (`https://bolls.life/get-text/{translation}/{book}/{chapter}/`): KJV 무료, NLT 포함 가능. 책 번호 1-66 매핑 필요.
- **bible-api.com**: KJV/WEB/BBE 등 무료, NLT 미지원.
- **api.bible (Scripture.api.bible)**: NLT 등 다수, 무료 API 키 필요.
- **getbible.net v2**: KJV 등, JSON 응답 단순.

### 한글 (개역개정, 새번역)
- **bolls.life**: KRV(개역) 제공, 개역개정/새번역 포함 여부 확인 필요.
- **bible.com (YouVersion)**: 공식 API 없음, 비공식 스크래핑 비추.
- **bskorea.or.kr (대한성서공회)**: 공식 데이터, 공개 API 없음.
- **GitHub bible-data 리포지토리**: 검색어 "개역개정 json", "새번역 bible json"으로 커뮤니티 덤프 탐색.

> **저작권 주의:** 사용자가 "저작권 무시"라고 명시했으므로 데이터 확보 가능성을 우선한다. 단, `sources.md`에 라이선스/저작권 상태를 정직하게 기록한다.

## 조사 워크플로우

1. **연결성 테스트** — 각 API에 1회 호출하여 응답 형식·인코딩(UTF-8)·접근 가능 여부 확인.
2. **샘플 비교** — 창세기 1:1을 4역본 모두 가져와 절 정렬·텍스트 품질 비교.
3. **커버리지 확인** — 4역본의 책 코드, 장수, 절 매핑이 일치하는지 검증.
4. **소스 선정** — 최소 호출 수, 최고 안정성으로 4역본을 얻는 조합 결정.
5. **벌크 수집** — 전체 성경(또는 맥체인이 다루는 범위)을 수집하여 JSON으로 저장.

## 맥체인 읽기표

365일 × 4구절(가족 OT/NT, 개인 OT/NT) 구조. 1842년 Robert Murray McCheyne가 만든 유서 깊은 표로, 공유 데이터로 자유롭게 구할 수 있다.

### 데이터 출처
- Wikipedia: "M'Cheyne Reading Plan"에서 전체 표 확인 가능
- esv.org, bible-gateway, mcheyne.info에서 PDF/JSON 형태 제공
- GitHub: "mccheyne reading plan json" 검색

### 표준 스키마
```json
[
  {
    "day": 1,
    "date_md": "01-01",
    "family_ot": {"book": "GEN", "chapter": 1},
    "family_nt": {"book": "MAT", "chapter": 1},
    "secret_ot": {"book": "EZR", "chapter": 1},
    "secret_nt": {"book": "ACT", "chapter": 1}
  },
  ...
]
```

> 맥체인 표는 윤년·시작일 등의 변형이 존재. 가장 보편적인 1월 1일 시작·2월 29일 생략 버전을 기본으로 한다.

## 표준 JSON 스키마

모든 데이터 파일은 다음 스키마를 따른다.

### `mccheyne-plan.json`
위 "표준 스키마" 참조. 365개 객체의 배열.

### `bible/{translation}.json` (단일 파일 방식)
```json
{
  "translation": "krv",
  "name": "개역개정",
  "language": "ko",
  "books": {
    "GEN": {
      "name": "창세기",
      "chapters": {
        "1": {
          "1": "태초에 하나님이 천지를 창조하시니라",
          "2": "땅이 혼돈하고 공허하며...",
          ...
        },
        ...
      }
    },
    ...
  }
}
```

### `bible/{translation}/{book}.json` (분할 방식 — 권장, lazy loading 용이)
```json
{
  "translation": "krv",
  "book": "GEN",
  "name": "창세기",
  "chapters": {
    "1": {"1": "...", "2": "..."},
    ...
  }
}
```

### 책 코드 표준 (SBL 3글자)
```
구약: GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL
신약: MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV
```

## 검증 규칙

1. **인코딩**: 모든 JSON 파일은 UTF-8, BOM 없음.
2. **절 번호 일관성**: 같은 구절(예: 시 5)에서 4역본 절 번호가 다르면 `verse-mapping.json`에 매핑 기록.
3. **누락 절**: 빈 객체나 빈 문자열로 두지 않고 키 자체를 생략. UI가 누락을 명시적으로 인지하도록.
4. **결정적 정렬**: JSON 객체 키를 정수 정렬, JSON.stringify 시 `sort_keys=true` 의도로 출력.

## 산출물

`_workspace/data/` 디렉토리에 다음 파일 생성:
- `sources.md` — 발굴 소스 + 평가 + 최종 선택 근거
- `mccheyne-plan.json` — 365일 읽기표
- `bible/{translation}/{book}.json` × 66권 × 4역본 (총 264 파일) 또는 단일 파일 방식
- `schema.md` — 위 스키마 명세 복사본
- `verse-mapping.json` — 역본 간 절 번호 불일치 매핑 (필요 시)
