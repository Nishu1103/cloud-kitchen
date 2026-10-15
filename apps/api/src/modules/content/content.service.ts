import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NOTIFICATION_TYPE, type PaginatedResult } from '@ck/types';
import { Model, Types } from 'mongoose';
import { AppException } from '@/common/exceptions/app.exception';
import { generateTicketCode } from '@/common/utils/crypto.util';
import { sanitizeRichText, stripTags } from '@/common/utils/html.util';
import { paginated } from '@/common/utils/pagination.util';
import {
  Banner,
  CmsPage,
  SupportTicket,
  type BannerDocument,
  type CmsPageDocument,
  type SupportTicketDocument,
} from '@/database/schemas';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { UploadsService } from '@/modules/uploads/uploads.service';
import type {
  CreateBannerDto,
  CreateTicketDto,
  ReplyTicketDto,
  UpsertPageDto,
} from './dto/content.dto';

/** CMS pages, merchandising banners and the support inbox. */
@Injectable()
export class ContentService {
  constructor(
    @InjectModel(CmsPage.name) private readonly pageModel: Model<CmsPageDocument>,
    @InjectModel(Banner.name) private readonly bannerModel: Model<BannerDocument>,
    @InjectModel(SupportTicket.name) private readonly ticketModel: Model<SupportTicketDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly uploads: UploadsService,
  ) {}

  async publicPage(campusId: string, slug: string) {
    const page = await this.pageModel
      .findOne({
        slug,
        status: 'published',
        // A page may be campus-specific or platform-wide (campusId null).
        $or: [{ campusId: new Types.ObjectId(campusId) }, { campusId: null }],
      })
      .select('title slug contentHtml metaDescription publishedAt updatedAt')
      .lean();
    if (!page) throw AppException.notFound('Page');
    return page;
  }

  async listPages(campusId: string) {
    return this.pageModel
      .find({ $or: [{ campusId: new Types.ObjectId(campusId) }, { campusId: null }] })
      .select('title slug status publishedAt updatedAt')
      .sort({ title: 1 })
      .lean();
  }

