#!/usr/bin/env bash
# End-to-end smoke test against a running API and a seeded database.
#
# Uses bearer tokens rather than cookies so the CSRF double-submit check does not
# apply; the cookie path is exercised separately by the browser clients.
set -uo pipefail

BASE="${BASE:-http://localhost:4000/api/v1}"
CAMPUS="${CAMPUS:-iit-kharagpur}"
PASSWORD="${SEED_PASSWORD:-ChangeMe!2026}"

pass=0
fail=0

check() { # name expected actual [body]
  if [[ "$2" == "$3" ]]; then
    printf '  ok    %-46s %s\n' "$1" "$3"
    pass=$((pass + 1))
  else
    printf '  FAIL  %-46s expected %s got %s\n' "$1" "$2" "$3"
    [[ -n "${4:-}" ]] && printf '        %s\n' "$(echo "$4" | head -c 300)"
    fail=$((fail + 1))
  fi
}

request() { # method path [token] [json]   (EXTRA holds additional curl args)
  local method="$1" path="$2" token="${3:-}" body="${4:-}"
  local args=(-s -o /tmp/ck-smoke-body -w '%{http_code}' -X "$method" "$BASE$path")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(-H 'Content-Type: application/json' -d "$body")
  [[ -n "${EXTRA:-}" ]] && args+=($EXTRA)
  STATUS="$(curl "${args[@]}")"
  BODY="$(cat /tmp/ck-smoke-body)"
  EXTRA=''
}

json() { # node expression over parsed body `b`
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const b=JSON.parse(d);const v=($1);console.log(v==null?'':v)}catch(e){console.log('')}})" <<<"$BODY"
}

login() { # email portal
  request POST /auth/login '' \
    "{\"email\":\"$1\",\"password\":\"$PASSWORD\",\"campusSlug\":\"$CAMPUS\",\"portal\":\"$2\"}"
  check "login $2 <$1>" 200 "$STATUS" "$BODY" >&2
  json 'b.data.accessToken'
}

# The burst test at the end leaves this IP throttled, which would fail every login on
# the next run. Clearing the counters keeps the script repeatable in development.
reset_throttle() {
  command -v docker >/dev/null 2>&1 || return 0
  local container="${REDIS_CONTAINER:-ck-redis}"
  local password="${REDIS_PASSWORD:-localdevpassword}"
  docker exec "$container" redis-cli -a "$password" --no-auth-warning \
    --scan --pattern 'throttle:*' 2>/dev/null |
    tr -d '\r' | xargs -r -n 200 docker exec -i "$container" \
    redis-cli -a "$password" --no-auth-warning DEL >/dev/null 2>&1
}
reset_throttle

echo
echo "--- infrastructure"
request GET /health/live
check 'health/live' 200 "$STATUS" "$BODY"
request GET /health/ready
check 'health/ready' 200 "$STATUS" "$BODY"

echo
echo "--- public surface (no session)"
request GET /campuses
check 'campus list' 200 "$STATUS" "$BODY"
request GET "/campuses/$CAMPUS"
check 'campus by slug' 200 "$STATUS" "$BODY"
EXTRA="-H x-campus-slug:$CAMPUS"
request GET '/content/banners?placement=home_hero'
check 'banners (tenant from slug header)' 200 "$STATUS" "$BODY"
request GET '/content/banners?placement=home_hero'
check 'banners without a campus slug' 403 "$STATUS" "$BODY"
EXTRA="-H x-campus-slug:no-such-campus"
request GET '/content/banners?placement=home_hero'
check 'banners for unknown campus' 403 "$STATUS" "$BODY"

echo
echo "--- anonymous access is refused"
request GET /me
check 'GET /me without token' 401 "$STATUS" "$BODY"
request GET /admin/users
check 'GET /admin/users without token' 401 "$STATUS" "$BODY"
request GET /vendors
check 'GET /vendors without campus slug' 403 "$STATUS" "$BODY"
EXTRA="-H x-campus-slug:$CAMPUS"
request GET /vendors
check 'public vendor list (anonymous + campus slug)' 200 "$STATUS" "$BODY"
request POST /orders '' '{}'
check 'POST /orders without token' 401 "$STATUS" "$BODY"
request GET /me '' && true
request GET /me 'not.a.real.jwt'
check 'forged bearer token' 401 "$STATUS" "$BODY"
request POST /auth/login '' \
  "{\"email\":\"student@campuskitchen.in\",\"password\":\"WrongPassword1\",\"campusSlug\":\"$CAMPUS\",\"portal\":\"customer\"}"
