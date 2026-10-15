import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  categoryPreferenceKey,
  channelPreferenceKey,
  ERROR_CODES,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PREFERENCE_KEYS,
  NOTIFICATION_REGISTRY,
  WS_EVENTS,
  type NotificationChannel,
  type NotificationType,
  type PaginatedResult,
} from '@ck/types';
import { Model, Types } from 'mongoose';
import { AppException } from '@/common/exceptions/app.exception';
import { paginated } from '@/common/utils/pagination.util';
import {
  Notification,
  User,
  type NotificationDocument,
  type UserDocument,
} from '@/database/schemas';
import { MailService } from '@/modules/mail/mail.service';
import { QUEUES, QueueService } from '@/modules/queue/queue.service';
import { NotificationsGateway } from './notifications.gateway';
import { PushService } from './push.service';

export interface NotifyInput {
  userId: string;
  campusId: string;
  type: NotificationType;
  title: string;
  body: string;
  imageUrl?: string;
  deepLink?: string;
  data?: Record<string, string>;
  /** Overrides the registry default when a caller needs to narrow channels. */
  channels?: NotificationChannel[];
  collapseKey?: string;
  email?: { subject: string; html: string };
}

interface NotificationJob {
  notificationId: string;
  userId: string;
  channels: NotificationChannel[];
  payload: {
    title: string;
    body: string;
    imageUrl?: string;
    deepLink?: string;
    data?: Record<string, string>;
    collapseKey?: string;
    urgent: boolean;
  };
  email?: { subject: string; html: string };
}

