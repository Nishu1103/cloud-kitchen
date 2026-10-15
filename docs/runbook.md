# Runbook

## Prerequisites

- Node 20.11+
- pnpm 9 (`packageManager` in root `package.json`)
- Docker, for local Mongo / Redis / Mailpit

## First boot

```bash
cp .env.example .env
# Set JWT_ACCESS_SECRET, PASSWORD_PEPPER, REDIS_PASSWORD.
# openssl rand -base64 48
# Refresh tokens are opaque (hashed in Mongo), not a second JWT secret.

pnpm install
pnpm run infra:up
pnpm run seed
```

Wait until `ck-mongo` is healthy before seeding. The replica set is required for transactions (orders, wallet, payments).

If Mongo was already running without a replica set, `pnpm run infra:reset` wipes volumes and starts clean.

## Processes

| Command | What |
| --- | --- |
| `pnpm run dev:api` | NestJS on :4000, watch mode |
| `pnpm run dev:customer` | Next.js :3000 |
| `pnpm run dev:vendor` | Next.js :3001 |
| `pnpm run dev:delivery` | Next.js :3002 |
| `pnpm run dev:admin` | Next.js :3003 |
| `pnpm run dev` | All of the above via Turbo |

API prefix: `http://localhost:4000/api/v1`.

## Seeded accounts

Password: `ChangeMe!2026` (override with `SEED_PASSWORD`).

- `owner@campuskitchen.in` — super admin (admin portal)
- `admin@campuskitchen.in` — campus admin (admin portal)
- `vendor@campuskitchen.in` / `vendor2@campuskitchen.in` — kitchens
- `delivery@campuskitchen.in` — rider
- `student@campuskitchen.in` — customer

Campus slug: `iit-kharagpur`. Send `x-campus-slug: iit-kharagpur` on anonymous catalog calls.

## Local infrastructure

| Service | Bind |
| --- | --- |
| MongoDB | `127.0.0.1:27018` (replica set `rs0`) |
| Redis | `127.0.0.1:6380` (password from `.env`) |
| Mailpit SMTP | `127.0.0.1:1025` (UI :8025) |

Production uses Atlas (TLS + SCRAM), managed Redis (TLS + AUTH), and Amazon S3. Do not expose these Docker ports beyond localhost.

## Payments

`PAYMENT_PROVIDER=mock` settles checkout without Razorpay. For live:

1. Set `PAYMENT_PROVIDER=razorpay` and the three Razorpay secrets.
2. Point the webhook at `POST /api/v1/webhooks/payments` (raw body, signature verified).
3. Never send the webhook secret to a frontend.

## Push (optional)

Leave Firebase empty in development. In-app + Socket.IO still work; the API logs a warning and skips FCM.

To enable:

1. Create a Firebase project, enable Cloud Messaging.
2. Put the **web** config in `NEXT_PUBLIC_FIREBASE_*` (public by design).
3. Put the **Admin SDK** service account in `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
4. Each portal serves `/firebase-messaging-sw.js` from its origin.

iOS push only works for an installed PWA. See [notifications.md](notifications.md).

## Amazon S3

Images never go through the API. The API mints a five-minute PUT URL; the browser uploads to the bucket.

Leave `S3_ENDPOINT` empty. Put IAM keys and the bucket name in `.env`. Public URLs look like:

`https://<bucket>.s3.<region>.amazonaws.com/kitchen/<campusId>/<vendorId>/<uuid>.jpg`

Folder map: `kitchen/` (logo, cover), `menus/` (dishes), `avatars/`, `reviews/`, `banners/`, `documents/` (private).

Bucket settings:

1. Object Ownership: Bucket owner enforced (ACLs off).
2. Block Public Access: allow public bucket policies; keep ACLs blocked.
3. Bucket policy `GetObject` on `kitchen/*`, `menus/*`, `avatars/*`, `reviews/*`, `banners/*` only. Do not grant `documents/*`.
4. CORS: allow PUT from the four portal origins, headers `Content-Type`, `Content-Length`, `Cache-Control`.

IAM: `s3:PutObject`, `s3:DeleteObject`, `s3:GetObject` on that bucket. Never put the root account keys in `.env`.

## Smoke test

```bash
# Login is rate-limited. If a previous run tripped it:
docker exec ck-redis redis-cli -a localdevpassword KEYS 'throttle:*'
docker exec ck-redis redis-cli -a localdevpassword DEL $(docker exec ck-redis redis-cli -a localdevpassword KEYS 'throttle:*')

bash apps/api/scripts/smoke.sh
```

## Common failures

| Symptom | Likely cause |
| --- | --- |
| Login `Invalid value for deletedAt` | Do not enable Mongoose `sanitizeFilter`; it rewrites `$exists`. |
| `No tenant context` on `/vendors` | Missing campus slug on an anonymous request. |
| Wallet checkout `INSUFFICIENT_FUNDS` with a funded wallet | `paymentMethod: wallet` must apply wallet on the server (already the case). |
| Invalid coupon poisons every cart GET | Coupons are priced before save; `clear` unsets the code. |
| 429 on login during smoke | Redis throttle keys; delete `throttle:*`. |
| Seeded password fails | Pepper must match between seed and `PasswordService` (HMAC-SHA256 of `PASSWORD_PEPPER`). Re-seed after changing the pepper. |
| Webhook signature fails | Path must be `/api/v1/webhooks/…` so `rawBody` is preserved. |

## Production checklist

- Generate new JWT secrets and pepper; never reuse `.env.example` placeholders.
- Set `CORS_ORIGINS` to the four exact HTTPS origins.
- Set `COOKIE_DOMAIN=.yourdomain.in`.
- `TRUST_PROXY_HOPS` equal to nginx + Cloudflare.
- Mongo connection string with TLS and `retryWrites=true`.
- Redis AUTH + TLS.
- Amazon S3 with Block Public ACLs, a public-read bucket policy only on `kitchen/*`, `menus/*`, `avatars/*`, `reviews/*`, `banners/*`, and `documents/*` private.
- `PAYMENT_PROVIDER=razorpay` and a verified webhook.
- Firebase Admin credentials from a secret manager, not a file in git.
- Rate limits: keep auth/checkout tight; the global ceiling must survive campus NAT.
