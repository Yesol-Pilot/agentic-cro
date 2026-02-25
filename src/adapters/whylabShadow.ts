/**
 * WhyLab Causal Audit — HIVE MIND Shadow Adapter
 * 
 * daemon.ts의 Decision 지점(fleetView.updateSite 직전)에 삽입.
 * Non-blocking: Shadow 감사 실패 시에도 원래 파이프라인에 영향 없음.
 * 
 * 연동 위치: daemon.ts L116~125 (bayesian decision 이후)
 */

interface ShadowAuditPayload {
    siteId: string;
    cycleId: string;
    decision: 'DEPLOY' | 'HOLD';
    probBBeatsA: number;
    expectedLoss: number;
    controlCvr: number;
    variantCvr: number;
    sampleSize: number;
    timestamp: string;
}

interface ShadowAuditResponse {
    accepted: boolean;
    zeta_proposed: number;
    zeta_max: number;
    was_clipped: boolean;
    drift_index: number;
    mode: 'shadow_dry_run' | 'shadow_active' | 'production';
}

// ─── Config ───────────────────────────────────────

/** WhyLab Shadow API 엔드포인트 */
const SHADOW_API_URL = process.env.WHYLAB_SHADOW_API || 'http://localhost:8100/api/v1/shadow/audit';
/** 타임아웃 (ms) — 메인 파이프라인을 절대 지연시키지 않음 */
const SHADOW_TIMEOUT_MS = parseInt(process.env.SHADOW_TIMEOUT_MS || '2000', 10);

// ─── Non-blocking Shadow Adapter ──────────────────

/**
 * HIVE MIND Decision을 WhyLab Shadow에 전달 (Fire-and-forget).
 * 
 * 무결성 보장:
 * - 2초 타임아웃
 * - 모든 에러 무시 (catch 처리)
 * - 원래 파이프라인의 흐름을 절대 방해하지 않음
 */
export async function shadowAuditFireAndForget(
    payload: ShadowAuditPayload,
    verbose: boolean = false,
): Promise<ShadowAuditResponse | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SHADOW_TIMEOUT_MS);

        const response = await fetch(SHADOW_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            if (verbose) {
                console.warn(`  [Shadow] ⚠️ HTTP ${response.status} — ignored`);
            }
            return null;
        }

        const result: ShadowAuditResponse = await response.json();

        if (verbose) {
            const clip = result.was_clipped ? '🛡️ CLIPPED' : '✅ OK';
            console.log(
                `  [Shadow] ${clip} ζ=${result.zeta_proposed.toFixed(4)} ` +
                `(max=${result.zeta_max.toFixed(4)}) DI=${result.drift_index.toFixed(3)} ` +
                `[${result.mode}]`
            );
        }

        return result;

    } catch (err: any) {
        // 타임아웃, 네트워크 에러, JSON 파싱 에러 등
        // 모두 무시 — 메인 파이프라인에 영향 없음
        if (verbose && err.name !== 'AbortError') {
            console.warn(`  [Shadow] ⚠️ ${err.message} — ignored`);
        }
        return null;
    }
}
