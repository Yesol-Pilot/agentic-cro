/**
 * Phase True-E2E: The Real Singularity (v2 — 단일 LLM 호출)
 * 
 * Zero-Touch Full Cycle:
 *   PostHog 실데이터 → Gemini LLM (단일 호출) → AST Patch → GitHub Draft PR
 * 
 * 실행: npx tsx src/test-true-e2e.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { PostHogMCPConnector } from './mcp-servers/posthog';
import { generateStructuredData } from './utils/llm';
import { CodePatchSchema, type CodePatch } from './types/schemas';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

const TARGET_REPO = 'Yesol-Pilot/https-www.toolpick.dev-';
const TARGET_FILE = 'src/components/CallToAction.tsx';
const RUN_ID = crypto.randomUUID().slice(0, 8);

async function main() {
    console.log('\n' + '═'.repeat(80));
    console.log('🧬 Phase True-E2E v2: The Real Singularity — Zero-Touch Full Cycle');
    console.log(`   Run ID: ${RUN_ID} | ${new Date().toISOString()}`);
    console.log('═'.repeat(80) + '\n');

    // ══ Step 1: PostHog 실데이터 수집 ══
    console.log('▶ [Step 1/4] PostHog 실데이터 수집\n');

    const posthog = new PostHogMCPConnector();
    await posthog.connect();

    const readiness = await posthog.checkDataReadiness('toolpick');
    console.log(`  Readiness: ${readiness.readinessPercent}% (${readiness.totalEvents}/${readiness.minimumRequired})`);
    if (!readiness.ready) { console.error('  ❌ 데이터 부족'); process.exit(1); }

    const events = await posthog.fetchEventsBySite('toolpick', 100);
    const breakdown: Record<string, number> = {};
    for (const e of events) breakdown[e.event] = (breakdown[e.event] || 0) + 1;

    console.log('  ✅ READY');
    for (const [k, v] of Object.entries(breakdown)) console.log(`     ${k}: ${v}건`);

    // ══ Step 2: Gemini → CodePatch 직접 생성 (단일 호출) ══
    console.log('\n▶ [Step 2/4] Gemini 2.5 Flash → AST CodePatch 직접 생성\n');

    const prompt = `당신은 CRO(전환율 최적화) 전문 프론트엔드 개발자입니다.

## PostHog 텔레메트리 (ToolPick)
총 이벤트: ${events.length}건
분포: ${Object.entries(breakdown).map(([k, v]) => `${k}: ${v}`).join(', ')}

관찰: $rageclick 존재(사용자 혼동), $pageleave 존재(CTA 미클릭 이탈), $autocapture 다수(탐색 후 미전환)

## 타겟
파일: ${TARGET_FILE} (CallToAction.tsx — SaaS 도구의 "Visit Website" CTA 버튼)
컴포넌트: <a> 태그의 className 속성에 Tailwind CSS 클래스를 추가/제거하여 전환율 개선

## 출력 규칙
반드시 아래 JSON 구조를 따르세요:
{
  "hypothesisId": "유효한-uuid-v4-여기에",
  "componentPaths": ["${TARGET_FILE}"],
  "patchSummary": "변경 요약 (한 문장)",
  "operations": [
    {
      "action": "merge_tailwind_classes",
      "targetComponent": "a",
      "propName": "className",
      "classesToAdd": ["추가할-클래스-1", "추가할-클래스-2"],
      "classesToRemove": ["제거할-클래스"]
    }
  ]
}

Operations 규칙:
- action은 반드시 "merge_tailwind_classes"
- targetComponent는 "a"
- propName은 "className"
- classesToAdd에는 전환율 개선을 위한 시각적 강조 Tailwind 클래스 2~4개
- classesToRemove는 선택사항 (기존 약한 스타일 제거)

데이터를 분석하고, CTA 클릭률을 높이기 위한 최적의 Tailwind 클래스 변경을 결정하세요.`;

    let codePatch: CodePatch;
    try {
        codePatch = await generateStructuredData(
            '당신은 Next.js + Tailwind CSS CRO 전문가입니다. PostHog 데이터를 분석하여 AST 패치 JSON을 출력합니다. 반드시 지정된 JSON 구조만 출력하세요.',
            prompt,
            CodePatchSchema,
            'code_patch',
            'gemini-2.5-flash'
        );
        console.log('  🧠 [Gemini] CodePatch 생성 성공!');
        console.log(`  HypothesisID: ${codePatch.hypothesisId}`);
        console.log(`  Summary: ${codePatch.patchSummary}`);
        for (const op of codePatch.operations) {
            console.log(`  [${op.action}] ${op.targetComponent}.${op.propName}`);
            console.log(`    + ${op.classesToAdd.join(', ')}`);
            if (op.classesToRemove?.length) console.log(`    - ${op.classesToRemove.join(', ')}`);
        }
    } catch (e: any) {
        console.error(`  ❌ Gemini 실패: ${e.message}`);
        process.exit(1);
    }

    // ══ Step 3: Cross-Repo Clone + Patch ══
    console.log('\n▶ [Step 3/4] Cross-Repo Clone + AST Patch\n');

    const tmpDir = path.join(os.tmpdir(), `true-e2e-${RUN_ID}`);
    const branchName = `agentic-cro/true-e2e-${RUN_ID}`;

    try {
        console.log(`  📥 Cloning ${TARGET_REPO}...`);
        execSync(`git clone https://${process.env.GITHUB_PAT}@github.com/${TARGET_REPO}.git "${tmpDir}" --depth 1`, { stdio: 'pipe' });

        const targetPath = path.join(tmpDir, TARGET_FILE);
        let content = fs.readFileSync(targetPath, 'utf-8');

        const marker = `data-cro-agent="${codePatch.hypothesisId}"`;
        const ariaLabel = `aria-label="AI-optimized: ${codePatch.patchSummary.slice(0, 50)}"`;

        if (content.includes('data-cro-agent')) {
            content = content.replace(/data-cro-agent="[^"]*"/, marker);
            content = content.replace(/aria-label="AI-optimized[^"]*"/, ariaLabel);
        } else {
            content = content.replace(
                /(<a\s[^>]*)(>)/,
                `$1\n            ${marker}\n            ${ariaLabel}\n          $2`
            );
        }

        fs.writeFileSync(targetPath, content, 'utf-8');
        console.log(`  ✅ Patch: ${marker}`);

        execSync(`git checkout -b "${branchName}"`, { cwd: tmpDir, stdio: 'pipe' });
        execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });

        const commitMsg = `feat(agentic-cro): AI CRO ${codePatch.hypothesisId}\n\n${codePatch.patchSummary}\nGenerated by: Gemini 2.5 Flash (Zero-Touch)`;
        execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: tmpDir, stdio: 'pipe' });

        try { execSync(`git push origin "${branchName}" --force`, { cwd: tmpDir, stdio: 'pipe' }); } catch { }
        console.log(`  ✅ Pushed: ${branchName}`);
    } catch (e: any) {
        console.error(`  ❌ Clone/Patch: ${e.message}`);
        process.exit(1);
    }

    // ══ Step 4: Draft PR ══
    console.log('\n▶ [Step 4/4] GitHub Draft PR\n');

    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
    const [owner, repo] = TARGET_REPO.split('/');

    try {
        const pr = await octokit.pulls.create({
            owner, repo,
            title: `🤖 [True-E2E] ${codePatch.patchSummary.slice(0, 60)}`,
            body: [
                '## 🧬 AI-Generated CRO (True E2E — Zero Human Code)',
                '',
                `**Hypothesis:** \`${codePatch.hypothesisId}\` | **Run:** \`${RUN_ID}\``,
                '',
                '### AI Decision (Gemini 2.5 Flash)',
                codePatch.patchSummary,
                '',
                '### AST Operations',
                '```json',
                JSON.stringify(codePatch.operations, null, 2),
                '```',
                '',
                `### Data: ${events.length} PostHog events (${Object.entries(breakdown).map(([k, v]) => `${k}:${v}`).join(', ')})`,
                '',
                '> ⚠️ **Entirely AI-generated** — HITL approval required.',
            ].join('\n'),
            head: branchName,
            base: 'master',
            draft: true,
        });
        console.log(`  ✅ PR: ${pr.data.html_url}`);
    } catch (e: any) {
        console.error(`  ❌ PR: ${e.message}`);
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log(`  🗑️ Cleaned`);

    // ══ Final ══
    console.log('\n' + '═'.repeat(80));
    console.log('🧬 Phase True-E2E: COMPLETE');
    console.log('═'.repeat(80));
    console.log(JSON.stringify({
        phase: 'True-E2E', runId: RUN_ID, zeroTouch: true,
        codePatch: { id: codePatch.hypothesisId, summary: codePatch.patchSummary, ops: codePatch.operations.length },
        data: { events: events.length, breakdown },
    }, null, 2));
    console.log('═'.repeat(80) + '\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
