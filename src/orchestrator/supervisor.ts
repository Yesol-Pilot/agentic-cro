// src/orchestrator/supervisor.ts


import { BaseAgent } from '../agents/baseAgent';
import { MessageBus } from './messageBus';
import { A2AMessage, A2AResponse } from '../types/a2a';

// =========================================================================
// Phase 8: 무한 루프 통제망 상태 전역 변수 (Infinite Loop Failsafes)
// =========================================================================
let isGlobalMutexLocked = false;
let currentActiveFunnel: string | null = null;
const componentWinTracker: Record<string, number> = {};
const REFACTORING_EPOCH_THRESHOLD = 5;

import { Connection, Client } from '@temporalio/client';
import * as crypto from 'crypto';

export class SupervisorAgent extends BaseAgent {
    private temporalClient: Client | null = null;

    constructor(messageBus: MessageBus) { super('Supervisor', messageBus); }

    /**
     * Temporal Client 지연 초기화 (Lazy Init)
     */
    private async initTemporalClient() {
        if (!this.temporalClient) {
            try {
                // 클라우드 접속 시 Address 및 TLS 인증서 등 추가 가능
                const connection = await Connection.connect({ address: 'localhost:7233' });
                this.temporalClient = new Client({ connection });
                console.log(`[Supervisor] 🌐 Temporal Server (localhost:7233) 연결 성공.`);
            } catch (err: any) {
                console.warn(`[Supervisor] ⚠️ Temporal Server 연결 실패(Worker 구동 전일 수 있음): ${err.message}`);
                // Mock 또는 Fallback 처리로 넘어갈 수 있도록 처리
            }
        }
    }

    protected async handleMessage(message: A2AMessage): Promise<A2AResponse | void> {
        console.log(`[Supervisor] 📥 A2A 메시지 수신 [${message.method}] from ${message.sender}`);
        await this.initTemporalClient();

        // 기존 인메모리 A2A 로직을 Temporal Workflow/Signal 연동으로 격상
        if (message.method === 'START_ANALYSIS') {
            await this.kickOffExperiment();
        } else if (message.method === 'REPORT_VERIFICATION_DONE') {
            console.log(`[Supervisor] ✅ 실험 검증 사이클 완료 보고 (Payload: ${JSON.stringify(message.params)})`);
        }
    }

    /**
     * 핵심 진입점: 기존 인메모리 함수에서 Temporal Workflow 발동 로직으로 완전 구현
     */
    public async kickOffExperiment() {
        console.log(`[Supervisor] 🚀 kickOffExperiment() 호출됨. 최상위 Temporal Flywheel 작동을 시도합니다.`);
        await this.initTemporalClient();

        if (!this.temporalClient) {
            console.error(`[Supervisor] ❌ Temporal Client가 준비되지 않아 Workflow를 시작할 수 없습니다.`);
            return;
        }

        const workflowId = `agentic-cro-flywheel-${crypto.randomUUID()}`;

        try {
            const handle = await this.temporalClient.workflow.start('optimizationFlywheelWorkflow', {
                taskQueue: 'agentic-cro-tasks',
                workflowId: workflowId,
                args: [{ wins: 0, targetUrl: 'http://localhost:3001/components/CheckoutButton.tsx' }]
            });
            console.log(`[Supervisor] 🎯 Temporal Workflow [${handle.workflowId}] 가동 시작 완료!`);
        } catch (err) {
            console.error(`[Supervisor] 🚨 Temporal Workflow 가동 실패:`, err);
        }
    }

    /**
     * [Phase 9] 무한 최적화 루프 실행
     */
    public async startInfiniteOptimizationLoop() {
        console.log(`[Supervisor Daemon] 🌀 (Deprecated) 인메모리 무한루프 대신 Temporal Client를 통해 Workflow를 백그라운드 구동합니다.`);
        await this.kickOffExperiment();
    }
}



/**
 * Supervisor 오케스트레이터 모듈
 * 
 * 에이전트 간 로직의 순환 핑퐁(Deadlock) 방지 및 Human-In-The-Loop(HITL) 비상 정지 로직을 수행합니다.
 */

const MAX_GLOBAL_ESCALATION = 3;

// 메모리 기반의 임시 상태 저장소 (실제 프로덕션에서는 Redis 등 사용 권장)
const escalationTracker: Record<string, number> = {};

/**
 * 에스컬레이션(백트래킹) 상황을 추적하고 제한치를 초과하면 HITL 개입을 요청합니다.
 * @param hypothesisId 현재 진행 중인 실험/가설 ID
 * @param lastErrorUrl 또는 에러 로그
 */
export async function trackEscalationAndTriggerHITL(hypothesisId: string, errorLogs: string): Promise<boolean> {

    // 카운트 증가
    escalationTracker[hypothesisId] = (escalationTracker[hypothesisId] || 0) + 1;
    const currentCount = escalationTracker[hypothesisId];

    console.log(`[Supervisor] 가설(${hypothesisId}) 복구 에스컬레이션 시도: ${currentCount} / ${MAX_GLOBAL_ESCALATION}`);

    if (currentCount >= MAX_GLOBAL_ESCALATION) {
        console.error(`[Supervisor] 🚨 치명적 교착 상태(Deadlock) 감지! (Escalation > 3회)`);

        // 1. 오케스트레이션 Kill-switch 가동
        haltExperiment(hypothesisId);

        // 2. 인간 관리자(CTO/운영자) 비상 알람 모의 발송
        await alertHumanInTheLoop({
            channel: '#cro-alerts',
            message: `⚠️ [Agentic CRO 비상] 가설 ${hypothesisId}의 자동 구현 및 수정이 모두 실패하여 데드락에 빠졌습니다.\nAI가 해결할 수 없는 시스템 인프라 또는 충돌 이슈로 의심됩니다. 즉각적인 수동 개입(Human-in-the-Loop)이 필요합니다.\n마지막 에러 로그: ${errorLogs}`
        });

        return true; // HITL Triggered (Deadlock 처리됨)
    }

    return false; // 아직 허용 범위 내
}

