import { Context } from '@temporalio/activity';
import { getGitHubClient } from '../mcp-servers/github';
import { getGrowthBookClient } from '../mcp-servers/growthbook';
import { deductTenantCredit } from '../utils/tokenMetering';
import { getNeoGenesisClient } from '../mcp-servers/neo-genesis';
import { context, trace } from '@opentelemetry/api';

// OpenTelemetry 기본 Tracer 설정 (Langfuse, Datadog 등으로 파이프라인 연결됨)
const tracer = trace.getTracer('agentic-cro-activities');

/**
 * [Phase 10] W3C Trace Context 동기화 헬퍼
 * Temporal Workflow Execution ID를 Root Trace ID로 승격시켜 분산 시스템 전체(CoT)의 시각화 맥락을 연결합니다.
 */
function runWithTraceContext<T>(activityName: string, fn: (traceId: string, activityId: string) => Promise<T>): Promise<T> {
    const info = Context.current().info;
    const workflowId = info.workflowExecution.workflowId;
    const runId = info.workflowExecution.runId;
    const activityId = info.activityId;

    // Temporal의 고유 ID를 Trace ID 및 Idempotency Key로 활용
    // (보통 Otel Interceptor를 씌우지만 여기선 명시적 시뮬레이션 로거 주입)
    const traceId = `trace-${workflowId}-${runId}`;

    return tracer.startActiveSpan(activityName, async (span) => {
        span.setAttribute('workflow.id', workflowId);
        span.setAttribute('workflow.runId', runId);
        span.setAttribute('activity.id', activityId);
        span.setAttribute('trace.id', traceId);

        console.log(`[Otel Trace] 🔗 ${activityName} 시작 (TraceID: ${traceId})`);

        try {
            const result = await fn(traceId, activityId);
            span.setStatus({ code: 1 }); // OK
            return result;
        } catch (error: any) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message }); // Error
            throw error;
        } finally {
            span.end();
            console.log(`[Otel Trace] 🏁 ${activityName} 종료`);
        }
    });
}

