---
description: Agentic CRO 프로젝트 전역: 하드코딩 제약 및 동적 주입(Dynamic Injection) 정책
---

# Policy: Zero-Hardcoding & Dynamic Configuration

"하드코딩은 프레임워크의 확장성과 생명력을 갉아먹는 기술 부채다."
에이전트가 코드를 작성하거나 시스템을 설계할 때, 이 정책은 최상위법으로 작용한다.

## 1. 하드코딩 절대 금지 구역 (No-Hardcoding Zones)

- **수학적 임계값 (Math Thresholds)**: 베이지안 다중 적분을 통과하기 위한 '기대 손실(Expected Loss)' 기준값(예: 0.15%)이나 신뢰 수준(Confidence Level, 예: 95%)은 소스 코드 내부(예: `if (p > 0.95)`)에 상수로 박아두면 안 된다.
  - **해결책**: 반드시 환경 변수(`.env`)나 중앙 집중화된 `config/experiment.json` 파일에서 동적으로 불러오도록 설계한다.
- **MCP API 엔드포인트 및 인증키**: PostHog, GrowthBook, GitHub 리포지토리 URL 등은 외부 주입(Injection)을 받아야 한다.
- **대상 타겟 선택자 (DOM Selectors)**: 섀도우 컴포넌트를 스크래핑할 때 특정 CSS 클래스(`.btn-primary`)를 프롬프트나 스크립트에 하드코딩하지 않는다. 에이전트는 접근성 트리(Accessibility Tree)를 기반으로 동적으로 요소를 탐색(Heuristic Search)해야 한다.

## 2. 환경 변수 및 스키마 기반 검증 (Schema-driven Validation)

모든 에이전트는 외부 API와 상호작용하거나 컨텍스트를 넘겨받을 때, 하드코딩된 파라미터 대신 **동적 스키마(예: Zod 스키마)**를 기반으로 런타임에 값을 검증한다.

## 3. 에이전트 프롬프트 템플릿의 분리

에이전트의 페르소나와 지시 사항(Instruction) 또한 소스 코드의 문자열(String)로 하드코딩하지 않는다.

- 모든 프롬프트는 `.agent/prompts/` 또는 별도의 템플릿 파일로 분리하여 관리되며, 프로젝트 런타임에 파일 시스템에서 읽어와 컨텍스트 변수만 바인딩(Binding)하여 사용한다.
