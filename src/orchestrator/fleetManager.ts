/**
 * Phase R5 Step 1: Fleet Orchestrator — 동시성 제어 + 큐잉 + Fleet View
 * 
 * 12개 사이트 동시 관리를 위한 엔터프라이즈 스케일 아웃 엔진.
 * - ConcurrencyLimiter: 최대 N개 동시 실험 제어 (메모리/API Rate Limit 방어)
 * - ExperimentQueue: FIFO 대기열 + 우선순위 큐잉
 * - FleetView: 12개 사이트 실험 상태 통합 관제
 * - AST FailSafe: 타겟 DOM 파괴 감지 + Slack 경고 자동 발송
 */

import { SITE_TAXONOMY, PostHogMCPConnector } from '../mcp-servers/posthog';
import { getSlackClient } from '../mcp-servers/slack';

// ─── Types ─────────────────────────────────────────

export type ExperimentStatus =
    | 'QUEUED'         // 대기열에서 대기 중
    | 'READINESS_CHECK'// 데이터 성숙도 검사 중
    | 'ANALYZING'      // 퍼널 분석 중
    | 'HYPOTHESIS'     // 가설 생성 중
    | 'AST_PATCHING'   // AST 코드 수정 중
    | 'PR_CREATED'     // Draft PR 생성 완료
    | 'AB_RUNNING'     // A/B 테스트 실행 중
    | 'HOLD'           // 베이지안 결과 추가 데이터 필요
    | 'DEPLOYED'       // 프로덕션 배포 완료
    | 'ERROR'          // 에러 발생
    | 'ABORTED'        // DOM 파괴 등으로 폐기
    | 'IDLE';          // 트래픽 부족 대기

export interface SiteExperiment {
    siteKey: string;
    domains: string[];
    status: ExperimentStatus;
    experimentId: string | null;
    hypothesisId: string | null;
    prUrl: string | null;
    lastError: string | null;
    readinessPercent: number;
    dropOffRate: number | null;
    bayesianResult: {
        probBBeatsA: number;
        expectedLoss: number;
        decision: 'DEPLOY' | 'HOLD' | 'PENDING';
    } | null;
    updatedAt: string;
}

// ─── Concurrency Limiter ──────────────────────────

export class ConcurrencyLimiter {
    private maxConcurrent: number;
    private running: Set<string> = new Set();
    private queue: Array<{ siteKey: string; resolve: () => void }> = [];

    constructor(maxConcurrent = 3) {
        this.maxConcurrent = maxConcurrent;
    }

    public getStatus() {
        return {
            maxConcurrent: this.maxConcurrent,
            running: this.running.size,
            queued: this.queue.length,
            runningList: Array.from(this.running),
            queuedList: this.queue.map(q => q.siteKey),
        };
    }

    /**
     * 실행 슬롯을 획득합니다. 슬롯 초과 시 큐에서 대기합니다.
     */
    public async acquire(siteKey: string): Promise<void> {
        if (this.running.size < this.maxConcurrent) {
            this.running.add(siteKey);
            console.log(`  🔓 [ConcurrencyLimiter] ${siteKey} 슬롯 획득 (${this.running.size}/${this.maxConcurrent})`);
            return;
        }

        console.log(`  ⏳ [ConcurrencyLimiter] ${siteKey} 대기열 진입 (큐 ${this.queue.length + 1}번째)`);
        return new Promise<void>((resolve) => {
            this.queue.push({ siteKey, resolve });
        });
    }

    /**
     * 실행 슬롯을 반환하고, 대기열의 다음 항목을 깨웁니다.
     */
    public release(siteKey: string): void {
        this.running.delete(siteKey);
        console.log(`  🔓 [ConcurrencyLimiter] ${siteKey} 슬롯 반환 (${this.running.size}/${this.maxConcurrent})`);

        if (this.queue.length > 0) {
            const next = this.queue.shift()!;
            this.running.add(next.siteKey);
            console.log(`  🔓 [ConcurrencyLimiter] ${next.siteKey} 대기열→실행 승격`);
            next.resolve();
        }
    }
}

// ─── Fleet View (State Store) ─────────────────────

export class FleetView {
    private sites: Map<string, SiteExperiment> = new Map();

    constructor() {
        // 12개 사이트 초기화
        for (const [siteKey, domains] of Object.entries(SITE_TAXONOMY)) {
            this.sites.set(siteKey, {
                siteKey,
                domains,
                status: 'IDLE',
                experimentId: null,
                hypothesisId: null,
                prUrl: null,
                lastError: null,
                readinessPercent: 0,
                dropOffRate: null,
                bayesianResult: null,
                updatedAt: new Date().toISOString(),
            });
        }
    }

