# Campus Kitchen

Multi-tenant food commerce platform. One NestJS API, four Next.js portals, MongoDB.

This is not a single food-ordering website. It is a campus workspace: every campus has its own branding, vendors, delivery zones, and admins. Adding a campus is configuration, not a rewrite.

## Apps

| App | Port | Who |
| --- | --- | --- |
| Customer web | 3000 | Students |
| Vendor portal | 3001 | Kitchens |
| Delivery portal | 3002 | Riders |
| Admin portal | 3003 | Campus admin + super admin |
| API | 4000 | `/api/v1` |

Admin and super-admin share one portal. Super-admin simply holds extra permissions.

## Quick start

```bash
cp .env.example .env          # then generate JWT and pepper secrets
pnpm install
pnpm run infra:up             # Mongo 27018, Redis 6380, Mailpit
pnpm run seed
pnpm run dev:api              # http://localhost:4000/api/v1
pnpm run dev:customer         # http://localhost:3000
pnpm run dev:vendor           # http://localhost:3001
pnpm run dev:delivery         # http://localhost:3002
pnpm run dev:admin            # http://localhost:3003
```

Demo password for every seeded account: `ChangeMe!2026`

| Account | Portal |
| --- | --- |
| `student@campuskitchen.in` | Customer |
| `vendor@campuskitchen.in` | Vendor |
| `delivery@campuskitchen.in` | Delivery |
| `admin@campuskitchen.in` | Admin |
| `owner@campuskitchen.in` | Admin 
(super) |

Campus slug: `iit-kharagpur`.

Mailpit (dev inbox): http://localhost:8025

Images are stored on **Amazon S3** (not MinIO), in folders such as `kitchen/` and `menus/`. Set `S3_*` in `.env`.

## Architecture

See [docs/architecture.md](docs/architecture.md), [docs/security.md](docs/security.md), [docs/notifications.md](docs/notifications.md), and [docs/runbook.md](docs/runbook.md).

## Stack

- **Monorepo:** pnpm + Turborepo
- **API:** NestJS, MongoDB (Mongoose), Redis, BullMQ, Socket.IO, Firebase Admin
- **Frontends:** Next.js 15 App Router, shared `@ck/ui` design system, typed `@ck/sdk`
- **Money:** integer paise, never floats
- **Auth:** Argon2id + pepper, JWT in httpOnly cookies, CSRF double-submit, permission guards (never role names)

## Phase 1 (this repo)

Authentication, vendors, customers, catalog, cart, checkout, orders, payments, delivery, wallet, coupons, reviews, notifications, admin RBAC, announcements, audit, CMS, feature flags.

Later phases (subscriptions, loyalty, group orders, white-label) are feature-flagged, not new codebases.
# cloud-kitchen
