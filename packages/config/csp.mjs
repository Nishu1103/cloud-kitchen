/**
 * Origins the browser may call (XHR, fetch, WebSocket).
 *
 * CSP treats `http://host` and `ws://host` as different. Listing the HTTP API origin
 * does not allow Socket.IO. Scheme-only `wss:` would allow any host, so we emit the
 * concrete websocket origin instead.
 */

function originOf(raw) {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed || /[\s;,]/.test(trimmed)) return undefined;
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

/**
 * Hosts the browser PUTs a presigned upload to.
 *
 * DigitalOcean Spaces signs virtual-hosted URLs on `{bucket}.{region}.digitaloceanspaces.com`,
 * while `S3_PUBLIC_BASE_URL` is often `{bucket}.s3.{region}.digitaloceanspaces.com`. Those
 * are different origins; CSP must list the PUT host, not only the public read host.
 *
 * Bucket and region are charset-checked so a malformed env cannot inject extra CSP
 * directives into the header.
 */
export function storageConnectOrigins(env = process.env) {
  const origins = new Set();
  const add = (raw) => {
    const origin = originOf(raw);
    if (origin) origins.add(origin);
  };

  add(env.NEXT_PUBLIC_UPLOAD_ORIGIN);
  add(env.S3_PUBLIC_BASE_URL);
  add(env.S3_ENDPOINT);

  const bucket = env.S3_BUCKET;
  const region = env.S3_REGION;
  const safeName = (value) => typeof value === 'string' && /^[a-z0-9][a-z0-9.-]{0,62}$/i.test(value);

  let publicHost = '';
  try {
    publicHost = new URL(env.S3_PUBLIC_BASE_URL ?? '').hostname.toLowerCase();
  } catch {
    // Public URL is optional at config-load time in some local setups.
  }

  if (safeName(bucket) && safeName(region)) {
    if (publicHost.includes('digitaloceanspaces.com') || env.S3_ENDPOINT) {
      add(`https://${bucket}.s3.${region}.digitaloceanspaces.com`);
      add(`https://${bucket}.${region}.digitaloceanspaces.com`);
    } else {
      add(`https://${bucket}.s3.${region}.amazonaws.com`);
    }
  }

  const spaces = publicHost.match(
    /^([a-z0-9][a-z0-9.-]*)\.s3\.([a-z0-9-]+)\.digitaloceanspaces\.com$/,
  );
  if (spaces) add(`https://${spaces[1]}.${spaces[2]}.digitaloceanspaces.com`);

  return [...origins];
}

export function cspConnectSrc({ apiOrigin, wsUrl, extra = [] }) {
  const origins = new Set();

  const addHttpAndWs = (raw) => {
    const origin = originOf(raw);
    if (!origin) return;
    origins.add(origin);
    try {
      const socket = new URL(origin);
      socket.protocol = origin.startsWith('https:') ? 'wss:' : 'ws:';
      origins.add(socket.origin);
    } catch {
      // Malformed env must not take the process down at config load.
    }
  };

  addHttpAndWs(apiOrigin);
  addHttpAndWs(wsUrl);
  for (const item of extra) {
    const origin = originOf(item);
    if (origin) origins.add(origin);
  }

  return [...origins].join(' ');
}
