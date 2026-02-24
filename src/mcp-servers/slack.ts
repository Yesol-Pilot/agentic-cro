/**
 * Slack Webhook Connector
 * 
 * 역할: Agentic CRO 파이프라인의 핵심 이벤트(실험 시작, 검증 완료, HITL 타임아웃, 에러 에스컬레이션) 발생 시 Slack/Discord에 알림을 전송합니다.
 */

export interface ISlackClient {
    connect(): Promise<boolean>;
    sendAlert(message: string, blocks?: any[]): Promise<boolean>;
}

export class RealSlackClient implements ISlackClient {
    private webhookUrl: string;

    constructor() {
        this.webhookUrl = process.env.SLACK_WEBHOOK_URL || '';
    }

    public async connect(): Promise<boolean> {
        if (!this.webhookUrl) {
            console.warn("[Slack] ⚠️ SLACK_WEBHOOK_URL 이 존재하지 않습니다. 알림 발송이 로컬 콘솔(Mock)로 대체됩니다.");
            return false;
        }
        console.log("✅ Slack Webhook Endpoint Ready.");
        return true;
    }

    public async sendAlert(message: string, blocks?: any[]): Promise<boolean> {
        if (!this.webhookUrl) {
            console.log(`[Slack API - MOCK] 🔔 알림 억제됨:\n${message}`);
            return true;
        }

        try {
            console.log(`[Slack API - REAL] 🔔 Webhook 메시지 전송 시도...`);
            const payload: any = { text: message };
            if (blocks) payload.blocks = blocks;

            const res = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error(`Slack API Error: ${res.statusText}`);
            }

            console.log(`[Slack API - REAL] ✅ 알림 전송 완료.`);
            return true;
        } catch (e: any) {
            console.error(`[Slack API - REAL] ❌ 알림 전송 실패: ${e.message}`);
            return false;
        }
    }
}

export class ShadowSlackClient implements ISlackClient {
    public async connect(): Promise<boolean> {
        return true;
    }
    public async sendAlert(message: string, blocks?: any[]): Promise<boolean> {
        console.log(`[Slack API - SHADOW] 🔔 알림 우회됨:\n${message}`);
        return true;
    }
}

// DI Factory
export function getSlackClient(): ISlackClient {
    const isShadow = process.env.IS_SHADOW_MODE === 'true';
    return isShadow ? new ShadowSlackClient() : new RealSlackClient();
}
