#!/usr/bin/env bash
#
# End-to-end smoke test for the API.
#
# Exercises the flows the four portals depend on, against a seeded database, and asserts
# both status codes and response shape. It is a shell script on purpose: it talks to the
# API exactly as a browser does (cookies, CSRF header, campus slug) and therefore catches
# the class of bug a unit test cannot — a guard that rejects an anonymous read, a cookie
# that is not set, a document that still serialises `_id` instead of `id`.
#
# Usage:  ./scripts/smoke-api.sh [base-url]
#
set -uo pipefail

BASE="${1:-http://localhost:4000/api/v1}"
CAMPUS="${CAMPUS_SLUG:-iit-kharagpur}"
# Matches the seed script's default; override both together.
PASSWORD="${SEED_PASSWORD:-ChangeMe!2026}"
CUSTOMER_EMAIL="${CUSTOMER_EMAIL:-student@campuskitchen.in}"
VENDOR_EMAIL="${VENDOR_EMAIL:-vendor@campuskitchen.in}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@campuskitchen.in}"
RIDER_EMAIL="${RIDER_EMAIL:-delivery@campuskitchen.in}"
JAR_DIR="$(mktemp -d)"
trap 'rm -rf "$JAR_DIR"' EXIT

PASS=0
FAIL=0
FAILURES=()

c_green() { printf '\033[32m%s\033[0m' "$1"; }
c_red() { printf '\033[31m%s\033[0m' "$1"; }
c_dim() { printf '\033[90m%s\033[0m' "$1"; }

# ------------------------------------------------------------------ HTTP helpers

BODY=''
STATUS=''

