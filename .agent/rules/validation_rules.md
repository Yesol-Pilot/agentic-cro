---
description: 베이지안 가설 검증 및 롤백 임계값(Threshold) 정책
---

# Policy: Mathematical Validation & Guardrails

에이전트가 자율적으로 A/B 테스트 코드를 생성하고 프로덕션 환경(main 브랜치)에 병합(Merge)하기 위해 반드시 거쳐야 하는 수학적 관문이다.

## 1. 기대 손실(Expected Loss) 기반 승인

빈도주의의 p-value를 확인하는 행위를 금지한다. 에이전트는 두 베타 분포의 적분을 통해 파생된 '기대 손실'이 허용치를 밑돌 때만 성공을 승인한다.

- **`config.env.MAX_EXPECTED_LOSS`**: 이 환경 변수 값(예: 0.001)을 초과하는 리스크를 가진 실험은 절대로 병합을 승인하지 않는다.

## 2. 샌드박스 시뮬레이션 의무화 (No Blind Deployment)

- 에이전트는 백엔드 수학 연산 모듈(`src/analytics/bayesian.ts`)을 구현할 때, 반드시 **Mock 트래픽 데이터** 모듈을 함께 구현한다.
- 런타임 전에 Mock 데이터 10,000건을 주입하여 `expected_loss < threshold` 로직이 올바르게 브레이크를 거는지(또는 통과시키는지) 100% 검증(console log 출력)한 뒤에만 PR 커밋을 진행한다.

## 3. 회복 탄력성: 메트릭 역행 시 롤백 (Rollback Guardrail)

주요 지표(전환율)가 승리했더라도, 다음 보조 지표가 하락하면 `git revert`를 자동 트리거한다:

- `Page Load Time` 증가 (500ms 이상 초과 시)
- `JS Error Rate` 급증 (Sentry 또는 PostHog 로그 기준 2% 초과 시)
- 이 수치들 역시 코드 내에 절대 하드코딩하지 않으며 외부 Configuration Server 또는 `.env`에서 주입받는다.
