import { Context } from '@temporalio/activity';
import { context, trace } from '@opentelemetry/api';
import { PostHogMCPConnector } from '../mcp-servers/posthog';
import { generateStructuredData } from '../utils/llm';
import { CodePatchSchema, type CodePatch } from '../types/schemas';
import { applySurgicalASTPatch, type ASTPatchOperation } from '../utils/ast/modifier';
import { getGitHubAuthToken, getAuthenticatedCloneUrl } from '../mcp-servers/github';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const tracer = trace.getTracer('agentic-cro-activities');

function runWithTraceContext<T>(activityName: string, fn: (traceId: string, activityId: string) => Promise<T>): Promise<T> {
    const info = Context.current().info;
    const workflowId = info.workflowExecution.workflowId;
    const runId = info.workflowExecution.runId;
    const activityId = info.activityId;
    const traceId = `trace-${workflowId}-${runId}`;

    return tracer.startActiveSpan(activityName, async (span) => {
        span.setAttribute('workflow.id', workflowId);
        span.setAttribute('workflow.runId', runId);
        span.setAttribute('activity.id', activityId);
        span.setAttribute('trace.id', traceId);

        console.log(`[Activity: ${activityName}] 시작 (TraceID: ${traceId})`);
        try {
            const result = await fn(traceId, activityId);
            span.setStatus({ code: 1 });
            return result;
        } catch (error: any) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            console.error(`[Activity: ${activityName}] ❌ 에러: ${error.message}`);
            throw error;
        } finally {
            span.end();
            console.log(`[Activity: ${activityName}] 🏁 정상 종료`);
        }
    });
}

// 1. 트래픽 분석 (PostHog 연동)
export async function analyzeTrafficActivity(): Promise<any> {
    return runWithTraceContext('analyzeTrafficActivity', async () => {
        const posthog = new PostHogMCPConnector();
        await posthog.connect();

        const readiness = await posthog.checkDataReadiness('toolpick');
        console.log(`[PostHog] Readiness: ${readiness.readinessPercent}%`);
        if (!readiness.ready) {
            throw new Error('Data Readiness 부족 - 충분한 트래픽이 모일 때까지 대기');
        }

        const events = await posthog.fetchEventsBySite('toolpick', 100);
        const breakdown: Record<string, number> = {};
        for (const e of events) breakdown[e.event] = (breakdown[e.event] || 0) + 1;

        return Object.entries(breakdown).map(([k, v]) => `${k}: ${v}`).join(', ');
    });
}

// 2. 가설 및 AST Operations 생성 (Gemini 3.1 Pro 연동)
export async function generateHypothesisActivity(trafficData: string): Promise<CodePatch> {
    return runWithTraceContext('generateHypothesisActivity', async () => {
        const prompt = `당신은 CRO 전문가입니다.
PostHog 분포: ${trafficData}
타겟 파일: src/components/CallToAction.tsx (<a> 태그 className)

출력 형식(JSON):
{
  "hypothesisId": "uuid",
  "componentPaths": ["src/components/CallToAction.tsx"],
  "patchSummary": "요약",
  "operations": [{
    "action": "merge_tailwind_classes",
    "targetComponent": "a",
    "propName": "className",
    "classesToAdd": ["추가할-클래스"],
    "classesToRemove": ["제거할-클래스"]
  }]
}`;
        const codePatch = await generateStructuredData(
            'JSON만 출력하세요.',
            prompt,
            CodePatchSchema,
            'code_patch',
            'gemini-3.1-pro-preview'
        );
        console.log(`[Gemini] CodePatch 생성 완료 - ${codePatch.hypothesisId}`);
        return codePatch;
    });
}

// 3. 실제 AST 적용 및 GitHub PR 생성
export async function applyASTAndCreatePRActivity(codePatch: CodePatch): Promise<string> {
    return runWithTraceContext('applyASTAndCreatePRActivity', async (traceId) => {
        const TARGET_REPO = 'Yesol-Pilot/https-www.toolpick.dev-';
        const TARGET_FILE = codePatch.componentPaths[0] || 'src/components/CallToAction.tsx';

        const auth = await getGitHubAuthToken();
        const cloneUrl = getAuthenticatedCloneUrl(TARGET_REPO, auth);
        const tmpDir = path.join(os.tmpdir(), `temporal-e2e-${traceId}`);
        const branchName = `agentic-cro/durable-${codePatch.hypothesisId}`;

        try {
            console.log(`[GitHub] Cloning ${TARGET_REPO}...`);
            execSync(`git clone "${cloneUrl}" "${tmpDir}" --depth 1`, { stdio: 'pipe' });

            const targetPath = path.join(tmpDir, TARGET_FILE);
            const astOps: ASTPatchOperation[] = codePatch.operations.map(op => ({
                action: op.action as 'merge_tailwind_classes',
                targetComponent: op.targetComponent,
                propName: op.propName,
                classesToAdd: op.classesToAdd,
                classesToRemove: op.classesToRemove,
            }));

            const result = await applySurgicalASTPatch(targetPath, astOps, codePatch.hypothesisId);
            if (!result) {
                throw new Error('AST 수술 변경점 없음');
            }

            execSync(`git checkout -b "${branchName}"`, { cwd: tmpDir, stdio: 'pipe' });
            execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });
            execSync(`git commit -m "feat(cro): Durable AST surgery by AI [${codePatch.hypothesisId}]"`, { cwd: tmpDir, stdio: 'pipe' });
            execSync(`git push origin "${branchName}" --force`, { cwd: tmpDir, stdio: 'pipe' });

            // Github PR 개설
            const { Octokit } = await import('@octokit/rest');
            const octokit = new Octokit({ auth: auth.token });
            const [owner, repo] = TARGET_REPO.split('/');

            const pr = await octokit.pulls.create({
                owner, repo,
                title: `🤖 [Durable] ${codePatch.patchSummary.slice(0, 60)}`,
                body: `## ⏳ Durable E2E - Temporal Orchestration\n\n**Hypothesis:** \`${codePatch.hypothesisId}\`\n\n${codePatch.patchSummary}`,
                head: branchName,
                base: 'master',
                draft: true,
            });

            console.log(`[GitHub] PR Created: ${pr.data.html_url}`);
            return pr.data.html_url;

        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
}
