/**
 * Phase R2 Step 3: Dry-Run Query Test
 * 
 * LLM 없이 순수 PostHog API 쿼리만으로 데이터 파이프라인을 검증합니다.
 * - Data Readiness Validator 동작 확인
 * - Cross-Site Taxonomy 격리 쿼리 검증
 * - Site-specific Funnel Dropoff JSON 출력
 * 
 * 실행: npx tsx src/test-dryrun-r2.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { PostHogMCPConnector, SITE_TAXONOMY } from './mcp-servers/posthog';
import type { DataReadinessResult, SiteFunnelResult } from './mcp-servers/posthog';

async function main() {
    console.log('\n' + '═'.repeat(60));
    console.log('🧪 Phase R2: Dry-Run Query Test (순수 API 검증)');
    console.log('═'.repeat(60) + '\n');

    const posthog = new PostHogMCPConnector();

    // ─── 1. API 연결 확인 ──────────────────────────

    console.log('▶ [1/5] API 연결 확인');
    const connected = await posthog.connect();
    if (!connected) {
        console.error('❌ API 연결 실패. 종료.');
        process.exit(1);
    }

    // ─── 2. 12개 사이트 Taxonomy 출력 ──────────────

    console.log('\n▶ [2/5] 등록된 사이트 Taxonomy');
    console.log(JSON.stringify(SITE_TAXONOMY, null, 2));

    // ─── 3. 타겟 사이트 Data Readiness 검사 ────────

    const targetSites = ['toolpick', 'ur-wrong', 'aiforge'];

    console.log('\n▶ [3/5] Data Readiness Validator (최소 500건 표본 검증)');
    console.log('─'.repeat(60));

    const readinessResults: Record<string, DataReadinessResult> = {};

    for (const site of targetSites) {
        const result = await posthog.checkDataReadiness(site);
        readinessResults[site] = result;
        console.log(JSON.stringify({
            site: result.site,
            ready: result.ready,
            totalEvents: result.totalEvents,
            readinessPercent: `${result.readinessPercent}%`,
            eventBreakdown: result.eventBreakdown,
        }, null, 2));
        console.log('─'.repeat(40));
    }

    // ─── 4. Site-specific Funnel Dropoff ────────────

    console.log('\n▶ [4/5] Site-specific Funnel Dropoff (도메인 격리 퍼널)');
    console.log('─'.repeat(60));

    const funnelResults: Record<string, SiteFunnelResult> = {};

    for (const site of targetSites) {
        const result = await posthog.fetchSiteFunnelDropoff(site, 'main_cta');
        funnelResults[site] = result;
        console.log(JSON.stringify({
            site: result.site,
            funnelId: result.funnelId,
            dataReady: result.readiness.ready,
            funnel: result.funnel,
            description: result.description,
        }, null, 2));
        console.log('─'.repeat(40));
    }

    // ─── 5. 최종 JSON 로그 ─────────────────────────

    console.log('\n▶ [5/5] 최종 검증 JSON 로그');
    console.log('═'.repeat(60));

    const finalReport = {
        timestamp: new Date().toISOString(),
        phase: 'R2',
        step: 'Dry-Run Query Test',
        apiConnected: connected,
        sitesAnalyzed: targetSites,
        readiness: Object.fromEntries(
            targetSites.map(s => [s, {
                ready: readinessResults[s].ready,
                events: readinessResults[s].totalEvents,
                percent: readinessResults[s].readinessPercent,
            }])
        ),
        funnels: Object.fromEntries(
            targetSites.map(s => [s, {
                dataReady: funnelResults[s].readiness.ready,
                funnel: funnelResults[s].funnel,
                blocked: !funnelResults[s].readiness.ready,
            }])
        ),
        guardrailStatus: targetSites.every(s => !readinessResults[s].ready)
            ? '⏳ 전 사이트 표본 부족 — 분석 에이전트 Sleep 상태 (Statistical Hallucination 방지)'
            : '✅ 일부 사이트 분석 가능',
    };

    console.log(JSON.stringify(finalReport, null, 2));

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Phase R2 Dry-Run Query Test 완료');
    console.log('═'.repeat(60) + '\n');
}

main().catch(console.error);
