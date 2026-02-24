/**
 * GitHub MCP Server Connector (DI-based)
 * 
 * 역할: Deployment Agent가 A/B 테스트 검증에 성공한 코드를 리포지토리에 푸시하고 PR을 생성합니다.
 */

import { Octokit } from '@octokit/rest';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export interface IGitHubClient {
    connect(): Promise<boolean>;
    createPullRequest(title: string, branchName: string, changes: any, idempotencyKey?: string): Promise<string>;
}

export class RealGitHubClient implements IGitHubClient {
    private octokit: Octokit;
    private repoOwner: string;
    private repoName: string;
    private isConnected: boolean = false;

    constructor() {
        const token = process.env.GITHUB_PAT || '';
        this.octokit = new Octokit({ auth: token });
        this.repoOwner = process.env.REPO_OWNER || '';
        this.repoName = process.env.REPO_NAME || '';
    }

    public async connect(): Promise<boolean> {
        if (!process.env.GITHUB_PAT || !this.repoOwner || !this.repoName) {
            console.warn("[GitHub] ⚠️ GitHub 자격 증명이 부족합니다. 실제 PR이 생성되지 않습니다.");
            return false;
        }
        try {
            const { data } = await this.octokit.rest.users.getAuthenticated();
            console.log(`✅ GitHub MCP Endpoint Connected (Authenticated as ${data.login}).`);
            this.isConnected = true;
            return true;
        } catch (e: any) {
            console.error(`[GitHub] ❌ 자격 증명 검증 실패: ${e.message}`);
            return false;
        }
    }

    public async createPullRequest(title: string, branchName: string, changes: any, idempotencyKey?: string): Promise<string> {
        if (!this.isConnected) {
            console.warn(`[GitHub API] 연동되지 않아 가짜 PR URL을 반환합니다.`);
            return `https://github.com/${this.repoOwner}/${this.repoName}/pull/mock`;
        }

        console.log(`[GitHub API - REAL] 브랜치 [${branchName}] 생성 및 PR(${title}) 시도 (IdempotencyKey: ${idempotencyKey})`);

        try {
            // 1. 로컬 환경에서 적용된 AST 패치 결과를 새 브랜치에 커밋하고 푸시합니다.
            // 주의: Temporal Worker 가 구동되는 서버에 git 레포지토리가 설정되어 있어야 함
            await execPromise(`git checkout -b ${branchName}`);
            await execPromise(`git add .`);
            await execPromise(`git commit -m "${title}"`);
            await execPromise(`git push origin ${branchName} --force`); // 멱등성을 위한 force push

            // 2. 푸시된 브랜치를 기반으로 Octokit PR 생성
            const diffBody = JSON.stringify(changes, null, 2);

            const response = await this.octokit.rest.pulls.create({
                owner: this.repoOwner,
                repo: this.repoName,
                title: title,
                head: branchName,
                base: 'main',
                body: `## Agentic CRO Auto-Generated PR\n\n**Hypothesis Info:**\n\`\`\`json\n${diffBody}\n\`\`\`\n\n> This PR was created with Idempotency Key: \`${idempotencyKey ?? 'None'}\``,
            });

            console.log(`[GitHub API - REAL] PR 생성 완료: ${response.data.html_url}`);

            // 작업 완료 후 원래 브랜치로 복귀 (Clean state)
            await execPromise(`git checkout main`);

            return response.data.html_url;
        } catch (e: any) {
            console.error(`[GitHub API] ❌ PR 생성 실패: ${e.message}`);
            // 복귀 시도
            try { await execPromise(`git checkout main`); } catch (_) { }
            throw e;
        }
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
