---
name: mccheyne-orchestrator
description: 맥체인 성경읽기표 웹앱 프로젝트의 모든 작업을 조율한다. 365일 맥체인 표 데이터, 4개 역본(개역개정/새번역/NLT/KJV) 본문, HTML/CSS/JS 구현, 일별/캘린더/Reader 뷰 설계, 절 단위 역본 비교 UI를 만들거나, 수정하거나, 다시 실행하거나, 부분 개선하거나, 새 역본을 추가하거나, 디자인을 바꾸거나, 데이터 소스를 교체할 때 반드시 이 스킬을 사용한다. "맥체인", "성경읽기표", "Bible reading plan", "역본 비교", "재실행", "업데이트", "보완", "이전 결과 기반" 관련 모든 요청 시 트리거.
---

# McCheyne Orchestrator

맥체인 성경읽기표 웹앱을 만들기 위해 4명의 전문가 에이전트 팀을 조직·운영한다.

## 팀 구성 (에이전트 팀 모드)

| 에이전트 | 역할 | 빌트인 타입 |
|---------|------|------------|
| `bible-data-curator` | 4역본 데이터 + 맥체인 365일 표 확보·정규화 | general-purpose |
| `frontend-designer` | UI/UX 디자인, 정보 구조, 디자인 시스템 | general-purpose |
| `web-implementer` | Vanilla HTML/CSS/JS 구현 | general-purpose |
| `integration-qa` | 데이터-UI 정합성, 기능 검증 | general-purpose |

모든 에이전트는 `model: "opus"`로 호출한다.

## Phase 0: 컨텍스트 확인 (필수 사전 단계)

오케스트레이터 시작 시 가장 먼저 `_workspace/` 존재 여부와 사용자 요청 성격을 확인하여 실행 모드를 결정한다.

```
프로젝트/_workspace/ 존재?
├── 아니오 → 초기 실행 (Phase 1부터 전체 실행)
├── 예 + 사용자가 부분 수정 요청 (예: "캘린더 뷰만 다시", "NLT만 교체")
│         → 부분 재실행 (해당 에이전트만 호출)
├── 예 + 사용자가 새 입력/스펙 변경 요청
│         → 새 실행 (_workspace → _workspace_prev/로 백업 후 Phase 1)
└── 예 + 사용자가 "이어서 진행" 요청
          → 마지막 완료 Phase 확인 후 다음 Phase부터
```

부분 재실행 시 매핑:
- "데이터 다시" / "역본 교체" / "맥체인 표 수정" → `bible-data-curator`
- "디자인 변경" / "레이아웃 수정" / "UI 개선" → `frontend-designer` (+ 구현 영향 시 `web-implementer`)
- "코드 수정" / "버그 픽스" / "기능 추가" → `web-implementer`
- "검증" / "테스트" / "QA" → `integration-qa`

## Phase 1: 팀 구성 및 작업 정의

1. `TeamCreate`로 `mccheyne-team` 팀 생성, 위 4개 에이전트 등록
2. 각 에이전트에 `model: "opus"` 명시
3. `TaskCreate`로 다음 마일스톤 등록 (의존 관계 포함)

### 마일스톤 (초기 실행)

```
M1: 데이터 소스 조사 (bible-data-curator)
  └─ M2: 맥체인 plan + 4역본 데이터 정규화 (bible-data-curator)
       ├─ M3: 디자인 시스템 + 레이아웃 정의 (frontend-designer)
       │    └─ M5: HTML/CSS 기본 구조 구현 (web-implementer)
       │         └─ M6: Today View 구현 (web-implementer)
       │              └─ QA-A: Today View 점진적 QA (integration-qa)
       │                   └─ M7: Calendar View 구현 (web-implementer)
       │                        └─ QA-B: Calendar View QA (integration-qa)
       │                             └─ M8: Reader View + 역본 비교 구현 (web-implementer)
       │                                  └─ QA-C: Reader View + 정합성 QA (integration-qa)
       │                                       └─ M9: 반응형 + 접근성 마무리 (web-implementer)
       │                                            └─ QA-D: 전체 시나리오 QA (integration-qa)
       └─ M4: 데이터 스키마 명세 산출 (bible-data-curator)
```

## Phase 2: 데이터 확보 (M1-M2, M4)

`bible-data-curator`에게 `bible-data-pipeline` 스킬을 사용해 작업 지시:

1. 4역본 데이터 소스 조사 → `_workspace/data/sources.md`
2. 1~3일 샘플로 검증 후 사용자 보고 (대체 소스 사용 결정 필요 시)
3. 맥체인 plan 365일 데이터 → `_workspace/data/mccheyne-plan.json`
4. 4역본 본문 데이터 → `_workspace/data/bible/{translation}/{book}.json`
5. 스키마 명세 → `_workspace/data/schema.md`

**중간 점검:** M2 완료 후 큐레이터의 산출물 요약을 사용자에게 보고하고 진행 승인을 받는다 (데이터 소스 품질·저작권 인식에 영향이 큼).

## Phase 3: 디자인 (M3)

큐레이터가 `schema.md`를 산출하는 즉시 `frontend-designer`가 병렬로 시작 가능.

`bible-app-design` 스킬을 사용해:
1. 정보 구조 정의 → `_workspace/design/information-architecture.md`
2. 3개 뷰 와이어프레임 → `_workspace/design/layouts.md`
3. CSS 변수 디자인 시스템 → `_workspace/design/design-system.md`
4. 인터랙션 명세 → `_workspace/design/interactions.md`

디자이너는 큐레이터에게 추가 데이터(예: 책별 장 수 인덱스)가 필요하면 `SendMessage`로 요청.

## Phase 4: 구현 (M5-M9) + 점진적 QA

