# Contributing to CSU-ISS FinTrack (Team SVT)

## 1. Branching Strategy
- `main` is protected and always holds deployable production code synced with Render.
- Create short-lived branches from `main` using the format `<type>/<short-topic>`:
  - `feat/<feature-name>` (e.g., `feat/db-repositories`, `feat/auth-rbac-middleware`)
  - `fix/<bug-or-finding>` (e.g., `fix/lw9-f3-atomic-audit`)
  - `docs/<doc-name>` (e.g., `docs/style-guide`)

## 2. Commit Message Convention
Follow Conventional Commits and reference SRS or LW9 Finding IDs where applicable:
`<type>(<scope>): <imperative summary> [<Ref-ID>]`
- Example: `feat(repositories): isolate SQL queries in TransactionRepository [LW9-F1]`
- Example: `fix(audit): wrap expense creation and audit log in DB transaction [FR-009, LW9-F3]`

## 3. Pull Request & Peer Review Workflow
1. Push your feature branch and open a Pull Request targeting `main`.
2. Assign at least **one teammate** as Reviewer.
3. Both Author and Reviewer must verify all **7 items in the Team Peer-Review Checklist** (LW10 Part D) before merging.