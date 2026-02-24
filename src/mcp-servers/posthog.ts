/**
 * PostHog MCP Server Connector
 * 
 * 역할: Data Analytics Agent가 이 커넥터를 통해 홈페이지의 클릭 데이터, 화면 이탈률 등의 텔레메트리를 가져옵니다.
 * 정책: API Key는 하드코딩하지 않고 process.env.POSTHOG_API_KEY를 통해 주입받습니다.
 */

export class PostHogMCPConnector {
    private apiKey: string;
    private projectId: string;
    private host: string;

    constructor() {
        this.apiKey = process.env.POSTHOG_API_KEY || '';
        this.projectId = process.env.POSTHOG_PROJECT_ID || '';
        this.host = process.env.POSTHOG_HOST || 'https://app.posthog.com';
    }

    public async connect(): Promise<boolean> {
        if (!this.apiKey || !this.projectId) {
            console.warn("⚠️ PostHog 자격 증명이 누락되었습니다. 데이터 수집이 Mock 모드로 작동합니다.");
            return false;
        }
        console.log("✅ PostHog MCP Endpoint Connected.");
        return true;
    }

    /**
     * 퍼널 이탈률 보고서를 실제 PostHog Management API로부터 Fetch 합니다.
     * @param funnelId 
     */
    public async fetchFunnelDropoff(funnelId: string): Promise<{ step: string, dropOffRate: number, description: string }> {
        if (!this.apiKey || !this.projectId || this.apiKey === 'dummy_key') {
            console.warn(`[PostHog] ⚠️ 유효한 API Key가 없습니다. Fallback Mock 데이터를 반환합니다.`);
            return {
                step: funnelId,
                dropOffRate: 23.5,
                description: "Mock: Step 2 단계에서 23.5%의 사용자가 이탈합니다."
            };
        }

        try {
            console.log(`📡 [PostHog API] Real 통신: ${this.host} 으로부터 Funnel(${funnelId}) Fetching...`);

            // 실제 PostHog Management API를 통해 특정 Insight(퍼널) 데이터를 가져옵니다.
            const res = await fetch(`${this.host}/api/projects/${this.projectId}/insights/${funnelId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) {
                throw new Error(`PostHog API 응답 에러: ${res.status} ${res.statusText}`);
            }

            const data = await res.json();

            // PostHog 퍼널 응답 구조체에서 이탈률 및 정보를 파싱 (응답 스펙에 맞게 조정 필요)
            // ex) data.result 배열 안의 스텝간 conversion rate 등을 계산
            // 여기서는 실제 응답 포맷이라 가정하고 안전하게 추출
            const resultList = data.result || [];

            if (resultList.length < 2) {
                throw new Error("분석할 퍼널 단계가 2개 이상 구축되지 않았습니다.");
            }

            // 첫 단계 유입 대비 마지막 단계 전환율을 기반으로 이탈률 산출
            const initialCount = resultList[0].count;
            const dropoffStepCount = resultList[resultList.length - 1].count;

            if (initialCount === 0) throw new Error("분석할 트래픽 데이터가 없습니다.");

            const conversionRate = (dropoffStepCount / initialCount) * 100;
            const dropOffRate = Number((100 - conversionRate).toFixed(2));

            return {
                step: funnelId,
                dropOffRate: dropOffRate,
                description: `실제 데이터 기반: 첫 퍼널 진입자 ${initialCount}명 중 ${dropoffStepCount}명만 도달하여 최종 이탈률은 ${dropOffRate}% 입니다.`
            };
        } catch (e: any) {
            console.error("❌ PostHog Fetch Error:", e.message);
            // 에러 발생 시 시스템 붕괴를 막기 위한 Fallback
            return {
                step: funnelId,
                dropOffRate: 20.0,
                description: `Fallback: 실제 통신 실패(${e.message})로 인한 안전 모드 20.0% 할당`
            };
        }
    }
}
