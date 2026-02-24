import { chromium, devices } from 'playwright';
import { analyzeImageWithVLM } from '../llm'; // vision validator

export async function validateHydrationAndRuntime(url: string = 'http://localhost:3000/checkout') {
    const browser = await chromium.launch({ headless: true });

    // 🛡️ 1. 대조군(Control) 컨텍스트 (기존 UI 파괴/회귀 버그 검증용)
    const controlContext = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Agentic-CRO-Sandbox-Bot/1.0-Desktop-Control'
    });

    // 🚀 2. 실험군(Test) 데스크톱 컨텍스트 (신규 UI 검증용)
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

    // 🚨 [교차 검증 파이프라인] 통제군과 실험군에 각기 다른 Variant 쿠키 주입 (Variant Forcing)
    const testUrl = new URL(url);
    const baseUrl = `${testUrl.protocol}//${testUrl.host}`;
    await controlContext.addCookies([{ name: 'checkout_variant', value: 'control', url: baseUrl }]);
    await desktopContext.addCookies([{ name: 'checkout_variant', value: 'test', url: baseUrl }]);
    await mobileContext.addCookies([{ name: 'checkout_variant', value: 'test', url: baseUrl }]);

    const controlPage = await controlContext.newPage();
    const desktopPage = await desktopContext.newPage();
    const mobilePage = await mobileContext.newPage();

    let isFailed = false;
    let errorLogs: string[] = [];

    // 공통 에러 핸들러
    const attachErrorHandlers = (page: any, type: string) => {
        page.on('console', (msg: any) => {
            if (msg.type() === 'error') {
                isFailed = true;
                errorLogs.push(`[${type} Console Error] ${msg.text()}`);
            }
        });
        page.on('pageerror', (exception: any) => {
            isFailed = true;
            errorLogs.push(`[${type} Runtime Exception] ${exception.message}`);
        });
    };

    attachErrorHandlers(controlPage, 'Control-Desktop');
    attachErrorHandlers(desktopPage, 'Test-Desktop');
    attachErrorHandlers(mobilePage, 'Test-Mobile');

    try {
        const QA_TIMEOUT = 60000;

        // 브라우저 렌더링 3-Way 병렬 실행
        await Promise.all([
            controlPage.goto(url, { waitUntil: 'networkidle', timeout: QA_TIMEOUT }),
            desktopPage.goto(url, { waitUntil: 'networkidle', timeout: QA_TIMEOUT }),
            mobilePage.goto(url, { waitUntil: 'networkidle', timeout: QA_TIMEOUT })
        ]);

    } catch (e: any) {
        isFailed = true;
        errorLogs.push(`[Navigation Failed] ${e.message}`);
    }

    if (isFailed) {
        await browser.close();
        return { success: false, logs: errorLogs.join('\n') };
    }

    // --- 2. 다중 뷰포트 & 대조군(Control) 교차 Visual QA Pipeline ---
    try {
        const [controlScreenshot, desktopScreenshot, mobileScreenshot] = await Promise.all([
            controlPage.screenshot({ fullPage: true }),
            desktopPage.screenshot({ fullPage: true }),
            mobilePage.screenshot({ fullPage: true })
        ]);

        const vlmPrompt = `첨부된 세 장의 화면은 순서대로 1.대조군(Control), 2.실험군(Test) 데스크톱, 3.실험군(Test) 모바일 입니다.
1. [Regression Audit] 첫 번째 대조군 화면의 렌더링 상태를 분석하고, 두 번째 화면 레이아웃과 비교하여 통제군의 기존 컴포넌트가 파괴되지 않았는지 무결성을 확인하십시오.
2. [Variant Audit] 실험군 화면에서 텍스트 오버플로우, Z-index 겹침 등 시각적 결함이 있다면 정확히 지적하십시오.
오류나 회귀 버그(Regression)가 완전히 없다면 'PASS'를 반환하십시오.
*(CI 런너에서는 이와 별도로 Control 이미지 간의 픽셀 단위(toMatchSnapshot) 검증을 보수적으로 수행합니다)*`;

        // VLM을 통한 교차 회귀 검증 + UI QA 동시 수행
        const visualQA = await analyzeImageWithVLM(vlmPrompt, [controlScreenshot, desktopScreenshot, mobileScreenshot]);

        if (visualQA.trim() !== 'PASS') {
            await browser.close();
            return {
                success: false,
                logs: `[Visual QA Error] 대조군 회귀 파괴 또는 시각적 결함 감지:\n${visualQA}`
            };
        }
    } catch (e: any) {
        console.warn(`[VisualValidator] VLM 검증 중 오류 발생: ${e.message}`);
        await browser.close();
        return { success: false, logs: `[Visual QA Failed] VLM 호출 예외: ${e.message}` };
    }

    await browser.close();
    return { success: true };
}