/**
 * One entry point for every notification in the platform.
 *
 * The in-app record is written synchronously so the notification exists the moment
 * the triggering action commits; push, email and SMS are handed to a worker. That
 * ordering matters: a student must be able to open the app and see "order ready"
 * even if their browser denied push, FCM was down, or they are on an iPhone that
 * never installed the PWA.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly pushService: PushService,
    private readonly gateway: NotificationsGateway,
    private readonly mailService: MailService,
    private readonly queueService: QueueService,
  ) {}

  onModuleInit(): void {
    this.queueService.registerWorker<NotificationJob>(
      QUEUES.NOTIFICATIONS,
      async (job) => this.deliver(job.data),
      10,
    );
  }

  async notify(input: NotifyInput): Promise<{ notificationId: string }> {
    const meta = NOTIFICATION_REGISTRY[input.type];
    const channels = input.channels ?? meta.channels;

    // Non-transactional notifications respect the user's mute preferences;
    // order and payment updates always go through.
    const allowed = meta.transactional
      ? channels
      : await this.filterByPreferences(input.userId, input.type, channels);

    const notification = await this.notificationModel.create({
      campusId: new Types.ObjectId(input.campusId),
      userId: new Types.ObjectId(input.userId),
      type: input.type,
      category: meta.category,
      title: input.title,
      body: input.body,
      imageUrl: input.imageUrl,
      deepLink: input.deepLink,
      data: input.data ?? {},
      deliveredChannels: allowed.includes(NOTIFICATION_CHANNEL.IN_APP)
        ? [NOTIFICATION_CHANNEL.IN_APP]
        : [],
    });

    // Anything already on screen updates instantly, with no reload and no push.
    if (allowed.includes(NOTIFICATION_CHANNEL.REALTIME)) {
      this.gateway.emitToUser(input.userId, WS_EVENTS.NOTIFICATION_NEW, {
        id: String(notification._id),
        type: input.type,
        category: meta.category,
        title: input.title,
        body: input.body,
        deepLink: input.deepLink,
        createdAt: new Date().toISOString(),
      });
      void this.emitUnreadCount(input.userId);
    }

    const needsWorker =
      allowed.includes(NOTIFICATION_CHANNEL.PUSH) || allowed.includes(NOTIFICATION_CHANNEL.EMAIL);

    if (needsWorker) {
      await this.queueService.enqueue<NotificationJob>(QUEUES.NOTIFICATIONS, input.type, {
        notificationId: String(notification._id),
        userId: input.userId,
        channels: allowed,
        payload: {
          title: input.title,
          body: input.body,
          imageUrl: input.imageUrl,
          deepLink: input.deepLink,
          data: { ...(input.data ?? {}), type: input.type },
          collapseKey: input.collapseKey,
          urgent: meta.transactional,
        },
        email: input.email,
      });
    }

    return { notificationId: String(notification._id) };
  }

  /** Fan-out helper for broadcasts; batches to keep memory flat on large campuses. */
  async notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>): Promise<number> {
    let queued = 0;
    for (const userId of userIds) {
      await this.notify({ ...input, userId });
      queued += 1;
    }
    return queued;
  }

  async list(
    userId: string,
    params: { page: number; limit: number; unreadOnly?: boolean },
  ): Promise<PaginatedResult<unknown> & { unread: number }> {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (params.unreadOnly) filter.readAt = { $exists: false };

    // The unread total is returned with the page so the badge and the list can never
    // disagree, which they do if the client counts unread rows in the current page.
    const [items, total, unread] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit)
        .lean(),
      this.notificationModel.countDocuments(filter),
      this.unreadCount(userId),
    ]);

    return { ...paginated(items, total, params.page, params.limit), unread };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      readAt: { $exists: false },
    });
  }

  async markRead(userId: string, notificationIds: string[]): Promise<{ updated: number }> {
    const result = await this.notificationModel.updateMany(
      {
        _id: { $in: notificationIds.map((id) => new Types.ObjectId(id)) },
        // Scoped to the caller so one user cannot mark another's notifications read.
        userId: new Types.ObjectId(userId),
        readAt: { $exists: false },
      },
      { $set: { readAt: new Date() } },
    );
    void this.emitUnreadCount(userId);
    return { updated: result.modifiedCount };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), readAt: { $exists: false } },
      { $set: { readAt: new Date() } },
    );
    void this.emitUnreadCount(userId);
    return { updated: result.modifiedCount };
  }

  async preferences(userId: string): Promise<Record<string, boolean>> {
    const user = await this.userModel
      .findById(userId)
      .select('notificationPreferences')
      .lean();
    return user?.notificationPreferences ?? {};
  }

  /**
   * Patch semantics, not replace: a portal that only renders three toggles must not
   * wipe the preferences set by another one. Unknown keys are dropped rather than
   * stored, so a client cannot grow the user document with arbitrary fields.
   */
  async updatePreferences(
    userId: string,
    preferences: Record<string, boolean>,
  ): Promise<Record<string, boolean>> {
    const update: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(preferences)) {
      if (NOTIFICATION_PREFERENCE_KEYS.includes(key)) {
        update[`notificationPreferences.${key}`] = value;
      }
    }

    if (!Object.keys(update).length) {
      throw AppException.unprocessable(
        ERROR_CODES.VALIDATION_FAILED,
        'No known notification preferences in the request.',
      );
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: update }, { new: true })
      .select('notificationPreferences')
      .lean();
    return user?.notificationPreferences ?? {};
  }

  private async deliver(job: NotificationJob): Promise<void> {
    const delivered: NotificationChannel[] = [];

    if (job.channels.includes(NOTIFICATION_CHANNEL.PUSH) && this.pushService.isEnabled) {
      const result = await this.pushService.sendToUsers([job.userId], job.payload);
      if (result.sent > 0) delivered.push(NOTIFICATION_CHANNEL.PUSH);
    }

    if (job.channels.includes(NOTIFICATION_CHANNEL.EMAIL) && job.email) {
      const user = await this.userModel.findById(job.userId).select('email name').lean();
      if (user?.email) {
        await this.mailService.send({
          to: user.email,
          subject: job.email.subject,
          html: job.email.html,
        });
        delivered.push(NOTIFICATION_CHANNEL.EMAIL);
      }
    }

    if (delivered.length) {
      await this.notificationModel.updateOne(
        { _id: new Types.ObjectId(job.notificationId) },
        { $addToSet: { deliveredChannels: { $each: delivered } } },
      );
    }
  }

  private async emitUnreadCount(userId: string): Promise<void> {
    const unread = await this.unreadCount(userId);
    this.gateway.emitToUser(userId, WS_EVENTS.NOTIFICATION_COUNT, { unread });
  }

  /**
   * Preferences are stored per notification category, so a student can silence
   * promotions without losing "your order is ready".
   */
  private async filterByPreferences(
    userId: string,
    type: NotificationType,
    channels: NotificationChannel[],
  ): Promise<NotificationChannel[]> {
    const user = await this.userModel
      .findById(userId)
      .select('notificationPreferences')
      .lean();
    const preferences = user?.notificationPreferences ?? {};
    const category = NOTIFICATION_REGISTRY[type].category;

    if (preferences[categoryPreferenceKey(category)] === false) {
      // Still recorded in the centre, just never pushed or emailed.
      return channels.filter((channel) => channel === NOTIFICATION_CHANNEL.IN_APP);
    }
    return channels.filter(
      (channel) => preferences[channelPreferenceKey(channel)] !== false,
    );
  }
}
