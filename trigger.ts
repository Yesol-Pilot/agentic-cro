import { Connection, Client } from '@temporalio/client';
import * as crypto from 'crypto';

async function run() {
    console.log('Connecting to Temporal server...');
    const connection = await Connection.connect();
    const client = new Client({ connection });

    const targetUrl = 'http://localhost:3001/components/CheckoutButton.tsx';
    const workflowId = `agentic-cro-flywheel-${crypto.randomUUID()}`;

    console.log(`Starting workflow for: ${targetUrl}`);

    const handle = await client.workflow.start('optimizationFlywheelWorkflow', {
        taskQueue: 'agentic-cro-tasks-default-tenant',
        workflowId,
        args: [{ wins: 0, targetUrl, tenantId: 'default-tenant' }]
    });

    console.log(`✅ Started workflow: ${handle.workflowId}`);
}

run().catch(console.error);
