/**
 * [Phase MVP] Durable Execution 가혹 테스트 — 데모 워커
 * 
 * 워크플로우: supervisor.ts의 optimizationFlywheelWorkflow
 * 액티비티: activities-demo.ts의 가혹 테스트용 함수들 (의도적 Sleep 포함)
 * 
 * 가혹 테스트 시나리오:
 *   1. 이 워커를 실행합니다.
 *   2. 별도 터미널에서 startDurableWorkflow.ts로 워크플로우를 제출합니다.
 *   3. Step 2 (generateHypothesisActivity) 실행 중 이 워커를 Ctrl+C로 Kill합니다.
 *   4. 몇 초 후 이 워커를 다시 실행합니다.
 *   5. Temporal이 Step 1을 건너뛰고 Step 2부터 재개하는 것을 확인합니다.
 * 
 * 실행: npx tsx src/durableTestWorker.ts
 */
import { Worker } from '@temporalio/worker';
import * as activities from './orchestrator/activities-demo';
import 'dotenv/config';

async function run() {
    console.log('═══════════════════════════════════════════');
    console.log('⚙️  Durable Execution 가혹 테스트 워커');
    console.log('═══════════════════════════════════════════');

    const temporalAddress = process.env.TEMPORAL_ADDRESS || '127.0.0.1:7233';
    console.log(`[Worker] Temporal Server: ${temporalAddress}`);

    const worker = await Worker.create({
        workflowsPath: require.resolve('./orchestrator/workflows'),
        activities,
        taskQueue: 'agentic-cro-tasks',
    });

    console.log('[Worker] ✅ Worker 생성 완료. Task 수신 대기중...\n');
    await worker.run();
}

run().catch((err) => {
    console.error('[Worker] ❌ 에러:', err.message);
    process.exit(1);
});
