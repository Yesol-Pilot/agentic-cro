/**
 * PostHog MCP Server Connector — Phase R2 (Data Guardrails)
 * 
 * 역할: Data Analytics Agent가 이 커넥터를 통해 실제 PostHog 데이터를 가져옵니다.
 * 정책: API Key는 하드코딩하지 않고 process.env.POSTHOG_API_KEY를 통해 주입받습니다.
 * 
 * Phase R2 추가 기능:
 *   - Data Readiness Validator (최소 표본 500건 검증)
 *   - Cross-Site Taxonomy (도메인별 이벤트 격리 쿼리)
 *   - Site-specific Funnel Dropoff (사이트별 퍼널 분석)
 */

// ─── Types ─────────────────────────────────────────

interface PostHogEvent {
    id: string;
    event: string;
    timestamp: string;
    properties: Record<string, unknown>;
    distinct_id: string;
}

interface PostHogPerson {
    id: string;
    distinct_ids: string[];
    properties: Record<string, unknown>;
    created_at: string;
}

interface PostHogInsight {
    id: number;
    name: string;
    filters: Record<string, unknown>;
    result: unknown;
}

interface PostHogPaginatedResponse<T> {
    results: T[];
    next?: string;
    count?: number;
}

// ─── Phase R2: Data Readiness Types ────────────────

export interface DataReadinessResult {
    ready: boolean;
    site: string;
    totalEvents: number;
    minimumRequired: number;
    readinessPercent: number;
    eventBreakdown: Record<string, number>;
    message: string;
}

export interface SiteFunnelResult {
    site: string;
    funnelId: string;
    readiness: DataReadinessResult;
    funnel: {
        L1_pageview: number;
        L2_scroll: number;
        L3_cta_viewport: number;
        L4_cta_click: number;
        L5_affiliate: number;
        dropOffRate: number;
    } | null;
    description: string;
}

// ─── Neo-Genesis 12개 사이트 Taxonomy ──────────────

export const SITE_TAXONOMY: Record<string, string[]> = {
    'toolpick': ['toolpick.dev', 'www.toolpick.dev'],
    'ur-wrong': ['ur-wrong.com', 'www.ur-wrong.com'],
    'aiforge': ['aiforge.neogenesis.app'],
    'sellkit': ['sellkit.neogenesis.app'],
    'deploystack': ['deploystack.neogenesis.app'],
    'craftdesk': ['craftdesk.neogenesis.app'],
    'finstack': ['finstack.neogenesis.app'],
    'reviewlab': ['review.neogenesis.app'],
    'k-ott': ['kott.kr', 'www.kott.kr'],
    'whylab': ['whylab.neogenesis.app'],
    'ethicaai': ['ethica.neogenesis.app'],
    'portfolio': ['heoyesol.kr', 'www.heoyesol.kr'],
};

// ─── Connector ─────────────────────────────────────

export class PostHogMCPConnector {
    private apiKey: string;
    private projectId: string;
    private host: string;

    /** 최소 통계적 유의성을 위한 표본 크기 (기본: 500건) */
    public static MINIMUM_SAMPLE_SIZE = 500;

    constructor() {
        this.apiKey = process.env.POSTHOG_API_KEY || '';
        this.projectId = process.env.POSTHOG_PROJECT_ID || '';
        this.host = process.env.POSTHOG_HOST || 'https://us.posthog.com';
    }

    public async connect(): Promise<boolean> {
        if (!this.apiKey || !this.projectId) {
            console.warn("⚠️ PostHog 자격 증명이 누락되었습니다. .env에 POSTHOG_API_KEY/POSTHOG_PROJECT_ID를 설정하세요.");
            return false;
        }

        try {
            await this.apiRequest<PostHogPaginatedResponse<unknown>>('/dashboards/?limit=1');
            console.log("✅ PostHog MCP Endpoint Connected. (Real API, Project: " + this.projectId + ")");
            return true;
        } catch (e: any) {
            console.error("❌ PostHog 연결 실패:", e.message);
            return false;
        }
    }

    // ─── Core API Request ──────────────────────────