check 'wrong password' 401 "$STATUS" "$BODY"
request POST /auth/login '' '{"email":"nope","password":"x"}'
check 'malformed login payload' 400 "$STATUS" "$BODY"

echo
echo "--- sessions"
STUDENT="$(login student@campuskitchen.in customer)"
VENDOR="$(login vendor@campuskitchen.in vendor)"
PARTNER="$(login delivery@campuskitchen.in delivery)"
ADMIN="$(login admin@campuskitchen.in admin)"
OWNER="$(login owner@campuskitchen.in admin)"

echo
echo "--- portal and permission boundaries"
request POST /auth/login '' \
  "{\"email\":\"student@campuskitchen.in\",\"password\":\"$PASSWORD\",\"campusSlug\":\"$CAMPUS\",\"portal\":\"admin\"}"
check 'student signing in to admin portal' 403 "$STATUS" "$BODY"
request GET /vendor/analytics/dashboard "$STUDENT"
check 'student on vendor analytics' 403 "$STATUS" "$BODY"
request GET /admin/analytics/dashboard "$STUDENT"
check 'student on admin analytics' 403 "$STATUS" "$BODY"
request GET /admin/users "$VENDOR"
check 'vendor on admin users' 403 "$STATUS" "$BODY"
request GET /cart "$VENDOR"
check 'vendor on customer cart' 403 "$STATUS" "$BODY"
request GET /admin/roles "$ADMIN"
check 'campus admin on role management' 403 "$STATUS" "$BODY"
STATUS="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $STUDENT" \
  -H 'x-campus-id: 000000000000000000000000' "$BASE/vendors")"
check 'student forging x-campus-id' 403 "$STATUS"
STATUS="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $OWNER" \
  -H 'x-campus-id: 000000000000000000000000' "$BASE/admin/users")"
check 'super admin may target another campus' 200 "$STATUS"

echo
echo "--- customer browse"
request GET /platform/bootstrap "$STUDENT"
check 'platform bootstrap (flags + settings)' 200 "$STATUS" "$BODY"
request GET /me "$STUDENT"
check 'GET /me' 200 "$STATUS" "$BODY"
STUDENT_ID="$(json 'b.data.id||b.data._id')"
printf '        wallet=%s paise  loyalty=%s\n' "$(json 'b.data.walletBalance')" "$(json 'b.data.loyaltyPoints')"

# Each run spends wallet money on a real order, so top up to keep the script repeatable.
request POST "/admin/wallet/users/$STUDENT_ID/adjust" "$ADMIN" \
  '{"amount":100000,"reason":"Smoke test top-up"}'
check 'admin tops up the wallet' 201 "$STATUS" "$BODY"
printf '        balance now=%s paise\n' "$(json 'b.data.balance')"
request GET /vendors "$STUDENT"
check 'vendor list' 200 "$STATUS" "$BODY"
VENDOR_ID="$(json 'b.data.items[0].id||b.data.items[0]._id')"
VENDOR_SLUG="$(json 'b.data.items[0].slug')"
printf '        vendors=%s first=%s\n' "$(json 'b.data.total')" "$VENDOR_SLUG"
request GET "/vendors/$VENDOR_SLUG" "$STUDENT"
check 'vendor by slug' 200 "$STATUS" "$BODY"
request GET "/catalog/vendors/$VENDOR_ID/menu" "$STUDENT"
check 'vendor menu' 200 "$STATUS" "$BODY"
PRODUCT_ID="$(json 'b.data.sections[0].products[0].id||b.data.sections[0].products[0]._id')"
printf '        sections=%s item=%s (%s paise)\n' \
  "$(json 'b.data.sections.length')" \
  "$(json 'b.data.sections[0].products[0].name')" \
  "$(json 'b.data.sections[0].products[0].basePrice')"
request GET /catalog/products "$STUDENT"
check 'product search' 200 "$STATUS" "$BODY"
request GET /catalog/categories "$STUDENT"
check 'category list' 200 "$STATUS" "$BODY"

echo
echo "--- cart"
request DELETE /cart "$STUDENT"
check 'clear cart' 200 "$STATUS" "$BODY"
request POST /cart/lines "$STUDENT" \
  "{\"vendorId\":\"$VENDOR_ID\",\"productId\":\"$PRODUCT_ID\",\"quantity\":2}"
check 'add line' 201 "$STATUS" "$BODY"
request GET /cart "$STUDENT"
check 'cart preview' 200 "$STATUS" "$BODY"
printf '        items=%s grandTotal=%s\n' \
  "$(json 'b.data.breakdown.itemsTotal')" "$(json 'b.data.breakdown.grandTotal')"

