`GET /api/leads` requires an authenticated `lender_admin` or `ops_admin` session and derives the lender from `currentUser.lenderId`; caller-supplied lender IDs are ignored. It supports `page` and `pageSize`; `pageSize` defaults to 10 and is capped at 100.
Lead matching uses lender eligibility rules (age, income, credit score, employment types) combined with optional user-supplied filters. Advanced filters include age range, income range, credit score range, employment type(s), location (state, city, pincode), loan amount range, and loan purpose. Search queries match against `_doc_id`, phone, first name, and last name. Sorting options are `newest` (default), `oldest`, `highestCreditScore`, and `highestIncome`. The response returns the current page in `data`, the number of returned records in `count`, the full match count in `totalCount`, and `pagination: { page, pageSize, totalPages }`.
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Lendere Workspace Project Context

Last updated: 2026-09-14
git_id: 4374b88aaa120f4a57265f288a3cdf253542c3d4

## Project Overview

- This is a Next.js 16.3.4 App Router application using React 19.2.8, TypeScript 5, Tailwind CSS 4, MongoDB 7, Mongoose 9.9.5, Axios, and `neat-csv`.
- The product is a lender operations workspace with authentication, lender CSV import, borrower CSV import, lender eligibility matching, and a paginated leads review screen.
- The workspace also includes a role-aware user creation page and lender-agent listing endpoint.
- The workspace includes lender-agent lead assignment and an assigned-case workflow with question, answer, and outcome nodes.
- MongoDB is the only persistence layer. Mongoose models are cached through `lib/db.ts`.
- Keep changes focused on the existing App Router, `features/`, and `lib/` boundaries. Do not introduce a second persistence layer or duplicate route for an existing feature.
- The current committed app has no automated test suite; use `npm run lint` and `npm run build` for validation.

## Architecture

- `app/` contains routes and client pages. API route handlers validate HTTP input, connect to MongoDB, call feature modules/models, and return JSON.
- `features/` contains domain models and CSV import transformations. Keep mapping and validation logic out of route handlers where practical.
- `lib/auth.ts` contains password hashing, session creation/lookup, cookie handling, role checks, and public user shaping.
- Authentication uses a random session token stored as an `httpOnly` cookie (`lendere_session`) or passed in the `Authorization: Bearer <token>` header; MongoDB stores only its SHA-256 hash in `Session` with a TTL index for automatic expiration.
- Users reference lenders with `User.lenderId: ObjectId`; lender records have a separate unique business identifier `Lender.lenderId: string`.
- The leads page loads `/api/auth/session`, fetches lender configuration from `/api/leander`, then calls `/api/leads` one page at a time. API routes derive lender ownership from the authenticated session rather than trusting query-string lender IDs.
- User creation uses `/users/new` and `/api/users`; the page limits visible role choices based on the signed-in user's role and automatically uses a lender admin's lender ID for lender-agent accounts.
- Lender admins assign eligible leads to active agents through `/api/cases`; agents work assigned cases through `/assigned` and manage case nodes through `/api/cases/node`.

## Important Locations

- `app/page.tsx`: client-side lead CSV import workspace and upload interaction.
- `app/leads/page.tsx`: client-side matched borrower lead table, eligibility summary, loading/error states, and previous/next pagination.
- `app/globals.css`: global visual system and responsive styling for the workspace.
- `app/api/leads/route.ts`: authenticated lead CSV upload endpoint and paginated lead filtering endpoint.
- `app/api/leander/route.ts`: authenticated current-lender lookup endpoint and lender CSV upload endpoint at `POST /api/leander`.
- `features/leads/lead.model.ts`: Mongoose lead schema and indexes.
- `features/leads/lead-import.ts`: CSV header normalization, validation, type conversion, and mapping into the lead model shape.
- `features/leander/leander.model.ts`: lender configuration model with eligibility, routing-flow, geography, lead-limit, preflight, application, and offer settings.
- `features/users/user.register.ts`: typed user creation, password hashing, lender ID validation, and lender existence checks.
- `features/leander/leander-import.ts`: lender CSV header normalization, validation, type conversion, and mapping into the lender model shape.
- `lib/db.ts`: cached Mongoose connection using `MONGODB_URI`.
- `lib/auth.ts`: session lookup, password hashing, user authorization, and public user helpers.
- `app/api/auth/**`: login, logout, session, forgot-password, and reset-password endpoints.
- `app/api/users/route.ts`: user administration endpoint. Both `GET` and `POST` require an authenticated `ops_admin`; `GET` excludes `passwordHash`, and `POST` returns a public user shape after creating the account.
- `app/users/new/page.tsx`: authenticated role-aware form for creating workspace users.
- `app/api/users/agents/route.ts`: authenticated lender-agent listing endpoint scoped to the current lender admin's `lenderId`.
- `app/api/cases/route.ts`: authenticated case assignment endpoint and assigned/free lead listing.
- `app/api/cases/node/route.ts`: authenticated agent case-path endpoint for creating questions/outcomes and submitting answers.
- `app/assigned/page.tsx`: assigned-case workspace with search, status filtering, case details, and case-path editing.
- `features/case/case.model.ts`: case model linking leads, lenders, users, and workflow state with assignment timestamps.
- `features/case/case.types.ts`: shared assigned-case, assigned-lead, and case-status types used by the assigned workspace.
- `features/case/caseNode.model.ts`: case question/outcome node model with parent links, answer formats, and answers.
- `features/case/caseEvent.model.ts`: case activity event model for assignment, node, answer, and completion events.
- `app/api/route.ts`: root API handler; keep it separate from feature routes.