    private async apiRequest<T = unknown>(path: string, options?: RequestInit): Promise<T> {
        const url = `${this.host}/api/projects/${this.projectId}${path}`;
        const res = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                ...(options?.headers || {}),
            },
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`PostHog API ${res.status} @ ${path}: ${body.substring(0, 200)}`);
        }

        return res.json() as Promise<T>;
    }

    // ─── Events (global) ───────────────────────────

    public async fetchEvents(limit = 10, eventName?: string): Promise<PostHogEvent[]> {
        let path = `/events/?limit=${limit}`;
        if (eventName) path += `&event=${encodeURIComponent(eventName)}`;

        const data = await this.apiRequest<PostHogPaginatedResponse<PostHogEvent>>(path);
        return data.results;
    }

    // ════════════════════════════════════════════════
    // Phase R2 Step 2: Cross-Site Taxonomy Query
    // ════════════════════════════════════════════════

    /**
     * 특정 도메인의 이벤트만 격리 조회합니다.
     * PostHog events API의 properties 필터를 사용하여 $host 기반 격리.
     * 서로 다른 사이트의 트래픽이 절대 섞이지 않습니다.
     */
    public async fetchEventsBySite(siteKey: string, limit = 100, eventName?: string): Promise<PostHogEvent[]> {
        const domains = SITE_TAXONOMY[siteKey];
        if (!domains || domains.length === 0) {
            throw new Error(`[Taxonomy] 알 수 없는 사이트 키: "${siteKey}". 유효한 키: ${Object.keys(SITE_TAXONOMY).join(', ')}`);
        }

        const filter = JSON.stringify([{
            key: '$host',
            value: domains,
            operator: 'exact',
            type: 'event',
        }]);

        let path = `/events/?limit=${limit}&properties=${encodeURIComponent(filter)}`;
        if (eventName) path += `&event=${encodeURIComponent(eventName)}`;

        const data = await this.apiRequest<PostHogPaginatedResponse<PostHogEvent>>(path);
        return data.results;
    }

    // ─── Persons / Insights / Flags / etc. ─────────

    public async fetchPersons(limit = 10): Promise<PostHogPerson[]> {
        const data = await this.apiRequest<PostHogPaginatedResponse<PostHogPerson>>(`/persons/?limit=${limit}`);
        return data.results;
    }

    public async fetchInsights(limit = 10): Promise<PostHogInsight[]> {
        const data = await this.apiRequest<PostHogPaginatedResponse<PostHogInsight>>(`/insights/?limit=${limit}`);
        return data.results;
    }

    public async fetchFeatureFlags(): Promise<unknown[]> {
        const data = await this.apiRequest<PostHogPaginatedResponse<unknown>>('/feature_flags/');
        return data.results;
    }

    public async fetchSessionRecordings(limit = 5): Promise<unknown[]> {
        const data = await this.apiRequest<PostHogPaginatedResponse<unknown>>(`/session_recordings/?limit=${limit}`);
        return data.results;
    }

    public async fetchExperiments(): Promise<unknown[]> {
        const data = await this.apiRequest<PostHogPaginatedResponse<unknown>>('/experiments/');
        return data.results;
    }

    public async fetchDashboards(): Promise<unknown[]> {
        const data = await this.apiRequest<PostHogPaginatedResponse<unknown>>('/dashboards/');
        return data.results;
    }

    // ════════════════════════════════════════════════
    // Phase R2 Step 1: Data Readiness Validator
    // ════════════════════════════════════════════════

    /**
     * 특정 사이트의 데이터 성숙도를 검증합니다.
     * 최소 표본(MINIMUM_SAMPLE_SIZE)에 미달하면 ready=false를 반환하고
     * 에이전트는 분석을 진행하지 않아야 합니다.
     * 
     * Statistical Hallucination 방지를 위한 가드레일입니다.
     */
    public async checkDataReadiness(siteKey: string): Promise<DataReadinessResult> {
        const minRequired = PostHogMCPConnector.MINIMUM_SAMPLE_SIZE;

        try {
            const events = await this.fetchEventsBySite(siteKey, minRequired);
            const totalEvents = events.length;

            // 이벤트 유형별 카운트
            const breakdown: Record<string, number> = {};
            for (const e of events) {
                breakdown[e.event] = (breakdown[e.event] || 0) + 1;
            }

            const readinessPercent = Math.min(100, Math.round((totalEvents / minRequired) * 100));
            const ready = totalEvents >= minRequired;

            const result: DataReadinessResult = {
                ready,
                site: siteKey,
                totalEvents,
                minimumRequired: minRequired,
                readinessPercent,
                eventBreakdown: breakdown,
                message: ready
                    ? `✅ [${siteKey}] 데이터 준비 완료. ${totalEvents}/${minRequired}건 (${readinessPercent}%) — 분석 진행 가능.`
                    : `⏳ [${siteKey}] 데이터 수집 대기 중. ${totalEvents}/${minRequired}건 (${readinessPercent}%) — 분석 차단됨. 워크플로우 Sleep.`,
            };

            console.log(result.message);
            return result;
        } catch (e: any) {
            return {
                ready: false,
                site: siteKey,
                totalEvents: 0,
                minimumRequired: minRequired,
                readinessPercent: 0,
                eventBreakdown: {},
                message: `❌ [${siteKey}] 데이터 조회 실패: ${e.message}`,
            };
        }
    }

    // ════════════════════════════════════════════════
    // Phase R2: Site-specific Funnel Dropoff
    // ════════════════════════════════════════════════

    /**
     * 특정 사이트에 대해 Data Readiness 검사 후 퍼널 분석을 수행합니다.
     * 표본 부족 시 분석을 차단하고 수집률만 반환합니다.
     */
    public async fetchSiteFunnelDropoff(siteKey: string, funnelId: string): Promise<SiteFunnelResult> {
        // 가드레일: Data Readiness 검사
        const readiness = await this.checkDataReadiness(siteKey);

        if (!readiness.ready) {
            return {
                site: siteKey,
                funnelId,
                readiness,
                funnel: null,
                description: readiness.message,
            };
        }

        // 표본 충분 → 실제 퍼널 분석
        try {
            const events = await this.fetchEventsBySite(siteKey, 500);

            const L1 = events.filter(e => e.event === '$pageview').length;
            const L2 = events.filter(e => e.event === 'scroll_depth').length;
            const L3 = events.filter(e => e.event === 'cta_viewport_reached').length;
            const L4 = events.filter(e => e.event === 'cta_click').length;
            const L5 = events.filter(e => e.event === 'affiliate_click').length;

            const dropOffRate = L1 > 0 ? Math.round((1 - L4 / L1) * 1000) / 10 : 0;

            return {
                site: siteKey,
                funnelId,
                readiness,
                funnel: { L1_pageview: L1, L2_scroll: L2, L3_cta_viewport: L3, L4_cta_click: L4, L5_affiliate: L5, dropOffRate },
                description: `[${siteKey}] PV:${L1} → Scroll:${L2} → CTA VP:${L3} → CTA Click:${L4} → Affiliate:${L5} | 이탈률: ${dropOffRate}%`,
            };
        } catch (e: any) {
            return { site: siteKey, funnelId, readiness, funnel: null, description: `❌ [${siteKey}] 퍼널 에러: ${e.message}` };
        }
    }

    // ─── Legacy: Global Funnel (R1 호환) ───────────

    public async fetchFunnelDropoff(funnelId: string): Promise<{ step: string; dropOffRate: number; description: string }> {
        try {
            const events = await this.fetchEvents(100);
            if (events.length === 0) {
                return { step: funnelId, dropOffRate: 0, description: 'Global: 이벤트 0건 (베이스라인 수집 중)' };
            }
            const pv = events.filter(e => e.event === '$pageview').length;
            const cta = events.filter(e => e.event === 'cta_click').length;
            const dr = pv > 0 ? Math.round((1 - cta / pv) * 1000) / 10 : 0;
            return { step: funnelId, dropOffRate: dr, description: `Global: PV ${pv} | CTA ${cta} | 이탈률 ${dr}%` };
        } catch (e: any) {
            return { step: funnelId, dropOffRate: -1, description: `에러: ${e.message}` };
        }
    }

    // ─── Summary ───────────────────────────────────

    public async fetchSummary(): Promise<Record<string, number>> {
        const sc = async (fn: () => Promise<unknown[]>) => {
            try { return (await fn()).length; } catch { return -1; }
        };
        const [ev, pe, ins, fl, rec, exp, da] = await Promise.all([
            sc(() => this.fetchEvents(1)), sc(() => this.fetchPersons(1)),
            sc(() => this.fetchInsights(1)), sc(() => this.fetchFeatureFlags()),
            sc(() => this.fetchSessionRecordings(1)), sc(() => this.fetchExperiments()),
            sc(() => this.fetchDashboards()),
        ]);
        const s = { events: ev, persons: pe, insights: ins, flags: fl, recordings: rec, experiments: exp, dashboards: da };
        console.log(`\n📊 PostHog Summary:`, JSON.stringify(s, null, 2));
        return s;
    }
}
