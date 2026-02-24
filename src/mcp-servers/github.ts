/**
 * GitHub MCP Server Connector (DI-based)
 * 
 * 역할: Deployment Agent가 A/B 테스트 검증에 성공한 코드를 리포지토리에 푸시하고 PR을 생성합니다.
 */

import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export interface IGitHubClient {
    connect(): Promise<boolean>;
    fetchInstallationToken(): Promise<string | null>;
    waitForCiCdStatus(ref: string, timeoutMinutes?: number): Promise<boolean>;
    createPullRequest(title: string, branchName: string, changes: any, idempotencyKey?: string): Promise<string>;
}

export class RealGitHubClient implements IGitHubClient {
    private octokit: Octokit | null = null;
    private repoOwner: string;
    private repoName: string;
    private appId: string;
    private privateKey: string;
    private installationId: string;
    private isConnected: boolean = false;

    constructor() {
        this.repoOwner = process.env.REPO_OWNER || '';
        this.repoName = process.env.REPO_NAME || '';
        this.appId = process.env.GITHUB_APP_ID || '';
        this.privateKey = (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
        this.installationId = process.env.GITHUB_APP_INSTALLATION_ID || '';
    }

    public async connect(): Promise<boolean> {
        // App Auth 우선 시도, 실패 시 PAT로 폴백
        if (this.appId && this.privateKey && this.installationId) {
            this.octokit = new Octokit({
                authStrategy: createAppAuth,
                auth: {
                    appId: this.appId,
                    privateKey: this.privateKey,
                    installationId: this.installationId,
                }
            });
            console.log(`✅ [GitHub] GitHub App 기반 연결 시도 중.`);
        } else if (process.env.GITHUB_PAT) {
            this.octokit = new Octokit({ auth: process.env.GITHUB_PAT });
            console.log(`✅ [GitHub] PAT(Personal Access Token) 기반 연결 시도 중.`);
        } else {
            console.warn("[GitHub] ⚠️ GitHub 자격 증명이 부족합니다. 실제 PR이 생성되지 않습니다.");
            return false;
        }

        if (!this.repoOwner || !this.repoName) return false;

        try {
            await this.octokit.rest.rateLimit.get(); // 연결 테스트
            console.log(`✅ GitHub MCP Endpoint Connected (Target: ${this.repoOwner}/${this.repoName}).`);
            this.isConnected = true;
            return true;
        } catch (e: any) {
            console.error(`[GitHub] ❌ 자격 증명 검증 실패: ${e.message}`);
            return false;
        }
    }

    public async fetchInstallationToken(): Promise<string | null> {
        if (!this.appId || !this.privateKey || !this.installationId) {
            // PAT 사용 시 PAT 본체 반환
            return process.env.GITHUB_PAT || null;
        }
        try {
            const auth = createAppAuth({
                appId: this.appId,
                privateKey: this.privateKey,
            });
            const installationAuthentication = await auth({
                type: "installation",
                installationId: this.installationId,
            }) as any;
            return installationAuthentication.token;
        } catch (e: any) {
            console.error(`[GitHub] ❌ Installation Token 발급 실패: ${e.message}`);
            return null;
        }
    }

    public async waitForCiCdStatus(ref: string, timeoutMinutes: number = 60): Promise<boolean> {
        if (!this.octokit) return false;
        console.log(`[GitHub API] 🔄 ${ref} 참조에 대한 CI/CD 상태 대기 시작 (타임아웃: ${timeoutMinutes}분)`);

        const timeoutMs = timeoutMinutes * 60 * 1000;
        const startTime = Date.now();
        const delayMs = 15000; // 15초 간격 폴링

        while (Date.now() - startTime < timeoutMs) {
            try {
                // 1. Commit Status 확인
                const { data: statusData } = await this.octokit.rest.repos.getCombinedStatusForRef({
                    owner: this.repoOwner,
                    repo: this.repoName,
                    ref: ref
                });

                // 2. Check Runs 확인 (GitHub Actions 등)
                const { data: checksData } = await this.octokit.rest.checks.listForRef({
                    owner: this.repoOwner,
                    repo: this.repoName,
                    ref: ref
                });

                const statusState = statusData.state; // 'success', 'pending', 'failure'
                const allChecksCompleted = checksData.check_runs.every(run => run.status === 'completed');
                const anyCheckFailed = checksData.check_runs.some(run => run.conclusion === 'failure' || run.conclusion === 'cancelled');

                if (anyCheckFailed || statusState === 'failure') {
                    console.error(`[GitHub API] ❌ CI/CD 빌드 실패 감지! (Ref: ${ref})`);
                    return false;
                }

                if (statusState === 'success' && allChecksCompleted) {
                    console.log(`[GitHub API] ✅ CI/CD 빌드 통과 성공! (Ref: ${ref})`);
                    return true;
                }

                console.log(`[GitHub API] ⏳ CI/CD 폴링 대기 중... 상태: ${statusState}, Checks: ${checksData.check_runs.length}`);
            } catch (error: any) {
                console.warn(`[GitHub API] ⚠️ 상태 조회 오류(재시도): ${error.message}`);
            }

            await new Promise(res => setTimeout(res, delayMs));
        }

        console.error(`[GitHub API] ⏰ CI/CD 상태 대기 타임아웃 만료! (Ref: ${ref})`);
        return false;
    }

    public async createPullRequest(title: string, branchName: string, changes: any, idempotencyKey?: string): Promise<string> {
        if (!this.isConnected || !this.octokit) {
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

    public async fetchInstallationToken(): Promise<string | null> {
        return "mock_installation_token";
    }

    public async waitForCiCdStatus(ref: string, timeoutMinutes?: number): Promise<boolean> {
        console.log(`[GitHub API - SHADOW] CI/CD 체크 패스 모사(200 OK) - Ref: ${ref}`);
        return true;
    }

    public async createPullRequest(title: string, branchName: string, changes: any, idempotencyKey?: string): Promise<string> {
        console.log(`[GitHub API - SHADOW] PR 생성 요청 우회됨(200 OK) - 제목: ${title} (IdempotencyKey: ${idempotencyKey})`);
        return `https://github.com/shadow-user/shadow-repo/pull/999`;
    }
}

// DI Factory
export function getGitHubClient(): IGitHubClient {
    const isShadow = process.env.IS_SHADOW_MODE === 'true';
    return isShadow ? new ShadowGitHubClient() : new RealGitHubClient();
}
