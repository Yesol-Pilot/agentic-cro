/**
 * Phase R1 연결 테스트 — PostHog Real API 검증
 * 실행: npx tsx src/test-connection.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { PostHogMCPConnector } from './mcp-servers/posthog';

async function main() {
    console.log('\n════════════════════════════════════════');
    console.log('🧪 Phase R1: PostHog Real API 연결 테스트');
    console.log('════════════════════════════════════════\n');

    const posthog = new PostHogMCPConnector();

    // 1. 연결 테스트
    const connected = await posthog.connect();
    if (!connected) {
        console.error('❌ 연결 실패. .env 파일의 POSTHOG_API_KEY / POSTHOG_PROJECT_ID를 확인하세요.');
        process.exit(1);
    }

    // 2. 전체 현황
    console.log('\n─── 전체 현황 조회 ───');
    const summary = await posthog.fetchSummary();

    // 3. 이벤트 상세
    console.log('\n─── 최근 이벤트 (최대 5건) ───');
    const events = await posthog.fetchEvents(5);
    events.forEach(e => {
        console.log(`  ${e.event} | ${e.properties?.['$current_url'] || '-'} | ${e.timestamp}`);
    });

    // 4. 퍼널 분석
    console.log('\n─── 간이 퍼널 분석 ───');
    const funnel = await posthog.fetchFunnelDropoff('main_cta');
    console.log(`  ${funnel.description}`);

    console.log('\n════════════════════════════════════════');
    console.log('✅ Phase R1 연결 테스트 완료');
    console.log('════════════════════════════════════════\n');
}

main().catch(console.error);
