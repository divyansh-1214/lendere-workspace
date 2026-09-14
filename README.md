# Lendere authentication API

# Lendere workspace

Lendere is a Next.js App Router workspace for importing borrower and lender data, matching leads against lender eligibility, assigning leads to lender agents, and working an assigned case through questions and outcomes. MongoDB is the only persistence layer.

## Run locally from a clean checkout

Prerequisites: Node.js 20+, a reachable MongoDB 7 instance, and npm.

```bash
git clone <repository-url>
cd lendere-workspace
npm install
```

Create `.env.local` in the project root:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/lendere
```

Seed a repeatable local dataset:

```bash
node scripts/seed.mjs
```

The seed upserts one demo lender, two eligible leads, and three active users:

| Role | Email |
| --- | --- |
| Operations admin | `ops@example.test` |
| Lender admin | `admin@demo-lender.test` |
| Lender agent | `agent@demo-lender.test` |

The default development password is `ChangeMe123!`. Set `SEED_PASSWORD` before running the seed to choose another local password. Do not use these credentials outside local development.

Start the application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Useful checks are `npm run lint` and `npm run build`.

## Data model

- `Lender` stores the lender business identifier, active state, routing flow, eligibility rules, geography, lead limits, preflight, application, and offer configuration.
- `User` stores a role (`ops_admin`, `lender_admin`, or `lender_agent`), status, and an optional MongoDB `lenderId`. Passwords are stored as salted Node `scrypt` hashes.
- `Leads` stores the borrower record as nested `personal`, `contact`, `addresses`, `employment`, `credit`, `loan`, `identification`, `application`, `attribution`, and `metadata` groups. This preserves the imported CSV shape and keeps filtering fields addressable in MongoDB.
- `Case` is the lender-specific assignment join between a lead and an agent. It stores assignment ownership, status, timestamps, current workflow node, and final outcome.
- `CaseNode` stores the question/outcome tree for a case; `CaseEvent` records assignment and workflow activity.

The assignment is a separate `Case` rather than a lender field on `Leads` because the same imported lead can be eligible for multiple lenders, while each lender must have at most one active assignment for that lead. `Case` has a unique compound index on `{ lenderId, leadId }`.

## Where lender isolation is enforced

The decision is made in the API request path, after authentication and before the database query:

1. `getAuthenticatedUser(request)` in `lib/auth.ts` resolves the bearer token or `httpOnly` `lendere_session` cookie to an active user.
2. `GET /api/leads` reads `currentUser.lenderId`; it does not accept a caller-supplied lender ID. It loads that lender's eligibility and applies it to the lead query.
3. `GET /api/cases` uses the session identity directly: an agent query is `Case.find({ agentId: currentUser._id })`; a lender admin query uses `currentUser.lenderId` when reading assignments and eligible free leads.
4. `POST /api/cases` checks the target agent with `{ _id: agentId, lenderId: currentUser.lenderId, role: "lender_agent" }`, checks the lead against that lender's eligibility, and writes the same session-derived lender ID to the case.
5. `GET` and `POST /api/cases/node` require a lender agent and scope every case/node lookup to `agentId: currentUser._id`.

This is deliberately server-side. UI filters and query-string lender IDs are not authorization boundaries.

## What an authenticated user could try

- A lender admin could change `lenderId` in a URL or request body. Lead listing ignores caller-supplied lender IDs; assignment uses the authenticated lender ID, and the target agent must belong to that lender.
- A lender agent could replace a `caseId`, `nodeId`, `leadId`, or `agentId` with another user's ID. Case and node reads/writes require the current user's ID, and assignment is lender-admin-only.
- A lender agent could call admin or operations endpoints directly. Each route checks both authentication and role with `requireRole`; the request is rejected before its database operation.
- A user with an expired, revoked, or disabled session could replay its cookie or bearer token. Session lookup requires an unexpired hash match, and the user must still be active. Logout, reset, expiry, and disabling prevent continued access.
- A caller could submit malformed filters or an oversized page size. Query validation rejects invalid ranges and caps `pageSize` at 100.

The API should still be deployed behind HTTPS, with production secrets kept out of source control. Rate limiting, audit review, and automated authorization tests are future hardening work.

## Concurrent assignment behavior

If two lender admins try to assign the same lead at the same time, both may pass the initial `Case.exists` check, but only one insert can win because `Case` has a unique `{ lenderId, leadId }` index. The losing request receives HTTP `409` with `Lead is already assigned`. The database constraint, rather than the pre-check, is the final concurrency authority.

Once assigned, two agents cannot normally act on the same case because only the assigned agent can read or mutate it. Case-node creation and answer/outcome updates run inside a MongoDB transaction, re-check the case owner and closed status, and write the related event records together. The current answer update is last-write-wins if the same agent submits two answers concurrently; optimistic version checks would be the next improvement if that matters to the workflow.

## What I would do with more time

- Add integration tests for cross-lender IDOR attempts, role boundaries, expired sessions, duplicate assignment races, and concurrent case updates.
- Move seed data to a typed script that imports the application schemas, add a package script, and support a safe reset option for disposable local databases.
- Add explicit ownership fields or a shared authorization helper so every route expresses tenant scope consistently and is easier to audit.
- Add optimistic concurrency/version checks for case nodes and answers, plus idempotency keys for assignment requests.
- Add rate limiting, structured audit logs without personal data, email delivery for password resets, and production secret/configuration checks.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
