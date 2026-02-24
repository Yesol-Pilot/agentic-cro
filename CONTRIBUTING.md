# Contributing to Agentic CRO

먼저 Agentic CRO (Growth-Pilot) 프로젝트에 관심을 가져주셔서 진심으로 감사합니다! 🚀
이 프로젝트는 **"완전 자율형 프론트엔드 최적화 머신"**이라는 원대한 비전을 목표로 하며, 한두 명의 천재 개발자가 아닌 거대한 집단 지성(Community)의 힘을 통해 완성된다고 믿습니다.

저희는 여러분의 모든 기여(코드 작성, 버그 리포팅, 기능 제안, 플러그인 생태계 확장)를 환영합니다. 아래 가이드를 따르면 더욱 부드럽게 병합(Merge)되는 PR을 작성하실 수 있습니다.

---

## 🛠 아키텍처 개방성 (Plug-and-Play)

이 프로젝트는 MCP (Model Context Protocol) 생태계와 완벽히 호환되도록 구성된 모듈러 아키텍처를 자랑합니다.

### 1. 새로운 커넥터 플러그인 추가 (MCP Servers)

현존하는 `posthog.ts`, `github.ts`, `growthbook.ts` 외에 새로운 애널리틱스(Amplitude, Mixpanel)나 A/B 테스트 툴(Optimizely, LaunchDarkly), 배포 툴(GitLab)을 붙이고 싶으신가요?

단 하나의 인터페이스만 상속받으면 됩니다.

```typescript
// src/interfaces/YourAnalyticsInterface.ts
export interface IAnalyticsClient {
    connect(): Promise<void>;
    fetchDropoffData(funnelId: string): Promise<any>;
}
```

위 인터페이스를 구현(Implement)하는 `src/mcp-servers/new-tool.ts` 를 작성한 뒤 PR을 보내주시면 됩니다!

### 2. 새로운 VLM / Validator 추가

현재 `playwrightValidator.ts` 는 뷰포트 캡처 및 화면 기반 VLM(Vision Language Model) 심사를 거칩니다. 만약 '접근성(a11y) 검수 VLM'이나 'Lighthouse 퍼포먼스 체크 Validator'를 추가하고 싶다면 `src/utils/sandbox/` 디렉토리에 추가해 주십시오.

---

## 🌱 처음 오셨나요? (`good first issue`)

코드 베이스가 방대(AST 조작, Temporal 파이프라인, 베이지안 톰슨 샘플링)하기 때문에 기여에 부담을 느끼실 수 있습니다. 처음 커미터 분들을 위해 저희가 준비한 `good first issue` 정책은 다음과 같습니다.

1. **GitHub Issues 탭 확인:** 레포지토리의 [Issues] 탭에서 `good first issue` 라는 라벨이 달린 항목을 찾아주세요.
2. **어떤 종류의 이슈가 있나요?**
   * 프롬프트 오타 수정 (`src/agents/*.ts` 내부)
   * `jsdoc` 주석이 누락된 함수에 대한 문서화 작업 보강
   * UI Mockup 컴포넌트(`test-app/`)의 간단한 CSS 버그 수정
   * AST Parser 에 예외를 추가하는 가벼운 패치

---

## 📝 개발 환경 설정 및 PR 규칙

1. **Fork & Branch:** 이 저장소를 Fork 한 후, 로컬에서 브랜치를 따주세요. (`feature/your-cool-feature`)
2. **Commit Convention:** 우리는 Conventional Commits 룰을 따릅니다.
   * `feat: Add new MCP connector for Amplitude`
   * `fix: Handle Promise rejection in GrowthBook fallback`
   * `docs: Update README architecture diagram`
3. **Dry-Run (필수):** API 키를 `IS_SHADOW_MODE=true` 로 설정하고(로컬 샌드박스 구동), 코드가 무한 루프에 빠지지 않는 지 `npm run dev` 를 통해 1회전 사이클을 돌려주세요.
4. **Pull Request:** 변경 사항이 구동되는 화면(데모)이나 `simulation_logs.txt` 등의 증빙 텍스트를 첨부하여 설명해 주십시오.

## ⚖️ 행동 강령 (Code of Conduct)

우리는 서투른 코드보다 서투른 매너를 더 경계합니다. 리뷰 과정에서 언제나 동료에 대한 존중을 유지해 주시기 바랍니다.

여러분의 멋진 PR을 기다리겠습니다! Happy Hacking! 💻✨
