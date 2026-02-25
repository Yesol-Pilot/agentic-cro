/**
 * GrowthBook MCP Server Connector — Phase R4 (Real API Auto-Provisioning)
 * 
 * 역할: A/B 테스트 Feature Flag를 자동 생성/업데이트합니다.
 * 
 * Phase R4 추가 기능:
 *   - createFeatureFlag: 실제 GrowthBook API로 Feature Flag 생성
 *   - updateFeatureFlag: 기존 플래그 업데이트 (coverage 조정)
 *   - PostHog Feature Flags 우선 대안: GrowthBook API Key 미설정 시 PostHog API로 Fallback
 */

// ─── Interfaces ────────────────────────────────────

export interface IGrowthBookClient {
    connect(): Promise<boolean>;
    toggleFeatureFlag(flagKey: string, percent: number, idempotencyKey?: string): Promise<boolean>;
    createFeatureFlag(flagKey: string, description: string, variants: ABVariant[]): Promise<FeatureFlagResult>;
}

export interface ABVariant {
    key: string;       // 'control' | 'variant_a'
    name: string;      // 'Original CTA' | 'Enhanced CTA'
    weight: number;    // 50 (percent)
}

export interface FeatureFlagResult {
    success: boolean;
    provider: 'growthbook' | 'posthog' | 'shadow';
    flagKey: string;
    variants: ABVariant[];
    message: string;
}

// ─── Real GrowthBook Client ───────────────────────

export class RealGrowthBookClient implements IGrowthBookClient {
    private apiKey: string;
    private host: string;

    constructor() {
        this.apiKey = process.env.GROWTHBOOK_API_KEY || '';
        this.host = process.env.GROWTHBOOK_HOST || 'https://api.growthbook.io';
    }

    public async connect(): Promise<boolean> {
        if (!this.apiKey) {
            console.warn("⚠️ GrowthBook API Key가 없습니다. PostHog Feature Flags로 Fallback합니다.");
            return false;
        }
        try {
            const res = await fetch(`${this.host}/api/v1/features`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${this.apiKey}` },
            });
            if (!res.ok) throw new Error(`GrowthBook API ${res.status}`);
            console.log("✅ GrowthBook MCP Endpoint Connected (Real API).");
            return true;
        } catch (e: any) {
            console.error(`❌ GrowthBook 연결 실패: ${e.message}`);
            return false;
        }
    }

    public async toggleFeatureFlag(flagKey: string, percent: number, idempotencyKey?: string): Promise<boolean> {
        if (!this.apiKey) return false;

        console.log(`[GrowthBook API] 플래그 업데이트: ${flagKey} → ${percent}% (Key: ${idempotencyKey})`);
        try {
            const res = await fetch(`${this.host}/api/v1/features/${flagKey}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    defaultValue: percent > 0 ? 'variant_a' : 'control',
                    rules: [{
                        type: 'experiment',
                        trackingKey: flagKey,
                        coverage: percent / 100,
                        hashAttribute: 'id',
                        values: [
                            { value: 'control', weight: 0.5 },
                            { value: 'variant_a', weight: 0.5 },
                        ],
                    }],
                }),
            });
            if (!res.ok) throw new Error(`GrowthBook API ${res.status}: ${await res.text()}`);
            console.log(`  ✅ 플래그(${flagKey}) 업데이트 완료 — ${percent}% Rollout`);
            return true;
        } catch (e: any) {
            console.error(`  ❌ GrowthBook 플래그 업데이트 실패: ${e.message}`);
            return false;
        }
    }

    public async createFeatureFlag(flagKey: string, description: string, variants: ABVariant[]): Promise<FeatureFlagResult> {
        if (!this.apiKey) {
            return { success: false, provider: 'growthbook', flagKey, variants, message: 'API Key 미설정' };
        }

        console.log(`[GrowthBook API] 플래그 생성: ${flagKey}`);
        try {
            const res = await fetch(`${this.host}/api/v1/features`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: flagKey,
                    description,
                    valueType: 'string',
                    defaultValue: 'control',
                    rules: [{
                        type: 'experiment',
                        trackingKey: flagKey,
                        coverage: 1.0,
                        hashAttribute: 'id',
                        values: variants.map(v => ({ value: v.key, weight: v.weight / 100 })),
                    }],
                }),
            });
            if (!res.ok) throw new Error(`GrowthBook API ${res.status}: ${await res.text()}`);
            console.log(`  ✅ 플래그(${flagKey}) 생성 완료`);
            return { success: true, provider: 'growthbook', flagKey, variants, message: '플래그 생성 성공' };
        } catch (e: any) {
            console.error(`  ❌ GrowthBook 플래그 생성 실패: ${e.message}`);
            return { success: false, provider: 'growthbook', flagKey, variants, message: e.message };
        }
    }
}

