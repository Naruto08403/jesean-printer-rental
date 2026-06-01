# Jesean Rentals

Business management app for **printer rentals**, **repairs**, **sales** (inks & supplies), and **CCTV installations** — with separate payments per transaction, partial payment support, client CSV import, printer audit logs, and a **client portal**.

## Stack

- Next.js 15 (App Router)
- Prisma + PostgreSQL (Prisma Postgres / `PRISMA_DATABASE_URL`)
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
3. Set a **username** and password; client signs in at `/portal/login`

## Deploy to Vercel

Set these environment variables in the Vercel project:

- `PRISMA_DATABASE_URL` (or `POSTGRES_URL` — keep both in sync)
- `AUTH_SECRET`
- `NEXTAUTH_URL` (your production URL)

The build runs `prisma db push` to sync the schema to Postgres.

### Billing Excel export

Billing fills `templates/billing.xlsx` (your logo and layout) and downloads `.xlsx` — commit that file to git (`Data/` is gitignored).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run db:push` | Sync schema to Postgres |
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