## Lead CSV Import Contract

- Uploads use `POST /api/leads` with a multipart `FormData` field named `file`; the endpoint requires an authenticated `ops_admin`.
- Only `.csv` files are accepted. The endpoint parses rows with `neat-csv`, validates each row, and persists valid rows with `Leads.create()`.
- Required fields are `_doc_id`, first name, last name, phone, DOB, credit score, and employment type. Header aliases such as `firstName`/`first_name`, `phone`/`mobile`, `creditScore`/`credit_score`, and `employmentType`/`employmentTypes` are supported. The importer also accepts `_doc_id` as a phone fallback, but a real `_doc_id` should always be supplied.
- `personal.age` is required and calculated from DOB using the current date; missing, invalid, or future DOB values return a row-level validation error.
- `credit.creditScore` and `employment.type` are required by the Mongoose schema and importer validation.
- `_doc_id` is a required top-level lead identifier and must be mapped from the CSV rather than replaced by the phone number.
- `address1` and `address2` map to one item in the model's `addresses` array as `addressLine1` and `addressLine2`.
- Lead employment values accepted by the schema are `salaried`, `self_employed`, `business`, `student`, `unemployed`, and `other`. Lender eligibility separately accepts `salaried`, `self_employed`, `business`, and `professional`; keep this difference in mind when matching imported data.
- Invalid rows should return their source CSV row number and an actionable message. Do not silently discard malformed data.
- Preserve the nested lead model shape (`personal`, `contact`, `addresses`, `employment`, `credit`, `loan`, `identification`, `application`, `attribution`, and `metadata`).

## Lead Assignment And Case Workflow

- `GET /api/cases` requires an authenticated `lender_admin` or `lender_agent`.
- A `lender_agent` receives only cases assigned to that agent, with the related lead populated. A `lender_admin` receives eligible, unassigned leads for the admin's lender, paginated with `page` and `pageSize` and capped at 100 per page.
- `POST /api/cases` is restricted to `lender_admin`. It requires valid `leadId` and `agentId` values, verifies that the agent is an active `lender_agent` belonging to the current lender, verifies the lead against lender eligibility, and prevents duplicate lender-lead assignments.
- Case assignments store the lead, lender, assigned agent, assigning lender admin, status, and assignment timestamp. Assignment status starts as `ASSIGNED`; the unique `{ lenderId, leadId }` index prevents duplicate assignments.
- `GET /api/cases/node` is restricted to `lender_agent`. It returns the agent's cases and case nodes, optionally filtered by a valid `caseId`; agents cannot read another agent's case.
- `POST /api/cases/node` is restricted to `lender_agent` and accepts `action: "create"` or `action: "answer"`. Agents can create `QUESTION` nodes with answer types `TEXT`, `NUMBER`, `BOOLEAN`, `SINGLE_SELECT`, or `MULTI_SELECT`, submit answers to question nodes, and create `OUTCOME` nodes.
- Creating the first node moves a case from `ASSIGNED` to `IN_PROGRESS`; an outcome changes the case to `COMPLETED`, `REJECTED`, or `CANCELLED`. Closed cases cannot be modified.
- Case events record node creation, answer submission, case start, outcome creation, and case completion. Preserve the `Case`, `CaseNode`, and `CaseEvent` model relationships when changing the workflow.

## Lead Filtering And Pagination

- `GET /api/leads` authenticates the request, requires the `lender_admin` or `ops_admin` role, loads `currentUser.lenderId` with `Lender.findById`, constructs a MongoDB filter from that lender's eligibility, and combines it with optional user-supplied filters. It sorts by the requested order (`newest`, `oldest`, `highestCreditScore`, or `highestIncome`; default `newest`) and uses `_id` as a deterministic tie-breaker.
- Query parameters: `page`, `pageSize`, `sort`, `ageMin`, `ageMax`, `incomeMin`, `incomeMax`, `creditMin`, `creditMax`, `employmentType` (comma-separated list), `search`, `state`, `city`, `pincode`, `loanAmountMin`, `loanAmountMax`, and `loanPurpose`. All parameters are optional.
- `search` performs case-insensitive regex matching against `_doc_id`, `contact.phone`, `personal.firstName`, and `personal.lastName`.
- Location filters (`state`, `city`, `pincode`) use `$elemMatch` to match against the `addresses` array.
- Validation returns 400 for invalid ranges (e.g., `ageMin > ageMax`, `creditMin >= creditMax`) or employment types outside lender eligibility.
- `pageSize` is capped at 100 to prevent an unbounded response. Client screens should request a page rather than fetching all matching leads.
- The leads UI requests 10 records per page and displays borrower name, source document ID, phone, age, employment, income, credit score, and first-address location.

