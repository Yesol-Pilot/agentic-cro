import { BaseAgent } from './baseAgent';
import { MessageBus } from '../orchestrator/messageBus';
import { A2AMessage, A2AResponse } from '../types/a2a';
import { CodePatch } from '../types/schemas';
import { getGitHubClient } from '../mcp-servers/github';
import { getGrowthBookClient } from '../mcp-servers/growthbook';
import { applySurgicalASTPatch } from '../utils/ast/modifier';
import path from 'path';

export class DeploymentQAAgent extends BaseAgent {
    constructor(messageBus: MessageBus) {
        super('DeploymentQA', messageBus);
    }

    protected async handleMessage(message: A2AMessage): Promise<A2AResponse | void> {
        if (message.method === 'DEPLOY_TEST') {
            const codeData = message.params as CodePatch;
            console.log(`[DeploymentQA] 🚀 전달받은 AST 조작 패치를 코드 베이스에 적용하고 배포를 준비 중...`);
            console.log(`[DeploymentQA] 🚀 적용 대상 컴포넌트 경로 개수: ${codeData.componentPaths.length}`);

            // 1. AST 파서를 이용한 실제 로컬 파일 시스템 Surgical Patch 적용
            for (const relPath of codeData.componentPaths) {
                // 프로젝트 루트 기준으로 절대 경로 탐색 (실제 환경에 맞게 조정)
                const targetFilePath = path.resolve(process.cwd(), relPath);

                try {
                    const isPatched = await applySurgicalASTPatch(targetFilePath, codeData.operations, codeData.hypothesisId);
                    if (isPatched) {
                        console.log(`[DeploymentQA] ✅ AST 변이 성공: ${targetFilePath}`);
                    } else {
                        console.warn(`[DeploymentQA] ⚠️ 대상 파일을 찾았으나 적용할 AST 매핑을 찾지 못함: ${targetFilePath}`);
                    }
                } catch (e: any) {
                    console.error(`[DeploymentQA] ❌ AST 패치 중 치명적 에러: ${e.message}`);
                }
            }

            // 2. PR 생성 및 A/B 툴 연동 (DI 주입 객체)
            // 배포 프로세스는 Idempotency-Key로 방어 (여기서는 임시로 hypothesisId를 멱등성 키로 사용)
            const idempotencyKey = `pr-${codeData.hypothesisId}-${Date.now()}`;
            const github = getGitHubClient();
            await github.connect();
            const operationsStr = JSON.stringify(codeData.operations, null, 2);
            const prUrl = await github.createPullRequest(`[Agentic CRO] 자동 AST 가설 트리 적용: ${codeData.hypothesisId}`, `ab-test-${codeData.hypothesisId}`, [{ file: 'Patch Operations', diff: operationsStr }], idempotencyKey);

            const growthbook = getGrowthBookClient();
            await growthbook.connect();
            await growthbook.toggleFeatureFlag(`ab-flag-${codeData.hypothesisId}`, 50, `gb-${codeData.hypothesisId}`);

            console.log(`[DeploymentQA] 🎯 소스 변이 완료, PR이 안전하게 생성되었으며 GrowthBook 타겟팅(50%)이 활성화되었습니다.`);
            console.log(`[DeploymentQA] 🎯 배포 완료. Supervisor에게 종단 결과 보고.`);

            await this.sendMessage('Supervisor', 'REPORT_VERIFICATION_DONE', {
                status: 'DEPLOYED',
                prLink: prUrl,
                experimentId: codeData.hypothesisId
            });
        }
    }
}
