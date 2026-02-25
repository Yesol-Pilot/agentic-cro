/**
 * [Phase MVP] Temporal Workflow — 결정론적 코드만 포함
 * 
 * ⚠️ 이 파일에는 @temporalio/workflow의 API만 사용 가능합니다.
 *    - @temporalio/client ❌
 *    - crypto ❌  
 *    - fs, path, os ❌
 *    - 비결정적 코드 전부 ❌
 */
import { proxyActivities } from '@temporalio/workflow';

// 액티비티 프록시 (비결정적 외부 호출은 반드시 Activity로 분리)
const {
    analyzeTrafficActivity,
    generateHypothesisActivity,
    applyASTAndCreatePRActivity
} = proxyActivities<any>({
    startToCloseTimeout: '10m',
    retry: {
        initialInterval: '2s',
        backoffCoefficient: 2.0,
        maximumInterval: '1m',
        maximumAttempts: 10,
        nonRetryableErrorTypes: [
            'LLM_CONTEXT_LIMIT_EXCEEDED',
            'UNAUTHORIZED_API_KEY',
            'FATAL_AST_SYNTAX_ERROR'
        ]
    }
});

/**
 * [Phase MVP] The Durable Singularity — 3-Step Workflow
 * 
 * Temporal 엔진 위에서 구동:
 * 1. analyzeTrafficActivity  — PostHog 데이터 수집
 * 2. generateHypothesisActivity — Gemini 3.1 Pro 추론
 * 3. applyASTAndCreatePRActivity — ts-morph AST 수술 + PR 생성
 * 
 * 프로세스 다운 시 완료된 Step의 결과는 Event History에 보존되어
 * 워커 재기동 시 중단 지점부터 자동 재개됩니다.
 */
export async function optimizationFlywheelWorkflow(iterationContext: any = { wins: 0 }): Promise<string> {
    console.log(`[Workflow] 🌀 Durable E2E 사이클 시작 (Wins: ${iterationContext.wins})`);

    // Step 1: 트래픽 분석
    console.log(`[Workflow] ▶ Step 1/3: analyzeTrafficActivity`);
    const trafficData = await analyzeTrafficActivity();
    console.log(`[Workflow] ✅ Step 1/3 완료`);

    // Step 2: AI 가설 생성 (Gemini 3.1 Pro)
    console.log(`[Workflow] ▶ Step 2/3: generateHypothesisActivity`);
    const codePatch = await generateHypothesisActivity(trafficData);
    console.log(`[Workflow] ✅ Step 2/3 완료`);

    // Step 3: AST 수술 + PR 생성
    console.log(`[Workflow] ▶ Step 3/3: applyASTAndCreatePRActivity`);
    const prUrl = await applyASTAndCreatePRActivity(codePatch);
    console.log(`[Workflow] ✅ Step 3/3 완료`);

    console.log(`[Workflow] 🎯 Durable Singularity 1회전 완료! PR: ${prUrl}`);
    return prUrl;
}