## Lender Eligibility Configuration

- Lender records use the `Lender` Mongoose model and require a unique `lenderId`, name, active status, priority, flow, eligibility rules, and timestamp fields. The current model does not define a separate `code` field.
- Eligibility includes minimum and maximum age, minimum annual income, credit-score bounds, and supported employment types (`salaried`, `self_employed`, `business`, `professional`).
- Preserve lender configuration groups (`eligibility`, `geography`, `leadLimits`, `preflight`, `application`, and `offer`) when adding lender operations.
- `GET /api/leander` requires an authenticated `ops_admin`, reads the lender ID from `currentUser.lenderId`, and looks up the lender by MongoDB `_id`; query-string lender IDs are not used by the current route.
- The lender response shape is `{ success: true, data: lender }`. The leads page consumes `data.eligibility` only for matching; do not discard the remaining lender configuration.
- `POST /api/leander` requires an authenticated `ops_admin`, accepts a CSV file in the `file` form field, validates lender rows, and returns imported rows plus source-row errors. Lender CSV list values may be separated with `|` or `;`; employment types are additionally split on `+`.

## Authentication and Authorization

- Define `MONGODB_URI` in `.env.local`, for example `mongodb://127.0.0.1:27017/lendere`.
- Protected routes call `getAuthenticatedUser(request)` from `lib/auth.ts` and enforce roles with `requireRole`. `getAuthenticatedUser` checks the `Authorization: Bearer <token>` header first, then falls back to the `lendere_session` cookie. Current route behavior: `/api/leads` GET accepts `lender_admin` or `ops_admin`, `/api/leads` POST is `ops_admin`-only, `/api/leander` GET and POST are `ops_admin`-only, `/api/users` GET is `ops_admin`-only, `/api/users` POST accepts `ops_admin` or `lender_admin`, `/api/users/agents` GET is `lender_admin`-only, `/api/cases` GET accepts `lender_admin` or `lender_agent`, `/api/cases` POST is `lender_admin`-only, and `/api/cases/node` GET and POST are `lender_agent`-only.
- `/api/users` `GET` lists all users without `passwordHash`. `POST` creates an active user, requires `name`, `email`, `password`, and a valid role, and validates lender IDs for lender users. An `ops_admin` can create any supported role; a `lender_admin` cannot create another `lender_admin` through the route.
- `/api/users/agents` returns only `lender_agent` records whose `lenderId` matches the authenticated lender admin. Do not accept a caller-supplied lender ID for this listing.
- Preserve `httpOnly` session cookies and never log or persist raw passwords or session tokens.
- Login rejects missing credentials, disabled/inactive accounts, and invalid passwords; successful login creates a seven-day session.
- Logout deletes the current session and clears the cookie. Password reset tokens are stored hashed, expire after one hour, activate the account on reset, and revoke existing sessions.
- `/api/auth/session` returns a public user object including `id`, `name`, `email`, `role`, `lenderId`, and `status`; unauthenticated requests return 401. Do not expose `passwordHash`.

## Development Commands

```bash
npm run dev
npm run lint
npm run build
```

- Run `npm run lint`, then `npm run build` for route, type, and production compilation checks.
- If port `3000` is already occupied, use the existing server or start Next.js on another port rather than killing an unrelated process.

## Implementation Conventions

- Prefer existing App Router, Mongoose, and auth helpers over new abstractions.
- Keep route handlers responsible for HTTP concerns and feature modules responsible for mapping and domain logic.
- Use `Link` for internal navigation in Next.js pages and keep client-only code behind `"use client"`.
- Preserve the existing visual direction of the import workspace: warm paper background, dark ink text, coral action color, editorial serif headings, and responsive layouts.
- Avoid logging complete uploaded files or imported personal data in production code.
- `app/api/leander/routes.ts` is not part of the current tree; use `app/api/leander/route.ts` for the production App Router endpoint.
- The leads and lender lookup routes contain debug logging; do not add logging of uploaded files, passwords, tokens, or complete personal data, and remove existing debug logging when touching those paths.
- Run `npm run lint` after edits. Run `npm run build` for route, type, and production compilation checks; a larger Node heap may be required during Next.js page-data collection on constrained Windows environments.
