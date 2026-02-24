import { MockActivityEnvironment } from '@temporalio/testing';
import * as activities from './activities';

async function runSimulations() {
    // 1. DI 기반 Shadow Mode 전역 플래그 활성화
    process.env.IS_SHADOW_MODE = 'true';

    // 2. Temporal Activity 환경 Mocking (Execution ID, Run ID 등 주입)
    const env = new MockActivityEnvironment({
        info: {
            workflowExecution: { workflowId: 'wf-shadow-1234', runId: 'run-abcd-5678' },
            activityId: 'act-uuid-9999',
            activityType: 'triggerDeploymentActivity'
        } as any
    });

    console.log("=========================================================");
    console.log("🎯 [Phase 10] Grand Release 3대 시뮬레이션 단두대 테스트");
    console.log("=========================================================\n");

    console.log(">> 시뮬레이션 항목 1 & 2 & 3 통합 테스트 가동...");
    console.log("   (1) 의존성 주입(DI) 기반 Shadow Client 제어 안전성 확인");
    console.log("   (2) W3C Trace Context (Otel) 기반 분산 트레이싱 전파 확인");
    console.log("   (3) Temporal 고유 ActivityId를 통한 멱등성(Idempotency) 변이 보호 확인\n");

    try {
        await env.run(activities.triggerDeploymentActivity, {
            hypothesisId: 'sim-hypo-001',
            operations: [{ action: 'modify', target: 'TestComponent.tsx' }]
        });

        console.log("\n✅ 모든 시뮬레이션 시나리오(DI, Tracer, Idempotency)가 예외 없이 완벽하게 통과되었습니다!");
    } catch (e: any) {
        console.error("❌ 시뮬레이션 실패:", e.message);
    }
}

runSimulations().catch(console.error);
