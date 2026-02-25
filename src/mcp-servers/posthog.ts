/**
 * PostHog MCP Server Connector — Phase R1 (Real API)
 * 
 * 역할: Data Analytics Agent가 이 커넥터를 통해 실제 PostHog 데이터를 가져옵니다.
 * 정책: API Key는 하드코딩하지 않고 process.env.POSTHOG_API_KEY를 통해 주입받습니다.
 * 
 * 지원 엔드포인트:
 *   - events, persons, insights, feature_flags
 *   - session_recordings, experiments, dashboards
 *   - fetchFunnelDropoff (이벤트 기반 간이 퍼널)
 *   - fetchSummary (전체 현황 통합 조회)
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

// ─── Connector ─────────────────────────────────────

export class PostHogMCPConnector {
    private apiKey: string;
    private projectId: string;
    private host: string;

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
            // 연결 테스트: dashboards 엔드포인트로 인증 확인
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

    // ─── Events ────────────────────────────────────

    public async fetchEvents(limit = 10, eventName?: string): Promise<PostHogEvent[]> {
        let path = `/events/?limit=${limit}`;
        if (eventName) path += `&event=${encodeURIComponent(eventName)}`;

        const data = await this.apiRequest<PostHogPaginatedResponse<PostHogEvent>>(path);
        console.log(`📡 [PostHog] Events: ${data.results.length}건`);
        return data.results;
    }

    // ─── Persons ───────────────────────────────────

    public async fetchPersons(limit = 10): Promise<PostHogPerson[]> {
        const data = await this.apiRequest<PostHogPaginatedResponse<PostHogPerson>>(`/persons/?limit=${limit}`);
        console.log(`📡 [PostHog] Persons: ${data.results.length}건`);
        return data.results;
    }

    // ─── Insights ──────────────────────────────────

    public async fetchInsights(limit = 10): Promise<PostHogInsight[]> {
        const data = await this.apiRequest<PostHogPaginatedResponse<PostHogInsight>>(`/insights/?limit=${limit}`);
        console.log(`📡 [PostHog] Insights: ${data.results.length}건`);
        return data.results;
    }

    // ─── Feature Flags ─────────────────────────────

    public async fetchFeatureFlags(): Promise<unknown[]> {
        const data = await this.apiRequest<PostHogPaginatedResponse<unknown>>('/feature_flags/');
        console.log(`📡 [PostHog] Feature Flags: ${data.results.length}건`);
        return data.results;
    }

    // ─── Session Recordings ────────────────────────

    public async fetchSessionRecordings(limit = 5): Promise<unknown[]> {
        const data = await this.apiRequest<PostHogPaginatedResponse<unknown>>(`/session_recordings/?limit=${limit}`);
        console.log(`📡 [PostHog] Session Recordings: ${data.results.length}건`);
        return data.results;
    }

    // ─── Experiments ───────────────────────────────

    public async fetchExperiments(): Promise<unknown[]> {
        const data = await this.apiRequest<PostHogPaginatedResponse<unknown>>('/experiments/');
        console.log(`📡 [PostHog] Experiments: ${data.results.length}건`);
        return data.results;
    }

    // ─── Dashboards ────────────────────────────────

    public async fetchDashboards(): Promise<unknown[]> {
        const data = await this.apiRequest<PostHogPaginatedResponse<unknown>>('/dashboards/');
        console.log(`📡 [PostHog] Dashboards: ${data.results.length}건`);
        return data.results;
    }

    // ─── Funnel Dropoff (CRO 핵심) ─────────────────

    public async fetchFunnelDropoff(funnelId: string): Promise<{ step: string; dropOffRate: number; description: string }> {
        try {
            const events = await this.fetchEvents(100);

            if (events.length === 0) {
                return {
                    step: funnelId,
                    dropOffRate: 0,
                    description: `베이스라인 수집 중 — 이벤트 0건. PostHog 인제스트 지연(최대 1시간) 또는 사이트 트래픽 부족.`,
                };
            }

            // 이벤트 기반 간이 퍼널 분석
            const pageviews = events.filter(e => e.event === '$pageview').length;
            const scrollDepth = events.filter(e => e.event === 'scroll_depth').length;
            const ctaViewport = events.filter(e => e.event === 'cta_viewport_reached').length;
            const ctaClicks = events.filter(e => e.event === 'cta_click').length;
            const affiliateClicks = events.filter(e => e.event === 'affiliate_click').length;

            const dropOffRate = pageviews > 0 ? Math.round((1 - ctaClicks / pageviews) * 1000) / 10 : 0;

            return {
                step: funnelId,
                dropOffRate,
                description: [
                    `L1 Pageview: ${pageviews}`,
                    `L2 Scroll 75%: ${scrollDepth}`,
                    `L3 CTA Viewport: ${ctaViewport}`,
                    `L4 CTA Click: ${ctaClicks}`,
                    `L5 Affiliate: ${affiliateClicks}`,
                    `→ 이탈률: ${dropOffRate}%`,
                ].join(' | '),
            };
        } catch (e: any) {
            console.error("PostHog Funnel Error:", e.message);
            return { step: funnelId, dropOffRate: -1, description: `에러: ${e.message}` };
        }
    }

    // ─── Summary (전체 현황 통합 조회) ──────────────

    public async fetchSummary(): Promise<Record<string, number>> {
        const safeCount = async (fn: () => Promise<unknown[]>) => {
            try { return (await fn()).length; } catch { return -1; }
        };

        const [events, persons, insights, flags, recordings, experiments, dashboards] = await Promise.all([
            safeCount(() => this.fetchEvents(1)),
            safeCount(() => this.fetchPersons(1)),
            safeCount(() => this.fetchInsights(1)),
            safeCount(() => this.fetchFeatureFlags()),
            safeCount(() => this.fetchSessionRecordings(1)),
            safeCount(() => this.fetchExperiments()),
            safeCount(() => this.fetchDashboards()),
        ]);

        const summary = { events, persons, insights, flags, recordings, experiments, dashboards };
        console.log(`\n📊 PostHog Summary:`, JSON.stringify(summary, null, 2));
        return summary;
    }
}
