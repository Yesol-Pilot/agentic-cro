/**
 * GitHub Authentication Gateway
 * 
 * B2B SaaS 엔터프라이즈 보안 체계:
 * - Production: GitHub App → JWT 서명 → Installation Token (1h 유효)
 * - Development: PAT Fallback
 * 
 * CTO 아키텍처 규격:
 *   Step A: RS256 JWT 서명 (APP_ID + PRIVATE_KEY, 10분 만료)
 *   Step B: Installation Token 발급 (POST /app/installations/{id}/access_tokens)
 *   Step C: Octokit + git clone 인증 주입
 */

import { Octokit } from '@octokit/rest';
<<<<<<< HEAD
import { createAppAuth } from '@octokit/auth-app';
import { exec } from 'child_process';
import util from 'util';
=======
import * as jwt from 'jsonwebtoken';
>>>>>>> d890aa47b029b33687c3a1296cc1a60c455c6b11

// ─── Types ─────────────────────────────────────────

<<<<<<< HEAD
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
=======
interface GitHubAuth {
    token: string;
    provider: 'github-app' | 'pat';
    expiresAt: string | null;
}

// ─── Config (환경변수 기반 — 하드코딩 금지) ──────────

const GITHUB_APP_ID = process.env.GITHUB_APP_ID || '';
const GITHUB_APP_PRIVATE_KEY = (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const GITHUB_APP_INSTALLATION_ID = process.env.GITHUB_APP_INSTALLATION_ID || '';

// ─── Step A: JWT 서명 (RS256, 10분 만료) ───────────

function generateJWT(): string {
    if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
        throw new Error('[GitHub App] APP_ID 또는 PRIVATE_KEY 미설정');
    }

    const now = Math.floor(Date.now() / 1000);

    const payload = {
        iat: now - 60,           // issued at (60초 클럭 스큐 허용)
        exp: now + (10 * 60),    // 10분 만료
        iss: GITHUB_APP_ID,      // GitHub App ID
    };
>>>>>>> d890aa47b029b33687c3a1296cc1a60c455c6b11

    return jwt.sign(payload, GITHUB_APP_PRIVATE_KEY, { algorithm: 'RS256' });
}

// ─── Step B: Installation Token 발급 ──────────────

async function generateInstallationToken(): Promise<GitHubAuth> {
    const jwtToken = generateJWT();

    const response = await fetch(
        `https://api.github.com/app/installations/${GITHUB_APP_INSTALLATION_ID}/access_tokens`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${jwtToken}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
            },
        }
    );

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`[GitHub App] Installation Token 발급 실패 (${response.status}): ${body}`);
    }

<<<<<<< HEAD
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
=======
    const data = await response.json() as { token: string; expires_at: string };

    console.log(`✅ [GitHub App] Installation Token 발급 완료 (만료: ${data.expires_at})`);

    return {
        token: data.token,
        provider: 'github-app',
        expiresAt: data.expires_at,
    };
>>>>>>> d890aa47b029b33687c3a1296cc1a60c455c6b11
}

// ─── Factory: 환경별 분기 (CTO 규격) ───────────────

/**
 * 프로덕션: GitHub App JWT → Installation Token (1h 유효, 최소 권한)
 * 개발/로컬: PAT Fallback
 */
export async function getGitHubAuthToken(): Promise<GitHubAuth> {
    // Production: GitHub App 인증
    if (process.env.NODE_ENV === 'production') {
        if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY || !GITHUB_APP_INSTALLATION_ID) {
            throw new Error(
                '[GitHub App] 프로덕션 환경에서 GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_INSTALLATION_ID가 필수입니다.'
            );
        }
        return await generateInstallationToken();
    }

    // Development: PAT Fallback
    const pat = process.env.GITHUB_PAT;
    if (!pat) {
        throw new Error('[GitHub Auth] GITHUB_PAT 미설정 (개발 환경)');
    }

    console.log('🔑 [GitHub Auth] PAT Fallback 모드 (개발 환경)');
    return {
        token: pat,
        provider: 'pat',
        expiresAt: null,
    };
}

// ─── Step C: 인증된 Octokit 인스턴스 팩토리 ────────

export async function getAuthenticatedOctokit(): Promise<{ octokit: Octokit; auth: GitHubAuth }> {
    const auth = await getGitHubAuthToken();
    const octokit = new Octokit({ auth: auth.token });
    return { octokit, auth };
}

/**
 * Step C: git clone URL에 인증 토큰을 주입합니다.
 * GitHub App: https://x-access-token:{token}@github.com/owner/repo.git
 * PAT:        https://{token}@github.com/owner/repo.git
 */
export function getAuthenticatedCloneUrl(repoFullName: string, auth: GitHubAuth): string {
    const prefix = auth.provider === 'github-app' ? 'x-access-token' : '';
    const authPart = prefix ? `${prefix}:${auth.token}` : auth.token;
    return `https://${authPart}@github.com/${repoFullName}.git`;
}
