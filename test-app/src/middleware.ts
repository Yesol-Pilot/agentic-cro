import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Mock Edge Config Storage for Local Evaluation demonstration
const edgeConfigStorage = {
    'active_posthog_flags': {
        'checkout_button_color': 'green' // Default A/B variant mapped in Edge
    }
};

function evaluateFlagLocally(flagKey: string, distinctId: string, flags: Record<string, any>) {
    // 0ms Overhead. Deterministic hash routing logic can be added here
    // based on distinctId for sticky bucketing.
    return flags[flagKey] || 'control';
}

export async function middleware(request: NextRequest) {
    // 1. 유저 고유 ID 식별 또는 생성 (Edge 환경)
    let distinctId = request.cookies.get('ph_distinct_id')?.value;
    if (!distinctId) {
        distinctId = crypto.randomUUID();
    }

    // 2. 외부 Fetch 대신 Edge Config에서 즉시 페이로드 로드 (0ms overhead)
    // 실제로는 await get('active_posthog_flags') 를 Vercel SDK로 이용
    const activeFlags = edgeConfigStorage['active_posthog_flags'];

    // 3. Hash Ring 또는 백분율 기법을 이용한 로컬 평가 (Local Evaluation)
    const variant = evaluateFlagLocally('checkout_button_color', distinctId, activeFlags);

    // 4. 응답에 쿠키 주입 (SSR 렌더링 및 클라이언트 사이드 부트스트랩 시 읽을 수 있도록 동기화)
    const response = NextResponse.next();
    response.cookies.set('ph_distinct_id', distinctId, { httpOnly: false }); // Cross-environment 브릿징을 위해 httpOnly false
    response.cookies.set('checkout_variant', variant, { httpOnly: false });

    return response;
}

export const config = {
    matcher: ['/checkout', '/'], // 미들웨어가 개입할 라우트
};
