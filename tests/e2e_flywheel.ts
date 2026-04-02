import { Connection, Client } from '@temporalio/client';
import * as crypto from 'crypto';
import { approveDeploymentSignal, getFlywheelStatusQuery } from '../src/orchestrator/workflows';

async function runTest() {
    console.log('[E2E Test] Temporal 서버 연결 및 3-Cycle Flywheel 테스트 시작...');
    const connection = await Connection.connect();
    const client = new Client({ connection });

    const targetUrl = 'http://localhost:3001/components/CheckoutButton.tsx';
    const workflowId = `e2e-flywheel-test-${crypto.randomUUID()}`;

    console.log(`[E2E Test] Workflow 시작: ${workflowId}`);
    const handle = await client.workflow.start('optimizationFlywheelWorkflow', {
        taskQueue: 'agentic-cro-tasks-default-tenant',
        workflowId,
        args: [{ wins: 0, targetUrl, tenantId: 'default-tenant' }]
    });

    let currentWins = 0;
    let cyclesCompleted = 0;
    const targetCycles = 3;

    while (cyclesCompleted < targetCycles) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 주기 Polling

        try {
            const state = await handle.query(getFlywheelStatusQuery);
            console.log(`[E2E Monitor] 상태(Status): ${state.status}, 누적 승리(Wins): ${state.wins}`);

            // 운영자 승인(HITL) 단계에 진입했을 때 강제로 시그널 송출 (Bypass)
            if (state.status === 'WAITING_FOR_APPROVAL') {
                console.log(`[E2E Action] 🤖 HITL 승인 대기 상태 감지됨. 강제 승인 시그널(Approve) 송출!`);
                await handle.signal(approveDeploymentSignal);
            }

            // 워크플로우 내에서 wins가 증가하면 한 사이클이 완전히 돈 것으로 판정
            if (state.wins > currentWins) {
                console.log(`[E2E Result] ✅ 사이클 1회 통과 완료! 현재 누적 승리: ${state.wins}`);
                currentWins = state.wins;
                cyclesCompleted++;
            }
        } catch (err: any) {
            console.warn(`[E2E Monitor] ⚠️ 쿼리 조회 중 오류 (Workflow 상태 전이 중일 수 있음): ${err.message}`);
        }
    }

    console.log(`[E2E Test] 🎉 ${targetCycles} 사이클 자율 무한 최적화(Flywheel) 구조 검증에 성공했습니다! Workflow를 강제 종료합니다.`);
    await handle.terminate('E2E Test Completed Successfully');
    process.exit(0);
}

runTest().catch(err => {
    console.error(`[E2E Test] ❌ 테스트 대실패:`, err);
    process.exit(1);
});