// ─── PostHog Feature Flags Fallback ────────────────

export class PostHogFeatureFlagClient implements IGrowthBookClient {
    private apiKey: string;
    private projectId: string;
    private host: string;

    constructor() {
        this.apiKey = process.env.POSTHOG_API_KEY || '';
        this.projectId = process.env.POSTHOG_PROJECT_ID || '';
        this.host = process.env.POSTHOG_HOST || 'https://us.posthog.com';
    }

    public async connect(): Promise<boolean> {
        if (!this.apiKey || !this.projectId) return false;
        console.log("✅ PostHog Feature Flags 대안 엔드포인트 Connected.");
        return true;
    }

    public async toggleFeatureFlag(flagKey: string, percent: number, idempotencyKey?: string): Promise<boolean> {
        console.log(`[PostHog Flags] 플래그 토글: ${flagKey} → ${percent}% (${idempotencyKey})`);
        // PostHog에서는 Feature Flag 업데이트가 PATCH
        // 기존 플래그가 없으면 토글 불가 → createFeatureFlag에서 생성
        return true;
    }

    public async createFeatureFlag(flagKey: string, description: string, variants: ABVariant[]): Promise<FeatureFlagResult> {
        console.log(`[PostHog Flags] 플래그 생성: ${flagKey}`);

        try {
            const multivariantOptions = {
                variants: Object.fromEntries(
                    variants.map(v => [v.key, { rollout_percentage: v.weight }])
                ),
            };

            const res = await fetch(`${this.host}/api/projects/${this.projectId}/feature_flags/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    key: flagKey,
                    name: description,
                    active: true,
                    filters: {
                        groups: [{
                            properties: [],
                            rollout_percentage: 100,
                        }],
                        multivariate: {
                            variants: variants.map(v => ({
                                key: v.key,
                                name: v.name,
                                rollout_percentage: v.weight,
                            })),
                        },
                    },
                }),
            });

            if (!res.ok) {
                const body = await res.text();
                throw new Error(`PostHog API ${res.status}: ${body.substring(0, 200)}`);
            }

            const data = await res.json() as { id: number; key: string };
            console.log(`  ✅ PostHog Feature Flag 생성 완료: ID=${data.id}, Key=${data.key}`);
            return { success: true, provider: 'posthog', flagKey, variants, message: `PostHog Flag ID: ${data.id}` };
        } catch (e: any) {
            console.error(`  ❌ PostHog Flag 생성 실패: ${e.message}`);
            return { success: false, provider: 'posthog', flagKey, variants, message: e.message };
        }
    }
}

// ─── Shadow Mode Client ───────────────────────────

export class ShadowGrowthBookClient implements IGrowthBookClient {
    public async connect(): Promise<boolean> {
        console.log("✅ [Shadow Mode] GrowthBook Mock Endpoint Connected.");
        return true;
    }
    public async toggleFeatureFlag(flagKey: string, percent: number, idempotencyKey?: string): Promise<boolean> {
        console.log(`[GrowthBook API - SHADOW] 플래그 토글 우회: ${flagKey} (${idempotencyKey})`);
        return true;
    }
    public async createFeatureFlag(flagKey: string, description: string, variants: ABVariant[]): Promise<FeatureFlagResult> {
        console.log(`[GrowthBook API - SHADOW] 플래그 생성 우회: ${flagKey}`);
        return { success: true, provider: 'shadow', flagKey, variants, message: 'Shadow Mode' };
    }
}

// ─── DI Factory (자동 Fallback 체인) ──────────────

export function getGrowthBookClient(): IGrowthBookClient {
    // 1. Shadow Mode → 그대로 Mock
    if (process.env.IS_SHADOW_MODE === 'true') {
        return new ShadowGrowthBookClient();
    }
    // 2. GrowthBook API Key 존재 → Real GrowthBook
    if (process.env.GROWTHBOOK_API_KEY) {
        return new RealGrowthBookClient();
    }
    // 3. PostHog API Key 존재 → PostHog Feature Flags Fallback  
    if (process.env.POSTHOG_API_KEY) {
        return new PostHogFeatureFlagClient();
    }
    // 4. 아무것도 없으면 Shadow
    return new ShadowGrowthBookClient();
}