echo
echo "--- input hardening"
request POST /cart/lines "$STUDENT" \
  "{\"vendorId\":\"$VENDOR_ID\",\"productId\":\"not-an-id\",\"quantity\":1}"
check 'invalid product id' 400 "$STATUS" "$BODY"
request POST /cart/lines "$STUDENT" \
  "{\"vendorId\":\"$VENDOR_ID\",\"productId\":\"$PRODUCT_ID\",\"quantity\":9999}"
check 'quantity above cap' 400 "$STATUS" "$BODY"
request POST /cart/lines "$STUDENT" \
  "{\"vendorId\":\"$VENDOR_ID\",\"productId\":\"$PRODUCT_ID\",\"quantity\":1,\"unitPrice\":1}"
check 'unknown property (price injection)' 400 "$STATUS" "$BODY"
request PATCH /cart/coupon "$STUDENT" '{"code":"DOES-NOT-EXIST"}'
check 'unknown coupon' 422 "$STATUS" "$BODY"
request GET "/vendors/$VENDOR_SLUG'--" "$STUDENT"
check 'slug with injection characters' 400 "$STATUS" "$BODY"
# Same 404 for a missing kitchen as for one on another campus, so a probe cannot
# use the status code to learn which vendor ids exist.
request GET "/catalog/vendors/000000000000000000000000/menu" "$STUDENT"
check 'menu of nonexistent vendor' 404 "$STATUS" "$BODY"

echo
echo "--- order lifecycle"
request POST /orders "$STUDENT" \
  "{\"vendorId\":\"$VENDOR_ID\",\"lines\":[{\"productId\":\"$PRODUCT_ID\",\"quantity\":1}],\"type\":\"pickup\",\"paymentMethod\":\"wallet\"}"
check 'place order (wallet)' 201 "$STATUS" "$BODY"
ORDER_ID="$(json 'b.data.orderId')"
printf '        order=%s status=%s payable=%s wallet=%s\n' \
  "$(json 'b.data.code')" "$(json 'b.data.status')" \
  "$(json 'b.data.breakdown.payableNow')" "$(json 'b.data.breakdown.walletApplied')"

request GET /orders "$STUDENT"
check 'customer order history' 200 "$STATUS" "$BODY"
request GET "/orders/$ORDER_ID" "$STUDENT"
check 'customer order detail' 200 "$STATUS" "$BODY"
request GET "/orders/$ORDER_ID" "$PARTNER"
check "another user's order" 403 "$STATUS" "$BODY"

request GET /vendor/orders "$VENDOR"
check 'vendor sees the order' 200 "$STATUS" "$BODY"
request PATCH "/vendor/orders/$ORDER_ID/status" "$VENDOR" '{"status":"accepted"}'
check 'vendor accepts' 200 "$STATUS" "$BODY"
request PATCH "/vendor/orders/$ORDER_ID/status" "$VENDOR" '{"status":"delivered"}'
check 'vendor cannot skip to delivered' 422 "$STATUS" "$BODY"
request PATCH "/vendor/orders/$ORDER_ID/status" "$VENDOR" '{"status":"preparing"}'
check 'vendor marks preparing' 200 "$STATUS" "$BODY"
request PATCH "/vendor/orders/$ORDER_ID/status" "$VENDOR" '{"status":"ready"}'
check 'vendor marks ready' 200 "$STATUS" "$BODY"
request GET /notifications "$STUDENT"
check 'customer notified' 200 "$STATUS" "$BODY"
printf '        notifications=%s unread=%s\n' "$(json 'b.data.total')" "$(json 'b.data.items[0]&&b.data.items[0].title')"

echo
echo "--- vendor portal"
request GET /vendor/profile "$VENDOR"
check 'vendor profile' 200 "$STATUS" "$BODY"
request GET /vendor/menu/products "$VENDOR"
check 'vendor products' 200 "$STATUS" "$BODY"
request GET /vendor/analytics/dashboard "$VENDOR"
check 'vendor dashboard' 200 "$STATUS" "$BODY"
request GET /vendor/analytics/peak-hours "$VENDOR"
check 'vendor peak hours' 200 "$STATUS" "$BODY"
request GET /vendor/reviews "$VENDOR"
check 'vendor reviews' 200 "$STATUS" "$BODY"
request GET /vendor/coupons "$VENDOR"
check 'vendor coupons' 200 "$STATUS" "$BODY"
request PATCH /vendor/profile/open-state "$VENDOR" '{"isOpen":true}'
check 'vendor toggles open' 200 "$STATUS" "$BODY"

