---
description: Agentic CRO 핵심 모듈 개발 표준 워크플로우
---

# Agentic CRO Development Workflow

프로젝트 개발을 궤도에 올리기 위한 단계별 워크플로우다. "// turbo" 구문을 사용하여 권한 허용 시 자동으로 실행하게 한다.

## Step 1: 환경 스캐폴딩 초기화

1. `npm init -y` 명령어 실행
// turbo
2. 필수 의존성 `typescript`, `@types/node`, `ts-node` 등 설치
// turbo
3. `tsconfig.json` 셋업

## Step 2: MCP 서버 아키텍처 수립

1. `src/mcp-servers/` 디렉토리 라우팅
2. `PostHog`, `v0.dev`, `GitHub`을 위한 빈 커넥터 템플릿 작성
3. `.env` 템플릿 파일 생성 및 관리 지침 추가

## Step 3: 베이지안 통계(Math) 검증

1. `src/analytics/bayesian.ts` 파일 생성
2. 베타 분포 확률 적분을 위한 공식 구현 (단순화된 수학 로직 적용 방안 문서화)

## Step 4: 에이전트 테스트

1. `walkthrough.md`에 테스트 결과를 한글로 자동 기록
2. 실패 시 스스로 원인을 파악하고 재시도하는 복구 프로토콜 이행
