/**
 * [Phase MVP] The Durable Singularity — Workflow Starter
 */
import 'dotenv/config';
import { Connection, Client } from '@temporalio/client';
import * as crypto from 'crypto';

async function main() {
    // Windows에서 localhost가 ::1(IPv6)으로 해석되는 경우를 방지하기 위해 127.0.0.1 명시
    const temporalAddress = process.env.TEMPORAL_ADDRESS || '127.0.0.1:7233';

    console.log('═══════════════════════════════════════════');
    console.log('🧬 Phase MVP: The Durable Singularity');
    console.log(`   Temporal Server: ${temporalAddress}`);
    console.log('═══════════════════════════════════════════');

    console.log('[Starter] Connecting to Temporal...');
    const connection = await Connection.connect({ address: temporalAddress });
    console.log('[Starter] ✅ Connected!');

    const client = new Client({ connection });
    const workflowId = `durable-e2e-${crypto.randomUUID().slice(0, 8)}`;

    console.log(`[Starter] Submitting workflow: ${workflowId}`);
    const handle = await client.workflow.start('optimizationFlywheelWorkflow', {
        taskQueue: 'agentic-cro-tasks',
        workflowId,
        args: [{ wins: 0 }],
    });

    console.log(`\n🚀 Workflow 제출 완료!`);
    console.log(`   Workflow ID: ${handle.workflowId}`);
    console.log(`   Run ID:      ${handle.firstExecutionRunId}`);
    console.log(`   UI:          http://localhost:8233/namespaces/default/workflows/${handle.workflowId}`);
    console.log(`\n⏳ 워크플로우 완료 대기중...\n`);

    try {
        const result = await handle.result();
        console.log('✅ 워크플로우 정상 완료:', result);
    } catch (err: any) {
        console.error('❌ 워크플로우 실패:', err.message);
    }
}

main().catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
});
