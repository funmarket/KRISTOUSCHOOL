# KRISTOU SCHOOL

KRISTOU SCHOOL is the clean application platform for École Primaire Privée Kristou School. It is a mobile-first, multilingual school platform for public visitors, parents, students, teachers, delegated managers/associates, and the School Owner / App Admin.

This repository is intentionally clean. The HoomaUltimate repository is a read-only process/architecture reference only; no HOOMA product code, schema, routes, runtime, auth, branding, or business rules belong here.

## Current Phase 0 topology

Verified deployed/source lineage: `deploy-candidate@76ab188b39327955d4b23a823ff1d5b5ddaf47dc`.

```text
apps/
  api/        # backend HTTP runtime
  web/        # canonical KRISTOU React application entry and current Railway Web build
  worker/     # async runtime foundation
packages/
  config/
  contracts/
  database/
  domain/
  frontend/   # shared product shell/feature UI
  testing/
  ui/
docs/
scripts/
tests/
.github/
```

The source tree above is current implementation evidence, not permission to preserve accidental ownership forever. KRISTOU's target architecture is one product frontend: normal Browser and Telegram WebView use the same canonical React/TypeScript product, route authority, feature implementation, API/application/domain behavior, and canonical User. Telegram-specific code may adapt host/runtime mechanics only.

R4 removed the superseded `apps/telegram` workspace after repository and Railway inspection found no current consumer requiring that standalone package identity. Telegram host/runtime mechanics remain canonically owned under `apps/web/src/telegram/runtime.ts`; any future compatibility package must be facade-only and must not create a second product owner.

## Current deployment truth

The currently verified public candidate runs on Railway:

- Web service: `web-candidate`
- Web source branch: `deploy-candidate`
- Web build command: `npm run build:web`
- API service: `api-candidate`
- PostgreSQL and Redis are Railway services in the same KRISTOU project.

Cloudflare is not the current frontend hosting authority. It is reserved for later AI/edge capabilities when that phase is explicitly implemented.

Deployment evidence belongs in `progress.md`; this README must not be used as a substitute for a fresh runtime check.

## Mandatory reading before implementation

Before the first implementation edit, every agent or developer must read:

1. `AGENTS.md`
2. `docs/LIVING_BUILD_PLAN.md`
3. the relevant sections of `requirements.md`
4. the relevant sections of `structure.md`
5. relevant decisions in `docs/DECISIONS.md`
6. relevant data/authority rules in `docs/CANONICAL_MODEL.md`

Then inspect the actual repository, current branch/HEAD, overlapping work, and relevant runtime/data evidence before editing.

## Domain ownership rule

Every durable product concept has exactly one authoritative owner. Do not create cross-domain monolithic services, repositories, scripts, contracts, frontend stores/clients, or catch-all modules to make implementation faster.

Cross-domain workflows must use explicit application orchestration or ports. The owning domain retains its business and persistence authority.

Unrelated product flows must not be forced to query, lock, validate, cache, load, or rerender together.

## Living documentation

Documentation is part of the product contract.

Authoritative subjects are separated:

- `requirements.md` — product behavior and acceptance contract;
- `structure.md` — architecture, topology, dependency direction, domain ownership;
- `docs/CANONICAL_MODEL.md` — canonical entities, writes, durable truth, projections;
- `docs/DECISIONS.md` — architectural decisions and ADR index;
- `AGENTS.md` + `docs/LIVING_BUILD_PLAN.md` — how work is performed;
- `progress.md` — current implementation/deployment evidence only.

Do not create another file that competes with one of these authorities.

## Core product direction

The approved product baseline includes:

- one canonical product frontend for Browser and Telegram WebView;
- one canonical user shared by Web and Telegram authentication transports;
- server-side RBAC + resource-scoped authorization;
- public/general, parent, student, teacher, manager/associate, and App Admin access boundaries;
- class communities;
- Parent Notes;
- short Messages;
- student class-wide Class Questions with no private student DMs initially;
- safety-critical Pickup;
- Teachers and Administration/School Board surfaces;
- La Toque Gourmande Food Menu;
- notifications and configurable sounds;
- Arabic, French, and English from foundation;
- Light as default appearance and Pitch Black as optional dark mode.

See `requirements.md` for accepted behavior rather than treating this README as the full product contract.

## Foundation verification

The Phase 0 workspace uses Node.js 22 and npm 10.9.2.

```bash
npm ci
npm run architecture:check
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build:web
npm run build
npm run deploy:preflight
```

A historical green run does not prove a new head. Use the repository's Foundation CI and the exact current candidate for merge evidence.
