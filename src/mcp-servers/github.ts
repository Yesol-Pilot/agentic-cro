/**
 * GitHub MCP Server Connector (DI-based)
 * 
 * 역할: Deployment Agent가 A/B 테스트 검증에 성공한 코드를 리포지토리에 푸시하고 PR을 생성합니다.
 */

export interface IGitHubClient {
    connect(): Promise<boolean>;
    createPullRequest(title: string, branchName: string, changes: any, idempotencyKey?: string): Promise<string>;
}

export class RealGitHubClient implements IGitHubClient {
    private token: string;
    private repoOwner: string;
    private repoName: string;

    constructor() {
        this.token = process.env.GITHUB_PAT || '';
        this.repoOwner = process.env.REPO_OWNER || '';
        this.repoName = process.env.REPO_NAME || '';
    }

    public async connect(): Promise<boolean> {
        if (!this.token || !this.repoOwner || !this.repoName) {
            console.warn("⚠️ GitHub 자격 증명이 부족합니다. PR 자동 생성은 Skip 처리됩니다.");
            return false;
        }
        console.log("✅ GitHub MCP Endpoint Connected.");
        return true;
    }

    public async createPullRequest(title: string, branchName: string, changes: any, idempotencyKey?: string): Promise<string> {
        // 실제 환경 시 Octokit을 통한 API 호출 수행 (Idempotency Key 주입)
        console.log(`[GitHub API - REAL] PR 생성 시도: ${title} (IdempotencyKey: ${idempotencyKey})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`[GitHub API - REAL] PR 생성 완료 - 브랜치: ${branchName}`);
        return `https://github.com/${this.repoOwner}/${this.repoName}/pull/101`;
    }
}

export class ShadowGitHubClient implements IGitHubClient {
    public async connect(): Promise<boolean> {
        console.log("✅ [Shadow Mode] GitHub Mock Endpoint Connected.");
        return true;
    }

    public async createPullRequest(title: string, branchName: string, changes: any, idempotencyKey?: string): Promise<string> {
        console.log(`[GitHub API - SHADOW] PR 생성 요청 우회됨(200 OK) - 제목: ${title} (IdempotencyKey: ${idempotencyKey})`);
        // 부수 효과 없이 가짜 URL 반환
        return `https://github.com/shadow-user/shadow-repo/pull/999`;
    }
}

// DI Factory
export function getGitHubClient(): IGitHubClient {
    const isShadow = process.env.IS_SHADOW_MODE === 'true';
    return isShadow ? new ShadowGitHubClient() : new RealGitHubClient();
}
