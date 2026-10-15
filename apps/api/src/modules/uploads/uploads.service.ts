import { Inject, Injectable, Logger } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ERROR_CODES } from '@ck/types';
import { randomUUID } from 'node:crypto';
import { AppException } from '@/common/exceptions/app.exception';
import { CONFIG, type AppConfig } from '@/config';

/** Only formats we can safely serve back to a browser as an image or a PDF. */
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/**
 * First path segment in the bucket. Aliases keep older clients working:
 * `vendor` → kitchen photos, `product` → menu photos.
 */
export const PURPOSE_FOLDER = {
  kitchen: 'kitchen',
  vendor: 'kitchen',
  menu: 'menus',
  product: 'menus',
  avatar: 'avatars',
  review: 'reviews',
  banner: 'banners',
  document: 'documents',
} as const;

export const UPLOAD_PURPOSES = Object.keys(PURPOSE_FOLDER) as Array<
  keyof typeof PURPOSE_FOLDER
>;

const MAX_BYTES: Record<keyof typeof PURPOSE_FOLDER, number> = {
  kitchen: 5 * 1024 * 1024,
  vendor: 5 * 1024 * 1024,
  menu: 5 * 1024 * 1024,
  product: 5 * 1024 * 1024,
  avatar: 2 * 1024 * 1024,
  review: 3 * 1024 * 1024,
  banner: 5 * 1024 * 1024,
  document: 8 * 1024 * 1024,
};

const KNOWN_FOLDERS = new Set<string>(Object.values(PURPOSE_FOLDER));
const LEGACY_PURPOSES = new Set<string>(UPLOAD_PURPOSES);

const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const DOCUMENT_CACHE_CONTROL = 'private, no-store';

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const FILE_NAME_RE = /^[a-zA-Z0-9._-]+$/;

export type UploadPurpose = keyof typeof PURPOSE_FOLDER;

export interface StoredImageOwner {
  campusId: string;
  userId?: string;
  vendorId?: string;
  /** When false, any object in this campus folder is accepted (admin CMS). */
  requireOwner?: boolean;
  folders: readonly string[];
}

interface ParsedObjectKey {
  folder: string;
  campusId: string;
  ownerId: string;
}

