/**
 * [Phase MVP] Durable Execution 가혹 테스트 — 데모 액티비티
 * 
 * 각 액티비티에 의도적 Sleep을 넣어 워커 Kill 시점을 확보합니다.
 * Temporal에서 이 액티비티들이 프로세스 다운에도 상태를 잃지 않음을 증명합니다.
 */

export async function analyzeTrafficActivity(): Promise<string> {
    console.log(`\n${'━'.repeat(60)}`);
    console.log(`  📊 [Step 1/3] analyzeTrafficActivity 시작`);
    console.log(`  PostHog 트래픽 데이터를 수집하고 있습니다...`);
    console.log(`${'━'.repeat(60)}`);

    // 실제 PostHog API 호출을 시뮬레이션하는 5초 대기
    await sleep(5000);

    const result = '$pageleave: 3, $web_vitals: 4, $autocapture: 11, $rageclick: 2';
    console.log(`  ✅ [Step 1/3] 완료! 트래픽 데이터: ${result}`);
    return result;
}

export async function generateHypothesisActivity(trafficData: string): Promise<any> {
    console.log(`\n${'━'.repeat(60)}`);
    console.log(`  🧠 [Step 2/3] generateHypothesisActivity 시작`);
    console.log(`  Gemini 3.1 Pro가 AST 패치를 생성하고 있습니다...`);
    console.log(`  입력 트래픽: ${trafficData}`);
    console.log(`${'━'.repeat(60)}`);

    // ⚠️ 이 지점에서 워커를 Kill합니다! (120초 동안 LLM 호출 시뮬레이션)
    console.log(`  ⏳ LLM 추론 중... (120초 소요 — 이 동안 워커를 Kill 하세요!)`);
    await sleep(120000);

    const codePatch = {
        hypothesisId: 'durable-test-' + Date.now(),
        patchSummary: 'CTA 버튼 transition + hover 효과 강화',
        componentPaths: ['src/components/CallToAction.tsx'],
        operations: [{
            action: 'merge_tailwind_classes',
            targetComponent: 'a',
            propName: 'className',
            classesToAdd: ['hover:scale-105', 'transition-all'],
        }]
    };

    console.log(`  ✅ [Step 2/3] 완료! HypothesisID: ${codePatch.hypothesisId}`);
    return codePatch;
}

export async function applyASTAndCreatePRActivity(codePatch: any): Promise<string> {
    console.log(`\n${'━'.repeat(60)}`);
    console.log(`  🔧 [Step 3/3] applyASTAndCreatePRActivity 시작`);
    console.log(`  ts-morph AST 수술 + GitHub PR 생성 중...`);
    console.log(`  Hypothesis: ${codePatch.hypothesisId}`);
    console.log(`${'━'.repeat(60)}`);

    await sleep(5000);

    const prUrl = `https://github.com/Yesol-Pilot/mock-pr/${codePatch.hypothesisId}`;
    console.log(`  ✅ [Step 3/3] 완료! PR: ${prUrl}`);
    return prUrl;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
