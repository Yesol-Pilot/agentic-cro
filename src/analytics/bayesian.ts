// @ts-ignore: jStat 타입스크립트 모듈 부재 허용
import * as jStat from 'jstat';

/**
 * Bayesian A/B Testing Sandbox Engine
 * 
 * 역할: 빈도주의 통계의 한계를 극복하고, 베타 분포(Beta Distribution)를 기반으로
 * 각 디자인 변형(Variant)의 실제 수익 전환율(Conversion Rate)을 샘플링하여 
 * "절대적 승리 확률"과 "잘못된 선택을 했을 때의 기대 손실(Expected Loss)"을 계산합니다.
 */

export interface BetaParams {
    alpha: number; // 성공 횟수 (예: 전환 수) + 사전 지식(보통 1)
    beta: number;  // 실패 횟수 (예: 이탈 수) + 사전 지식(보통 1)
}

export class BayesianCalculator {
    private sandboxLimit: number;

    constructor(mockSamples: number = 10000) {
        // Monte Carlo 시뮬레이션을 위한 샌드박스 샘플 수
        this.sandboxLimit = mockSamples;
    }

    /**
     * Variant A(기존)와 Variant B(대안)의 전환율 비교
     * @param control A의 베타 분포 파라미터 (alpha, beta)
     * @param variant B의 베타 분포 파라미터 (alpha, beta)
     * @returns 절대 우위 확률(P(B>A)) 및 기대 손실(Expected Loss)
     */
    public calculateExpectedLoss(control: BetaParams, variant: BetaParams): { probBBeatsA: number, expectedLoss: number } {
        let bWins = 0;
        let totalLoss = 0;

        // 몬테카를로 시뮬레이션 (적분 근사)
        for (let i = 0; i < this.sandboxLimit; i++) {
            // jStat을 활용해 각 분포에서 하나의 확률 p 샘플링
            const pA = jStat.beta.sample(control.alpha, control.beta);
            const pB = jStat.beta.sample(variant.alpha, variant.beta);

            if (pB > pA) {
                bWins++;
            } else {
                // B를 선택했는데 사실 A가 더 좋았을 경우의 "손실" 누적
                totalLoss += (pA - pB);
            }
        }

        const probBBeatsA = bWins / this.sandboxLimit;
        // 승리 확률이 높을수록 기대 손실은 0에 수렴함
        const expectedLoss = totalLoss / this.sandboxLimit;

        return {
            probBBeatsA,
            expectedLoss
        };
    }
}
