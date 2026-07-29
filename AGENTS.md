<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 프로젝트 규칙 (rokstock-01)

## 프로젝트 개요

**국내 주식(KRX) 자동 매매 프로그램**을 만드는 프로젝트다. 다음 순서로 진화한다:

1. **가상 매매** — 실제 시세(지연/일봉)를 기반으로 가상 계좌에서 매매
2. **모의투자** — 한국투자증권(KIS) Open API 모의투자 계좌 연동
3. **실전 매매** — KIS 실계좌 전환, 리스크 관리 포함

마일스톤과 진행 상황은 `docs/ROADMAP.md`를 참조하고, 작업 시작 전 반드시 확인한다.

## 소통 규칙

- **모든 소통은 한국어로 한다**: 대화 응답, 커밋 메시지, PR 제목/본문, 문서 전부.
- 코드 식별자(변수/함수/컴포넌트명)와 코드 주석 내 기술 용어는 영어를 사용해도 된다.

## 사용자 배경

- 사용자는 **보험 도메인 개발자**이며, 이 프로젝트를 통해 **웹개발(Next.js/React/TypeScript)** 과 **주식 개념**을 학습하려 한다.
- 새로운 웹개발 개념이나 주식 용어를 도입할 때는 짧은 설명을 곁들일 것.
- 학습 포인트는 `docs/learning/`에 노트로 남긴다.

## 문서화 규칙

- 기능을 구현하면 관련 문서(`docs/`)를 함께 갱신한다.
- 마일스톤 완료 시 `docs/ROADMAP.md`의 상태를 갱신한다.
- 학습할 만한 개념(웹개발/주식)이 등장하면 `docs/learning/`에 문서를 추가하거나 보강한다.

## 버전 규칙

- **PR을 생성할 때마다 `package.json`의 `version`을 올린다** (SemVer):
  - 기능 추가 → **minor** (예: 0.1.0 → 0.2.0)
  - 버그 수정/자잘한 개선 → **patch** (예: 0.1.0 → 0.1.1)
- 버전은 화면에 항상 표기된다 (`src/components/VersionBadge.tsx`, 루트 레이아웃 footer).
- 컴포넌트가 `package.json`의 `version`을 직접 읽으므로 버전 표기는 별도 수정이 필요 없다.

## 기술 스택

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- 패키지 매니저: npm
- import alias: `@/*` → `src/*`
