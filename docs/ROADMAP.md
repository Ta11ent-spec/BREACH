# Roadmap — turn the investor UI into the official website

## Stage 0: Git-ready UI starter — included

- [x] Preserve all investor-demo screens and mock interactions
- [x] Introduce Vite + React + TypeScript tooling
- [x] Add VS Code tasks, debugger and Windows launcher
- [x] Provide reproducible Git source history and GitHub remote instructions
- [x] Add build checks on pushes / pull requests
- [x] Provide a separately runnable, offline presentation snapshot

## Stage 1: Production-quality frontend architecture

- [x] Break `src/App.tsx` into screen components and shared layout
- [x] Move fictional fixtures into `src/data/`
- [x] Define preliminary TypeScript domain interfaces for round and match events (needs integration across legacy screens)
- [ ] Remove `@ts-nocheck` from migrated modules
- [ ] Improve hash routing, invalid-route handling and accessibility (a new routing library is optional)
- [ ] Add automated component tests and responsive visual regression tests
- [ ] Design public marketing pages, privacy policy and terms
- [ ] Add user-facing demo-data labeling in all exports/screens

## Stage 2: Website features

- [ ] Accounts, teams, permissions and invited members
- [ ] Team profile and onboarding screens
- [ ] Filter persistence, data import statuses and empty/error states
- [ ] Connect typed data adapter to API endpoints (no screen rewrites)
- [ ] Manual event corrections with attribution and an audit log
- [ ] Deployment domains, analytics, monitoring and security review

## Stage 3: Actual data ingestion and analytics

- [ ] Validate what data replay files expose in current game version
- [ ] Match/round event ingestion with validation + deduplication
- [ ] Console/manual review workflow
- [ ] Advanced metric definitions (KOST, trades, clutches, objective support)
- [ ] Permission-aware dashboards backed by server-generated stats

**Important:** Do not replace demo telemetry with unverified numbers or promise full automatic data extraction until each source has been validated.
