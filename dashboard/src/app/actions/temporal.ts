'use server';

import { Connection, Client } from '@temporalio/client';
import crypto from 'crypto';

// -------------------------------------------------------------
// [Phase 13] Next.js Server Actions (Temporal Client Integration)
// -------------------------------------------------------------
// 브라우저에 Temporal Client 의존성이나 보안 크리덴셜을 노출하지 않고
// 오직 백엔드 서버에서만 안전하게 워크플로우를 타격(Trigger)합니다.
// -------------------------------------------------------------

export async function startOptimizationWorkflow(targetUrl: string) {
    try {
        // 1. gRPC 기반 Temporal 서버와의 커넥션 확립
        const connection = await Connection.connect({
            address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
        });

        // 2. 워크플로우 클라이언트 스핀업 (Idempotency 등 인프라 설정)
        const client = new Client({
            connection,
            namespace: process.env.TEMPORAL_NAMESPACE || 'default'
        });

        const workflowId = `agentic-cro-flywheel-${crypto.randomUUID()}`;

        // 3. 워크플로우 프로그래밍적 기동 (Untyped Start API 활용)
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
