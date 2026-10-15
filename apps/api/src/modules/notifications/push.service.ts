import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging, type MulticastMessage } from 'firebase-admin/messaging';
import { Model, Types } from 'mongoose';
import { CONFIG, type AppConfig } from '@/config';
import { NotificationToken, type NotificationTokenDocument } from '@/database/schemas';

export interface PushPayload {
  title: string;
  body: string;
  imageUrl?: string;
  /** Relative path inside the portal, e.g. /orders/CK-7QF4KD. */
  deepLink?: string;
  /** FCM requires all data values to be strings. */
  data?: Record<string, string>;
  /** Collapses replaceable notifications, e.g. repeated updates for one order. */
  collapseKey?: string;
  urgent?: boolean;
}

const FCM_MULTICAST_LIMIT = 500;

/** FCM error codes that mean the token is permanently dead. */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Web push via Firebase Cloud Messaging.
 *
 * Reach, honestly stated: Android Chrome, desktop Chrome/Edge/Firefox, and iOS
 * Safari *only* when the site has been installed to the home screen as a PWA. A
 * plain iOS Safari tab cannot receive push at all, which is precisely why every
 * notification is also written to the in-app centre and, when it matters, emailed.
 * Push is an accelerator here, never the system of record.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private messaging?: Messaging;
  private app?: App;

  constructor(
    @InjectModel(NotificationToken.name)
    private readonly tokenModel: Model<NotificationTokenDocument>,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    if (!this.config.firebase.enabled) {
      this.logger.warn(
        'Firebase credentials absent - push disabled. In-app, realtime and email still deliver.',
      );
      return;
    }

    this.app =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: this.config.firebase.projectId,
          clientEmail: this.config.firebase.clientEmail,
          privateKey: this.config.firebase.privateKey,
        }),
      });
    this.messaging = getMessaging(this.app);
    this.logger.log('Firebase Cloud Messaging ready.');
  }

  get isEnabled(): boolean {
    return Boolean(this.messaging);
  }

  /** Registers or refreshes a device token. Idempotent by token. */
  async registerToken(params: {
    userId: string;
    campusId: string;
    token: string;
    platform: string;
    browser?: string;
    deviceLabel?: string;
  }): Promise<void> {
    await this.tokenModel.updateOne(
      { token: params.token },
      {
        $set: {
          userId: new Types.ObjectId(params.userId),
          campusId: new Types.ObjectId(params.campusId),
          platform: params.platform,
          browser: params.browser,
          deviceLabel: params.deviceLabel,
          lastSeenAt: new Date(),
          isActive: true,
          failureCount: 0,
        },
      },
      { upsert: true },
    );
  }

  async removeToken(userId: string, token: string): Promise<void> {
    await this.tokenModel.deleteOne({ token, userId: new Types.ObjectId(userId) });
  }

  /**
   * Sends to every active device of the given users and prunes tokens FCM rejects,
   * so the token table does not slowly fill with dead browsers.
   */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
    if (!this.messaging || !userIds.length) return { sent: 0, failed: 0 };

    const tokens = await this.tokenModel
      .find({
        userId: { $in: userIds.map((id) => new Types.ObjectId(id)) },
        isActive: true,
      })
      .select('token')
      .lean();

    if (!tokens.length) return { sent: 0, failed: 0 };
    return this.sendToTokens(
      tokens.map((entry) => entry.token),
      payload,
    );
  }

  async sendToTokens(
    tokens: string[],
    payload: PushPayload,
  ): Promise<{ sent: number; failed: number }> {
    if (!this.messaging || !tokens.length) return { sent: 0, failed: 0 };

    let sent = 0;
    let failed = 0;
    const deadTokens: string[] = [];

    for (let index = 0; index < tokens.length; index += FCM_MULTICAST_LIMIT) {
      const batch = tokens.slice(index, index + FCM_MULTICAST_LIMIT);
      const message = this.buildMessage(batch, payload);

      try {
        const response = await this.messaging.sendEachForMulticast(message);
        sent += response.successCount;
        failed += response.failureCount;

        response.responses.forEach((result, position) => {
          if (result.success) return;
          const code = result.error?.code ?? '';
          const token = batch[position];
          if (token && DEAD_TOKEN_CODES.has(code)) deadTokens.push(token);
        });
      } catch (error) {
        failed += batch.length;
        this.logger.error({ err: error }, 'FCM multicast failed');
      }
    }

    if (deadTokens.length) {
      await this.tokenModel.deleteMany({ token: { $in: deadTokens } });
      this.logger.log(`Pruned ${deadTokens.length} dead push token(s).`);
    }

    return { sent, failed };
  }

  private buildMessage(tokens: string[], payload: PushPayload): MulticastMessage {
    const data: Record<string, string> = { ...(payload.data ?? {}) };
    if (payload.deepLink) data.deepLink = payload.deepLink;

    return {
      tokens,
      // Title/body live in `notification` so the service worker can display them
      // without the page being open.
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
      data,
      android: {
        priority: payload.urgent ? 'high' : 'normal',
        ...(payload.collapseKey ? { collapseKey: payload.collapseKey } : {}),
        notification: { channelId: payload.urgent ? 'orders_urgent' : 'orders' },
      },
      apns: {
        headers: {
          'apns-priority': payload.urgent ? '10' : '5',
          ...(payload.collapseKey ? { 'apns-collapse-id': payload.collapseKey } : {}),
        },
        payload: { aps: { sound: payload.urgent ? 'default' : undefined, badge: 1 } },
      },
      webpush: {
        headers: {
          Urgency: payload.urgent ? 'high' : 'normal',
          TTL: payload.urgent ? '600' : '3600',
        },
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-72.png',
          requireInteraction: payload.urgent ?? false,
          ...(payload.collapseKey ? { tag: payload.collapseKey } : {}),
        },
        fcmOptions: payload.deepLink ? { link: payload.deepLink } : undefined,
      },
    };
  }
}