export async function analyzeTrafficActivity(): Promise<any> {
    return runWithTraceContext('analyzeTrafficActivity', async (traceId) => {
        console.log(`[Activity] PostHog 이탈률 분석을 모의 실행합니다. (TraceID: ${traceId})`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return { target: 'checkout_button', dropRate: 0.45 };
    });
}

export async function checkTenantCreditActivity(tenantId: string): Promise<boolean> {
    return runWithTraceContext('checkTenantCreditActivity', async (traceId) => {
        console.log(`[Activity] 테넌트(${tenantId})의 LLM Usage Credit을 검증합니다. (TraceID: ${traceId})`);
        const isApproved = await deductTenantCredit(tenantId, 1);

        if (!isApproved) {
            throw new Error(`[Activity] 🚫 테넌트(${tenantId}) 잔여 크레딧 부족으로 인해 워크플로우 진행이 중단됩니다.`);
        }
        return true;
    });
}

export async function reportToNeoGenesisActivity(tenantId: string, currentWins: number, isRefactoringEpoch: boolean): Promise<void> {
    return runWithTraceContext('reportToNeoGenesisActivity', async (traceId) => {
        console.log(`[Activity/Bridge] 🌉 원격 본사 시스템(Neo-Genesis)으로 배치 상태를 동기화합니다. (TraceID: ${traceId})`);
        const client = getNeoGenesisClient();
        await client.reportStatus({
            sbuId: 'agentic-cro',
            tenantId: tenantId,
            status: 'active',
            metrics: {
                wins: currentWins,
                tokensUsed: 1, // 이번 사이클 소모량
                message: isRefactoringEpoch ? '리팩토링 에폭 진입' : '통상 최적화 수행 완료'
            }
        });
    });
}

export async function runAICodeGenerationActivity(targetFunnel: any): Promise<any> {
    return runWithTraceContext('runAICodeGenerationActivity', async (traceId) => {
        console.log(`[Activity] VLM/LLM 가설 추론 및 AST 조작 코드를 생성합니다. (TraceID: ${traceId})`);
        await new Promise(resolve => setTimeout(resolve, 800));
        return {
            hypothesisId: `hyp-${Date.now()}`,
            components: ['src/components/Checkout.tsx'],
            operations: [{ action: 'modify', target: 'button', value: 'Complete Purchase' }]
        };
    });
}

export async function runBrowserlessQAActivity(components: string[]): Promise<boolean> {
    return runWithTraceContext('runBrowserlessQAActivity', async (traceId) => {
        console.log(`[Activity] Browserless 기반 VLM 교차 검증을 수행합니다. (TraceID: ${traceId})`);
        // [Chaos Engineering Target] 무거운 작업 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 1500));
        return true;
    });
}

export async function sendHITLReportActivity(patchResult: any): Promise<void> {
    return runWithTraceContext('sendHITLReportActivity', async (traceId) => {
        console.log(`[Activity/Slack] 📩 관리자(CTO)에게 승인(HITL)을 요청합니다.`);

        try {
            const slack = (await import('../mcp-servers/slack')).getSlackClient();
            await slack.connect();

            const message = `🚨 *Agentic CRO: HITL (Human-in-the-loop) Approval Required*\n` +
                `새로운 A/B 테스트 가설이 제안되었습니다.\n\n` +
                `• *가설 ID*: \`${patchResult?.hypothesisId || 'Unknown'}\`\n` +
                `• *Trace ID*: \`${traceId}\`\n` +
                `• *변형 대상*: ${patchResult?.components?.join(', ') || 'N/A'}\n\n` +
                `> CTO님, 승인하시려면 대시보드에서 Approve 버튼을 눌러주십시오.`;

            await slack.sendAlert(message);
            console.log(`[Activity/Slack] 📩 TraceID( ${traceId} ) 및 승인 내용 발송 완수됨.`);
        } catch (e: any) {
            console.error(`[Activity/Slack] ❌ 슬랙 알림 발송 중 에러 발생: ${e.message}`);
        }
    });
}

export async function triggerDeploymentActivity(patchResult: any): Promise<void> {
    return runWithTraceContext('triggerDeploymentActivity', async (traceId, activityId) => {
        console.log(`[Activity] 배포 승인 완료. PR 생성 및 Feature Flag를 활성화합니다.`);

        // [Phase 10] 멱등성 키(Idempotency Key) 주입. 
        // 워커가 API 응답 직전 크래시(kill -9)되어도 재시도 시 동일한 activityId가 주입되므로
        // 외부 서버(또는 캐시)에서 중복을 식별하고 방어할 수 있습니다.
        const idempotencyKey = `idem-${activityId}`;

        const github = getGitHubClient();
        await github.connect();
        await github.createPullRequest(
            `[Agentic CRO] 자동 배포: ${patchResult.hypothesisId}`,
            `feature/${patchResult.hypothesisId}`,
            patchResult.operations,
            idempotencyKey
        );

        console.log(`[Activity] 🚀 1단계: 외부 Github PR 생성이 완료되었습니다.`);
    });
}

export async function waitForCiCdStatusActivity(patchResult: any): Promise<boolean> {
    return runWithTraceContext('waitForCiCdStatusActivity', async (traceId) => {
        console.log(`[Activity] 고객사 CI/CD 상태 검증을 시작합니다. (TraceID: ${traceId})`);
        const github = getGitHubClient();
        await github.connect();

        const branchName = `feature/${patchResult.hypothesisId}`;
        const isSuccess = await github.waitForCiCdStatus(branchName, 120); // 최대 2시간 대기

        if (!isSuccess) {
            throw new Error(`[Activity] ❌ CI/CD 빌드가 실패하였거나 타임아웃 되었습니다. (분기: ${branchName})`);
        }

        console.log(`[Activity] ✅ 고객사 CI/CD 파이프라인 검증 통과 완료!`);
        return true;
    });
}

export async function enableFeatureFlagActivity(patchResult: any): Promise<void> {
    return runWithTraceContext('enableFeatureFlagActivity', async (traceId, activityId) => {
        console.log(`[Activity] HITL 승인 완료. 대상 프로덕트의 Feature Flag를 활성화합니다.`);
        const growthbook = getGrowthBookClient();
        await growthbook.connect();
        await growthbook.toggleFeatureFlag(
            `gb-${patchResult.hypothesisId}`,
            50,
            `idem-${activityId}`
        );
        console.log(`[Activity] 🚀 Feature Flag 활성화 완료.`);
    });
}