echo
echo "--- delivery portal"
request GET /delivery/offers "$PARTNER"
check 'delivery offers' 200 "$STATUS" "$BODY"
request GET /delivery/jobs "$PARTNER"
check 'delivery jobs' 200 "$STATUS" "$BODY"
request GET /delivery/earnings "$PARTNER"
check 'delivery earnings' 200 "$STATUS" "$BODY"
request PATCH /delivery/availability "$PARTNER" '{"isOnline":true}'
check 'go online' 200 "$STATUS" "$BODY"
request PATCH /delivery/location "$PARTNER" '{"coordinates":[87.3105,22.3149]}'
check 'location ping' 200 "$STATUS" "$BODY"
request PATCH /delivery/location "$PARTNER" '{"coordinates":[87.3105,999]}'
check 'out-of-range coordinate' 400 "$STATUS" "$BODY"

echo
echo "--- admin portal"
request GET /admin/users "$ADMIN"
check 'user list' 200 "$STATUS" "$BODY"
request GET /admin/vendors "$ADMIN"
check 'vendor list' 200 "$STATUS" "$BODY"
request GET /admin/orders "$ADMIN"
check 'order list' 200 "$STATUS" "$BODY"
request GET /admin/analytics/dashboard "$ADMIN"
check 'platform dashboard' 200 "$STATUS" "$BODY"
request GET /admin/delivery "$ADMIN"
check 'delivery board' 200 "$STATUS" "$BODY"
request GET /admin/reviews "$ADMIN"
check 'review moderation queue' 200 "$STATUS" "$BODY"
request GET /admin/coupons "$ADMIN"
check 'coupon list' 200 "$STATUS" "$BODY"
request GET /admin/content/tickets "$ADMIN"
check 'support queue' 200 "$STATUS" "$BODY"
request GET /admin/campuses/current "$ADMIN"
check 'own campus' 200 "$STATUS" "$BODY"

echo
echo "--- super admin"
request GET /admin/roles "$OWNER"
check 'roles' 200 "$STATUS" "$BODY"
request GET /admin/roles/permissions "$OWNER"
check 'permission catalogue' 200 "$STATUS" "$BODY"
request GET /admin/platform/settings "$OWNER"
check 'settings' 200 "$STATUS" "$BODY"
request GET /admin/platform/feature-flags "$OWNER"
check 'feature flags' 200 "$STATUS" "$BODY"
request GET /admin/audit-logs "$OWNER"
check 'audit log' 200 "$STATUS" "$BODY"
printf '        audit entries=%s\n' "$(json 'b.data.total')"
request GET /admin/campuses "$OWNER"
check 'all campuses' 200 "$STATUS" "$BODY"

echo
echo "--- notifications"
request GET /notifications/unread-count "$STUDENT"
check 'unread count' 200 "$STATUS" "$BODY"
request PATCH /notifications/read-all "$STUDENT" '{}'
check 'mark all read' 200 "$STATUS" "$BODY"
request POST /notifications/devices "$STUDENT" \
  '{"token":"fake-fcm-token-for-smoke-test-000000000000","platform":"web"}'
check 'register device token' 201 "$STATUS" "$BODY"
request POST /admin/announcements "$ADMIN" \
  '{"title":"Smoke test","body":"Ignore me.","audiences":["customer"]}'
check 'draft announcement' 201 "$STATUS" "$BODY"
ANNOUNCEMENT_ID="$(json 'b.data.id||b.data._id')"
request POST "/admin/announcements/$ANNOUNCEMENT_ID/send" "$ADMIN" '{}'
check 'send announcement' 201 "$STATUS" "$BODY"
request GET /notifications "$STUDENT"
check 'announcement reached the customer' 200 "$STATUS" "$BODY"
printf '        latest=%s\n' "$(json 'b.data.items[0]&&b.data.items[0].title')"

echo
echo "--- rate limiting"
codes=""
for _ in $(seq 1 14); do
  codes+="$(curl -s -o /dev/null -w '%{http_code} ' -X POST "$BASE/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"nobody@campuskitchen.in\",\"password\":\"WrongPassword1\",\"campusSlug\":\"$CAMPUS\",\"portal\":\"customer\"}")"
done
if [[ "$codes" == *429* ]]; then
  check 'login throttled after burst' 'throttled' 'throttled'
else
  check 'login throttled after burst' 'throttled' "none ($codes)"
fi

reset_throttle

echo
echo "--- session teardown"
request POST /auth/logout "$STUDENT" '{}'
check 'logout' 200 "$STATUS" "$BODY"
request GET /me "$STUDENT"
check 'token rejected after logout' 401 "$STATUS" "$BODY"

printf '\n%s passed, %s failed\n\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
