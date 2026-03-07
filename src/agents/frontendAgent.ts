import { BaseAgent } from './baseAgent';
import { MessageBus } from '../orchestrator/messageBus';
import { A2AMessage, A2AResponse } from '../types/a2a';
import { generateStructuredData } from '../utils/llm';
import { CodePatchSchema, Hypothesis } from '../types/schemas';

export class FrontendDevAgent extends BaseAgent {
    constructor(messageBus: MessageBus) {
        super('FrontendDev', messageBus);
    }

    protected async handleMessage(message: A2AMessage): Promise<A2AResponse | void> {
        if (message.method === 'GENERATE_CODE') {
            const hypothesis = message.params as Hypothesis;
            console.log(`[FrontendDev] 🛠️ 가설에 기반하여 v0.dev/LLM을 통해 코드 생성 중...`);
            console.log(`[FrontendDev] 🛠️ 수신 가설 요약:`, hypothesis.uxRationale);

            let resultCodePatch;

            try {
                const systemPrompt = `당신은 Next.js 및 Tailwind CSS 전문 시니어 프론트엔드 개발자입니다. 제공된 UI 가설과 지시사항(Directives)을 충실히 반영하여, 대상 React 컴포넌트의 추상 구문 트리(AST)를 정밀하게 변형하기 위한 operations 배열을 JSON 형태로 출력하세요. 단순 diff 형태로는 출력하지 마세요.`;
                const userPrompt = `[작업 지시서]\n타겟 라우트: ${hypothesis.targetRoute}\n변경 사유: ${hypothesis.uxRationale}\n세부 지시:\n${hypothesis.uiDirectives.map(d => `- [${d.action}] ${d.selector}: ${d.description}`).join('\n')}`;

                resultCodePatch = await generateStructuredData(
                    systemPrompt,
                    userPrompt,
                    CodePatchSchema,
                    'code_patch_ast_output',
                    'gemini-3.1-pro-preview'
                );
                console.log(`[FrontendDev] 🧠 LLM AST 패치 생성 성공!`);
            } catch (err: any) {
                console.warn(`[FrontendDev] ⚠️ AST 코드 생성 실패(${err.message}). 내장 기반(Mock) 패턴으로 Fallback 합니다.`);
                await new Promise(resolve => setTimeout(resolve, 1500));

                resultCodePatch = {
                    hypothesisId: hypothesis.hypothesisId,
                    componentPaths: [hypothesis.targetRoute],
                    patchSummary: `Mock updated applying: ${hypothesis.uiDirectives[0]?.description}`,
                    operations: [
                        {
                            action: 'merge_tailwind_classes',
                            targetComponent: 'Button.Checkout',
                            propName: 'className',
                            classesToAdd: ['bg-green-500', 'text-lg'],
                            classesToRemove: ['bg-blue-600']
                        }
                    ]
                };
            }

            console.log(`[FrontendDev] 🛠️ UI 컴포넌트 코드 생성 로직(또는 Mock) 완료. Supervisor에게 보고.`);
            await this.sendMessage('Supervisor', 'REPORT_CODE_READY', resultCodePatch);
        }
    }
}
