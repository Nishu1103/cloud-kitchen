# Security model

Security is the product constraint, not a later pass. The API is the source of truth. Frontends hide buttons; they do not authorize.

## Authentication

- Passwords: Argon2id with a server-side HMAC pepper. Rotating the pepper invalidates every password.
- Session: short-lived access JWT + longer refresh JWT, both httpOnly, `Secure` in production, `SameSite=Lax`.
- CSRF: double-submit cookie on mutating browser requests.
- Refresh-token reuse is treated as theft: the family is revoked.
- Failed logins lock the account after a threshold (`AUTH_MAX_FAILED_ATTEMPTS`).
- Portal mismatch is a 403: a student token cannot call vendor routes by swapping the origin.

Tokens are never stored in `localStorage`. The SDK talks with `credentials: 'include'`.

## Authorization (RBAC)

Code never checks a role name.

```
Permission  →  Create product / Refund / Approve vendor / …
Role        →  named bundle of permissions, editable at runtime
```

`PermissionsGuard` reads the session's permission set. Admin UI nav is filtered the same way. Granting a new capability is a role edit, not a deploy.

## Tenancy

- Signed-in: `campusId` comes from the JWT. `x-campus-id` is ignored unless the caller has `campus:read_all`.
- Anonymous: campus is resolved from slug. No slug → 403, not a leaked default campus.
- Mongo queries that return tenant data always include `campusId` (and `deletedAt` where soft-delete applies).

## Money

All amounts are integer paise. The client may display rupees; it may not submit a total. Cart pricing, coupons, wallet apply, and refunds are computed on the server. Wallet checkout is idempotent.

## Payments

Razorpay (or `mock` in development). The webhook path keeps the raw body for signature verification. The client is not trusted to prove a charge: the API confirms with the provider before releasing the order.

## Input

- DTOs validated with class-validator.
- `$` operators stripped from body/query/params (Mongo operator injection).
- HTML in CMS is sanitized.
- File uploads go through presigned URLs with content-type, size, and cache-control pinned in the signature. Object keys are generated server-side as `{folder}/{campusId}/{ownerId}/{uuid}.ext`. Persisted image URLs must match that object and the caller; arbitrary hosts are rejected.

## Transport

- Helmet, HSTS in production, exact-origin CORS (no wildcards).
- Rate limits: JWT runs before the throttler so signed-in traffic is keyed by user (campus NAT and local multi-portal must not share one IP bucket). Tight named limits on login and checkout.
- CSP on every Next.js app. Admin/vendor/delivery send `X-Robots-Tag: noindex`.

## Audit

Mutations that move money, change account status, or approve a vendor write an audit log. Sensitive fields (passwords, tokens, card data) are never stored there.

## Secrets

JWT secrets, password pepper, Razorpay, Redis, S3, Firebase Admin, and SMTP live in environment variables. Generate with `openssl rand -base64 48`. Never commit `.env`.
