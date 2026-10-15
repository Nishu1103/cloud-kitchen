# Notifications

Order updates, kitchen alerts, and rider assignments cannot wait on a page refresh. The platform uses four channels. None of them is optional in the architecture; the user may decline push.

```
Domain event (order.created, …)
        │
Notification service
        │
 ┌──────┼──────────┬────────────┐
 │      │          │            │
Push   In-app    Realtime     Email
(FCM)  (Mongo)   (Socket.IO)  (BullMQ)
```

Email, SMS, and FCM are never sent inside the HTTP handler. The API writes the in-app row, emits a socket event, and enqueues the slow channels.

## Channels

| Channel | When | Notes |
| --- | --- | --- |
| Socket.IO | Tab is open | Immediate board/order updates. Rooms come from the JWT, not from the client. |
| In-app centre | Always | Stored in Mongo. Works if push is denied. |
| FCM web push | Tab closed / background | Android Chrome, desktop, installed iOS PWA. |
| Email | Account, invoice, weekly | Not every order ping. |
| SMS | OTP and critical only | Costly; mocked in development. |

## Web push (PWA)

This is a website, not a native app.

1. The portal asks for notification permission after the user has a reason (first order, kitchen board, rider shift).
2. Firebase mints a device token.
3. The token is stored against the user (`notification_tokens`: user, token, platform, browser, lastSeen).
4. A user with a phone, laptop, and tablet has three tokens. Sends go to all of them.

Service workers live at `/firebase-messaging-sw.js` on each origin. Firebase config is posted into the worker at runtime so campus keys are not baked into a cached file.

### iOS

Safari will not deliver web push in a normal tab. It works only when:

1. The site is opened in Safari
2. The user chooses Add to Home Screen
3. They launch the installed PWA
4. They grant notification permission

The UI explains this instead of showing a switch that cannot work. In-app + socket still cover an open tab.

### Android / desktop

Chrome, Edge, and Firefox can subscribe from a tab. The PWA install is still recommended.

## Realtime rooms

The gateway assigns rooms from the verified session:

- `user:{id}` — that person's notification feed
- `vendor:{id}` — that kitchen's live board
- `order:{id}` — tracking for people on that order
- `campus:{id}:admins` — operator alerts
- `campus:{id}:delivery` — rider offers

A client cannot join another tenant's room.

## Categories

| Audience | Examples |
| --- | --- |
| Customer | Accepted, preparing, ready, delivered, coupon, announcement |
| Vendor | New order, cancelled, review, settlement, low stock |
| Delivery | New assignment, cancelled, customer waiting |
| Admin | Vendor application, complaint, platform notice |

Vendors may send promotional pushes (today's special) with a daily cap. Order-related notifications are unlimited. Uncapped marketing is how students disable notifications.

## Admin broadcasts

Admin → Announcements: pick audience (students, kitchens, riders, admins), write the copy, send now or later. Fan-out is a worker job so the request stays fast.

## Failure policy

Push is best-effort. If FCM is not configured, the API still writes the in-app notification and emits the socket event. A denied permission must not break ordering, cooking, or delivery.

## Version 2

If iPhone usage is high and missed alerts cost money, wrap the PWAs with Capacitor or ship native apps. They reuse the same user, the same tokens collection, and the same notification service.
