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
        console.log(`[GrowthBook API - REAL] 플래그 업데이트 시도 - Key: ${flagKey}, Rollout: ${percent}% (IdempotencyKey: ${idempotencyKey})`);

        if (!this.apiKey || this.apiKey === 'dummy_key') {
            console.warn(`[GrowthBook API] ⚠️ API Key 가 없어 100% Mock 전송으로 대체합니다.`);
            return true;
        }

        try {
            // GrowthBook Admin API (Feature 업데이트)
            // https://docs.growthbook.io/api#tag/features/paths/~1api~1v1~1features~1{id}/post
            const res = await fetch(`https://api.growthbook.io/api/v1/features/${flagKey}`, {
                method: 'POST', // 일부 스펙엔 PUT일 수 있음. 환경에 맞게 조정
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rules: [
                        {
                            coverage: percent / 100,
                            status: "running",
                            force: true
                        }
                    ]
                })
            });

            if (!res.ok) {
                throw new Error(`GrowthBook API Error: ${res.statusText}`);
            }

            console.log(`[GrowthBook API - REAL] 플래그(${flagKey}) 업데이트 롤아웃(${percent}%) 배포 성공.`);
            return true;
        } catch (e: any) {
            console.error(`[GrowthBook API - REAL] ❌ 플래그 업데이트 실패: ${e.message}`);
            throw e; // Saga 트랜잭션 롤백 감지를 위해 에러를 전파
        }
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
