import * as dotenv from 'dotenv';
import { z } from 'zod';

// 1. 하드코딩 지양 정책에 따라 환경 변수 로드
dotenv.config();

// 2. 환경 변수 스키마 검증 (Zod)
const EnvSchema = z.object({
    MAX_EXPECTED_LOSS: z.string().default('0.0015'),
    MIN_CONFIDENCE_LEVEL: z.string().default('0.95'),
    AGENT_MESH_TIMEOUT_MS: z.string().default('120000'),
});

const parsedEnv = EnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error("❌ 기본 환경 변수 주입이 실패했습니다.");
    process.exit(1);
}

const envConfig = parsedEnv.data;
import { PostHogMCPConnector } from './mcp-servers/posthog';
import { V0DevMCPConnector } from './mcp-servers/v0';
import { GitHubMCPConnector } from './mcp-servers/github';
import { GrowthBookMCPConnector } from './mcp-servers/growthbook';

import { MessageBus } from './orchestrator/messageBus';
import { SupervisorAgent } from './orchestrator/supervisor';
import { DataAnalyticsAgent } from './agents/dataAnalyticsAgent';
import { HypothesisStrategyAgent } from './agents/hypothesisAgent';
import { FrontendDevAgent } from './agents/frontendAgent';
import { DeploymentQAAgent } from './agents/deploymentAgent';

async function bootstrap() {
    console.log(`\n========================================`);
    console.log(`🚀 Agentic CRO Orchestrator Bootstrapping...`);
    console.log(`- Max Expected Loss Threshold: ${envConfig.MAX_EXPECTED_LOSS}`);
    console.log(`- Agent Mesh Timeout: ${envConfig.AGENT_MESH_TIMEOUT_MS}ms`);
    console.log(`========================================\n`);

    console.log(`[1/2] MCP 서버(Agent External Tools) 커넥트 중...`);
    const posthog = new PostHogMCPConnector();
    const v0 = new V0DevMCPConnector();
    const github = new GitHubMCPConnector();
    const growthbook = new GrowthBookMCPConnector();

    await Promise.all([
        posthog.connect(),
        v0.connect(),
        github.connect(),
        growthbook.connect(),
    ]);

    console.log(`\n[2/2] 베이지안 샌드박스(Bayesian Sandbox) 연산 로직 테스트 진입...`);
    const { BayesianCalculator } = await import('./analytics/bayesian');
    const calc = new BayesianCalculator(10000); // 1만회 Mock MCMC

    // 모의 상황: 기존 대조군(Control) 전환 수 120/1000, 대안(Variant) 전환 수 145/1000
    const controlParams = { alpha: 121, beta: 881 };
    const variantParams = { alpha: 146, beta: 856 };

    const result = calc.calculateExpectedLoss(controlParams, variantParams);
    console.log(`📊 Mock Test Result:`);
    console.log(`- B가 A를 이길 확률 [P(B>A)]: ${(result.probBBeatsA * 100).toFixed(2)}%`);
    console.log(`- B 채택 시 기대 손실 (Expected Loss): ${parseFloat(result.expectedLoss.toString()).toFixed(5)}`);

    if (result.expectedLoss < parseFloat(envConfig.MAX_EXPECTED_LOSS)) {
        console.log(`✅ [승인] 기대 손실이 허용 임계값(${envConfig.MAX_EXPECTED_LOSS}) 미만입니다. 배포를 진행할 수 있습니다.`);
    } else {
        console.log(`❌ [승인 거부] 기대 손실이 너무 높습니다. 리스크를 회피합니다.`);
    }

    console.log(`\n[3/3] A2A (Agent-to-Agent) 메시지 버스 및 다중 에이전트 초기화 중...`);
    const messageBus = new MessageBus();

    const supervisor = new SupervisorAgent(messageBus);
    new DataAnalyticsAgent(messageBus);
    new HypothesisStrategyAgent(messageBus);
    new FrontendDevAgent(messageBus);
    new DeploymentQAAgent(messageBus);

    console.log(`\n========================================`);
    console.log(`Orchestrator Idle 상태 돌입. 수신 메시지 대기 중...`);

    // A2A 종단간 통합 시뮬레이션 발동
    console.log(`\n[Test Trigger] Supervisor가 자율 A/B 실험 파이프라인(Flywheel)을 가동합니다...`);
    await supervisor.kickOffExperiment();
}

bootstrap().catch(console.error);
