# Contributing to Agentic CRO (Growth-Pilot)

First of all, thank you for your interest in Agentic CRO! 🚀
This project envisions a **"Fully Autonomous Frontend Optimization Machine,"** and we believe a vision this immense requires the collective intelligence of the open-source community, not just a few lone engineers.

We welcome all forms of contributions: writing code, reporting bugs, proposing features, and expanding our plugin ecosystem. Please follow the guidelines below to ensure your Pull Requests (PRs) merge as smoothly as possible.

---

## 🛠 Open Architecture (Plug-and-Play)

This project boasts a modular architecture perfectly compatible with the MCP (Model Context Protocol) ecosystem.

### 1. Adding a New Connector Plugin (MCP Servers)

Do you want to integrate a new analytics tool (Amplitude, Mixpanel), experimentation platform (Optimizely, LaunchDarkly), or deployment service (GitLab) alongside our existing `posthog.ts`, `github.ts`, and `growthbook.ts`?

You only need to inherit a single interface.

```typescript
// src/interfaces/YourAnalyticsInterface.ts
export interface IAnalyticsClient {
    connect(): Promise<void>;
    fetchDropoffData(funnelId: string): Promise<any>;
}
```

Implement this interface in a new file (e.g., `src/mcp-servers/new-tool.ts`), and submit a PR!

### 2. Adding a New VLM / Validator

Currently, `playwrightValidator.ts` handles viewport capturing and VLM (Vision Language Model) visual inspection. If you want to add an 'Accessibility (a11y) VLM Validator' or a 'Lighthouse Performance Validator', simply append your strategy inside the `src/utils/sandbox/` directory.

---

## 🌱 Are You New Here? (`good first issue`)

Due to the massive footprint of this codebase (AST Mutation, Temporal Pipelines, Bayesian Thompson Sampling), contributing might seem daunting. For first-time committers, we have established a strict `good first issue` policy:

1. **Check the Issues Tab:** Look for issues tagged with `good first issue` in our GitHub repository.
2. **What kind of issues are these?**
   * Typos in agent prompts (`src/agents/*.ts`)
   * Adding missing `jsdoc` documentation to core functions
   * Minor CSS bug fixes in the UI mockup components (`test-app/`)
   * Adding lightweight edge-case patches to the AST Parser

---

## 📝 Developer Environment Setup & PR Rules

1. **Fork & Branch:** Fork this repository and create a local branch. (`feature/your-cool-feature`)
2. **Commit Convention:** We strictly follow the Conventional Commits specification.
   * `feat: Add new MCP connector for Amplitude`
   * `fix: Handle Promise rejection in GrowthBook fallback`
   * `docs: Update README architecture diagram`
3. **Dry-Run (Mandatory):** Set `IS_SHADOW_MODE=true` in your `.env` to engage the local sandbox. Ensure your code does not spiral into an infinite loop by running at least one full cycle with `npm run dev`.
4. **Pull Requests:** Please attach proof of execution (e.g., screenshots of the running demo or output from `simulation_logs.txt`) in your PR description.

## ⚖️ Code of Conduct

We are much more wary of bad manners than bad code. Please maintain respect and empathy for your peers during code reviews.

We eagerly await your incredible PRs! Happy Hacking! 💻✨
