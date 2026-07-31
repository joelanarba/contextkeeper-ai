# CLAUDE.md

Operating manual for ContextKeeper AI. Read this file at the start of every session before touching code. If a decision in this file turns out to be wrong, change this file in the same commit that changes the code.

---

## 1. Project Vision

ContextKeeper is a capture-first personal memory system. You dump raw material into it without organizing anything, and it returns structure: tasks, deadlines, people, projects, ideas, and follow-ups.

**The one annoying task it kills:** re-reading everything you dumped somewhere in order to find what you actually committed to. Notes, screenshots, PDFs, and voice memos all hold obligations, and none of them tell you what those obligations are. ContextKeeper reads them for you and produces one list of what you owe, to whom, by when.

That one sentence is the product. Every feature is judged against it. If a feature does not shorten the path from "I dumped something" to "I know what I owe," it does not ship this weekend.

**Concrete example of the contract:**

Input (voice note or text):
> "I need to send the AWS Student Builder Group document to Dr. Gyamfua before Friday and follow up with Samuel about the orientation."

Output (structured, queryable, and reminder-eligible):
```json
{
  "items": [
    { "type": "TASK", "title": "Send AWS Student Builder Group document", "person": "Dr. Gyamfua", "dueDate": "2026-08-07", "project": "AWS Community", "priority": "HIGH" },
    { "type": "FOLLOW_UP", "title": "Follow up about orientation", "person": "Samuel", "dueDate": null, "project": "AWS Community", "priority": "MEDIUM" }
  ]
}
```

---

## 2. Product Principles

1. **Capture must never block.** The upload succeeds and returns immediately. Processing happens asynchronously. A slow model is never allowed to make the user wait at the point of capture, because a capture tool that stalls stops being used within a week.
2. **Never lose the original.** The raw file and the raw extracted text are stored forever alongside the structured output. Extraction is a lossy interpretation and it will sometimes be wrong. The user must always be able to see what was actually said.
3. **Structure is a suggestion, not a verdict.** Every extracted item is editable and deletable. Every item carries a `sourceCaptureId` so the user can jump back to the original.
4. **Recall answers with citations.** Smart Recall never asserts something without linking the captures it came from. An unsourced answer from a memory system is worse than no answer.
5. **Silence over noise.** Reminders fire once per day as a single digest. No per-item pings. A reminder system that annoys you gets muted, and a muted reminder system is a dead feature.
6. **Single user, real user.** This is built for one person to actually use daily. Do not build team features, sharing, or workspaces. Do build real auth, because it holds real personal data.
7. **Boring infrastructure.** Managed, serverless, pay-per-use. No containers, no VPC, no databases you have to patch.

---

## 3. Technical Architecture

### 3.1 Region and account

Deploy everything to **us-east-1**. It carries the widest Bedrock model availability alongside Textract and Transcribe, and keeping one region avoids cross-region S3 and Bedrock plumbing. eu-west-1 is the fallback if model access approval stalls; if you switch, switch everything.

Use a dedicated AWS account or at minimum a dedicated CDK stack prefix. Turn on a billing alarm at $5 before the first deploy.

### 3.2 High-level flow

```
                   ┌──────────────────────────┐
                   │  Next.js (Amplify Hosting)│
                   └────────────┬──────────────┘
                                │ Cognito JWT
                     ┌──────────▼───────────┐
                     │ API Gateway HTTP API │
                     └──────────┬───────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
  ┌─────▼─────┐          ┌──────▼──────┐          ┌──────▼──────┐
  │ captureFn │          │  itemsFn    │          │  recallFn   │
  │ (write)   │          │ (CRUD)      │          │ (Q&A)       │
  └─────┬─────┘          └──────┬──────┘          └──────┬──────┘
        │                       │                        │
        │  presigned PUT        │                        │ Bedrock
   ┌────▼────┐             ┌────▼─────────────────────────▼────┐
   │   S3    │             │           DynamoDB               │
   │ raw/    │             │      ContextKeeperTable          │
   └────┬────┘             └────▲─────────────────────────────┘
        │ S3 ObjectCreated      │
   ┌────▼─────┐                 │
   │   SQS    │                 │
   │ ingest-q │                 │
   └────┬─────┘                 │
        │                       │
  ┌─────▼──────────┐            │
  │ extractTextFn  │            │
  │  Textract sync │            │
  │  Transcribe    │────────────┘ (writes rawText, status)
  └─────┬──────────┘
        │  EventBridge: Transcribe Job State Change
  ┌─────▼──────────┐
  │ understandFn   │  Bedrock: structured extraction + embedding
  └─────┬──────────┘
        │
  ┌─────▼──────────┐
  │ DynamoDB items │
  └────────────────┘

  EventBridge Scheduler (daily 07:00 Africa/Accra) ──> digestFn ──> SES
```

