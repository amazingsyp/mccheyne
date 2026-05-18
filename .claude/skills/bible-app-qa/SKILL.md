---
name: bible-app-qa
description: 맥체인 웹앱의 데이터 정합성과 UI 기능을 점진적으로 검증하는 QA 방법론. integration-qa 에이전트가 데이터-UI 경계면 버그, 절 정렬 불일치, 라우팅 문제, 반응형 깨짐을 발견할 때 반드시 사용한다. "QA", "검증", "테스트", "버그 리포트", "정합성 검증", "맥체인 테스트", "역본 비교 검증" 관련 작업 시 트리거.
---

# Bible App QA

데이터 레이어와 UI 레이어의 경계에서 발생하는 정합성 문제를 점진적으로 잡아낸다.

## 핵심 원칙

1. **점진적 검증** — 모듈 하나 완성될 때마다 즉시 검증. 전체 완성 후 한 번에 검증하면 누적 버그로 디버깅 비용 폭증.
2. **경계면 교차 비교** — 데이터 정의(JSON)와 데이터 소비(JS)를 동시에 열고 shape을 비교. 단일 파일만 보면 불일치를 놓친다.
3. **실행 기반 검증** — 정적 분석 + 실제 브라우저 렌더링 + 인터랙션 검증.
4. **샘플 케이스 사전 정의** — 검증 전 "이 케이스를 통과하면 합격"이라는 구체적 시나리오를 먼저 정한다.

## 검증 시나리오 (사전 정의)

검증을 시작하기 전 다음 시나리오를 `test-scenarios.md`에 기록한다.

### S1. 기본 진입
- 사이트 진입 → Today View 표시
- 오늘 날짜와 4구절(가족 OT/NT, 개인 OT/NT) 표시
- 진도 0% 표시

### S2. 본문 보기 (단일 역본)
- 카드 클릭 → Reader View 진입
- 기본 역본(예: 개역개정) 본문 표시
- 절 번호 1부터 끝까지 누락 없음

### S3. 역본 비교 (다중 선택)
- Reader View에서 추가 역본 체크박스 클릭
- 컬럼 추가되어 절 단위 가로 정렬
- 한 절이 길어도 다른 역본 절과 같은 행 유지 (vertical-align: top)
- 최소 1개 역본 항상 표시(전부 해제 불가)

### S4. 날짜 네비게이션
- Today View에서 좌우 화살표 → 어제/내일 4구절로 변경
- Calendar View → 임의 날짜 클릭 → 해당 일자 Today View
- 1년 시작(1/1)과 끝(12/31) 경계 확인

### S5. 진도 추적
- 카드 체크 → 체크 상태 시각화
- 새로고침 후에도 체크 유지
- Calendar 셀에 진도 게이지 반영

### S6. 반응형
- 360px 폭: 모든 뷰 깨짐 없음
- 768px 폭: 4구절 카드 2열 배치
- 1280px 폭: 4역본 동시 비교 가독성 OK

## 경계면 버그 패턴 (집중 체크)

다음 패턴은 데이터-UI 경계에서 자주 발생한다. 검증 시 우선 점검.