`web-implementer`가 `static-web-build` 스킬을 사용해 구현. 각 뷰 완성 즉시 `integration-qa`에 검증 요청.

### 구현 순서 (점진적 QA 포함)
1. **M5: HTML 셸 + CSS 토큰** — `index.html`, `styles/*.css` (디자인 시스템 적용)
2. **M6: Today View** → 즉시 `integration-qa`에 시나리오 S1, S5 검증 요청
3. **M7: Calendar View** → 즉시 S4 검증 요청
4. **M8: Reader View + 역본 비교** → 즉시 S2, S3 검증 요청 (가장 복잡, 절 정렬 집중 검증)
5. **M9: 반응형 + 접근성** → 즉시 S6 검증 요청

각 QA 통과 후에만 다음 뷰로 진행한다. QA에서 P1 이슈 발견 시 해당 뷰 수정 후 재검증.

## Phase 5: 통합 검증 (QA-D)

전체 구현 완료 후 `integration-qa`가 `bible-app-qa` 스킬로 종합 검증:
- 모든 시나리오 일괄 재검증 (회귀 확인)
- 데이터 정합성 전수 검사 (365일 × 4구절 × 4역본)
- README 작성 (로컬 실행법, 배포 가이드)

## Phase 6: 사용자 검토 및 피드백

산출물을 사용자에게 제시하고 피드백 수집:
- 결과물 품질 → 해당 에이전트의 스킬 보강
- 누락 기능 → 새 마일스톤 추가, 부분 재실행
- 디자인 변경 → frontend-designer 재호출

피드백 반영 후 CLAUDE.md 변경 이력에 기록.

## 데이터 전달 프로토콜

| 전략 | 사용처 |
|------|-------|
| **파일 기반** | `_workspace/data/`, `_workspace/design/`, `_workspace/qa/` — 모든 중간/최종 산출물 |
| **태스크 기반** | `TaskCreate`/`TaskUpdate`로 마일스톤 의존 관계 및 진행 상황 |
| **메시지 기반** | `SendMessage`로 팀원 간 즉각적 질문·검증 요청 |

### 파일 컨벤션
- 중간 산출물: `_workspace/{phase}/{file}` 보존 (사후 검증·감사용)
- 최종 산출물: 프로젝트 루트 (`index.html`, `styles/`, `scripts/`, `data/`)
- 이전 실행 산출물: 새 실행 시 `_workspace_prev/`로 이동, 자동 삭제 금지

## 에러 핸들링

| 상황 | 대응 |
|------|------|
| 데이터 소스 접근 실패 | 1회 재시도 → 대체 소스 탐색 → 30분 내 미해결 시 사용자 결정 요청 |
| 역본 일부 누락 | 즉시 사용자 보고. 대체 역본 / 부분 출시 결정 |
| QA에서 P1 이슈 발견 | 해당 에이전트에 즉시 수정 요청, 통과 전 다음 단계 진행 금지 |
| 같은 이슈 3회 반복 | 인접 모듈/디자인 단까지 점검 범위 확장 |
| 에이전트 응답 불가/타임아웃 | 작업 분할 후 재시도, 그래도 안 되면 사용자 보고 |
| 상충하는 결정 (디자인 vs 구현) | 사용자에게 트레이드오프 명시하고 결정 요청 |

## 팀 크기 가이드

- 작업 규모: 9개 마일스톤 + 4회 점진적 QA = 약 13개 작업 단위 (중규모)
- 팀원: 4명 (각자 3-4개 작업) — 적정 크기

## 테스트 시나리오

### 정상 흐름
1. 사용자: "맥체인 성경읽기표 웹앱을 만들어줘"
2. Phase 0: `_workspace/` 없음 → 초기 실행
3. Phase 1-5 순차 실행, 각 뷰마다 점진적 QA
4. 최종: `index.html` 외 정적 파일 묶음 + 데이터 + README

### 부분 재실행
1. 사용자: "Reader View에서 모바일 가로 스크롤 대신 역본 하나씩 토글로 바꿔줘"
2. Phase 0: `_workspace/` 있음 + 디자인+구현 부분 변경 요청
3. `frontend-designer`에 인터랙션 패턴 수정 요청 → `interactions.md` 갱신
4. `web-implementer`에 Reader View JS/CSS 수정 요청
5. `integration-qa`에 S3, S6 재검증 요청
6. CLAUDE.md 변경 이력 추가

### 에러 흐름
1. 데이터 큐레이터가 새번역 본문 API 접근 실패
2. 1회 재시도 실패 → 다른 소스 탐색 → 모두 실패
3. 사용자에게 보고: "새번역 확보 불가, (a) 개역한글로 대체 (b) 새번역 제외하고 3역본만 (c) 사용자 직접 데이터 제공"
4. 사용자 결정에 따라 진행

## 후속 작업 트리거 키워드 (description 보강 참고)

- "다시", "재실행", "업데이트", "수정", "보완", "개선"
- "데이터 교체", "역본 추가", "역본 빼기"
- "디자인 바꿔", "레이아웃 수정", "색상 변경"
- "버그", "안 돼", "깨져", "이상해"
- "이전 결과 기반", "그대로 두고"

## 산출물 체크리스트

오케스트레이션 완료 시 다음이 모두 존재해야 함:

- [ ] `_workspace/data/sources.md`, `mccheyne-plan.json`, `bible/*/`, `schema.md`
- [ ] `_workspace/design/{information-architecture, layouts, design-system, interactions}.md`
- [ ] `_workspace/qa/{test-scenarios, test-report, issues}.md`
- [ ] 프로젝트 루트: `index.html`, `styles/`, `scripts/`, `data/`, `README.md`
- [ ] CLAUDE.md 변경 이력 갱신