### 3.3 Component decisions and why

| Concern | Choice | Reasoning |
|---|---|---|
| Frontend | Next.js 15 App Router, TypeScript | Client-side data fetching against the API; no server-side AWS SDK calls from Next.js |
| Hosting | AWS Amplify Hosting | Git-connected CI/CD, free tier covers this, satisfies the AWS service requirement visibly |
| Auth | Amazon Cognito User Pool + Amplify UI Authenticator | About an hour of work, and it gives API Gateway a JWT authorizer for free |
| API | API Gateway HTTP API (not REST API) | Cheaper, lower latency, native JWT authorizer. No feature here needs REST API |
| Compute | Lambda, Node.js 22, arm64, TypeScript bundled with esbuild | arm64 is cheaper and faster for this workload |
| Queue | SQS Standard with DLQ | Decouples upload from processing; gives retries and a place for poison messages |
| Async speech | Transcribe StartTranscriptionJob + EventBridge rule on job state change | Transcribe has no sync API for files; polling from Lambda burns duration |
| Documents | Textract `DetectDocumentText` (sync) | Sync path handles images and single-page PDFs, which is 95% of real usage |
| Inference | Bedrock, `amazon.nova-lite-v1:0` for extraction, `anthropic.claude-sonnet-4-5` for recall | Nova Lite is cheap and fast for structured extraction; recall needs stronger synthesis |
| Embeddings | Bedrock `amazon.titan-embed-text-v2:0`, 512 dimensions | 512 dims keeps DynamoDB item size sane and loses almost nothing at this corpus size |
| Vector search | Cosine similarity computed in the recall Lambda | See 3.5. Correct call at this scale, wrong call at 10x |
| Database | DynamoDB, single table, on-demand | No connection pooling, no idle cost, scales to zero |
| Storage | S3 with Block Public Access and SSE-S3 | Presigned URLs only; no public objects ever |
| Notifications | SES for the daily digest | Email is the right channel for a digest. SNS is for fanout, which is not what this is |
| IaC | AWS CDK v2 (TypeScript) | One language across infra and app. Everything reproducible from `cdk deploy` |
| Observability | CloudWatch Logs (structured JSON) + one dashboard + billing alarm | Enough to debug and enough to not get surprised by a bill |

### 3.4 Capture pipeline states

Every capture row carries a `status` that moves strictly forward:

```
UPLOADED -> EXTRACTING -> EXTRACTED -> UNDERSTANDING -> READY
                  \                          \
                   -> FAILED                  -> FAILED
```

The frontend polls `GET /captures/{id}` every 2 seconds while status is not terminal. Do not build WebSockets for this. Polling for a single-user app for a 15 second job is the right amount of engineering.

`FAILED` captures keep their `errorMessage` and stay visible in the UI with a retry button. Silent failures are the fastest way to lose trust in a capture tool.

### 3.5 Why in-Lambda vector search, and when it breaks

Recall loads all embedding vectors for the user, computes cosine similarity in memory, takes the top 12, and passes those captures to Bedrock as context.

This is correct up to roughly 5,000 items: 5,000 vectors at 512 float32 dimensions is about 10 MB, which loads in well under a second in a 1024 MB Lambda and costs nothing extra. OpenSearch Serverless would cost more per month than the rest of this stack combined and would take half the weekend to wire up.

**Write this ceiling into the code as a comment and into the article as a deliberate tradeoff.** It is a better engineering story than pretending the design scales infinitely. When the user crosses ~5,000 items, migrate to S3 Vectors or OpenSearch Serverless behind the same `VectorStore` interface.

---

## 4. Folder Structure

pnpm workspaces monorepo. One repo, one deploy story.