  async upsertPage(campusId: string, editorId: string, dto: UpsertPageDto) {
    const publish = dto.status === 'published';
    const page = await this.pageModel.findOneAndUpdate(
      { campusId: new Types.ObjectId(campusId), slug: dto.slug },
      {
        $set: {
          campusId: new Types.ObjectId(campusId),
          slug: dto.slug,
          title: stripTags(dto.title),
          // Sanitised on write, so the stored document is safe for every client that
          // later renders it, not just the one that happens to sanitise on read.
          contentHtml: sanitizeRichText(dto.contentHtml),
          metaDescription: dto.metaDescription ? stripTags(dto.metaDescription) : undefined,
          status: dto.status ?? 'draft',
          updatedBy: new Types.ObjectId(editorId),
          ...(publish ? { publishedAt: new Date() } : {}),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
    return page.toJSON();
  }

  async deletePage(campusId: string, slug: string) {
    const result = await this.pageModel.deleteOne({
      campusId: new Types.ObjectId(campusId),
      slug,
    });
    if (result.deletedCount === 0) throw AppException.notFound('Page');
    return { deleted: true };
  }

  /** Only banners whose schedule window is currently open are returned to shoppers. */
  async activeBanners(campusId: string, placement: string) {
    const now = new Date();
    return this.bannerModel
      .find({
        campusId: new Types.ObjectId(campusId),
        placement,
        isActive: true,
        $and: [
          { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
        ],
      })
      .select('title subtitle imageUrl deepLink placement sortOrder')
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(12)
      .lean();
  }

  async listBanners(campusId: string) {
    return this.bannerModel
      .find({ campusId: new Types.ObjectId(campusId) })
      .sort({ placement: 1, sortOrder: 1 })
      .lean();
  }

  async createBanner(campusId: string, dto: CreateBannerDto) {
    this.uploads.assertPersistedImageUrl(dto.imageUrl, {
      campusId,
      folders: ['banners'],
      requireOwner: false,
    });
    const banner = await this.bannerModel.create({
      ...dto,
      campusId: new Types.ObjectId(campusId),
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
    });
    return banner.toJSON();
  }

  async updateBanner(campusId: string, bannerId: string, dto: Partial<CreateBannerDto>) {
    this.uploads.assertPersistedImageUrl(dto.imageUrl, {
      campusId,
      folders: ['banners'],
      requireOwner: false,
    });
    const banner = await this.bannerModel.findOneAndUpdate(
      { _id: new Types.ObjectId(bannerId), campusId: new Types.ObjectId(campusId) },
      {
        $set: {
          ...dto,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        },
      },
      { new: true, runValidators: true },
    );
    if (!banner) throw AppException.notFound('Banner');
    return banner.toJSON();
  }

  async deleteBanner(campusId: string, bannerId: string) {
    const result = await this.bannerModel.deleteOne({
      _id: new Types.ObjectId(bannerId),
      campusId: new Types.ObjectId(campusId),
    });
    if (result.deletedCount === 0) throw AppException.notFound('Banner');
    return { deleted: true };
  }

  async createTicket(campusId: string, userId: string, dto: CreateTicketDto) {
    const ticket = await this.ticketModel.create({
      campusId: new Types.ObjectId(campusId),
      code: generateTicketCode(),
      raisedBy: new Types.ObjectId(userId),
      subject: dto.subject,
      category: dto.category,
      orderId: dto.orderId ? new Types.ObjectId(dto.orderId) : undefined,
      messages: [
        {
          authorId: new Types.ObjectId(userId),
          authorRole: 'customer',
          body: dto.message,
          createdAt: new Date(),
        },
      ],
    });
    return ticket.toJSON();
  }

  async listMyTickets(campusId: string, userId: string, page: number, limit: number) {
    const filter = {
      campusId: new Types.ObjectId(campusId),
      raisedBy: new Types.ObjectId(userId),
    };
    const [items, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.ticketModel.countDocuments(filter),
    ]);
    return paginated(items, total, page, limit);
  }

  async findMyTicket(campusId: string, userId: string, ticketId: string) {
    const ticket = await this.ticketModel
      .findOne({
        _id: new Types.ObjectId(ticketId),
        campusId: new Types.ObjectId(campusId),
        raisedBy: new Types.ObjectId(userId),
      })
      .lean();
    if (!ticket) throw AppException.notFound('Ticket');
    return ticket;
  }

  /** A customer may only append to their own ticket; staff replies go through `staffReply`. */
  async addMessage(campusId: string, userId: string, ticketId: string, dto: ReplyTicketDto) {
    const ticket = await this.ticketModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(ticketId),
        campusId: new Types.ObjectId(campusId),
        raisedBy: new Types.ObjectId(userId),
        status: { $ne: 'closed' },
      },
      {
        $push: {
          messages: {
            authorId: new Types.ObjectId(userId),
            authorRole: 'customer',
            body: dto.body,
            createdAt: new Date(),
          },
        },
        $set: { status: 'open' },
      },
      { new: true },
    );
    if (!ticket) throw AppException.notFound('Ticket');
    return ticket.toJSON();
  }

  async listTicketsForAdmin(
    campusId: string,
    params: { page: number; limit: number; status?: string },
  ): Promise<PaginatedResult<unknown>> {
    const filter: Record<string, unknown> = { campusId: new Types.ObjectId(campusId) };
    if (params.status) filter.status = params.status;

    const [items, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit)
        .lean(),
      this.ticketModel.countDocuments(filter),
    ]);
    return paginated(items, total, params.page, params.limit);
  }

  async staffReply(campusId: string, staffId: string, ticketId: string, dto: ReplyTicketDto) {
    const ticket = await this.ticketModel.findOneAndUpdate(
      { _id: new Types.ObjectId(ticketId), campusId: new Types.ObjectId(campusId) },
      {
        $push: {
          messages: {
            authorId: new Types.ObjectId(staffId),
            authorRole: 'agent',
            body: dto.body,
            createdAt: new Date(),
          },
        },
        $set: {
          status: dto.resolve ? 'resolved' : 'pending',
          assignedTo: new Types.ObjectId(staffId),
          ...(dto.resolve ? { resolvedAt: new Date() } : {}),
        },
      },
      { new: true },
    );
    if (!ticket) throw AppException.notFound('Ticket');

    await this.notificationsService.notify({
      userId: String(ticket.raisedBy),
      campusId,
      type: NOTIFICATION_TYPE.SUPPORT_REPLY,
      title: `Support replied to ${ticket.code}`,
      body: dto.body.slice(0, 120),
      deepLink: `/support/${ticketId}`,
    });

    return ticket.toJSON();
  }
}
