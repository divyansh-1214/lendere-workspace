# Lendere authentication API

## Configuration

Create `.env.local`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/lendere
```

Sessions use an `httpOnly`, `secure` cookie named `lendere_session`. The cookie lasts seven days and is invalidated on logout, password reset, expiry, or when the account is disabled.

## Authentication endpoints

- `POST /api/auth/login` with `{ "email", "password" }` creates a session cookie.
- `POST /api/auth/logout` revokes the current session.
- `GET /api/auth/session` returns the current user or `401`.
- `POST /api/auth/forgot-password` with `{ "email" }` creates a one-hour reset token. In development it is returned as `resetToken`; production should deliver it through an email provider.
- `POST /api/auth/reset-password` with `{ "token", "password" }` consumes the reset token, hashes the password, and revokes existing sessions.

Passwords are hashed with Node `scrypt`; raw passwords and session tokens are never stored in MongoDB.

## Authorization

`/api/users` is protected and only an authenticated `ops_admin` can list or create users. New users require `name`, `email`, `password`, and one of `ops_admin`, `lender_admin`, or `lender_agent`.

For other route handlers, call `getAuthenticatedUser(request)` from `lib/auth.ts`, then use `requireRole(user, ["ops_admin"])` (or the required roles). Always reject a missing user with `401` and an authenticated user without the required role with `403`.

## Development

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