```
contextkeeper/
├── CLAUDE.md
├── README.md                     # what it is, screenshots, how to run
├── package.json                  # workspace root, scripts only
├── pnpm-workspace.yaml
├── .env.example
├── .github/workflows/ci.yml      # typecheck + test + lint on PR
│
├── apps/
│   └── web/                      # Next.js 15
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx          # capture screen (the default screen)
│       │   ├── inbox/page.tsx    # extracted items, grouped
│       │   ├── recall/page.tsx   # ask-your-memory
│       │   └── captures/[id]/page.tsx
│       ├── components/
│       │   ├── CaptureDropzone.tsx
│       │   ├── ItemCard.tsx
│       │   ├── ItemList.tsx
│       │   └── StatusBadge.tsx
│       ├── lib/
│       │   ├── api.ts            # typed fetch client, injects JWT
│       │   └── auth.ts           # Amplify Auth config
│       └── next.config.ts
│
├── services/
│   └── api/
│       ├── src/
│       │   ├── handlers/
│       │   │   ├── createCapture.ts     # POST /captures
│       │   │   ├── getCapture.ts        # GET  /captures/{id}
│       │   │   ├── listCaptures.ts      # GET  /captures
│       │   │   ├── listItems.ts         # GET  /items
│       │   │   ├── updateItem.ts        # PATCH /items/{id}
│       │   │   ├── deleteItem.ts        # DELETE /items/{id}
│       │   │   ├── recall.ts            # POST /recall
│       │   │   ├── extractText.ts       # SQS consumer
│       │   │   ├── transcribeComplete.ts# EventBridge consumer
│       │   │   ├── understand.ts        # SQS consumer
│       │   │   └── dailyDigest.ts       # Scheduler target
│       │   └── middleware/
│       │       ├── withAuth.ts          # pulls userId from JWT claims
│       │       └── withErrors.ts        # maps thrown errors to responses
│       └── package.json
│
├── packages/
│   └── core/                     # pure domain logic, zero AWS SDK imports at top level
│       ├── src/
│       │   ├── schemas.ts        # zod schemas, single source of truth for types
│       │   ├── types.ts          # inferred from schemas
│       │   ├── keys.ts           # DynamoDB key builders, tested
│       │   ├── prompts/
│       │   │   ├── extraction.ts
│       │   │   └── recall.ts
│       │   ├── inference/
│       │   │   ├── provider.ts   # LlmProvider interface
│       │   │   ├── bedrock.ts    # default
│       │   │   └── openai.ts     # fallback, key from Secrets Manager
│       │   ├── vector.ts         # cosine, topK
│       │   └── dates.ts          # "before Friday" -> ISO, Africa/Accra
│       └── src/**/*.test.ts
│
├── infra/
│   ├── bin/app.ts
│   ├── lib/
│   │   ├── data-stack.ts         # DynamoDB, S3
│   │   ├── api-stack.ts          # Cognito, HTTP API, CRUD Lambdas
│   │   ├── pipeline-stack.ts     # SQS, processing Lambdas, EventBridge
│   │   └── notify-stack.ts       # SES identity, Scheduler, digest Lambda
│   └── cdk.json
│
├── docs/
│   ├── architecture.md
│   ├── architecture.png          # for the submission article
│   └── decisions/                # one file per non-obvious choice
│
└── tasks/
    ├── todo.md                   # the live plan, checkable items
    └── lessons.md                # corrections captured, never deleted
```

Rule: `packages/core` must be importable in a plain unit test with no AWS credentials present. All AWS SDK usage lives in `services/api/src/handlers` or in thin adapters injected into core functions. This is what makes the domain logic testable in seconds instead of requiring a deploy.

---

## 5. Coding Standards

### TypeScript
- `strict: true`. No `any`. If you truly need an escape hatch, use `unknown` and narrow it.
- No default exports except Next.js pages and layouts, which require them.
- Zod schemas in `packages/core/src/schemas.ts` are the single source of truth. Derive TypeScript types with `z.infer`. Never hand-write a type that duplicates a schema.
- Every API boundary parses its input with zod. Parsing at the edge means the interior of a handler can trust its data.

### Functions and files
- A handler file exports one handler. Business logic lives in core and is called by the handler.
- Files over 200 lines are a signal to split, not a rule to obey blindly.
- Name things after what they do in the domain: `extractItemsFromText`, not `processData`.

### Errors
- Throw typed errors from `packages/core/src/errors.ts` (`NotFoundError`, `ValidationError`, `ForbiddenError`, `UpstreamError`). `withErrors` maps them to status codes. Never return a bare 500 with a stack trace.
- Never swallow an error. If you catch, either recover meaningfully or rethrow with added context.

