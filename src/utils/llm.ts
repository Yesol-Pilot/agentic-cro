import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

let geminiObj: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
    if (!geminiObj) {
        // Zero-Hardcoding 정책 준수 (환경변수 주입)
        geminiObj = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY || 'dummy_key',
        });
    }
    return geminiObj;
}

/**
 * 프롬프트와 Zod 스키마를 입력받아 LLM에게 정형화된 JSON 객체를 반환받습니다.
 */
export async function generateStructuredData<T extends z.ZodTypeAny>(
    systemPrompt: string,
    userPrompt: string,
    schema: T,
    schemaName: string = 'result_data',
    modelName: string = 'gemini-2.5-flash',
    maxRetries: number = 3,
    timeoutMs: number = 30000 // 30초 타임아웃 서킷 브레이커
): Promise<z.infer<T>> {
    const ai = getGemini();

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy_key') {
        throw new Error("GEMINI_API_KEY가 존재하지 않습니다. Mock 모드로 전환되어야 합니다.");
    }

    let currentAttempt = 1;
    let currentUserPrompt = userPrompt;

    while (currentAttempt <= maxRetries) {
        try {
            const fullSystemPrompt = `${systemPrompt}\n\n[중요] 당신의 출력은 다음 내용만을 포함하는 순수 JSON 문자열이어야 합니다. 마크다운 백틱(\`\`\`) 없이 반환하세요.`;

            // Circuit Breaker (Timeout) 적용
            const fetchPromise = ai.models.generateContent({
                model: modelName,
                contents: currentUserPrompt,
                config: {
                    systemInstruction: fullSystemPrompt,
                    responseMimeType: "application/json",
                    temperature: 0.2, // 구조적 정확도를 위해 낮은 Temperature
                }
            });

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`[LLM Timeout] ${timeoutMs}ms 초과로 인한 강제 종료(Circuit Breaker)`)), timeoutMs)
            );

            // Fetch와 Timeout 중 먼저 완료되는 것을 반환
            const response = await Promise.race([fetchPromise, timeoutPromise]) as NonNullable<Awaited<ReturnType<typeof ai.models.generateContent>>>;

            const rawText = response.text;
            if (!rawText) {
                throw new Error(`[LLM Response Error] 빈 응답을 받았습니다.`);
            }

            let parsedJson;
            try {
                parsedJson = JSON.parse(rawText);
            } catch (jsonErr: any) {
                throw new Error(`[JSON Parse Error] 반환된 텍스트가 올바른 JSON 문자열이 아닙니다.\n원본 텍스트: ${rawText}\n에러 메시지: ${jsonErr.message}`);
            }

            // Zod Schema 구조적 검증 (safeParse 사용)
            const validationResult = schema.safeParse(parsedJson);

            if (!validationResult.success) {
                // LLM이 스스로 인지할 수 있도록 상세 Zod 에러 경로와 메시지를 조립
                const zError = validationResult.error as any;
                const errorDetails = zError.errors.map((err: any) =>
                    `- 경로 [${err.path.join('.')}] : ${err.message}`
                ).join('\n');

                throw new Error(`[Zod Schema Error] 지정된 JSON 스키마 구조와 불일치합니다.\n다음 에러를 수정하여 재응답하세요:\n${errorDetails}`);
            }

            // 파싱 및 검증 성공 시 반환
            return validationResult.data;

        } catch (e: any) {
            console.warn(`[LLM Service / Attempt ${currentAttempt}/${maxRetries}] 실패(Self-Healing 가동 중): ${e.message}`);

            if (currentAttempt >= maxRetries) {
                console.error(`[LLM Service] 🚨 ${maxRetries}회 재시도 모두 실패. Supervisor에게 최종 교착(Deadlock) 에스컬레이션 발생.`);
                throw e; // 최종 한계치 도달 시 상위 Orchestrator로 Throw
            }

            // 다음 시도 시, 기존 Prompt 밑에 에러 피드백을 강하게 주입하여 자율 수정 유도
            currentUserPrompt = `${userPrompt}\n\n====================\n[오류 피드백 (반드시 수정할 것)]\n이전 당신의 응답은 다음 오류를 발생시켰습니다. 스키마와 문법을 재점검하여 새로운 JSON을 생성하세요:\n${e.message}\n====================`;
            currentAttempt++;
        }
    }

    throw new Error("[LLM Service] 알 수 없는 루프 이탈");
}

/**
 * Gemini Vision (VLM) 모델을 사용하여 이미디(들)를 분석하고 피드백을 반환합니다.
 */
export async function analyzeImageWithVLM(
    prompt: string,
    imageBuffers: Buffer[],
    modelName: string = 'gemini-2.5-pro', // 정밀한 다중 뷰포트 시각 검증을 위해 pro 모델 상향 배정
    timeoutMs: number = 90000 // 90초의 넉넉한 VLM 전용 타임아웃(Circuit Breaker)
): Promise<string> {
    const ai = getGemini();

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy_key') {
        throw new Error("GEMINI_API_KEY가 존재하지 않습니다. Mock 모드로 전환되어야 합니다.");
    }

    try {
        const imageParts = imageBuffers.map(buffer => ({
            inlineData: {
                data: buffer.toString("base64"),
                mimeType: "image/png"
            }
        }));

        const fetchPromise = ai.models.generateContent({
            model: modelName,
            contents: [
                prompt,
                ...imageParts
            ],
            config: {
                temperature: 0.1,
            }
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`[VLM Timeout] ${timeoutMs}ms 초과로 인한 강제 종료(Circuit Breaker)`)), timeoutMs)
        );

        const response = await Promise.race([fetchPromise, timeoutPromise]) as NonNullable<Awaited<ReturnType<typeof ai.models.generateContent>>>;

        if (!response.text) {
            throw new Error(`[VLM Service] 빈 응답을 받았습니다.`);
        }

        return response.text;
    } catch (e: any) {
        console.error(`[VLM Service] Gemini Vision 호출 에러:`, e?.message || e);
        throw e;
    }
}


