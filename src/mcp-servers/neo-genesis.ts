import axios from 'axios';
import { z } from 'zod';

// Neo-Genesis가 기대하는 SBU 데이터 스키마
export const SbuReportSchema = z.object({
    sbuId: z.string(),
    tenantId: z.string(),
    status: z.enum(['active', 'idle', 'healing', 'error']),
    metrics: z.object({
        wins: z.number().default(0),
        tokensUsed: z.number().default(0),
        message: z.string()
    })
});

export type SbuReportPayload = z.infer<typeof SbuReportSchema>;

export class NeoGenesisClient {
    private readonly baseUrl: string;

    constructor() {
        // 본사 서버의 로컬 IP/DNS가 .env에 존재한다고 가정, 없으면 7700 포트를 기본값으로 함
        this.baseUrl = process.env.NEO_GENESIS_URL || 'http://localhost:7700';
    }

    /**
     * Agentic-CRO의 상태를 본사 SBU 브릿지로 발송합니다.
     */
    async reportStatus(payload: SbuReportPayload): Promise<boolean> {
        try {
            // Zod 스키마 검증
            const validatedPayload = SbuReportSchema.parse(payload);

            console.log(`[Neo-Genesis Bridge] 📡 본사 관제탑(${this.baseUrl})으로 상태 보고 발송 시도...`);

            // 본사 API 구조가 /api/v2/sbu/{sbuId}/status 라고 가정
            const endpoint = `${this.baseUrl}/api/v2/sbu/${validatedPayload.sbuId}/status`;

            const response = await axios.post(endpoint, validatedPayload, {
                timeout: 5000 // 5초 타임아웃
            });

            if (response.status >= 200 && response.status < 300) {
                console.log(`[Neo-Genesis Bridge] ✅ 본사 보고 완료. (응답 코드: ${response.status})`);
                return true;
            } else {
                console.warn(`[Neo-Genesis Bridge] ⚠️ 본사 보고 실패. (응답 코드: ${response.status})`);
                return false;
            }
        } catch (error: any) {
            // 본사 서버가 꺼져있을 수 있으므로 워커가 죽지 않도록 에러를 우아하게 삼킵니다 (Graceful Degradation)
            console.warn(`[Neo-Genesis Bridge] ❌ 본사 연결 실패 (오프라인 상태일 수 있음): ${error.message}`);
            return false;
        }
    }
}

// 싱글톤 인스턴스 반환 헬퍼
export function getNeoGenesisClient() {
    return new NeoGenesisClient();
}
