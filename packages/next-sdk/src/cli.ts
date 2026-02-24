#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    console.log("==========================================");
    console.log("🚀 Agentic CRO B2B SaaS Installer");
    console.log("==========================================");

    const command = process.argv[2];

    if (command !== 'init') {
        console.log("Usage: npx @agentic-cro/next-sdk init");
        process.exit(1);
    }

    const cwd = process.cwd();
    const pkgPath = path.join(cwd, 'package.json');

    if (!fs.existsSync(pkgPath)) {
        console.error("❌ Error: package.json not found in the current directory.");
        console.error("Please run this command in the root of your Next.js project.");
        process.exit(1);
    }

    console.log(`[1/3] 📦 대상 워크스페이스의 패키지를 분석 및 설치합니다...`);
    try {
        console.log("Installing @agentic-cro/next-sdk, posthog-js, and @growthbook/growthbook-react...");
        // In local development, we might just want to use the linked version, 
        // but for the real CLI it would be npm install
        execSync('npm install posthog-js @growthbook/growthbook-react', { stdio: 'inherit' });
        console.log("✅ Dependencies installed successfully.");
    } catch (e: any) {
        console.error("❌ Failed to install dependencies.", e.message);
        process.exit(1);
    }

    console.log(`\n[2/3] ⚙️  환경변수(.env) 설정 안내...`);
    const envPath = path.join(cwd, '.env');
    let envSource = '';
    if (fs.existsSync(envPath)) {
        envSource = fs.readFileSync(envPath, 'utf8');
    }

    if (!envSource.includes('NEXT_PUBLIC_POSTHOG_KEY')) {
        const defaultEnv = `\n# Agentic CRO Environment Variables\nNEXT_PUBLIC_POSTHOG_KEY=phc_YOUR_POSTHOG_KEY\nNEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com\nNEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY=sdk_YOUR_GROWTHBOOK_KEY\n`;
        fs.appendFileSync(envPath, defaultEnv);
        console.log("✅ .env 파일에 Agentic CRO 환경 변수 템플릿이 추가되었습니다.");
    } else {
        console.log("✅ .env 파일에 이미 관련 환경 변수가 존재합니다.");
    }

    console.log(`\n[3/3] 🪄  App Router 연동 코드 안내 (Manual Steps for now)`);
    console.log(`다중 테넌시 텔레메트리 완성을 위해 다음 코드를 \`app/layout.tsx\`에 추가하세요:\n`);
    console.log(`import { AgenticWrapper } from '@agentic-cro/next-sdk';\n`);
    console.log(`export default function RootLayout({ children }: { children: React.ReactNode }) {`);
    console.log(`  return (`);
    console.log(`    <html lang="en">`);
    console.log(`      <AgenticWrapper>`);
    console.log(`        <body>{children}</body>`);
    console.log(`      </AgenticWrapper>`);
    console.log(`    </html>`);
    console.log(`  );`);
    console.log(`}\n`);

    console.log("🎉 Agentic CRO SDK 초기화가 완료되었습니다! (Tenant Isloated)");
    process.exit(0);
}

main().catch(console.error);
