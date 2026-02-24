import { chromium, devices } from 'playwright';
import { analyzeImageWithVLM } from '../llm'; // vision validator
import { ClaimCheckStorage } from '../storage/claimCheck';

export async function validateHydrationAndRuntime(url: string = 'http://localhost:3000/checkout') {

    // 🛡️ [Phase 9] Vercel Serverless 용량 극복 (Browserless.io 원격 브라우저 연결)
    const browserlessUrl = process.env.BROWSERLESS_URL || 'ws://localhost:3000'; // Default to mock local
    const browser = await chromium.connect({ wsEndpoint: browserlessUrl });

    // 🛡️ 1. 대조군(Control) 컨텍스트
    const controlContext = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Agentic-CRO-Sandbox-Bot/1.0-Desktop-Control'
    });

    // 🚀 2. 실험군(Test) 데스크톱 컨텍스트
    const desktopContext = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Agentic-CRO-Sandbox-Bot/1.0-Desktop-Test',
        extraHTTPHeaders: { 'X-Sandbox-QA-Traffic': 'true' }
    });

    // 🚀 3. 실험군(Test) 모바일 컨텍스트
    const iPhone = devices['iPhone 14 Pro'];
    const mobileContext = await browser.newContext({
        ...iPhone,
        userAgent: `${iPhone.userAgent} Agentic-CRO-Sandbox-Bot/1.0-Mobile-Test`,
        extraHTTPHeaders: { 'X-Sandbox-QA-Traffic': 'true' }
    });

    const testUrl = new URL(url);
    const baseUrl = `${testUrl.protocol}//${testUrl.host}`;
    await controlContext.addCookies([{ name: 'checkout_variant', value: 'control', url: baseUrl }]);
    await desktopContext.addCookies([{ name: 'checkout_variant', value: 'test', url: baseUrl }]);
    await mobileContext.addCookies([{ name: 'checkout_variant', value: 'test', url: baseUrl }]);

    const controlPage = await controlContext.newPage();
    const desktopPage = await desktopContext.newPage();
    const mobilePage = await mobileContext.newPage();

    try {
        const QA_TIMEOUT = 60000;

        await Promise.all([
            controlPage.goto(url, { waitUntil: 'networkidle', timeout: QA_TIMEOUT }),
            desktopPage.goto(url, { waitUntil: 'networkidle', timeout: QA_TIMEOUT }),
            mobilePage.goto(url, { waitUntil: 'networkidle', timeout: QA_TIMEOUT })
        ]);

        // 🛡️ [Phase 9] Browserless 통신 지연 방어 (Evaluate Injection)
        // 무수한 locator 통신 왕복(Round-trip) 대신 원격 Node 브라우저 문맥에 일괄 주입(Inject)하여 평가 로직 1회 호출
        const performRemoteEvaluate = async (page: any, type: string) => {
            return await page.evaluate(async (envType: string) => {
                const logs: string[] = [];
                // 에러 발생 여부를 Remote 측 DOM에서 스위핑 (Client-side JS 환경 기준)
                const hasErrorBoundary = !!document.querySelector('.error-boundary');
                const scrollHeight = document.body.scrollHeight;
                return { envType, hasErrorBoundary, scrollHeight, logs };
            }, type);
        };

        const [controlState, desktopState, mobileState] = await Promise.all([
            performRemoteEvaluate(controlPage, 'Control-Desktop'),
            performRemoteEvaluate(desktopPage, 'Test-Desktop'),
            performRemoteEvaluate(mobilePage, 'Test-Mobile')
        ]);

        if (controlState.hasErrorBoundary || desktopState.hasErrorBoundary || mobileState.hasErrorBoundary) {
            console.error('[Browserless QA] 에러 바운더리 포획 감지됨.');
            await browser.close();
            return { success: false, logs: '[Remote Eval] Error boundary triggered' };
        }

    } catch (e: any) {
        await browser.close();
        return { success: false, logs: `[Navigation Failed] ${e.message}` };
    }

    // --- 2. 다중 뷰포트 & 대조군(Control) 교차 Visual QA Pipeline ---
    try {
        const [controlBuffer, desktopBuffer, mobileBuffer] = await Promise.all([
            controlPage.screenshot({ fullPage: true }),
            desktopPage.screenshot({ fullPage: true }),
            mobilePage.screenshot({ fullPage: true })
        ]);

        // 🛡️ [Phase 9] Temporal 페이로드 초과 방지 (Claim Check Pattern)
        // 무거운 스크린샷 버퍼는 외부 스토리지(Redis/S3)로 Offload하고 Key(URI)만 추출
        const [controlKey, desktopKey, mobileKey] = await Promise.all([
            ClaimCheckStorage.uploadBuffer(controlBuffer, 'control_ss'),
            ClaimCheckStorage.uploadBuffer(desktopBuffer, 'desktop_test_ss'),
            ClaimCheckStorage.uploadBuffer(mobileBuffer, 'mobile_test_ss')
        ]);

        // Temporal Activity는 이 Key들을 반환받아 차후에 downloadBuffer() 로 검증 로직 가동
        const storageKeys = { controlKey, desktopKey, mobileKey };

        // [MOCK] 원래 VLM 단계이나, 이 함수를 Temporal Activity로 분리할 경우 반환 형태를 변경
        // 여기서는 하위 모듈과 맞추기 위해 버퍼 자체로 VLM 테스트를 진행한다고 임시 가정 (또는 다운로드 로직 추가)
        const downloadedControl = await ClaimCheckStorage.downloadBuffer(controlKey);
        const downloadedDesktop = await ClaimCheckStorage.downloadBuffer(desktopKey);
        const downloadedMobile = await ClaimCheckStorage.downloadBuffer(mobileKey);

        const vlmPrompt = `첨부된 세 장의 화면은 순서대로 1.대조군(Control), 2.실험군(Test) 데스크톱, 3.실험군(Test) 모바일 입니다.\n...`;

        const visualQA = await analyzeImageWithVLM(vlmPrompt, [downloadedControl, downloadedDesktop, downloadedMobile]);

        if (visualQA.trim() !== 'PASS') {
            await browser.close();
            return { success: false, logs: `[Visual QA Error] 대조군 회귀 파괴 감지:\n${visualQA}` };
        }

    } catch (e: any) {
        console.warn(`[VisualValidator] VLM/ClaimCheck 중 오류: ${e.message}`);
        await browser.close();
        return { success: false, logs: `[Visual QA Failed] ${e.message}` };
    }

    await browser.close();
    return { success: true };
}