### Logging
- `console.log(JSON.stringify({ level, msg, requestId, userId, captureId, ...fields }))`. Structured JSON only, so CloudWatch Logs Insights can query it.
- **Never log capture content, extracted text, or transcripts.** Log IDs, byte counts, durations, and model names. This is personal data.

### Testing
- Unit tests are mandatory for: `keys.ts`, `dates.ts`, `vector.ts`, and the extraction response parser. These are where silent correctness bugs live.
- Do not write tests that mock the entire AWS SDK to assert a call happened. Those tests pass forever and catch nothing.
- Integration verification is manual and evidence-based: run a real capture of each type end to end and screenshot it. Those screenshots are also your submission evidence.

### Formatting
- Prettier and ESLint, default configs, no bikeshedding. `pnpm lint` must pass before commit.

---

## 6. AWS Development Guidelines

1. **Everything through CDK.** If you click it in the console, you have introduced an undeployable environment. The one exception is Bedrock model access approval and SES identity verification, which are account-level and must be documented in README instead.
2. **One IAM role per Lambda, scoped to exactly what it needs.** `understandFn` gets `bedrock:InvokeModel` on two specific model ARNs and `dynamodb:PutItem` on one table. It does not get `dynamodb:*`. Wildcards in a policy are a code review failure.
3. **Environment configuration via Lambda environment variables**, populated by CDK from stack outputs. No hardcoded ARNs, bucket names, or table names anywhere in `src/`.
4. **Secrets in Secrets Manager**, retrieved once per cold start and cached in a module-level variable. The only secret in this project is the OpenAI key if you enable that provider.
5. **Lambda sizing:** CRUD handlers 512 MB, `understandFn` 1024 MB, `recallFn` 1024 MB. Timeouts: CRUD 10s, pipeline 60s, recall 60s. Do not set a 15 minute timeout on anything; a hung Lambda should die fast.
6. **Idempotency:** `understandFn` must be safe to run twice on the same capture. SQS Standard delivers at least once. Use a conditional write on `status` so the second invocation is a no-op.
7. **DLQ on every queue and every async Lambda.** A failed capture must be recoverable, not lost.
8. **Cost discipline.** Free tier relevant limits, as of build time: Lambda 1M requests and 400,000 GB-seconds per month, always free. S3 5 GB standard storage, 12 months. DynamoDB 25 GB storage, always free (on-demand read/write are billed but negligible at personal volume). Transcribe 60 audio minutes per month, 12 months. Textract 1,000 pages per month, 3 months. **Bedrock has no free tier and is billed per token**, which is what the $200 new-account credits are for. Nova Lite keeps extraction cost in the fractions of a cent per capture.
9. Tag every resource `Project=ContextKeeper` so Cost Explorer can break out spend.

---

## 7. Database Design Principles

Single DynamoDB table, `ContextKeeperTable`, on-demand billing, point-in-time recovery on.

### Primary keys

| Entity | PK | SK |
|---|---|---|
| Capture | `USER#<userId>` | `CAPTURE#<createdAt>#<captureId>` |
| Item | `USER#<userId>` | `ITEM#<itemId>` |
| Person rollup | `USER#<userId>` | `PERSON#<normalizedName>` |

Capture SK leads with `createdAt` (ISO 8601) so `listCaptures` is a single reverse-order query with no sorting in the application.

### Global secondary indexes

**GSI1, "items by type and due date"**
- `GSI1PK = USER#<userId>#TYPE#<type>` (TASK, IDEA, NOTE, FOLLOW_UP, PROJECT)
- `GSI1SK = <status>#<dueDate or 9999-12-31>#<itemId>`
- Serves: open tasks sorted by deadline, the daily digest query, the inbox tabs.

**GSI2, "items by person"**
- `GSI2PK = USER#<userId>#PERSON#<normalizedName>`
- `GSI2SK = <createdAt>`
- Serves: "what tasks are waiting on someone else." Sparse index; only items with a person get these attributes.

Normalize person names with `toLowerCase().trim().replace(/\s+/g, ' ')`. Store the original casing in a separate `personDisplay` attribute.

### Rules

