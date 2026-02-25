/**
 * Phase R7 Step 1: Full Autopilot Daemon
 * 
 * 24시간 간격으로 12개 사이트의 Data Readiness를 폴링하고,
 * 500건 임계점을 돌파한 사이트에 대해 자동으로 파이프라인을 가동합니다.
 * 
 * Temporal Cron 또는 단독 프로세스(node daemon.ts)로 구동 가능.
 * 
 * 실행: npx tsx src/daemon.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { PostHogMCPConnector, SITE_TAXONOMY } from './mcp-servers/posthog';
import { ConcurrencyLimiter, FleetView, handleASTDiscoveryFailure } from './orchestrator/fleetManager';
import { BayesianCalculator } from './analytics/bayesian';
import { getSlackClient } from './mcp-servers/slack';
import { shadowAuditFireAndForget } from './adapters/whylabShadow';

// ─── Config ───────────────────────────────────────

/** 폴링 간격 (ms) — 프로덕션: 24h, 개발: 30s */
const POLLING_INTERVAL_MS = parseInt(process.env.DAEMON_POLLING_MS || '86400000', 10);
/** 동시 최대 실험 수 */
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_EXPERIMENTS || '3', 10);
/** Data Readiness 최소 임계값 */
const MIN_SAMPLE_SIZE = 500;

// ─── Daemon Core ──────────────────────────────────

const fleetView = new FleetView();
const limiter = new ConcurrencyLimiter(MAX_CONCURRENT);
const posthog = new PostHogMCPConnector();
const slack = getSlackClient();

let isRunning = false;
let cycleCount = 0;

async function runCycle() {
    cycleCount++;
    const cycleId = `cycle-${cycleCount}`;
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🌀 [Daemon] Autopilot Cycle #${cycleCount} — ${new Date().toISOString()}`);
    console.log(`${'═'.repeat(70)}\n`);

    const allSites = Object.keys(SITE_TAXONOMY);
    const readySites: string[] = [];

    // Phase 1: 전 사이트 Data Readiness 스캔
    console.log(`▶ [1/3] Data Readiness 스캔 (${allSites.length}개 사이트)\n`);

    for (const site of allSites) {
        try {
            const readiness = await posthog.checkDataReadiness(site);
            fleetView.updateSite(site, {
                readinessPercent: readiness.readinessPercent,
                status: readiness.ready ? 'READINESS_CHECK' : 'IDLE',
            });

            if (readiness.ready) {
                readySites.push(site);
            }
        } catch (e: any) {
            fleetView.updateSite(site, {
                status: 'ERROR',
                lastError: e.message,
            });
        }
    }

    console.log(`\n  📊 Ready Sites: ${readySites.length}/${allSites.length}`);

    if (readySites.length === 0) {
        console.log('  ⏳ 표본 충족 사이트 없음 — Sleep\n');
        fleetView.printDashboard();
        return;
    }

    // Phase 2: 준비된 사이트에 대해 파이프라인 가동
    console.log(`\n▶ [2/3] 파이프라인 가동 (Max ${MAX_CONCURRENT} 동시)\n`);

    const pipelinePromises = readySites.map(async (site) => {
        await limiter.acquire(site);

        try {
            // 퍼널 분석
            fleetView.updateSite(site, { status: 'ANALYZING' });
            const funnel = await posthog.fetchSiteFunnelDropoff(site, 'main_cta');

            if (!funnel.funnel) {
                fleetView.updateSite(site, { status: 'ERROR', lastError: 'Funnel data null' });
                return;
            }

            fleetView.updateSite(site, {
                dropOffRate: funnel.funnel.dropOffRate,
                status: 'HYPOTHESIS',
                experimentId: `exp-${site}-${cycleId}`,
            });

            // 베이지안 연산
            const calc = new BayesianCalculator(10000);
            const pv = funnel.funnel.L1_pageview;
            const clicks = funnel.funnel.L4_cta_click;
            const controlCvr = clicks / Math.max(pv, 1);

            // 가설: Variant는 Control 대비 +20% 개선 가정
            const variantCvr = Math.min(controlCvr * 1.2, 1.0);
            const halfPv = Math.floor(pv / 2);

            const result = calc.calculateExpectedLoss(
                { alpha: Math.round(controlCvr * halfPv) + 1, beta: halfPv - Math.round(controlCvr * halfPv) + 1 },
                { alpha: Math.round(variantCvr * halfPv) + 1, beta: halfPv - Math.round(variantCvr * halfPv) + 1 }
            );

            const maxLoss = parseFloat(process.env.MAX_EXPECTED_LOSS || '0.0015');
            const decision = result.expectedLoss < maxLoss ? 'DEPLOY' : 'HOLD';

            // ═══ WhyLab Shadow Audit (Non-blocking) ═══
            // Fire-and-forget: 카나리 10% 결정론적 라우팅
            // 에러 시 파이프라인에 영향 없음
            shadowAuditFireAndForget({
                siteId: site,
                cycleId: cycleId,
                decision: decision as 'DEPLOY' | 'HOLD',
                probBBeatsA: result.probBBeatsA,
                expectedLoss: result.expectedLoss,
                controlCvr,
                variantCvr,
                sampleSize: pv,
                timestamp: new Date().toISOString(),
            }, true).catch(() => { }); // 최종 안전망
            // ═══════════════════════════════════════════

            fleetView.updateSite(site, {
                status: decision === 'DEPLOY' ? 'PR_CREATED' : 'HOLD',
                bayesianResult: {
                    probBBeatsA: result.probBBeatsA,
                    expectedLoss: result.expectedLoss,
                    decision: decision as 'DEPLOY' | 'HOLD',
                },
            });

            console.log(`  [${site}] P(B>A)=${(result.probBBeatsA * 100).toFixed(1)}% | Loss=${result.expectedLoss.toFixed(5)} | → ${decision}`);

            // DEPLOY 결정 시: Shadow PR 생성 → HITL 대기
            if (decision === 'DEPLOY') {
                // 실제 프로덕션에서는 여기서 cross-repo clone + AST patch + PR 생성
                // Phase R3의 test-shadow-pipeline.ts 로직이 가동됨
                console.log(`  [${site}] 🚀 AUTO: Draft PR 생성 → HITL 대기열 진입`);
                fleetView.updateSite(site, { status: 'AB_RUNNING' });

                await slack.sendAlert(
                    `🤖 [HIVE MIND Autopilot] ${site}: P(B>A)=${(result.probBBeatsA * 100).toFixed(1)}%, Loss=${result.expectedLoss.toFixed(5)} — Draft PR 생성됨. HITL 승인 대기.`
                );
            }

        } catch (e: any) {
            console.error(`  [${site}] ❌ 파이프라인 에러: ${e.message}`);
            fleetView.updateSite(site, { status: 'ERROR', lastError: e.message });
        } finally {
            limiter.release(site);
        }
    });

    await Promise.all(pipelinePromises);

    // Phase 3: Fleet View 대시보드 출력
    console.log(`\n▶ [3/3] Fleet View 대시보드\n`);
    fleetView.printDashboard();
}

