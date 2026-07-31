# ContextKeeper AI — Tasks

## Milestone 1: Skeleton and Data Layer

### Repo scaffold
- [ ] Initialize pnpm workspace root (`package.json` with `workspaces`, `pnpm-workspace.yaml`)
- [ ] Create workspace directories: `apps/web`, `services/api`, `packages/core`, `infra`, `docs`, `docs/decisions`
- [ ] Create `package.json` for each workspace (`@contextkeeper/web`, `@contextkeeper/api`, `@contextkeeper/core`, `@contextkeeper/infra`)
- [ ] Install shared dev deps at root: `typescript`, `eslint`, `prettier`, `vitest`

### TypeScript config
- [ ] Root `tsconfig.base.json` with `strict: true`, `noUncheckedIndexedAccess`, target ES2022, module NodeNext
- [ ] `packages/core/tsconfig.json` extending base
- [ ] `services/api/tsconfig.json` extending base
- [ ] `infra/tsconfig.json` extending base (CDK-specific settings)
- [ ] `apps/web/tsconfig.json` (Next.js managed, extends base where possible)

### Linting and formatting
- [ ] `.eslintrc.cjs` at root — TypeScript rules, no-any, no default exports (except Next.js pages)
- [ ] `.prettierrc` at root — defaults, single quotes, trailing commas
- [ ] Root scripts: `pnpm lint`, `pnpm format`, `pnpm typecheck`, `pnpm test`

### Dotfiles and repo hygiene
- [ ] `.gitignore` — node_modules, .env, cdk.out, .next, dist, coverage, *.js.map
- [ ] `.env.example` — document every env var with fake values (AWS region, table name, bucket name, Cognito pool ID, OpenAI key placeholder)
- [ ] `.npmrc` — `shamefully-hoist=false`, `strict-peer-dependencies=true`

### CI workflow
- [ ] `.github/workflows/ci.yml` — on push/PR to main: install pnpm, install deps, run `pnpm typecheck`, `pnpm test`, `pnpm lint`

### CDK data stack
- [ ] `infra/bin/app.ts` — CDK app entry point, instantiate DataStack
- [ ] `infra/cdk.json` — CDK config with esbuild context
- [ ] `infra/lib/data-stack.ts`:
  - [ ] DynamoDB table `ContextKeeperTable`, on-demand, PITR on, tag `Project=ContextKeeper`
    - PK: `pk` (String), SK: `sk` (String)
    - GSI1: `gsi1pk` (String) / `gsi1sk` (String) — items by type and due date
    - GSI2: `gsi2pk` (String) / `gsi2sk` (String) — items by person
  - [ ] S3 bucket: Block Public Access on all 4 settings, SSE-S3, lifecycle rule to Intelligent-Tiering at 30 days, tag `Project=ContextKeeper`
  - [ ] Stack outputs for table name, table ARN, bucket name, bucket ARN

### Key builders (`packages/core/src/keys.ts`)
- [ ] `makeCapturePK(userId)` → `USER#<userId>`
- [ ] `makeCaptureSK(createdAt, captureId)` → `CAPTURE#<createdAt>#<captureId>`
- [ ] `makeItemSK(itemId)` → `ITEM#<itemId>`
- [ ] `makePersonSK(normalizedName)` → `PERSON#<normalizedName>`
- [ ] `makeGSI1PK(userId, type)` → `USER#<userId>#TYPE#<type>`
- [ ] `makeGSI1SK(status, dueDate, itemId)` → `<status>#<dueDate|9999-12-31>#<itemId>`
- [ ] `makeGSI2PK(userId, normalizedName)` → `USER#<userId>#PERSON#<normalizedName>`
- [ ] `makeGSI2SK(createdAt)` → `<createdAt>`
- [ ] `normalizeName(name)` → `toLowerCase().trim().replace(/\s+/g, ' ')`
- [ ] Unit tests for every key builder function

### Zod schemas (`packages/core/src/schemas.ts`)
- [ ] `CaptureStatus` enum: UPLOADED, EXTRACTING, EXTRACTED, UNDERSTANDING, READY, FAILED
- [ ] `ItemType` enum: TASK, IDEA, NOTE, FOLLOW_UP, PROJECT
- [ ] `ItemStatus` enum: OPEN, COMPLETE
- [ ] `Priority` enum: HIGH, MEDIUM, LOW
- [ ] `CaptureSchema` — id, userId, type (TEXT, IMAGE, PDF, AUDIO), status, rawText (optional), s3Key (optional), createdAt, updatedAt, errorMessage (optional), embedding (optional number[]), schemaVersion
- [ ] `ItemSchema` — id, userId, type, title, person (optional), personDisplay (optional), dueDate (optional), project (optional), priority, status, sourceCaptureId, createdAt, updatedAt, schemaVersion
- [ ] `ExtractionResponseSchema` — `{ items: Array<{ type, title, person?, dueDate?, project?, priority }> }`
- [ ] `types.ts` — `z.infer` derived types exported: `Capture`, `Item`, `ExtractionResponse`

### Typed errors (`packages/core/src/errors.ts`)
- [ ] `NotFoundError`, `ValidationError`, `ForbiddenError`, `UpstreamError` classes

### Verification
- [ ] `pnpm typecheck` passes across all workspaces
- [ ] `pnpm test` passes — key builder tests green
- [ ] `pnpm lint` passes
- [ ] CI workflow runs successfully (or dry-run validated locally)
- [ ] `cdk synth DataStack` produces valid CloudFormation (deploy deferred to real AWS)

---

### Notes
- **OpenAI override**: User directive — use OpenAI models instead of Amazon Bedrock for all inference. The `LlmProvider` interface still gets both a Bedrock stub and an OpenAI implementation, but OpenAI is the wired-up default.
- **Commit style**: Conventional commits, human-written, e.g. `feat: add DynamoDB key builders with tests`