- **The partition key always starts with the userId from the JWT.** Not from the request body, not from a query parameter. This single rule is the entire tenant isolation model, and it must never be violated.
- Access patterns are decided before the schema. If you need a new query, add it to `docs/decisions/` with the index it requires. Never add a `Scan`.
- Embeddings live on the capture item as a `number[]` attribute. At 512 dimensions this is roughly 4 KB per capture, well inside the 400 KB item limit.
- `rawText` over 300 KB gets stored in S3 and referenced by key instead of inlined. Guard this explicitly; a long PDF will otherwise blow the item size limit at 2 AM.
- Every item carries `createdAt`, `updatedAt`, `sourceCaptureId`, and `schemaVersion`.

---

## 8. API Conventions

Base: `https://<api-id>.execute-api.us-east-1.amazonaws.com`

| Method | Path | Purpose |
|---|---|---|
| POST | `/captures/upload-url` | Returns presigned S3 PUT URL and `captureId` |
| POST | `/captures` | Creates a text capture, or finalizes a file capture |
| GET | `/captures` | List, reverse chronological, cursor paginated |
| GET | `/captures/{id}` | Single capture, includes status and rawText |
| GET | `/items` | Filter by `type`, `status`, `person`, `dueBefore` |
| PATCH | `/items/{id}` | Edit title, dueDate, status, priority |
| DELETE | `/items/{id}` | Hard delete |
| POST | `/recall` | `{ question }` returns `{ answer, citations[] }` |

### Conventions
- JSON only. `Content-Type: application/json` on request and response.
- Success bodies return the resource directly. Lists return `{ items: [...], nextCursor: string | null }`.
- Errors return `{ error: { code: "VALIDATION_ERROR", message: "human readable" } }` with the matching status. `code` is a stable machine string; `message` is for humans and may change.
- Auth: `Authorization: Bearer <cognito-id-token>` on every route. The API Gateway JWT authorizer rejects before Lambda is invoked, so no unauthenticated request ever costs money.
- No API versioning in the MVP. It is a single-user app with a single client that deploys together.
- Timestamps are ISO 8601 UTC strings. Dates without times (`dueDate`) are `YYYY-MM-DD`. The user's timezone is Africa/Accra and lives in one constant in `packages/core/src/dates.ts`.

---

## 9. Security Practices

- **userId comes from `event.requestContext.authorizer.jwt.claims.sub` and nowhere else.** `withAuth` extracts it. A handler that reads a userId from the body is a bug regardless of what else it does.
- S3 bucket: Block Public Access on all four settings, SSE-S3 encryption, no bucket policy granting public read, presigned URLs expiring in 300 seconds.
- Presigned uploads are constrained by `ContentLength` range and key prefix `raw/<userId>/`. Validate the content type server-side against an allowlist: `text/plain`, `image/png`, `image/jpeg`, `application/pdf`, `audio/mpeg`, `audio/mp4`, `audio/wav`, `audio/webm`. Max 25 MB.
- S3 lifecycle rule: transition raw objects to Intelligent-Tiering after 30 days. Do not auto-delete; principle 2 says the original is permanent.
- DynamoDB writes that modify an existing item use a condition expression asserting the PK matches the caller's userId.
- Cognito: email verification required, password minimum 12 characters, advanced security in audit mode.
- Prompt injection: captured content is untrusted input to the model. Wrap it in explicit delimiters in the prompt and instruct the model to treat the delimited block as data. The extraction model has no tools and no write access; the worst case is a malformed item, which the user can delete.
- CloudWatch log retention 30 days, not indefinite.
- API Gateway throttling at 20 requests per second burst, 10 steady. This is a single-user app; that ceiling is a runaway-cost circuit breaker.
- `.env` is gitignored. `.env.example` documents every variable with a fake value.

---

## 10. Development Workflow

### Session start
1. Read `CLAUDE.md`.
2. Read `tasks/lessons.md`.
3. Read `tasks/todo.md` for current state.

### Working
1. **Plan first.** For anything with 3 or more steps or any architectural choice, write the plan to `tasks/todo.md` as checkable items and confirm it before implementing.
2. **Simplicity first.** The smallest change that fully solves the problem. Touch only what is necessary.
3. **Root causes only.** No temporary patches, no commented-out code, no `// TODO: fix properly`. If a fix feels hacky, stop and implement the elegant version.
4. **Elegance check on non-trivial changes.** Before presenting work, ask whether there is a simpler shape. Skip this for one-line fixes; do not over-engineer trivial things.
5. **Re-plan on surprises.** If reality diverges from the plan, stop and re-plan. Do not push through.
6. **Verify before claiming done.** Run the typecheck, run the tests, deploy, exercise the actual path, and show the evidence. "Would a staff engineer approve this" is the bar.
7. **Capture lessons.** After any correction, append the pattern and the preventing rule to `tasks/lessons.md`.
8. **Review.** Add a short outcome summary to `tasks/todo.md` when a milestone closes.