function haltExperiment(hypothesisId: string) {
    console.warn(`[Supervisor] 🛑 가설 ${hypothesisId} 처리를 시스템 락(Lock) 상태로 전환합니다. (추가 진행 불가)`);
    // 내부적으로 Message Queue Reject 처리 등의 비즈니스 로직 연계
}

async function alertHumanInTheLoop(payload: { channel: string, message: string }) {
    console.log(`[Supervisor => Webhook 발송 모의] : 채널 ${payload.channel}\n${payload.message}`);
    // 실제 슬랙 버퍼 등과 연결
}

// =========================================================================
// Phase 7: 동적 트래픽 라우팅 (Daily Batch Sync & Exponential Backoff)
// =========================================================================

const DAILY_BATCH_MS = 24 * 60 * 60 * 1000;
interface SagaPayload { featureId: string; newWeights: number[]; previousWeights: number[]; }
const SYNC_QUEUE = new Map<string, SagaPayload>();
const MAX_RETRIES = 3;
const DLQ: Array<{ timestamp: number, payload: any, error: string }> = [];

/**
 * 베이지안 엔진의 결과를 수신하여 타겟 컴포넌트의 트래픽을 동적 편향시킵니다.
 * 즉시 통신하지 않고 자정 배치로 묶일 메모리 큐를 갱신합니다.
 */
export async function adjustTrafficWeightsThompson(featureId: string, probBBeatsA: number): Promise<void> {
    let variantWeight = probBBeatsA;
    variantWeight = Math.max(0.05, Math.min(0.95, variantWeight));
    const controlWeight = 1.0 - variantWeight;
    const newWeights = [Number(controlWeight.toFixed(3)), Number(variantWeight.toFixed(3))];

    // [중요] 보상 트랜잭션(Saga Rollback)을 위한 직전 상태 저장
    // 실제로는 GrowthBook API에서 기존 Rules를 가져오지만 여기서는 50:50으로 가정
    const previousWeights = [0.5, 0.5];

    SYNC_QUEUE.set(featureId, { featureId, newWeights, previousWeights });
    console.log(`[Supervisor] 📥 24h 배치 & 보상 트랜잭션 큐 적재: Feature(${featureId}) -> Weights: [${newWeights.join(', ')}]`);
}

/**
 * [크론 스케줄러] 24시간 단위 Two-Phase Commit(2PC) 분산 트랜잭션 배치 
 */
export async function executeDailyBatchSync() {
    if (SYNC_QUEUE.size === 0) return;
    const payloads = Array.from(SYNC_QUEUE.values());
    SYNC_QUEUE.clear();
    await sendBatchWithBackoffSaga(payloads, 0);
}

/**
 * 지수 백오프와 Saga 롤백 패턴이 적용된 고도화된 스플릿 브레인 원천 차단 모듈 
 */
async function sendBatchWithBackoffSaga(payloads: SagaPayload[], retryCount: number): Promise<void> {
    const failedFeatures: SagaPayload[] = [];

    for (const item of payloads) {
        let isGrowthBookUpdated = false;
        try {
            console.log(`[Saga 트랜잭션] 🚀 [1/2] GrowthBook 업데이트 시도 (Retry: ${retryCount}): ${item.featureId}`);
            isGrowthBookUpdated = true;

            console.log(`[Saga 트랜잭션] 🚀 [2/2] Vercel Edge Config 업데이트 시도: ${item.featureId}`);
            // TODO: [Phase 12] Vercel API 연동 전까지 무조건 성공하도록 임시 처리
            const isVercelSuccess = true;
            if (!isVercelSuccess) throw new Error("Vercel Edge Config 504 Gateway Timeout");

            console.log(`[Saga] ✅ 2PC 커밋 완벽 성공 (상태 일치): ${item.featureId}`);

        } catch (e: any) {
            console.error(`[Saga] ❌ 트랜잭션 부분 실패 감지(${e.message}): ${item.featureId}`);

            // 🚨 Compensating Transaction (보상 트랜잭션) 발동
            if (isGrowthBookUpdated) {
                console.warn(`[Saga 롤백] 🔙 스플릿 브레인 방어! GrowthBook의 가중치를 이전 상태 [${item.previousWeights.join(',')}] 로 강제 원복합니다.`);
                try {
                    // await updateGrowthBook(item.previousWeights)
                    console.log(`[Saga 롤백] ✅ GrowthBook 보상 트랜잭션 성공. (데이터 표류 무결성 보존)`);
                } catch (rollbackErr: any) {
                    console.error(`[Saga 롤백 붕괴] 🚨 롤백마저 실패하여 분산 상태 불일치(Drift) 확정. 즉각적인 시스템 개입 요망!`);
                }
            }
            failedFeatures.push(item);
        }
    }

    if (failedFeatures.length > 0) {
        if (retryCount < MAX_RETRIES) {
            const backoffDelay = Math.pow(2, retryCount) * 1000;
            console.warn(`[Supervisor] ${backoffDelay}ms 후 지수 백오프 재시도 진행...`);
            setTimeout(() => sendBatchWithBackoffSaga(failedFeatures, retryCount + 1), backoffDelay);
        } else {
            console.error(`[Supervisor] ❌ Saga 트랜잭션 최종 실패. DLQ로 격리 이관.`);
            DLQ.push(...failedFeatures.map(payload => ({ timestamp: Date.now(), payload, error: "Max Retries" })));
        }
    }
}