# request METHOD PATH [JSON_BODY] [JAR_NAME] [EXTRA_CURL_ARG...]
request() {
  local method="$1" path="$2" payload="${3:-}" jar="${4:-anon}"
  shift $(( $# < 4 ? $# : 4 ))
  local jar_file="$JAR_DIR/$jar.txt"
  touch "$jar_file"
  local args=(
    -sS -o "$JAR_DIR/body" -w '%{http_code}'
    -X "$method" "$BASE$path"
    -H "x-campus-slug: $CAMPUS"
    -b "$jar_file" -c "$jar_file"
  )

  # Double-submit CSRF: the API compares the header to the cookie it set, so a
  # cross-site form post cannot forge it.
  local csrf
  csrf="$(grep -o 'ck_csrf[[:space:]].*' "$jar_file" 2>/dev/null | awk '{print $NF}' | tail -1)"
  [[ -n "$csrf" ]] && args+=(-H "x-csrf-token: $csrf")

  if [[ -n "$payload" ]]; then
    args+=(-H 'content-type: application/json' -d "$payload")
  fi
  args+=("$@")

  STATUS="$(curl "${args[@]}")"
  BODY="$(cat "$JAR_DIR/body")"
}

# json EXPR — evaluates a Node expression against the parsed body, bound to `b`.
json() {
  node -e '
    let b = {};
    try { b = JSON.parse(process.argv[1]); } catch { }
    let out = "";
    try { out = eval(process.argv[2]); } catch { out = ""; }
    process.stdout.write(out === undefined || out === null ? "" : String(out));
  ' "$BODY" "$1" 2>/dev/null
}

check() {
  local label="$1" expected="$2"
  if [[ "$STATUS" == "$expected" ]]; then
    PASS=$((PASS + 1))
    printf '  %s %s\n' "$(c_green '✓')" "$label"
  else
    FAIL=$((FAIL + 1))
    FAILURES+=("$label (expected $expected, got $STATUS)")
    printf '  %s %s %s\n' "$(c_red '✗')" "$label" "$(c_dim "expected $expected got $STATUS: ${BODY:0:200}")"
  fi
}

# assert LABEL EXPR — asserts a truthy JSON expression on the last response.
assert() {
  local label="$1" expr="$2"
  if [[ "$(json "$expr")" == "true" ]]; then
    PASS=$((PASS + 1))
    printf '  %s %s\n' "$(c_green '✓')" "$label"
  else
    FAIL=$((FAIL + 1))
    FAILURES+=("$label")
    printf '  %s %s %s\n' "$(c_red '✗')" "$label" "$(c_dim "${BODY:0:200}")"
  fi
}

section() { printf '\n%s\n' "$(c_dim "── $1")"; }

# Rate limits are per-minute and the intentional "wrong credentials" check trips the
# per-account lockout, so both are cleared before and after rather than sleeping between
# requests. Local development only: this reaches into the Redis container directly.
reset_throttle() {
  local password="${REDIS_PASSWORD:-}"
  if ! command -v docker >/dev/null 2>&1; then return 0; fi
  local auth="${password:+-a $password}"
  for pattern in 'throttle:*' 'auth:attempts:*' 'auth:lockout:*'; do
    docker exec ck-redis sh -c \
      "redis-cli $auth --no-auth-warning --scan --pattern '$pattern' | xargs -r redis-cli $auth --no-auth-warning del" \
      >/dev/null 2>&1 || true
  done
}

# --------------------------------------------------------------------- the tests

printf '%s\n' "$(c_dim "smoke: $BASE  campus: $CAMPUS")"
reset_throttle

section 'health and public discovery'
request GET /health/live
check 'health/live is open' 200

request GET "/campuses/$CAMPUS"
check 'campus by slug is public' 200
assert 'campus exposes id, not _id' 'b.data.id !== undefined && b.data._id === undefined'

request GET /vendors
check 'vendor list is public' 200
assert 'vendors are normalised' '(b.data.items ?? []).every((v) => v.id && v._id === undefined)'
VENDOR_ID="$(json 'b.data.items?.[0]?.id')"
VENDOR_SLUG="$(json 'b.data.items?.[0]?.slug')"

request GET /catalog/products
check 'dish browse is public' 200
assert 'dish carries its kitchen' '(b.data.items ?? []).every((p) => p.vendor && p.vendor.name)'
PRODUCT_ID="$(json 'b.data.items?.[0]?.id')"

request GET /catalog/categories
check 'categories are public' 200

request GET /content/banners?placement=home_hero
check 'banners are public' 200

request GET /platform/bootstrap
check 'bootstrap is public' 200

section 'anonymous requests are refused where they must be'
request GET /me
check 'profile requires a session' 401
request GET /orders
check 'orders require a session' 401
request POST /orders '{"vendorId":"000000000000000000000000"}'
check 'placing an order requires a session' 401

section 'authentication'
request POST /auth/login '{"email":"nobody@campuskitchen.in","password":"WrongPassword1","campusSlug":"'"$CAMPUS"'","portal":"customer"}' customer
check 'wrong credentials are rejected' 401
assert 'no user leak on failure' 'b.data === undefined'

request POST /auth/login '{"email":"'"$CUSTOMER_EMAIL"'","password":"'"$PASSWORD"'","campusSlug":"'"$CAMPUS"'","portal":"customer"}' customer
check 'customer signs in' 200
assert 'session carries permissions' 'Array.isArray(b.data.user.permissions) && b.data.user.permissions.length > 0'
assert 'session is bound to a portal' 'b.data.user.portal === "customer"'
assert 'no password hash in the payload' 'JSON.stringify(b.data).includes("passwordHash") === false'

request GET /auth/me '' customer
check 'session reads back' 200

request GET /me '' customer
check 'profile reads back' 200
assert 'profile and session agree on portal' 'b.data.portal === "customer"'

section 'addresses'
request POST /me/addresses '{"label":"Hostel","hostel":"RK Hall","roomNumber":"C-214","contactName":"Test Student","contactPhone":"9876543210","isDefault":true}' customer
check 'address saves' 201
assert 'address list comes back with ids' 'Array.isArray(b.data) && b.data.every((a) => a.id && a._id === undefined)'
ADDRESS_ID="$(json 'b.data[b.data.length-1].id')"

request GET /me/addresses '' customer
check 'addresses read back' 200

section 'cart and pricing'
request DELETE /cart '' customer
request POST /cart/lines '{"vendorId":"'"$VENDOR_ID"'","productId":"'"$PRODUCT_ID"'","quantity":2,"replaceCart":true}' customer
check 'dish adds to cart' 201
assert 'cart prices server-side' 'b.data.breakdown.itemsTotal > 0'
assert 'totals are whole paise' 'Number.isInteger(b.data.breakdown.grandTotal)'

request PATCH /cart/coupon '{"code":"NOTACOUPON"}' customer
check 'invalid coupon is rejected' 422

request GET /cart '' customer
check 'cart survives a bad coupon' 200
assert 'bad coupon did not stick' '!b.data.couponCode'

section 'orders'
request POST /orders '{"vendorId":"'"$VENDOR_ID"'","lines":[{"productId":"'"$PRODUCT_ID"'","quantity":2}],"type":"delivery","paymentMethod":"cod","addressId":"'"$ADDRESS_ID"'"}' customer \
  -H "idempotency-key: smoke-$$"
check 'order places' 201
ORDER_ID="$(json 'b.data.orderId || b.data.order?.id || b.data.id')"
assert 'order returns an id' 'Boolean(b.data.orderId || b.data.order?.id || b.data.id)'

request GET "/orders/$ORDER_ID" '' customer
check 'order reads back' 200
assert 'order is normalised' 'b.data.id !== undefined && b.data._id === undefined'
assert 'handover OTP is not exposed as a hash' 'JSON.stringify(b.data).includes("OtpHash") === false'

request GET /orders '' customer
check 'order list reads back' 200

section 'notifications'
request GET /notifications '' customer
check 'notification centre reads' 200
assert 'feed reports its unread total' 'typeof b.data.unread === "number"'

request GET /notifications/unread-count '' customer
check 'unread count reads' 200
assert 'unread count uses the shared key' 'typeof b.data.unread === "number"'

request GET /notifications/preferences '' customer
check 'preferences read' 200
request PATCH /notifications/preferences '{"preferences":{"category:promotion":false}}' customer
check 'preferences save' 200
assert 'preferences echo back' 'b.data.preferences["category:promotion"] === false'

request PATCH /notifications/preferences '{"preferences":{"category.injected":false}}' customer
check 'unknown preference keys are refused' 400

section 'wallet and support'
request GET /wallet '' customer
check 'wallet reads' 200
request GET /wallet/transactions '' customer
check 'wallet ledger reads' 200

request POST /support/tickets '{"subject":"Smoke test","category":"other","message":"Ignore me."}' customer
check 'support ticket raises' 201
TICKET_ID="$(json 'b.data.id')"
request GET "/support/tickets/$TICKET_ID" '' customer
check 'support ticket reads back' 200

section 'tenant and portal isolation'
request POST /auth/login '{"email":"'"$VENDOR_EMAIL"'","password":"'"$PASSWORD"'","campusSlug":"'"$CAMPUS"'","portal":"customer"}' crossportal
check 'a vendor cannot sign in to the customer portal' 403

request POST /auth/login '{"email":"'"$VENDOR_EMAIL"'","password":"'"$PASSWORD"'","campusSlug":"'"$CAMPUS"'","portal":"vendor"}' vendor
check 'vendor signs in to its own portal' 200

request GET /vendor/orders '' vendor
check 'vendor reads its order board' 200

request GET /admin/users '' vendor
check 'vendor cannot read the admin user list' 403

# A delivery order is closed by the rider, so the kitchen is refused outright rather
# than told the transition is out of order.
request PATCH "/vendor/orders/$ORDER_ID/status" '{"status":"delivered"}' vendor
check 'vendor cannot mark a delivery order delivered' 403

request PATCH "/vendor/orders/$ORDER_ID/status" '{"status":"accepted"}' vendor
check 'vendor accepts the order' 200

section 'delivery'
# The rider portal's whole flow, because it is the one path where the API is the only
# thing standing between a partner and somebody else's dinner.
request POST /auth/login '{"email":"'"$RIDER_EMAIL"'","password":"'"$PASSWORD"'","campusSlug":"'"$CAMPUS"'","portal":"delivery"}' rider
check 'rider signs in' 200

request PATCH /delivery/availability '{"isOnline":false}' rider
check 'rider can go offline' 200
request GET /delivery/offers '' rider
check 'offers read while offline' 200
assert 'an offline rider is told why the pool is empty' 'b.data.reason === "offline" && b.data.items.length === 0'

request PATCH /delivery/availability '{"isOnline":true}' rider
check 'rider goes online' 200

# The job only exists once the kitchen has the food ready.
request PATCH "/vendor/orders/$ORDER_ID/status" '{"status":"preparing"}' vendor
check 'kitchen starts cooking' 200
request PATCH "/vendor/orders/$ORDER_ID/status" '{"status":"ready"}' vendor
check 'kitchen marks the order ready' 200

request GET /delivery/offers '' rider
check 'offer pool reads' 200
assert 'the ready order is offered' 'b.data.items.length > 0'
# The pool is a broadcast to every online rider, so it must not carry the customer's
# room number, name or phone before anybody has accepted.
assert 'offers withhold the customer identity' 'b.data.items.every((o) => o.dropArea && o.drop === undefined)'
assert 'offers withhold contact details' 'JSON.stringify(b.data.items).includes("9000000006") === false'
assert 'offers say what cash to collect' 'b.data.items.every((o) => Number.isInteger(o.collectCash))'
ASSIGNMENT_ID="$(json 'b.data.items[0].id')"

request POST "/delivery/jobs/$ASSIGNMENT_ID/accept" '' rider
check 'rider accepts the job' 200
assert 'accepting reveals the drop address' 'Boolean(b.data.drop.address)'
assert 'a cash order tells the rider the amount' 'b.data.collectCash > 0'

request POST "/delivery/jobs/$ASSIGNMENT_ID/accept" '' rider
check 'a taken job cannot be accepted twice' 409

request PATCH "/delivery/jobs/$ASSIGNMENT_ID/status" '{"status":"delivered","otp":"000000"}' rider
check 'a delivery cannot skip pickup' 422

request PATCH "/delivery/jobs/$ASSIGNMENT_ID/status" '{"status":"arrived_at_vendor"}' rider
check 'rider reports arrival at the kitchen' 200
request PATCH "/delivery/jobs/$ASSIGNMENT_ID/status" '{"status":"picked_up","location":[87.31,22.32]}' rider
check 'rider picks the order up' 200

request PATCH /delivery/location '{"coordinates":[87.311,22.321]}' rider
check 'location ping accepted' 200

request PATCH "/delivery/jobs/$ASSIGNMENT_ID/status" '{"status":"delivered","otp":"000000"}' rider
check 'a wrong handover code is refused' 400

# The customer fetches the code separately from the order, which is why it survives a
# page reload without ever appearing in an order payload.
request GET "/orders/$ORDER_ID/handover-code" '' customer
check 'customer reads their handover code' 200
HANDOVER_CODE="$(json 'b.data.code')"
assert 'the handover code is six digits' '/^\d{6}$/.test(b.data.code)'

# The customer endpoints are bound to the customer portal, so a rider's session is
# refused before ownership is even considered.
request GET "/orders/$ORDER_ID/handover-code" '' rider
check 'a rider cannot read the handover code' 403

request PATCH "/delivery/jobs/$ASSIGNMENT_ID/status" '{"status":"delivered","otp":"'"$HANDOVER_CODE"'"}' rider
check 'the correct handover code completes the delivery' 200
assert 'the job is closed' 'b.data.status === "delivered"'

request GET /delivery/earnings '' rider
check 'rider earnings read' 200
assert 'the completed job is paid' 'b.data.today.deliveries > 0 && b.data.today.amount > 0'
assert 'earnings report availability' 'typeof b.data.isOnline === "boolean"'

# Spent the moment the order closed, so a screenshot taken later is worth nothing.
request GET "/orders/$ORDER_ID/handover-code" '' customer
check 'handover code reads after delivery' 200
assert 'a closed order has no live code' 'b.data.code === null && b.data.reason === "closed"'

section 'admin'
request POST /auth/login '{"email":"'"$ADMIN_EMAIL"'","password":"'"$PASSWORD"'","campusSlug":"'"$CAMPUS"'","portal":"admin"}' admin
check 'admin signs in' 200
request GET /admin/users '' admin
check 'admin reads users' 200
assert 'admin user list hides secrets' 'JSON.stringify(b.data).includes("passwordHash") === false'
request GET /admin/audit-logs '' admin
check 'audit log reads' 200
assert 'audit entries are normalised' '(b.data.items ?? []).every((e) => e._id === undefined)'

section 'sign out'
request POST /auth/logout '' customer
check 'customer signs out' 200
request GET /me '' customer
check 'session is gone after sign out' 401

reset_throttle

# ------------------------------------------------------------------------ summary
printf '\n'
if [[ $FAIL -eq 0 ]]; then
  printf '%s %d checks passed\n' "$(c_green 'PASS')" "$PASS"
  exit 0
fi

printf '%s %d passed, %d failed\n' "$(c_red 'FAIL')" "$PASS" "$FAIL"
for failure in "${FAILURES[@]}"; do printf '  %s %s\n' "$(c_red '-')" "$failure"; done
exit 1
