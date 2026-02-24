---
description: Agentic CRO 최상위 워크스페이스 룰 및 시스템 제약 사항
---

# Workspace Rules for Agentic CRO

이 문서는 `agentic-cro` 프로젝트를 수행하는 모든 자율형 에이전트가 100% 준수해야 하는 최상위 프로토콜이다.

## 1. 언어 및 소통 스탠다드

- **모든 설명, 주석, 로그 출력, 문서(`task.md`, `implementation_plan.md`, `walkthrough.md` 포함)는 100% 한국어로 작성한다.**
- 단, 클래스/함수/변수/파일명은 영어로 표기하며(예: `BayesianCalculator`, `DataAnalyticsAgent`), 그에 대한 설명 주석은 한국어를 사용한다.

## 2. 작동 프로세스 (Plan -> Files -> Code -> Test)

에이전트는 모든 피처 개발 시 다음의 엄격한 선형 워크플로우를 따른다:

1. **작업 계획 (Plan)**: 무엇을 왜 어떤 순서로 할지 한국어로 짧게 명시
2. **대상 파일 (Files)**: 수정/생성할 파일 목록 확정
3. **코드 작성 (Code)**: Node.js/TypeScript 환경에서 엄밀한 코드 작성 (MCP 프로토콜 기반)
4. **검증 및 브라우저 테스트 (Test)**: 테스트 명령어(예: `npm run dev`) 및 검증 시나리오 작성

## 3. 다중 에이전트 ও MCP(Model Context Protocol)

- 단일 거대 모델 배제: 기능별 서브 에이전트가 각자의 MCP 서버(Data, Strategy, UI, Deploy)와 격리되어 결합도를 낮추는 **Agentic Mesh** 패턴을 지향한다.
- **수학적 가드레일 제약**: 베이지안 기반 A/B 테스트에서 변인 평가(통계 적분 계산) 시, **기대 손실(Expected Loss)이 제한된 임계값을 충족할 때만** 코드 병합(Merge)을 승인한다.

## 4. 백업 및 에러 복구(Resilience)

- 파괴적 변경(DOM 제어 로직 변경이나 주요 MCP 통신 변경)을 진행할 경우, 반드시 테스트 스크립트를 거친 뒤 반영한다.
- 910개의 `.agent/skills/` 스킬 라이브러리는 현재 워크플로우에 최적화하여 언제든 불러내어(Retrieve) 참고한다.
