'use server';

import { Connection, Client } from '@temporalio/client';
import crypto from 'crypto';

// -------------------------------------------------------------
// [Phase 13] Next.js Server Actions (Temporal Client Integration)
// -------------------------------------------------------------

// CTO 지적사항 반영 1: gRPC 커넥션 누수 방지를 위한 전역 싱글턴 패턴 (Serverless 방어)
// 글로벌 객체를 재사용하여 Next.js HMR 분실 방지 및 Vercel 환경 커넥션 풀 공유를 지원합니다.
const globalForTemporal = globalThis as unknown as {
    temporalConnection: Connection | undefined;
    temporalClient: Client | undefined;
};

async function getTemporalClient() {
    if (!globalForTemporal.temporalConnection) {
        console.log('[Server Action] 🔌 Initializing new Temporal gRPC Connection...');
        globalForTemporal.temporalConnection = await Connection.connect({
            address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
        });
    }

    if (!globalForTemporal.temporalClient) {
        globalForTemporal.temporalClient = new Client({
            connection: globalForTemporal.temporalConnection,
            namespace: process.env.TEMPORAL_NAMESPACE || 'default'
        });
    }

    return globalForTemporal.temporalClient;
}

export async function startOptimizationWorkflow(targetUrl: string) {
    try {
        const client = await getTemporalClient();
        const workflowId = `agentic-cro-flywheel-${crypto.randomUUID()}`;

        // 워크플로우 프로그래밍적 기동 (Untyped Start API 활용)
        const handle = await client.workflow.start('optimizationFlywheelWorkflow', {
            taskQueue: 'agentic-cro-tasks',
            workflowId,
            args: [{ wins: 0, targetUrl }]
        });

        return {
            success: true,
            workflowId: handle.workflowId,
            message: `Workflow started: [${handle.workflowId}]`
        };
    } catch (err: any) {
        console.error('[Server Action] 🚨 Temporal Action Error:', err);
        return {
            success: false,
            error: err.message || '워크플로우 기동을 실패했습니다.'
        };
    }
}
