import { BaseAgent } from './baseAgent';
import { MessageBus } from '../orchestrator/messageBus';
import { A2AMessage, A2AResponse } from '../types/a2a';
import { generateStructuredData } from '../utils/llm';
import { HypothesisSchema, AnalysisReport } from '../types/schemas';
import { randomUUID } from 'crypto';
export class HypothesisStrategyAgent extends BaseAgent {
    constructor(messageBus: MessageBus) {
        super('HypothesisStrategy', messageBus);
    }

    protected async handleMessage(message: A2AMessage): Promise<A2AResponse | void> {
        if (message.method === 'GENERATE_HYPOTHESIS') {
            const analysisData = message.params as AnalysisReport;
            console.log(`[HypothesisStrategy] 💡 분석 데이터 수신됨:`, analysisData.issueDescription);
            console.log(`[HypothesisStrategy] 💡 LLM 추론을 통한 가설 수립 최적화 중...`);

            let resultHypothesis;

            try {
                // LLM 프롬프트 디자인
                const systemPrompt = `당신은 세계 최고의 CRO(전환율 최적화) 전문가이자 UI/UX 마스터입니다. 제공된 이탈률 데이터와 타겟 Funnel을 분석하여, 유저의 마찰(Friction)을 줄이고 전환율(CR)을 높일 수 있는 구체적인 가설과 화면(DOM) 수정 지시사항을 JSON 형태로 출력하세요.`;
                const userPrompt = `[분석 리포트]\n타겟 퍼널: ${analysisData.targetFunnel}\n이탈 요인: ${analysisData.issueDescription}\n수치: ${analysisData.dropOffRate}%\n관련 셀렉터: ${analysisData.affectedSelectors?.join(', ') || '없음'}`;

                resultHypothesis = await generateStructuredData(
                    systemPrompt,
                    userPrompt,
                    HypothesisSchema,
                    'hypothesis_output',
                    'gemini-2.5-pro'
                );
                console.log(`[HypothesisStrategy] 🧠 LLM 가설 생성 성공! (AI 추론 모드)`);
            } catch (err: any) {
                console.warn(`[HypothesisStrategy] ⚠️ LLM 호출 실패(${err.message}). 내장 기반(Mock) 패턴으로 Fallback 합니다.`);
                await new Promise(resolve => setTimeout(resolve, 800));

                resultHypothesis = {
                    hypothesisId: randomUUID(),
                    targetRoute: '/src/components/CheckoutButton.tsx',
                    uxRationale: 'Reduce friction at step 2 by highlighting primary action',
                    uiDirectives: [
                        { selector: '#checkout-btn', action: 'MODIFY_STYLE', description: 'Change color to green and enlarge text' }
                    ]
                };
            }

            console.log(`[HypothesisStrategy] 💡 가설 도출 완료. Supervisor에게 보고.`);
            await this.sendMessage('Supervisor', 'REPORT_HYPOTHESIS', resultHypothesis);
        }
    }
}
