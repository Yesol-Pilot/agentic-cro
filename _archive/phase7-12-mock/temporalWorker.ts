import { Worker } from '@temporalio/worker';
import * as activities from './orchestrator/activities';
import 'dotenv/config';

/**
 * [Phase 12] Temporal Worker 클라우드 호스팅 엔트리 포인트
 * 
 * 역할: Agentic CRO의 무한 최적화 루프 워크플로우를 영속적으로 캐리합니다.
 * 실행 방법: ts-node src/temporalWorker.ts
 */
async function run() {
    console.log("==========================================");
    console.log("⚙️  Agentic CRO Temporal Worker 시작 중...");
    console.log("==========================================");

    // 환경 변수 기반 Temporal 서버 설정 (클라우드 환경 대응)
    const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';

    // 네임스페이스 및 Task Queue 정의
    const namespace = process.env.TEMPORAL_NAMESPACE || 'default';
    const taskQueue = 'agentic-cro-tasks';

    console.log(`[Worker] 접속 대상 Temporal Server: ${temporalAddress}`);
    console.log(`[Worker] 대상 Namespace: ${namespace} | TaskQueue: ${taskQueue}`);

    try {
        // 워커 인스턴스 생성 및 액티비티 바인딩
        const worker = await Worker.create({
            workflowsPath: require.resolve('./orchestrator/supervisor'), // optimizationFlywheelWorkflow가 선언된 파일
            activities,
            taskQueue: taskQueue,
        });

        console.log(`[Worker] ✅ Worker 생성 완료. Task 수신 대기 전환...`);

        // 워커 실행 (프로세스 종료 시까지 영속 동작)
        await worker.run();

    } catch (err: any) {
        console.error(`[Worker] ❌ 치명적 에러로 인한 일시 중단: ${err.message}`);
        process.exit(1);
    }
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
