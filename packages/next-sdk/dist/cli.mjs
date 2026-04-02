#!/usr/bin/env node

// src/cli.ts
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import * as readline from "readline";
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
async function main() {
  console.log("==========================================");
  console.log("\u{1F680} Agentic CRO B2B SaaS Installer");
  console.log("==========================================");
  const command = process.argv[2];
  if (command !== "init") {
    console.log("Usage: npx @agentic-cro/next-sdk init");
    process.exit(1);
  }
  const cwd = process.cwd();
  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.error("\u274C Error: package.json not found in the current directory.");
    console.error("Please run this command in the root of your Next.js project.");
    process.exit(1);
  }
  console.log(`[1/3] \u{1F4E6} \uB300\uC0C1 \uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4\uC758 \uD328\uD0A4\uC9C0\uB97C \uBD84\uC11D \uBC0F \uC124\uCE58\uD569\uB2C8\uB2E4...`);
  try {
    console.log("Installing @agentic-cro/next-sdk, posthog-js, and @growthbook/growthbook-react...");
    execSync("npm install posthog-js @growthbook/growthbook-react", { stdio: "inherit" });
    console.log("\u2705 Dependencies installed successfully.");
  } catch (e) {
    console.error("\u274C Failed to install dependencies.", e.message);
    process.exit(1);
  }
  console.log(`
[2/3] \u2699\uFE0F  \uD658\uACBD\uBCC0\uC218(.env) \uC124\uC815 \uC548\uB0B4...`);
  const envPath = path.join(cwd, ".env");
  let envSource = "";
  if (fs.existsSync(envPath)) {
    envSource = fs.readFileSync(envPath, "utf8");
  }
  if (!envSource.includes("NEXT_PUBLIC_POSTHOG_KEY")) {
    const defaultEnv = `
# Agentic CRO Environment Variables
NEXT_PUBLIC_POSTHOG_KEY=phc_YOUR_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY=sdk_YOUR_GROWTHBOOK_KEY
`;
    fs.appendFileSync(envPath, defaultEnv);
    console.log("\u2705 .env \uD30C\uC77C\uC5D0 Agentic CRO \uD658\uACBD \uBCC0\uC218 \uD15C\uD50C\uB9BF\uC774 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
  } else {
    console.log("\u2705 .env \uD30C\uC77C\uC5D0 \uC774\uBBF8 \uAD00\uB828 \uD658\uACBD \uBCC0\uC218\uAC00 \uC874\uC7AC\uD569\uB2C8\uB2E4.");
  }
  console.log(`
[3/3] \u{1FA84}  App Router \uC5F0\uB3D9 \uCF54\uB4DC \uC548\uB0B4 (Manual Steps for now)`);
  console.log(`\uB2E4\uC911 \uD14C\uB10C\uC2DC \uD154\uB808\uBA54\uD2B8\uB9AC \uC644\uC131\uC744 \uC704\uD574 \uB2E4\uC74C \uCF54\uB4DC\uB97C \`app/layout.tsx\`\uC5D0 \uCD94\uAC00\uD558\uC138\uC694:
`);
  console.log(`import { AgenticWrapper } from '@agentic-cro/next-sdk';
`);
  console.log(`export default function RootLayout({ children }: { children: React.ReactNode }) {`);
  console.log(`  return (`);
  console.log(`    <html lang="en">`);
  console.log(`      <AgenticWrapper>`);
  console.log(`        <body>{children}</body>`);
  console.log(`      </AgenticWrapper>`);
  console.log(`    </html>`);
  console.log(`  );`);
  console.log(`}
`);
  console.log("\u{1F389} Agentic CRO SDK \uCD08\uAE30\uD654\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4! (Tenant Isloated)");
  process.exit(0);
}
main().catch(console.error);
