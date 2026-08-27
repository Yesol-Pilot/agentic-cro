# Repository Governance Contract

Policy ID: `ng-repo-governance/1.0.0`
Last reviewed: 2026-08-27

## Identity

- Repository: `Yesol-Pilot/agentic-cro`
- Lifecycle class: `product-platform`
- Current owner: `Yesol-Pilot`
- Intended owner: `NeoGenesisAI`
- Canonical branch: `main`
- Visibility: `public`
- Production status: `UNVERIFIED`
- Transfer state: `REQUIRED`

`UNKNOWN` means not independently verified and must never be reported as PASS.

## Purpose and current risk

Agentic CRO is a company optimization product. Automated experimentation can alter public content, analytics, conversion flows, and user experience, so optimization authority must be bounded by evidence and rollback.

- Public code requires recurring license, security-contact, claim, and historical-secret review.
- Experiment recommendations must not become production changes without explicit scope, metric definitions, guardrails, and rollback.
- Mock, shadow, simulation, and offline evaluator results are not live conversion evidence.
- Analytics identifiers, consent, privacy, traffic allocation, and statistical validity remain `UNKNOWN` until target-surface verification.

## Required remediation

- [ ] Define the production integration, authorized mutation surface, primary metric, guardrail metrics, minimum sample, stop rule, and rollback authority.
- [ ] Run full-history secret, dependency, license, and public-claim audits.
- [ ] Separate recommendation, preview, experiment allocation, production promotion, and rollback roles.
- [ ] Add format, typecheck, unit, production build, preview deployment, analytics reconciliation, visual review, security-header, consent, and rollback checks.
- [ ] Prohibit autonomous publication when data quality, consent, or experiment identity is unverified.
- [ ] Transfer the repository to `NeoGenesisAI` while preserving public visibility and integrations.

## Pull-request and branch rules

- One task, one branch, one isolated worktree.
- Draft inactivity limit: 14 days; maximum stack depth: 3.
- Ready WIP limit: 5; Draft WIP limit: 10.
- Every optimization PR states hypothesis, metric contract, affected surface, risks, evidence, and rollback.
- Review conversations resolve before squash merge.
- `main` is not force-pushed or deleted.

## Exit criteria

The repository becomes `TRANSFERRED_COMPLIANT` only when organization ownership, public security and license posture, exact experiment identity, target-surface analytics reconciliation, preview and production evidence, bounded promotion authority, and rollback are proven.

The presence of this file alone is not compliance.
