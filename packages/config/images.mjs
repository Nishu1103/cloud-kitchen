/**
 * Hosts next/image is allowed to fetch server-side.
 *
 * Keep this tight: the optimiser is an SSRF hole if it can reach arbitrary AWS
 * endpoints. Only virtual-hosted S3, regional S3, and CloudFront.
 */
export const remoteImagePatterns = [
  { protocol: 'https', hostname: '**.s3.amazonaws.com' },
  { protocol: 'https', hostname: '**.s3.*.amazonaws.com' },
  { protocol: 'https', hostname: 's3.*.amazonaws.com' },
  { protocol: 'https', hostname: '*.cloudfront.net' },
  { protocol: 'https', hostname: '**.digitaloceanspaces.com' },
  { protocol: 'https', hostname: '**.cdn.digitaloceanspaces.com' },
  { protocol: 'https', hostname: 'images.unsplash.com' },
];