/**
 * Uploads never pass through the API.
 *
 * The client asks for a presigned PUT, uploads straight to Amazon S3 and sends us
 * back only the public URL. The signature pins the content type, the exact byte
 * length, cache headers and a five-minute expiry. The object key is generated
 * server-side — a client can neither choose the folder nor overwrite someone else's file.
 *
 * Layout (purpose-first, campus-scoped, owner-scoped, UUID filename):
 *   kitchen/{campusId}/{vendorId}/{uuid}.jpg
 *   menus/{campusId}/{vendorId}/{uuid}.jpg
 *   avatars/{campusId}/{userId}/{uuid}.jpg
 *   reviews/{campusId}/{userId}/{uuid}.jpg
 *   banners/{campusId}/{userId}/{uuid}.jpg
 *   documents/{campusId}/{userId}/{uuid}.pdf
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly client: S3Client;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    this.client = new S3Client({
      region: config.storage.region,
      credentials: {
        accessKeyId: config.storage.accessKeyId,
        secretAccessKey: config.storage.secretAccessKey,
      },
      // Native AWS S3: omit endpoint so the SDK uses the regional AWS endpoint.
      // A custom endpoint is only for an S3-compatible host, never MinIO in this project.
      ...(config.storage.endpoint
        ? {
            endpoint: config.storage.endpoint,
            forcePathStyle: config.storage.forcePathStyle,
          }
        : {}),
    });
  }

  async createPresignedUpload(params: {
    userId: string;
    campusId: string;
    vendorId?: string;
    purpose: UploadPurpose;
    contentType: string;
    byteLength: number;
  }) {
    const extension = ALLOWED_MIME[params.contentType];
    if (!extension) {
      throw AppException.badRequest(
        ERROR_CODES.UNSUPPORTED_FILE_TYPE,
        'Upload a JPG, PNG, WebP image or a PDF.',
      );
    }

    if (params.contentType === 'application/pdf' && params.purpose !== 'document') {
      throw AppException.badRequest(
        ERROR_CODES.UNSUPPORTED_FILE_TYPE,
        'This upload must be an image.',
      );
    }

    const limit = MAX_BYTES[params.purpose] ?? MAX_BYTES.avatar;
    if (params.byteLength <= 0 || params.byteLength > limit) {
      throw AppException.badRequest(
        ERROR_CODES.FILE_TOO_LARGE,
        `Files for this upload must be under ${Math.round(limit / (1024 * 1024))} MB.`,
      );
    }

    const folder = PURPOSE_FOLDER[params.purpose];
    const ownerId = this.ownerIdFor(params.purpose, params.userId, params.vendorId);
    const key = [folder, params.campusId, ownerId, `${randomUUID()}.${extension}`].join('/');
    const cacheControl =
      params.purpose === 'document' ? DOCUMENT_CACHE_CONTROL : IMAGE_CACHE_CONTROL;

    const command = new PutObjectCommand({
      Bucket: this.config.storage.bucket,
      Key: key,
      ContentType: params.contentType,
      ContentLength: params.byteLength,
      CacheControl: cacheControl,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 300,
      signableHeaders: new Set(['content-type', 'content-length', 'cache-control']),
    });

    return {
      uploadUrl,
      key,
      publicUrl: this.publicUrl(key),
      expiresInSeconds: 300,
      requiredHeaders: {
        'Content-Type': params.contentType,
        'Content-Length': String(params.byteLength),
        'Cache-Control': cacheControl,
      },
    };
  }

  publicUrl(key: string): string {
    return `${this.canonicalPublicBase()}/${key}`;
  }

  /**
   * Confirms a persisted image URL is an object this caller is allowed to attach.
   * Without this a user could set `avatarUrl` / `coverUrl` to any object in the bucket
   * or to an arbitrary remote host.
   */
  assertPersistedImageUrl(url: string | undefined, owner: StoredImageOwner): void {
    if (!url) return;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw AppException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'That image URL is not valid.');
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw AppException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'That image URL is not valid.');
    }

    if (parsed.search || parsed.hash) {
      throw AppException.badRequest(
        ERROR_CODES.VALIDATION_FAILED,
        'Image URLs must not include query strings or fragments.',
      );
    }

    if (!this.config.isProduction && parsed.hostname === 'placehold.co') {
      return;
    }

    const key = this.keyFromPublicUrl(url);
    if (!key) {
      throw AppException.badRequest(
        ERROR_CODES.VALIDATION_FAILED,
        'Images must be uploaded through Campus Kitchen storage.',
      );
    }

    this.assertOwnedKey(key, owner);
  }

  /**
   * Confirms a key belongs to the caller before it is written onto a document.
   */
  assertOwnedKey(key: string, owner: StoredImageOwner | string, campusId?: string): void {
    const ctx: StoredImageOwner =
      typeof owner === 'string'
        ? { userId: owner, campusId: campusId ?? '', folders: [...KNOWN_FOLDERS], requireOwner: true }
        : owner;

    const parsed = this.parseObjectKey(key);
    if (!parsed) {
      throw AppException.forbidden('That upload does not belong to you.');
    }

    if (parsed.campusId !== ctx.campusId) {
      throw AppException.forbidden('That upload does not belong to you.');
    }

    if (ctx.folders.length && !ctx.folders.includes(parsed.folder)) {
      throw AppException.forbidden('That upload does not belong in this field.');
    }

    if (ctx.requireOwner === false) return;

    const allowedOwners = [ctx.userId, ctx.vendorId].filter(Boolean);
    if (!allowedOwners.includes(parsed.ownerId)) {
      throw AppException.forbidden('That upload does not belong to you.');
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.config.storage.bucket, Key: key }),
      );
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Could not delete stored object');
    }
  }

  private ownerIdFor(purpose: UploadPurpose, userId: string, vendorId?: string): string {
    const folder = PURPOSE_FOLDER[purpose];
    if ((folder === 'kitchen' || folder === 'menus') && vendorId) {
      return vendorId;
    }
    return userId;
  }

  private canonicalPublicBase(): string {
    const configured = this.config.storage.publicBaseUrl.replace(/\/+$/, '');
    try {
      const parsed = new URL(configured);
      parsed.hostname = parsed.hostname.replace(
        /^([a-z0-9][a-z0-9.-]*)\.s3\.([a-z0-9-]+)\.digitaloceanspaces\.com$/i,
        '$1.$2.digitaloceanspaces.com',
      );
      return parsed.origin;
    } catch {
      return configured;
    }
  }

  /**
   * Spaces has two virtual-hosted spellings. Objects uploaded to one must still
   * validate when the kitchen later saves a product that stores the other.
   */
  private publicBases(): string[] {
    const primary = this.canonicalPublicBase();
    const configured = this.config.storage.publicBaseUrl.replace(/\/+$/, '');
    const bases = new Set([primary, configured]);
    try {
      const parsed = new URL(primary);
      const host = parsed.hostname;
      const awsStyle = host.match(
        /^([a-z0-9][a-z0-9.-]*)\.s3\.([a-z0-9-]+)\.digitaloceanspaces\.com$/i,
      );
      const virtual = host.match(
        /^([a-z0-9][a-z0-9.-]*)\.([a-z0-9-]+)\.digitaloceanspaces\.com$/i,
      );
      if (awsStyle) {
        parsed.hostname = `${awsStyle[1]}.${awsStyle[2]}.digitaloceanspaces.com`;
        bases.add(parsed.origin);
      } else if (virtual && !host.includes('.s3.')) {
        parsed.hostname = `${virtual[1]}.s3.${virtual[2]}.digitaloceanspaces.com`;
        bases.add(parsed.origin);
      }
    } catch {
      // Config URL is already validated at boot.
    }
    return [...bases];
  }

  private keyFromPublicUrl(url: string): string | undefined {
    for (const base of this.publicBases()) {
      if (!url.startsWith(`${base}/`)) continue;
      const key = decodeURIComponent(url.slice(base.length + 1));
      if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
        return undefined;
      }
      return key;
    }
    return undefined;
  }

  private parseObjectKey(key: string): ParsedObjectKey | undefined {
    if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
      return undefined;
    }

    const parts = key.split('/');
    if (parts.length !== 4) return undefined;

    const [first, second, third, file] = parts;
    if (!first || !second || !third || !file || !FILE_NAME_RE.test(file)) {
      return undefined;
    }

    if (KNOWN_FOLDERS.has(first) && OBJECT_ID_RE.test(second) && OBJECT_ID_RE.test(third)) {
      return { folder: first, campusId: second, ownerId: third };
    }

    // Legacy keys: {campusId}/{purpose}/{userId}/{file}
    if (
      OBJECT_ID_RE.test(first) &&
      LEGACY_PURPOSES.has(second) &&
      OBJECT_ID_RE.test(third)
    ) {
      return {
        folder: PURPOSE_FOLDER[second as UploadPurpose],
        campusId: first,
        ownerId: third,
      };
    }

    return undefined;
  }
}