| 패턴 | 검증 방법 |
|------|----------|
| 책 코드 대소문자 ("GEN" vs "gen") | plan.json과 bible/*.json의 책 코드를 grep으로 추출, diff |
| 절 번호 타입 (`1` vs `"1"`) | JSON.parse 후 typeof 검증 |
| 날짜 0/1-indexed 혼동 | day=1이 1월 1일과 일치하는지 |
| 빈 절(누락된 절 번호) | 1부터 끝까지 시퀀스 확인, 누락 시 verse-mapping.json 존재 여부 |
| 시편 절 매핑 차이 | 시 3, 시 51 등 역본 간 다른 절 번호 비교 |
| Reader URL 직접 접근 | `#/read/GEN/1` 같은 URL을 직접 입력해도 작동하는지 |
| 캐시 stale | 같은 책 두 번 로드 시 캐시 작동, 새로고침 시 재로드 확인 |
| localStorage 초과 | 모든 365일 슬롯 체크 시 setItem 실패 없는지 |

## 검증 도구

### 1. JSON 데이터 검증 (스크립트)
간단한 Node.js 또는 브라우저 콘솔 스크립트로 정합성 검증.

```js
// 의사코드 — 실제 검증 시 작성
const plan = await fetch('./data/mccheyne-plan.json').then(r=>r.json());
const translations = ['krv', 'nkrv', 'nlt', 'kjv'];

// 모든 plan 구절이 모든 역본에 존재하는지
for (const entry of plan) {
  for (const slot of ['family_ot','family_nt','secret_ot','secret_nt']) {
    const { book, chapter } = entry[slot];
    for (const t of translations) {
      const data = await fetch(`./data/bible/${t}/${book}.json`).then(r=>r.json());
      if (!data.chapters?.[chapter]) {
        console.error(`Missing: ${t}/${book}/${chapter} for day ${entry.day}`);
      }
    }
  }
}
```

### 2. UI 검증 (브라우저)
- `document-skills:webapp-testing` 스킬 활용 시 Playwright로 자동화
- 수동으로 할 경우: Chrome DevTools 디바이스 에뮬레이션으로 360/768/1280px 순회
- console에 error/warning 0건 목표

### 3. 시각 회귀
- 핵심 화면 3개(Today, Calendar, Reader) 스크린샷 보관
- 수정 후 비교, 의도하지 않은 변경 발견

## 산출물

`_workspace/qa/`에 다음 파일 생성:

### `test-scenarios.md`
검증 시작 전 정의한 시나리오 목록. 위 S1-S6 + 프로젝트 특화 시나리오.

### `test-report.md`
각 시나리오의 통과/실패 결과. 형식:
```markdown
## S3. 역본 비교 (다중 선택)
- [x] 컬럼 추가 작동
- [x] 가로 정렬 유지
- [ ] **실패**: NLT만 단독 선택 시 KJV 체크박스도 동시에 변경됨 → reader.js:142 이벤트 핸들러 버그
- [x] 최소 1개 보장
```

### `issues.md`
발견된 모든 이슈, 우선순위, 담당자.
```markdown
## ISSUE-001: 역본 체크박스 이벤트 핸들러 오작동
- 심각도: P1 (핵심 기능)
- 담당: web-implementer
- 재현: Reader View에서 NLT 체크박스 클릭 시 KJV도 토글됨
- 원인 추정: 이벤트 위임 selector가 너무 광범위
- 수정 요청: scripts/views/reader.js:142 이벤트 핸들러 selector를 `input[data-translation]`로 한정
```

## 점진적 QA 워크플로우

`web-implementer`가 모듈 완성을 알릴 때마다 다음을 즉시 수행:

1. **데이터 큐레이터 완료 시**
   - JSON 스키마 검증
   - 365일 plan 전체 4구절 정의 확인
   - 4역본 책 코드 일치 확인 (특히 시편, 시편 일부)

2. **Today View 완성 시**
   - S1, S5 검증
   - 좌우 네비게이션 경계 (1/1, 12/31) 확인

3. **Calendar View 완성 시**
   - S4 검증
   - 진도 게이지 시각화 정확도

4. **Reader View 완성 시**
   - S2, S3 검증
   - 절 정렬 시각 검증
   - 시편/예외 본문에서 절 매핑 확인

5. **반응형 검증**
   - 모든 뷰 완성 후 S6 일괄 점검

## 에러 핸들링

- **수정 거부**: 담당 에이전트가 수정 불가 보고 시 → 오케스트레이터에 에스컬레이션 + 사용자 결정 요청
- **반복 수정 루프**: 같은 이슈 3회 반복 미해결 → 근본 원인이 다른 모듈일 가능성, 인접 모듈 코드 리뷰
- **검증 불가**: 외부 의존(API down 등)으로 확인 불가 → 한계 명시 + 수동 검증 요청
