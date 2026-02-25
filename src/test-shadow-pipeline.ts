/**
 * Phase R3: Shadow Mode Pipeline Test
 * 
 * 가상 퍼널 데이터 → Hypothesis → Cross-Repo Clone → AST Patch → Draft PR → GC
 * 
 * 실행: npx tsx src/test-shadow-pipeline.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { Octokit } from '@octokit/rest';

// ── Config ─────────────────────────────────────────
const TARGET_REPO_OWNER = 'Yesol-Pilot';
const TARGET_REPO_NAME = 'https-www.toolpick.dev-';
const TARGET_COMPONENT = 'src/components/CallToAction.tsx';
const EXPERIMENT_BRANCH = 'agentic-cro/experiment-shadow-001';
const RUN_ID = crypto.randomUUID().slice(0, 8);
const CLONE_DIR = path.join(os.tmpdir(), `agentic-cro-target-${RUN_ID}`);
const GITHUB_PAT = process.env.GITHUB_PAT || '';

async function main() {
    console.log('\n' + '═'.repeat(70));
    console.log('🎯 Phase R3: Shadow Mode Pipeline — Cross-Repo PR 파이프라인 검증');
    console.log('═'.repeat(70));
    console.log(`  RunID: ${RUN_ID}`);
    console.log(`  Target: ${TARGET_REPO_OWNER}/${TARGET_REPO_NAME}`);
    console.log(`  Component: ${TARGET_COMPONENT}`);
    console.log(`  Clone Dir: ${CLONE_DIR}`);
    console.log(`  Branch: ${EXPERIMENT_BRANCH}`);
    console.log('─'.repeat(70) + '\n');

    // ══════════════════════════════════════════════════
    // Step 1: Shadow Mode 상태 주입 (가상 퍼널 데이터)
    // ══════════════════════════════════════════════════
    console.log('▶ [Step 1/3] Shadow Mode 상태 주입 — 가상 퍼널 데이터 생성\n');

    const mockFunnelData = {
        site: 'toolpick',
        totalEvents: 1200,
        readiness: { ready: true, readinessPercent: 100 },
        funnel: {
            L1_pageview: 1200,
            L2_scroll: 720,
            L3_cta_viewport: 480,
            L4_cta_click: 150,
            L5_affiliate: 45,
            dropOffRate: 87.5,
        },
        description: '[Shadow] PV:1200 → Scroll:720 → CTA VP:480 → CTA Click:150 → Affiliate:45 | 이탈률: 87.5%',
    };

    console.log('  📊 Injected Mock Funnel Data:');
    console.log(JSON.stringify(mockFunnelData, null, 2));

    // 가상 분석 리포트 → Hypothesis 생성 (LLM 없이 직접 생성)
    const mockHypothesis = {
        hypothesisId: crypto.randomUUID(),
        targetRoute: TARGET_COMPONENT,
        uxRationale: `CTA 클릭률 12.5% (150/1200)로 심각한 이탈 감지. CTA 버튼의 시각적 존재감 강화 필요 — 배경색 대비 향상, 폰트 크기 확대, 여백 추가로 클릭 영역(Tap Target) 최적화.`,
        uiDirectives: [
            {
                selector: 'a[data-cta]',
                action: 'MODIFY_STYLE' as const,
                description: 'CTA 버튼 배경색을 고대비 emerald-500으로 변경, 폰트 크기 확대, 패딩 추가',
            },
        ],
    };

    console.log('\n  💡 Generated Hypothesis:');
    console.log(JSON.stringify({ id: mockHypothesis.hypothesisId.slice(0, 8), rationale: mockHypothesis.uxRationale.slice(0, 80) + '...' }, null, 2));

    // ══════════════════════════════════════════════════
    // Step 2: Cross-Repo Clone + AST 패치
    // ══════════════════════════════════════════════════
    console.log('\n▶ [Step 2/3] Cross-Repo AST 조작 — ToolPick Clone + ts-morph 패치\n');

    // 2-1. Clone
    console.log(`  📦 Cloning ${TARGET_REPO_OWNER}/${TARGET_REPO_NAME} → ${CLONE_DIR}`);
    const cloneUrl = `https://${GITHUB_PAT}@github.com/${TARGET_REPO_OWNER}/${TARGET_REPO_NAME}.git`;

    try {
        execSync(`git clone --depth 1 "${cloneUrl}" "${CLONE_DIR}"`, { stdio: 'pipe' });
        console.log('  ✅ Clone 완료');
    } catch (e: any) {
        console.error('  ❌ Clone 실패:', e.message);
        process.exit(1);
    }

    // 2-2. 타겟 컴포넌트 존재 확인
    const targetFilePath = path.join(CLONE_DIR, TARGET_COMPONENT);
    if (!fs.existsSync(targetFilePath)) {
        console.error(`  ❌ 타겟 파일 미발견: ${targetFilePath}`);
        cleanup(CLONE_DIR);
        process.exit(1);
    }
    console.log(`  📄 타겟 파일 확인: ${TARGET_COMPONENT}`);

    // 2-3. AST 패치 (ts-morph 직접 사용)
    console.log('  🔧 ts-morph AST 패치 실행...');

    const { Project, SyntaxKind, Node } = await import('ts-morph');
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(targetFilePath);

    // CallToAction.tsx 내 <a> 태그에 data-cro-agent 속성 삽입 + aria-label 추가
    const jsxElements = [
        ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ];

    let patchApplied = false;
    for (const el of jsxElements) {
        const tagName = el.getTagNameNode().getText();
        if (tagName === 'a') {
            // data-cro-agent 가역성 마커 삽입
            const existingMarker = el.getAttribute('data-cro-agent');
            if (!existingMarker) {
                el.addAttribute({
                    name: 'data-cro-agent',
                    initializer: `"${mockHypothesis.hypothesisId}"`,
                });
                console.log(`  ✅ data-cro-agent 마커 삽입 완료`);
            }

            // aria-label 추가 (접근성 개선 + CRO)
            const existingAria = el.getAttribute('aria-label');
            if (!existingAria) {
                el.addAttribute({
                    name: 'aria-label',
                    initializer: `{\`Visit \${software.name} — Special Offer\`}`,
                });
                console.log(`  ✅ aria-label 접근성 속성 삽입 완료`);
            }

            patchApplied = true;
            break;
        }
    }

    if (patchApplied) {
        await sourceFile.save();
        console.log('  ✅ AST 패치 저장 완료');

        // 패치된 파일 diff 확인
        const patchedContent = fs.readFileSync(targetFilePath, 'utf-8');
        const patchedLines = patchedContent.split('\n');
        const markerLine = patchedLines.findIndex(l => l.includes('data-cro-agent'));
        if (markerLine >= 0) {
            console.log(`\n  📝 패치 확인 (라인 ${markerLine + 1} 부근):`);
            const start = Math.max(0, markerLine - 1);
            const end = Math.min(patchedLines.length, markerLine + 3);
            for (let i = start; i < end; i++) {
                const prefix = i === markerLine ? '  >> ' : '     ';
                console.log(`${prefix}${i + 1}: ${patchedLines[i]}`);
            }
        }
    } else {
        console.warn('  ⚠️ AST 패치 대상 <a> 태그를 찾지 못했습니다.');
    }

    // ══════════════════════════════════════════════════
    // Step 3: Draft PR 생성 + GC
    // ══════════════════════════════════════════════════
    console.log('\n▶ [Step 3/3] Draft PR 생성 및 /tmp GC 검증\n');

    try {
        // 3-1. Git 설정 + 브랜치 + 커밋
        execSync(`git config user.email "agentic-cro@neogenesis.app"`, { cwd: CLONE_DIR, stdio: 'pipe' });
        execSync(`git config user.name "Agentic CRO Bot"`, { cwd: CLONE_DIR, stdio: 'pipe' });

        // 기존 원격 브랜치 삭제 시도 (재실행 대비)
        try {
            execSync(`git push origin --delete ${EXPERIMENT_BRANCH}`, { cwd: CLONE_DIR, stdio: 'pipe' });
        } catch { /* 브랜치 미존재 시 무시 */ }

        execSync(`git checkout -b ${EXPERIMENT_BRANCH}`, { cwd: CLONE_DIR, stdio: 'pipe' });
        execSync(`git add -A`, { cwd: CLONE_DIR, stdio: 'pipe' });
        execSync(`git commit -m "[Agentic CRO Shadow] AST patch: CTA accessibility + CRO marker (${RUN_ID})"`, { cwd: CLONE_DIR, stdio: 'pipe' });
        execSync(`git push origin ${EXPERIMENT_BRANCH} --force`, { cwd: CLONE_DIR, stdio: 'pipe' });
        console.log(`  ✅ 브랜치 ${EXPERIMENT_BRANCH} Push 완료`);

        // 3-2. Octokit으로 Draft PR 생성
        const octokit = new Octokit({ auth: GITHUB_PAT });

        // 기존 PR이 있으면 찾아서 링크 반환
        let prUrl = '';
        const existingPRs = await octokit.rest.pulls.list({
            owner: TARGET_REPO_OWNER,
            repo: TARGET_REPO_NAME,
            head: `${TARGET_REPO_OWNER}:${EXPERIMENT_BRANCH}`,
            state: 'open',
        });

        if (existingPRs.data.length > 0) {
            prUrl = existingPRs.data[0].html_url;
            console.log(`  ♻️ 기존 PR 발견: ${prUrl}`);
        } else {
            const pr = await octokit.rest.pulls.create({
                owner: TARGET_REPO_OWNER,
                repo: TARGET_REPO_NAME,
                title: `[Agentic CRO Shadow] CTA 접근성 개선 + CRO 마커 주입 (Run: ${RUN_ID})`,
                head: EXPERIMENT_BRANCH,
                base: 'master',
                body: [
                    '## 🤖 Agentic CRO — Shadow Mode Auto-Generated PR',
                    '',
                    '### 가설 (Hypothesis)',
                    `> ${mockHypothesis.uxRationale}`,
                    '',
                    '### 변경 사항',
                    `- \`${TARGET_COMPONENT}\`에 \`data-cro-agent\` 가역성 마커 삽입`,
                    '- `aria-label` 접근성 속성 추가',
                    '',
                    '### 퍼널 데이터 (Mock)',
                    '```json',
                    JSON.stringify(mockFunnelData.funnel, null, 2),
                    '```',
                    '',
                    `> **Run ID:** \`${RUN_ID}\``,
                    `> **Hypothesis ID:** \`${mockHypothesis.hypothesisId}\``,
                    '',
                    '⚠️ **This is a Shadow Mode test PR. Do NOT merge.**',
                ].join('\n'),
                draft: true,
            });
            prUrl = pr.data.html_url;
            console.log(`  ✅ Draft PR 생성 완료: ${prUrl}`);
        }

        // 3-3. GC (Garbage Collection) — /tmp 클린업
        console.log('\n  🧹 /tmp GC (Garbage Collection) 실행...');
        cleanup(CLONE_DIR);
        console.log(`  ✅ ${CLONE_DIR} 삭제 완료`);

        // 최종 결과
        console.log('\n' + '═'.repeat(70));
        console.log('✅ Phase R3: Shadow Mode Pipeline 전 단계 완료');
        console.log('═'.repeat(70));

        const finalReport = {
            timestamp: new Date().toISOString(),
            phase: 'R3',
            runId: RUN_ID,
            steps: {
                step1_shadowInjection: {
                    status: 'SUCCESS',
                    mockFunnel: mockFunnelData.funnel,
                    hypothesisId: mockHypothesis.hypothesisId,
                },
                step2_astPatch: {
                    status: patchApplied ? 'SUCCESS' : 'SKIPPED',
                    targetFile: TARGET_COMPONENT,
                    patchType: 'data-cro-agent marker + aria-label',
                },
                step3_draftPR: {
                    status: 'SUCCESS',
                    prUrl,
                    branch: EXPERIMENT_BRANCH,
                    gcCompleted: !fs.existsSync(CLONE_DIR),
                },
            },
        };

        console.log('\n📋 Final Report:');
        console.log(JSON.stringify(finalReport, null, 2));
        console.log('\n' + '═'.repeat(70) + '\n');

    } catch (e: any) {
        console.error(`  ❌ Step 3 실패: ${e.message}`);
        cleanup(CLONE_DIR);
        process.exit(1);
    }
}

function cleanup(dir: string) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

main().catch(e => {
    console.error('Fatal:', e);
    cleanup(CLONE_DIR);
    process.exit(1);
});
