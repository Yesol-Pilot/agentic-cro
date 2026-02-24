import { randomUUID } from 'crypto';

/**
 * [Phase 9] Claim Check Pattern (Data Converter)
 * Temporal Workflow의 History 폭증 및 gRPC Payload 크기 초과(2MB) 방지를 위해
 * 무거운 버퍼/객체를 외부 스토리지(S3, Redis)에 저장하고 URI(Key)만 반환합니다.
 */
export class ClaimCheckStorage {
    // 실제 운영 환경에서는 AWS S3 SDK 또는 ioredis를 사용합니다.
    // 여기서는 로컬 인메모리 Map을 Storage 스텁(Stub)으로 활용합니다.
    private static storage = new Map<string, Buffer | string>();

    // 1. Buffer (스크린샷 등) 업로드 후 Key 반환
    public static async uploadBuffer(buffer: Buffer, prefix: string = 'snapshot'): Promise<string> {
        const key = `s3://cro-storage/${prefix}_${randomUUID()}.png`;
        this.storage.set(key, buffer);
        console.log(`[Claim Check] 무거운 바이너리 업로드 완료: ${key} (크기: ${buffer.byteLength} bytes)`);
        return key;
    }

    // 2. 대용량 JSON (AST 전체 파일 등) 업로드 후 Key 반환
    public static async uploadLargeJSON(data: any, prefix: string = 'ast'): Promise<string> {
        const jsonString = JSON.stringify(data);
        const key = `redis://ast-cache/${prefix}_${randomUUID()}`;
        this.storage.set(key, jsonString);
        console.log(`[Claim Check] 대용량 JSON 객체 업로드 완료: ${key}`);
        return key;
    }

    // 3. Key를 이용해 데이터 다운로드 (Activity 내부에서만 호출)
    public static async downloadBuffer(key: string): Promise<Buffer> {
        const data = this.storage.get(key);
        if (!data || typeof data === 'string') {
            throw new Error(`[Claim Check] 해당 Key에 버퍼가 존재하지 않거나 잘못된 타입입니다: ${key}`);
        }
        return data;
    }

    public static async downloadJSON<T>(key: string): Promise<T> {
        const data = this.storage.get(key);
        if (!data || typeof data !== 'string') {
            throw new Error(`[Claim Check] 해당 Key에 JSON 데이터가 존재하지 않거나 잘못된 타입입니다: ${key}`);
        }
        return JSON.parse(data) as T;
    }
}