### Commits
Conventional commits: `feat(api): add recall endpoint`. Small and atomic. The commit that changes behavior also changes the docs describing that behavior.

### Deploy
```bash
pnpm typecheck && pnpm test && pnpm -C infra cdk deploy --all
```
Frontend deploys on push to `main` via Amplify's Git integration.

---

## 11. MVP Scope

The submission window closes **August 3, 2026 at 1:00 PM PT**. Scope accordingly.

### In scope (must ship)
- Cognito auth, one user account
- Text capture, typed directly
- Image capture, screenshots and photos, via Textract sync
- Single-page PDF capture via Textract sync
- Audio capture via Transcribe async
- Bedrock extraction into TASK, IDEA, NOTE, FOLLOW_UP, with person, dueDate, project, priority
- Inbox view grouped by type, with edit, complete, and delete
- Smart Recall with citations back to source captures
- Daily SES digest at 07:00 Africa/Accra covering items due within 3 days and follow-ups untouched for 7 days
- Deployed and reachable at a public Amplify URL
- Architecture diagram in `docs/`

### Explicitly out of scope this weekend
- Multi-page PDFs (Textract async adds a second completion path; ship sync-only and say so)
- Browser extension, mobile app, email forwarding ingestion
- Sharing, teams, collaboration of any kind
- Calendar or task-manager integrations
- Editing the raw transcript
- Search-as-you-type; Recall is the search
- Dark mode, animations, and any styling work beyond clean and legible

### Definition of done for the submission
- [ ] Deployed URL loads and is usable by someone who is not you
- [ ] One end-to-end screenshot per capture type: text, image, PDF, audio
- [ ] One screenshot of a Recall answer with citations
- [ ] One screenshot of a received digest email
- [ ] Public GitHub repo with a README that lets a stranger deploy it
- [ ] Article of 500+ words covering: Vision and What the App Does, How You Built It, AWS Services Used and Architecture Overview, What You Learned, Link to App or Repo
- [ ] Article title contains `Weekend Challenge: Turn One Annoying Task Into an App: ContextKeeper AI`
- [ ] Tags `apps` and `productivity` both applied

### Build order, in strict dependency order
1. CDK data stack: table and bucket. Deploy. Confirm in console.
2. Cognito plus HTTP API plus one `GET /health` behind the authorizer. Deploy. Confirm a 401 without a token and a 200 with one.
3. Text capture end to end: `POST /captures` -> SQS -> `understandFn` -> Bedrock -> items in DynamoDB. **This is the spine. Nothing else matters until this works.**
4. Next.js capture screen and inbox against the real API.
5. Image and PDF via presigned upload plus Textract.
6. Audio via Transcribe plus the EventBridge completion path.
7. Recall.
8. Digest.
9. Polish, screenshots, article.

If time runs out, cut from step 8 backward. A submission with steps 1 through 5 working cleanly beats one with all eight half-working, because the Relevance and Functionality gate asks whether the task is handled end to end, not whether you shipped many features.

---

## 12. Future Improvements

Post-submission, in rough priority order:

1. **Multi-page PDF** via Textract async with SNS completion into the ingest queue.
2. **Vector store migration** behind the existing `VectorStore` interface once the corpus passes ~5,000 items. S3 Vectors first, OpenSearch Serverless if that is insufficient.
3. **WhatsApp capture.** Given the target user, WhatsApp is where the thoughts actually happen. Twilio or Meta Cloud API webhook into API Gateway, straight into the same ingest queue. This is the single highest-value addition.
4. **Recurring commitment detection.** "I always tell people I will follow up and never do." Surface the pattern.
5. **Weekly review email**, distinct from the daily digest: what you committed to, what you closed, what went stale.
6. **Step Functions** replacing the queue-and-Lambda chain once the pipeline grows a third branch. Not before.
7. **Offline capture** with an IndexedDB queue that flushes on reconnect. Matters on Ghanaian mobile networks.
8. **Confidence scores** on extracted items, with low-confidence items flagged for review rather than silently added.
9. **Multi-user hardening**: per-user rate limits, usage quotas, cost attribution.
