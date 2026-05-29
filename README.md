# Jesean Rentals

Business management app for **printer rentals**, **repairs**, **sales** (inks & supplies), and **CCTV installations** — with separate payments per transaction, partial payment support, client CSV import, printer audit logs, and a **client portal**.

## Stack

- Next.js 15 (App Router)
- Prisma + SQLite (local)
- NextAuth (credentials) — admin + client roles
- Tailwind CSS 4

## Quick start

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Default admin** (from `.env`):

- Email: `admin@jeseanrentals.local`
- Password: `changeme123`

Change these before production.

## Features

| Area | Details |
|------|---------|
| **Rentals** | Quarterly/monthly/annual billing; partial payments until contract total is met |
| **Repairs** | Linked to printers; partial payments |
| **Sales** | Inks & supplies; walk-in or client-linked |
| **CCTV** | Installations with partial payments |
| **Payments** | Each transaction has its own payment records |
| **Printers** | Rental + repair history; audit log |
| **Clients** | CSV import (only **name** required); optional portal login |
| **Portal** | Clients see rentals, balances, and payment history |

## CSV import

Upload a CSV on **Dashboard → Clients**. Supported headers (flexible):

- `name` or `client_name` (required)
- `email`, `phone`, `address`, `company`, `notes` (optional)

## Client portal

1. Open a client in the dashboard
2. Use **Create portal access** with email + password
3. Share credentials; client signs in at `/login` and lands on `/portal`

## Deploy to Vercel

SQLite file storage does **not** persist on serverless. For production:

1. Create a [Turso](https://turso.tech) database (LibSQL)
2. In `prisma/schema.prisma`, switch provider when ready:

   ```prisma
   datasource db {
     provider = "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

   Turso uses the same SQLite dialect; set:

   ```env
   DATABASE_URL="libsql://your-db.turso.io?authToken=..."
   ```

3. Set Vercel env vars: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`
4. Run migrations on deploy: add build script `prisma db push` or use Turso CLI

Alternatively use **Prisma Postgres** or **Neon** and change `provider` to `postgresql`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run db:push` | Sync schema to SQLite |
| `npm run db:seed` | Create admin user |
| `npm run db:studio` | Prisma Studio |

## Project structure

```
src/
  app/
    dashboard/   # Admin UI
    portal/      # Client UI
    login/
  actions/       # Server actions
  components/
  lib/           # Auth, Prisma, payments helpers
prisma/
  schema.prisma
```
