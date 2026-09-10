<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Lendere Workspace Project Context

Last updated: 2026-09-10

## Project Overview

- This is a Next.js 16 App Router application using React 19, TypeScript, Tailwind CSS 4, MongoDB, and Mongoose.
- The product is a lender operations workspace. The current primary workflow is importing borrower leads from CSV files.
- Keep changes focused on the existing feature structure. Do not introduce a second persistence layer or duplicate route for an existing feature.

## Important Locations

- `app/page.tsx`: client-side lead CSV import workspace and upload interaction.
- `app/globals.css`: global visual system and responsive styling for the workspace.
- `app/api/leads/route.ts`: lead CSV upload endpoint.
- `features/leads/lead.model.ts`: Mongoose lead schema and indexes.
- `features/leads/lead-import.ts`: CSV header normalization, validation, type conversion, and mapping into the lead model shape.
- `lib/db.ts`: cached Mongoose connection using `MONGODB_URI`.
- `lib/auth.ts`: session lookup, password hashing, user authorization, and public user helpers.
- `app/api/auth/**`: login, logout, session, forgot-password, and reset-password endpoints.
- `app/api/users/route.ts`: authenticated user administration endpoint.

## Lead CSV Import Contract

- Uploads use `POST /api/leads` with a multipart `FormData` field named `file`.
- Only `.csv` files are accepted. The endpoint parses rows with `neat-csv`, validates each row, and persists valid rows with `Leads.create()`.
- Required fields are first name, last name, and phone. Header aliases such as `firstName`/`first_name`, `phone`/`mobile`, and `address1`/`address_line_1` are supported.
- `address1` and `address2` map to one item in the model's `addresses` array as `addressLine1` and `addressLine2`.
- Invalid rows should return their source CSV row number and an actionable message. Do not silently discard malformed data.
- Preserve the nested lead model shape (`personal`, `contact`, `addresses`, `employment`, `credit`, `loan`, `identification`, `application`, `attribution`, and `metadata`).

## Authentication and Authorization

- Define `MONGODB_URI` in `.env.local`, for example `mongodb://127.0.0.1:27017/lendere`.
- Protected routes should call `getAuthenticatedUser(request)` from `lib/auth.ts` and enforce roles with `requireRole`.
- `/api/users` is restricted to authenticated `ops_admin` users.
- Preserve `httpOnly` session cookies and never log or persist raw passwords or session tokens.

## Development Commands

```bash
npm run dev
npm run lint
npm run build
```

- Run `npm run lint` for changed files when possible, then run `npm run build` for route, type, and production compilation checks.
- If port `3000` is already occupied, use the existing server or start Next.js on another port rather than killing an unrelated process.

## Implementation Conventions

- Prefer existing App Router, Mongoose, and auth helpers over new abstractions.
- Keep route handlers responsible for HTTP concerns and feature modules responsible for mapping and domain logic.
- Preserve the existing visual direction of the import workspace: warm paper background, dark ink text, coral action color, editorial serif headings, and responsive layouts.
- Avoid logging complete uploaded files or imported personal data in production code.
