import { proxyActivities, sleep, continueAsNew, ApplicationFailure, defineSignal, setHandler, condition, defineQuery } from '@temporalio/workflow';

// HITL 승인 시그널 및 상태 쿼리 정의
export const approveDeploymentSignal = defineSignal('approveDeployment');
export const getFlywheelStatusQuery = defineQuery<any>('getFlywheelStatus');

const {
    analyzeTrafficActivity,
    runAICodeGenerationActivity,
    runBrowserlessQAActivity,
    triggerDeploymentActivity,
    waitForCiCdStatusActivity,
    enableFeatureFlagActivity,
    sendHITLReportActivity,
    checkTenantCreditActivity,
    reportToNeoGenesisActivity
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

// Workflow execution must be completely deterministic (No Node Built-ins, No Math.random)
export async function optimizationFlywheelWorkflow(iterationContext: any = { wins: 0, targetUrl: '', tenantId: 'default-tenant' }): Promise<void> {
    const currentTenant = iterationContext.tenantId || 'default-tenant';
    console.log(`[Temporal Workflow] 🌀 테넌트(${currentTenant}) 자율 A/B 테스트 사이클 시작 (Wins: ${iterationContext.wins}, Target: ${iterationContext.targetUrl})`);

    let status = 'RUNNING';
    let isApproved = false;

    setHandler(getFlywheelStatusQuery, () => ({ status, wins: iterationContext.wins }));
    setHandler(approveDeploymentSignal, () => {
        isApproved = true;
    });

    try {
        const targetFunnel = await analyzeTrafficActivity(iterationContext.targetUrl);

        if (iterationContext.wins >= 5) {
            console.log(`[Temporal Workflow] ⚠️ 컴포넌트 승리 누적 도달. Refactoring Epoch 발동!`);
            iterationContext.wins = 0;
        } else {
            console.log(`[Temporal Workflow] 🛡️ 테넌트 크레딧 차감 여부(Rate-Limit 검사)를 진행합니다.`);
            await checkTenantCreditActivity(currentTenant);

            const patchResult = await runAICodeGenerationActivity(targetFunnel);
            const qaPassed = await runBrowserlessQAActivity(patchResult?.components);

            if (qaPassed) {
                console.log(`[Temporal Workflow] 📦 AST 패치를 적용한 PR을 고객사 저장소에 생성합니다.`);
                await triggerDeploymentActivity(patchResult);

                console.log(`[Temporal Workflow] 🔄 생성된 PR의 CI/CD 통과 여부를 대기합니다...`);
                await waitForCiCdStatusActivity(patchResult);

                await sendHITLReportActivity(patchResult);
                console.log(`[Temporal Workflow] ⏳ 운영자 승인(HITL)을 대기합니다... (최대 24시간)`);

                status = 'WAITING_FOR_APPROVAL';
                const isSignaled = await condition(() => isApproved, '24h');
                status = 'RUNNING';

                if (!isSignaled) {
                    console.log(`[Temporal Workflow] ⏰ 24시간 타임아웃 만료. 가설이 기각(Discard) 처리됩니다.`);
                    throw ApplicationFailure.create({
                        message: 'HITL Approval Timeout exceeded',
                        type: 'HITL_TIMEOUT',
                        nonRetryable: true
                    });
                }

                console.log(`[Temporal Workflow] ✅ 관리자 승인(Approve) 수신. Feature Flag를 실시간 활성화합니다.`);
                await enableFeatureFlagActivity(patchResult);
                iterationContext.wins += 1;
            }
        }

        // 본사 관제탑 (Neo-Genesis 7700 포트)에 에폭 1사이클 진행 상황 보고
        console.log(`[Temporal Workflow] 🌉 본사 SBU 브릿지 통신 시도 시뮬레이션...`);
        await reportToNeoGenesisActivity(currentTenant, iterationContext.wins, iterationContext.wins >= 5);

    } catch (err: any) {
        console.log(`[Temporal Workflow] ❌ 워크플로우 진행 중 에러: ${err?.message}`);
    } finally {
        await sleep('10s');
        await continueAsNew(iterationContext);
    }
}
