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
import * as jwt from 'jsonwebtoken';

// ─── Types ─────────────────────────────────────────

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

    const data = await response.json() as { token: string; expires_at: string };

    console.log(`✅ [GitHub App] Installation Token 발급 완료 (만료: ${data.expires_at})`);

    return {
        token: data.token,
        provider: 'github-app',
        expiresAt: data.expires_at,
    };
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
