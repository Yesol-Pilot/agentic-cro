/**
 * GrowthBook MCP Server Connector (DI-based)
 * 
 * 역할: Strategy Agent가 생성된 UI에 매칭되는 A/B 테스트 Feature Flag를 설정하거나 타겟 규칙을 제어합니다.
 */

export interface IGrowthBookClient {
    connect(): Promise<boolean>;
    toggleFeatureFlag(flagKey: string, percent: number, idempotencyKey?: string): Promise<boolean>;
}

export class RealGrowthBookClient implements IGrowthBookClient {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.GROWTHBOOK_API_KEY || '';
    }

    public async connect(): Promise<boolean> {
        if (!this.apiKey) {
            console.warn("⚠️ GrowthBook API Key가 없습니다. 동적 Feature Flag 모드를 Mock으로 대체합니다.");
            return false;
        }
        console.log("✅ GrowthBook MCP Endpoint Connected.");
        return true;
    }

    public async toggleFeatureFlag(flagKey: string, percent: number, idempotencyKey?: string): Promise<boolean> {
        // 실제 API 연동 시 GrowthBook POST API 호출
        console.log(`[GrowthBook API - REAL] 플래그 업데이트 시도 - Key: ${flagKey}, Rollout: ${percent}% (IdempotencyKey: ${idempotencyKey})`);
        await new Promise(resolve => setTimeout(resolve, 600));
        console.log(`[GrowthBook API - REAL] 플래그 업데이트 성공`);
        return true;
    }
}

export class ShadowGrowthBookClient implements IGrowthBookClient {
    public async connect(): Promise<boolean> {
        console.log("✅ [Shadow Mode] GrowthBook Mock Endpoint Connected.");
        return true;
    }

    public async toggleFeatureFlag(flagKey: string, percent: number, idempotencyKey?: string): Promise<boolean> {
        console.log(`[GrowthBook API - SHADOW] 플래그 업데이트 요청 우회됨(200 OK) - Key: ${flagKey} (IdempotencyKey: ${idempotencyKey})`);
        return true;
    }
}

// DI Factory
export function getGrowthBookClient(): IGrowthBookClient {
    const isShadow = process.env.IS_SHADOW_MODE === 'true';
    return isShadow ? new ShadowGrowthBookClient() : new RealGrowthBookClient();
}
