import { BaseAgent } from './baseAgent';
import { MessageBus } from '../orchestrator/messageBus';
import { A2AMessage, A2AResponse } from '../types/a2a';
import { PostHogMCPConnector } from '../mcp-servers/posthog';
import { AnalysisReport } from '../types/schemas';

export class DataAnalyticsAgent extends BaseAgent {
    constructor(messageBus: MessageBus) {
        super('DataAnalytics', messageBus);
    }

    protected async handleMessage(message: A2AMessage): Promise<A2AResponse | void> {
        if (message.method === 'START_ANALYSIS') {
            console.log(`[DataAnalytics] 🔍 MCP(PostHog) 데이터를 수집하여 이탈 구간 분석 중...`);

            const posthog = new PostHogMCPConnector();
            // MCP를 통해 Funnel 데이터 Fetch
            const funnelData = await posthog.fetchFunnelDropoff('checkout_step_2');

            const report: AnalysisReport = {
                targetFunnel: funnelData.step,
                issueDescription: funnelData.description,
                dropOffRate: funnelData.dropOffRate,
                affectedSelectors: ['#checkout-btn', '#payment-form']
            };

            console.log(`[DataAnalytics] 🔍 분석 완료. 현황: [이탈률 ${report.dropOffRate}%]`);
            console.log(`[DataAnalytics] 🔍 Supervisor에게 결과 보고 수행.`);

            await this.sendMessage('Supervisor', 'REPORT_ANALYSIS', report);
        }
    }
}
