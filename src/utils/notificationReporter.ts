import * as dotenv from 'dotenv';
dotenv.config();

export interface NotificationPayload {
    level: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    metrics?: Record<string, string | number>;
    url?: string;
}

/**
 * 무한 루프 최적화 시스템의 가시성을 위해 외부 플랫폼(Slack / Discord)으로 알림을 전송합니다.
 */
export class NotificationReporter {
    private webhookUrl: string;

    constructor() {
        this.webhookUrl = process.env.SLACK_WEBHOOK_URL || '';
    }

    public async sendNotification(payload: NotificationPayload): Promise<void> {
        if (!this.webhookUrl) {
            // Webhook이 설정되지 않았을 경우 Console 로깅으로 대체 (로컬 환경 지원)
            this.fallbackToConsole(payload);
            return;
        }

        try {
            // Slack Incoming Webhook Format (단순화)
            let color = '#36a64f'; // Default Green (success)
            switch (payload.level) {
                case 'info': color = '#439FE0'; break;
                case 'warning': color = '#FFCC00'; break;
                case 'error': color = '#FF0000'; break;
            }

            const slackMessage = {
                attachments: [
                    {
                        color: color,
                        title: payload.title,
                        title_link: payload.url,
                        text: payload.message,
                        fields: payload.metrics ? Object.entries(payload.metrics).map(([key, value]) => ({
                            title: key,
                            value: value.toString(),
                            short: true
                        })) : []
                    }
                ]
            };

            // 실제 통신 시 fetch 사용 (모듈에서는 모의 형태로 주석 처리)
            /*
            await fetch(this.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(slackMessage)
            });
            */

            this.fallbackToConsole(payload); // 확인용 콘솔 출력 병행
        } catch (error) {
            console.error('[NotificationReporter] 알림 전송 실패:', error);
        }
    }

    private fallbackToConsole(payload: NotificationPayload) {
        const icons = {
            info: '💬',
            success: '🥳',
            warning: '⚠️',
            error: '🚨'
        };
        console.log(`\n================================`);
        console.log(`${icons[payload.level]} [${payload.level.toUpperCase()}] ${payload.title}`);
        console.log(`--------------------------------`);
        console.log(payload.message);
        if (payload.metrics) {
            console.log(`📊 지표 현황:`, payload.metrics);
        }
        if (payload.url) {
            console.log(`🔗 링크: ${payload.url}`);
        }
        console.log(`================================\n`);
    }
}