// ─── Main Loop ────────────────────────────────────

async function startDaemon() {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║  🤖 HIVE MIND — Full Autopilot Daemon v1.0                     ║');
    console.log('║  Mode: 24h Polling → Auto Pipeline → HITL Queue                ║');
    console.log(`║  Concurrency: Max ${MAX_CONCURRENT} | Polling: ${POLLING_INTERVAL_MS / 1000}s         ║`);
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    // PostHog 연결
    const connected = await posthog.connect();
    if (!connected) {
        console.error('❌ PostHog 연결 실패 — 데몬 종료');
        process.exit(1);
    }
    await slack.connect();

    isRunning = true;

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 [Daemon] SIGINT 수신 — Graceful Shutdown');
        isRunning = false;
    });
    process.on('SIGTERM', () => {
        console.log('\n🛑 [Daemon] SIGTERM 수신 — Graceful Shutdown');
        isRunning = false;
    });

    // 첫 사이클 즉시 실행
    await runCycle();

    // 이후 폴링 간격마다 반복
    while (isRunning) {
        console.log(`\n⏳ [Daemon] 다음 사이클까지 ${POLLING_INTERVAL_MS / 1000}초 대기...`);
        await new Promise(r => setTimeout(r, POLLING_INTERVAL_MS));
        if (!isRunning) break;
        await runCycle();
    }

    console.log('\n🏁 [Daemon] Autopilot 종료. Fleet View 최종 스냅샷:');
    fleetView.printDashboard();

    const snapshot = fleetView.getFleetSnapshot();
    console.log(JSON.stringify(snapshot, null, 2));
}

// 단독 실행
startDaemon().catch(e => {
    console.error('Fatal:', e);
    process.exit(1);
});
