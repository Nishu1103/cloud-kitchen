# Architecture

Campus Kitchen is a multi-tenant food commerce platform. A campus is a tenant (`campusId`). One backend serves every campus. Four frontends share types, UI, and the API client.

```
                    Internet
                         │
                  Cloudflare CDN
                         │
                   Nginx reverse proxy
                         │
   ┌──────────┬──────────┼──────────┬──────────┐
   │          │          │          │          │
Customer   Vendor    Delivery     Admin     NestJS
 :3000     :3001      :3002       :3003      :4000
   │          │          │          │          │
   └──────────┴──────────┴──────────┴──── API Gateway
                                              │
                                    /api/v1  (versioned)
                                              │
                              Feature modules (NestJS)
                                              │
                    MongoDB  ·  Redis + BullMQ  ·  Amazon S3
```

## Repository

```
apps/
  api                 NestJS — the only backend
  customer-web        Student storefront (PWA)
  vendor-portal       Kitchen console
  delivery-portal     Rider console
  admin-portal        Campus admin + super admin
packages/
  types               Shared domain types, permissions, money
  sdk                 Typed HTTP + Socket.IO + web-push client
  ui                  Design system (Button, Table, AppShell, …)
  config              ESLint / TypeScript presets
```

Do not copy buttons or API calls into four apps. Change them in `packages/ui` and `packages/sdk`.

## Tenancy

Every document that belongs to a campus carries `campusId`. Signed-in requests take the tenant from the session, never from a client-supplied header. Anonymous catalog requests resolve the campus from `x-campus-slug` or `?campusSlug=`. Super-admin may read across campuses with `campus:read_all`.

Adding IIT Bombay is: create a campus, assign admins, set branding and zones. Not a new deploy of the API.

## Backend modules

One NestJS process. Controllers are grouped by audience (`/auth`, `/vendors`, `/orders`, `/admin/...`) but they share the same database and the same permission catalogue.

Domain events (`order.created`, `payment.captured`, …) fan out to notifications, analytics, and delivery. The order service does not send email.

Background work (email, FCM, announcement fan-out) goes through Redis + BullMQ. The HTTP request returns first.

## Frontends

Four Next.js apps so a vendor deploy does not restart the student site.

| App | Domain (prod) | Permission surface |
| --- | --- | --- |
| Customer | campuskitchen.in | Place orders, wallet, reviews |
| Vendor | vendor.campuskitchen.in | Own kitchen, own orders, own menu |
| Delivery | delivery.campuskitchen.in | Assigned jobs, OTP handover |
| Admin | admin.campuskitchen.in | Campus ops; extra modules if the session has them |

Navigation is filtered by **permission**, never by role name. Super-admin is a role that holds more permissions, not a fifth app.

## State

Each portal keeps small stores, not one global blob:

- Session (who you are, which permissions)
- Cart (customer only)
- Realtime (Socket.IO invalidates React Query)
- Theme / campus branding

Prices are never trusted from the client. The API recomputes every cart and checkout in paise.

## Feature flags

Flash sale, happy hour, festival menu, and similar capabilities are flags in MongoDB. Toggle them in Admin → Settings. Product-level toggles (today's special, combo, hidden, chef special) live on the product document, not as extra pages.

## Storage

Profile, kitchen, menu, banner, and document files go to Amazon S3. Leave `S3_ENDPOINT` empty so the SDK talks to AWS for `S3_REGION`. The API mints short-lived upload URLs; browsers never receive the bucket secret.

Objects are stored by folder, then campus, then owner:

```
kitchen/{campusId}/{vendorId}/{uuid}.jpg
menus/{campusId}/{vendorId}/{uuid}.jpg
avatars/{campusId}/{userId}/{uuid}.jpg
reviews/{campusId}/{userId}/{uuid}.jpg
banners/{campusId}/{userId}/{uuid}.jpg
documents/{campusId}/{userId}/{uuid}.pdf
```

## What is not in Phase 1

Native iOS/Android apps, Capacitor wrappers, subscriptions, loyalty, group orders, meal pass, white-label public APIs. The notification stack is built so a native app can reuse the same FCM tokens later.
