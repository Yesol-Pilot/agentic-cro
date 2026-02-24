import { promisify } from 'util';

// Redis Mock Data
const tenantCredits: Record<string, number> = {
    'tenant-a': 100,
    'tenant-b': 10,
    'default': 500,
    'default-tenant': 500
};

/**
 * 모의 테넌트 크레딧 차감 모듈
 * 실제로는 Redis 기반 Rate Limiting(Token Bucket)을 수행합니다.
 */
export async function deductTenantCredit(tenantId: string, cost: number): Promise<boolean> {
    console.log(`[Token Metering Engine] 테넌트(${tenantId}) 크레딧 잔여량 조회 중...`);

    // 모의 딜레이
    await promisify(setTimeout)(100);

    const currentCredit = tenantCredits[tenantId] ?? 0;
    if (currentCredit >= cost) {
        tenantCredits[tenantId] = currentCredit - cost;
        console.log(`[Token Metering Engine] 테넌트(${tenantId}) 크레딧 차감 완료 (-${cost}). 잔여: ${tenantCredits[tenantId]}`);
        return true;
    }

    console.warn(`[Token Metering Engine] ❌ 거부됨: 테넌트(${tenantId}) 잔여 크레딧 부족 (현재: ${currentCredit}, 요구: ${cost})`);
    return false;
}