    public updateSite(siteKey: string, updates: Partial<SiteExperiment>): void {
        const existing = this.sites.get(siteKey);
        if (existing) {
            this.sites.set(siteKey, { ...existing, ...updates, updatedAt: new Date().toISOString() });
        }
    }

    public getSite(siteKey: string): SiteExperiment | undefined {
        return this.sites.get(siteKey);
    }

    /** 전 사이트 현황을 JSON으로 반환 */
    public getFleetSnapshot(): SiteExperiment[] {
        return Array.from(this.sites.values());
    }

    /** 상태별 사이트 수 집계 */
    public getStatusSummary(): Record<ExperimentStatus, number> {
        const summary: Record<string, number> = {};
        for (const site of this.sites.values()) {
            summary[site.status] = (summary[site.status] || 0) + 1;
        }
        return summary as Record<ExperimentStatus, number>;
    }

    /** 콘솔 대시보드 출력 */
    public printDashboard(): void {
        const snapshot = this.getFleetSnapshot();
        const summary = this.getStatusSummary();

        console.log('\n' + '═'.repeat(80));
        console.log('🗺️  FLEET VIEW — 12-Site Multi-Tenant Monitoring Dashboard');
        console.log('═'.repeat(80));
        console.log(`  Updated: ${new Date().toISOString()}\n`);

        // 상태별 요약
        console.log('  📊 Status Summary:');
        for (const [status, count] of Object.entries(summary)) {
            const icon = {
                'IDLE': '⚪', 'QUEUED': '🟡', 'READINESS_CHECK': '🔵', 'ANALYZING': '🔵',
                'HYPOTHESIS': '🟣', 'AST_PATCHING': '🟠', 'PR_CREATED': '🟢', 'AB_RUNNING': '🟢',
                'HOLD': '🟡', 'DEPLOYED': '✅', 'ERROR': '🔴', 'ABORTED': '⛔',
            }[status] || '⚪';
            console.log(`     ${icon} ${status}: ${count}`);
        }

        // 사이트별 상세
        console.log('\n  📋 Site Details:');
        console.log('  ' + '─'.repeat(76));
        console.log('  ' + 'Site'.padEnd(14) + 'Status'.padEnd(18) + 'Readiness'.padEnd(12) + 'DropOff'.padEnd(10) + 'P(B>A)'.padEnd(10) + 'Decision');
        console.log('  ' + '─'.repeat(76));

        for (const site of snapshot) {
            const readiness = `${site.readinessPercent}%`.padEnd(12);
            const dropoff = site.dropOffRate !== null ? `${site.dropOffRate}%`.padEnd(10) : '-'.padEnd(10);
            const prob = site.bayesianResult ? `${(site.bayesianResult.probBBeatsA * 100).toFixed(1)}%`.padEnd(10) : '-'.padEnd(10);
            const decision = site.bayesianResult?.decision || '-';

            console.log(`  ${site.siteKey.padEnd(14)}${site.status.padEnd(18)}${readiness}${dropoff}${prob}${decision}`);
        }
        console.log('  ' + '─'.repeat(76));
        console.log('═'.repeat(80) + '\n');
    }
}

// ─── AST Fail-safe ────────────────────────────────

/**
 * Phase R5 Step 2: AST Discovery 실패 시 우아한 폐기(Abort) + Slack 경고
 * 타겟 DOM 구조 변경 감지 시 워크플로우 전체 패닉 방지
 */
export async function handleASTDiscoveryFailure(
    siteKey: string,
    targetFile: string,
    errorMessage: string,
    fleetView: FleetView,
): Promise<void> {
    console.error(`  ⛔ [AST Fail-safe] ${siteKey}의 타겟 DOM 구조 변경 감지!`);
    console.error(`     File: ${targetFile}`);
    console.error(`     Error: ${errorMessage}`);

    // 해당 사이트만 우아하게 폐기 — 다른 사이트 실험에 영향 없음
    fleetView.updateSite(siteKey, {
        status: 'ABORTED',
        lastError: `DOM structure changed: ${errorMessage}`,
    });

    // Slack 경고 발송
    const slack = getSlackClient();
    await slack.connect();
    await slack.sendAlert([
        `⚠️ *[Agentic CRO Fleet Alert]*`,
        ``,
        `*Site:* ${siteKey}`,
        `*Target:* ${targetFile}`,
        `*Issue:* Target DOM structure changed — experiment aborted`,
        `*Error:* ${errorMessage}`,
        ``,
        `> 해당 사이트의 실험이 우아하게 폐기(Abort)되었습니다.`,
        `> 타겟 앱의 소유자가 코드를 직접 수정한 것으로 추정됩니다.`,
        `> 나머지 ${Object.keys(SITE_TAXONOMY).length - 1}개 사이트의 실험은 정상 진행됩니다.`,
    ].join('\n'));
}
