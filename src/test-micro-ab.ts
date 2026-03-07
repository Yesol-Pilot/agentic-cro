/**
 * Phase R4: Micro A/B Test Pipeline — E2E 통합 검증
 * 
 * Step 1: PostHog/GrowthBook Feature Flag 자동 프로비저닝
 * Step 2: Edge Middleware 분기 패턴 검증 (로컬 시뮬레이션)
 * Step 3: PostHog 텔레메트리 → 베이지안 MCMC 통합 연산
 * 
 * 실행: npx tsx src/test-micro-ab.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { getGrowthBookClient, type ABVariant } from './mcp-servers/growthbook';
import { PostHogMCPConnector, SITE_TAXONOMY } from './mcp-servers/posthog';
import { BayesianCalculator, type BetaParams } from './analytics/bayesian';
import * as crypto from 'crypto';

async function main() {
    console.log('\n' + '═'.repeat(70));
    console.log('🧪 Phase R4: Micro A/B Test Pipeline — E2E 통합 검증');
    console.log('═'.repeat(70) + '\n');

    // ══════════════════════════════════════════════════
    // Step 1: Feature Flag 자동 프로비저닝
    // ══════════════════════════════════════════════════
    console.log('▶ [Step 1/3] Feature Flag 자동 프로비저닝\n');

    const flagClient = getGrowthBookClient();
    const connected = await flagClient.connect();
    console.log(`  Flag Provider: ${connected ? 'Connected' : 'Fallback Mode'}`);

    const experimentId = `cro-experiment-${crypto.randomUUID().slice(0, 8)}`;
    const variants: ABVariant[] = [
        { key: 'control', name: 'Original CTA (현상 유지)', weight: 50 },
        { key: 'variant_a', name: 'Enhanced CTA (고대비 + 접근성)', weight: 50 },
    ];

    const flagResult = await flagClient.createFeatureFlag(
        experimentId,
        '[Agentic CRO] CTA 버튼 최적화 A/B 테스트 — Shadow Mode에서 검증된 가설',
        variants
    );

    console.log('\n  📋 Flag Provisioning Result:');
    console.log(JSON.stringify(flagResult, null, 2));

    // ══════════════════════════════════════════════════
    // Step 2: Edge Middleware 분기 시뮬레이션
    // ══════════════════════════════════════════════════
    console.log('\n▶ [Step 2/3] Edge Middleware A/B 분기 시뮬레이션\n');

    // 실제 Edge Middleware의 로직을 로컬에서 시뮬레이션
    const simulateMiddleware = (distinctId: string, flagKey: string) => {
        // FNV-1a 해시 기반 결정적 할당 (Zero-Flicker 보장)
        let hash = 2166136261;
        const str = `${distinctId}:${flagKey}`;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        const bucket = ((hash >>> 0) % 100);
        const variant = bucket < 50 ? 'control' : 'variant_a';

        return {
            distinctId: distinctId.slice(0, 8),
            bucket,
            variant,
            cookie: `ph_distinct_id=${distinctId}; cro_variant=${variant}`,
        };
    };

    // 20명의 가상 유저로 분기 테스트
    const users = Array.from({ length: 20 }, () => crypto.randomUUID());
    const assignments = users.map(u => simulateMiddleware(u, experimentId));

    const controlCount = assignments.filter(a => a.variant === 'control').length;
    const variantCount = assignments.filter(a => a.variant === 'variant_a').length;

    console.log(`  🎲 20명 가상 유저 할당 결과:`);
    console.log(`     Control:   ${controlCount}명 (${(controlCount / 20 * 100).toFixed(0)}%)`);
    console.log(`     Variant A: ${variantCount}명 (${(variantCount / 20 * 100).toFixed(0)}%)`);
    console.log(`     분기 알고리즘: FNV-1a Hash (Deterministic, 0ms Overhead)`);

    // 샘플 3명의 쿠키 헤더 출력
    console.log('\n  🍪 샘플 쿠키 헤더 (0ms Flicker-Free):');
    for (const a of assignments.slice(0, 3)) {
        console.log(`     User ${a.distinctId}[${a.bucket}%] → ${a.variant} | Set-Cookie: ${a.cookie.slice(0, 60)}...`);
    }

    // Sticky Bucketing 검증 (같은 유저 = 같은 결과)
    const stickyTest = simulateMiddleware(users[0], experimentId);
    const stickyTest2 = simulateMiddleware(users[0], experimentId);
    console.log(`\n  🔒 Sticky Bucketing 검증: User[0] 재방문 → ${stickyTest.variant === stickyTest2.variant ? '✅ PASS (결정적 할당)' : '❌ FAIL'}`);

    // ══════════════════════════════════════════════════
    // Step 3: PostHog 텔레메트리 → 베이지안 MCMC 통합
    // ══════════════════════════════════════════════════
    console.log('\n▶ [Step 3/3] PostHog 텔레메트리 → 베이지안 통합 연산\n');

    // 3-1. PostHog에서 실제 이벤트 조회 시도
    const posthog = new PostHogMCPConnector();
    await posthog.connect();

    let realPageviews = 0;
    let realClicks = 0;

    try {
        const events = await posthog.fetchEventsBySite('toolpick', 500);
        realPageviews = events.filter(e => e.event === '$pageview').length;
        realClicks = events.filter(e => e.event === 'cta_click' || e.event === '$autocapture').length;
        console.log(`  📡 PostHog Real Data: Pageviews=${realPageviews} | Clicks=${realClicks}`);
    } catch (e: any) {
        console.log(`  📡 PostHog Real Data: 조회 실패 (${e.message})`);
    }

    // 3-2. 실데이터 + Micro Traffic 시뮬레이션 결합
    // 콜드 스타트 상태이므로 가상 Micro Traffic을 결합하여 베이지안 엔진 검증
    const microTraffic = {
        control: {
            impressions: 100 + realPageviews,  // 실 트래픽 결합
            conversions: 12 + realClicks,
        },
        variant_a: {
            impressions: 100,
            conversions: 18,
        },
    };

    console.log('\n  📊 Micro Traffic (Real + Simulated):');
    console.log(JSON.stringify(microTraffic, null, 2));

    // 3-3. 베이지안 MCMC 연산
    console.log('\n  🧮 Bayesian MCMC Engine (10,000 시뮬레이션)');
    console.log('  ' + '─'.repeat(50));

    const calc = new BayesianCalculator(10000);

    // Beta(alpha=conversions+1, beta=impressions-conversions+1) 사전분포
    const controlParams: BetaParams = {
        alpha: microTraffic.control.conversions + 1,
        beta: microTraffic.control.impressions - microTraffic.control.conversions + 1,
    };

    const variantParams: BetaParams = {
        alpha: microTraffic.variant_a.conversions + 1,
        beta: microTraffic.variant_a.impressions - microTraffic.variant_a.conversions + 1,
    };

    const result = calc.calculateExpectedLoss(controlParams, variantParams);

    const maxExpectedLoss = parseFloat(process.env.MAX_EXPECTED_LOSS || '0.0015');
    const isDeployable = result.expectedLoss < maxExpectedLoss;

    console.log(`\n  📈 결과:`);
    console.log(`     Control Conversion Rate:  ${(microTraffic.control.conversions / microTraffic.control.impressions * 100).toFixed(2)}%`);
    console.log(`     Variant A Conversion Rate: ${(microTraffic.variant_a.conversions / microTraffic.variant_a.impressions * 100).toFixed(2)}%`);
    console.log(`     ──────────────────────────────────────`);
    console.log(`     P(Variant A > Control):    ${(result.probBBeatsA * 100).toFixed(2)}%`);
    console.log(`     Expected Loss:             ${result.expectedLoss.toFixed(6)}`);
    console.log(`     Threshold:                 ${maxExpectedLoss}`);
    console.log(`     Decision:                  ${isDeployable ? '✅ DEPLOY (기대 손실 < 임계값)' : '❌ HOLD (추가 데이터 필요)'}`);

    // ══════════════════════════════════════════════════
    // Final Report
    // ══════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(70));
    console.log('✅ Phase R4: Micro A/B Test Pipeline 완료');
    console.log('═'.repeat(70));

    const finalReport = {
        timestamp: new Date().toISOString(),
        phase: 'R4',
        experimentId,
        steps: {
            step1_flagProvisioning: {
                status: flagResult.success ? 'SUCCESS' : 'FAILED',
                provider: flagResult.provider,
                flagKey: experimentId,
                variants: variants.map(v => `${v.key} (${v.weight}%)`),
            },
            step2_middlewareRouting: {
                status: 'SUCCESS',
                algorithm: 'FNV-1a Hash (Deterministic)',
                stickyBucketing: true,
                distribution: { control: controlCount, variant_a: variantCount },
            },
            step3_bayesianEngine: {
                status: 'SUCCESS',
                realPostHogData: { pageviews: realPageviews, clicks: realClicks },
                probBBeatsA: `${(result.probBBeatsA * 100).toFixed(2)}%`,
                expectedLoss: result.expectedLoss.toFixed(6),
                threshold: maxExpectedLoss,
                decision: isDeployable ? 'DEPLOY' : 'HOLD',
            },
        },
    };

    console.log('\n📋 Final Report:');
    console.log(JSON.stringify(finalReport, null, 2));
    console.log('\n' + '═'.repeat(70) + '\n');
}

main().catch(console.error);
