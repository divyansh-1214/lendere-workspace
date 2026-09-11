`GET /api/leads` requires an authenticated `lender_admin` session and derives the lender from `currentUser.lenderId`; caller-supplied lender IDs are ignored. It supports `page` and `pageSize`; `pageSize` defaults to 10 and is capped at 100.
Lead matching uses inclusive age bounds, an income minimum, a credit score greater than `minExclusive` and at or below `maxInclusive`, and employment types from the lender configuration. The response returns the current page in `data`, the number of returned records in `count`, the full match count in `totalCount`, the resolved `filters`, and `pagination: { page, pageSize, totalPages }`.
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Lendere Workspace Project Context

Last updated: 2026-09-11
git_id: 95e4d547336a8a816d310fb94d863b570d428ba0

## Project Overview

- This is a Next.js 16.3.4 App Router application using React 19.2.8, TypeScript 5, Tailwind CSS 4, MongoDB 7, Mongoose 9.9.5, Axios, and `neat-csv`.
- The product is a lender operations workspace with authentication, lender CSV import, borrower CSV import, lender eligibility matching, and a paginated leads review screen.
- MongoDB is the only persistence layer. Mongoose models are cached through `lib/db.ts`.
- Keep changes focused on the existing App Router, `features/`, and `lib/` boundaries. Do not introduce a second persistence layer or duplicate route for an existing feature.
- The current committed app has no automated test suite; use `npm run lint` and `npm run build` for validation.

## Architecture

- `app/` contains routes and client pages. API route handlers validate HTTP input, connect to MongoDB, call feature modules/models, and return JSON.
- `features/` contains domain models and CSV import transformations. Keep mapping and validation logic out of route handlers where practical.
- `lib/auth.ts` contains password hashing, session creation/lookup, cookie handling, role checks, and public user shaping.
- Authentication uses a random session token stored as an `httpOnly` cookie (`lendere_session`); MongoDB stores only its SHA-256 hash in `Session`.
- Users reference lenders with `User.lenderId: ObjectId`; lender records have a separate unique business identifier `Lender.lenderId: string`.
- The leads page loads `/api/auth/session`, fetches lender configuration from `/api/leander`, then calls `/api/leads` one page at a time. API routes derive lender ownership from the authenticated session rather than trusting query-string lender IDs.

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

## Lead Filtering And Pagination

- `GET /api/leads` authenticates the request, requires the `lender_admin` role, loads `currentUser.lenderId` with `Lender.findById`, constructs a MongoDB filter from that lender's eligibility, and runs `countDocuments` plus a sorted, bounded query. It sorts newest `metadata.createdAt` first and uses `_id` as a deterministic tie-breaker.
- `page` and `pageSize` are validated as positive integers. Invalid values, reversed lender age bounds, and invalid lender credit bounds return a 400 response. If the session has no lender ID or the lender cannot be found, the current implementation falls back to default matching values; authorization is still required.
- `pageSize` is capped at 100 to prevent an unbounded response. Client screens should request a page rather than fetching all matching leads.
- The leads UI currently requests 10 records per page and displays borrower name, source document ID, phone, age, employment, income, credit score, and first-address location.
- The route uses the authenticated lender's eligibility directly. Do not add direct `id`, `ageMin`, `ageMax`, income, credit, or employment query aliases without changing both the route and the client deliberately.

## Lender Eligibility Configuration

- Lender records use the `Lender` Mongoose model and require a unique `lenderId`, name, active status, priority, flow, eligibility rules, and timestamp fields. The current model does not define a separate `code` field.
- Eligibility includes minimum and maximum age, minimum annual income, credit-score bounds, and supported employment types (`salaried`, `self_employed`, `business`, `professional`).
- Preserve lender configuration groups (`eligibility`, `geography`, `leadLimits`, `preflight`, `application`, and `offer`) when adding lender operations.
- `GET /api/leander` requires an authenticated `ops_admin`, reads the lender ID from `currentUser.lenderId`, and looks up the lender by MongoDB `_id`; query-string lender IDs are not used by the current route.
- The lender response shape is `{ success: true, data: lender }`. The leads page consumes `data.eligibility` only for matching; do not discard the remaining lender configuration.
- `POST /api/leander` requires an authenticated `ops_admin`, accepts a CSV file in the `file` form field, validates lender rows, and returns imported rows plus source-row errors. Lender CSV list values may be separated with `|` or `;`; employment types are additionally split on `+`.

## Authentication and Authorization

- Define `MONGODB_URI` in `.env.local`, for example `mongodb://127.0.0.1:27017/lendere`.
- Protected routes call `getAuthenticatedUser(request)` from `lib/auth.ts` and enforce roles with `requireRole`. Current route behavior: `/api/leads` GET is `lender_admin`-only, `/api/leads` POST is `ops_admin`-only, `/api/leander` GET and POST are `ops_admin`-only, and `/api/users` GET and POST are `ops_admin`-only.
- `/api/users` `GET` and `POST` are restricted to authenticated `ops_admin` users.
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
- The lender lookup route still contains temporary console logging; do not add logging of uploaded files, passwords, tokens, or complete personal data, and remove the debug logging when touching that path.
- Run `npm run lint` after edits. Run `npm run build` for route, type, and production compilation checks; a larger Node heap may be required during Next.js page-data collection on constrained Windows environments.
