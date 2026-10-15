import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { CONFIG, type AppConfig } from '@/config';
import {
  Announcement,
  AnnouncementSchema,
  AuditLog,
  AuditLogSchema,
  Banner,
  BannerSchema,
  Campus,
  CampusSchema,
  Cart,
  CartSchema,
  Category,
  CategorySchema,
  CmsPage,
  CmsPageSchema,
  Coupon,
  CouponRedemption,
  CouponRedemptionSchema,
  CouponSchema,
  DeliveryAssignment,
  DeliveryAssignmentSchema,
  DeliveryProfile,
  DeliveryProfileSchema,
  FeatureFlag,
  FeatureFlagSchema,
  Notification,
  NotificationSchema,
  NotificationToken,
  NotificationTokenSchema,
  Order,
  OrderSchema,
  Payment,
  PaymentSchema,
  Product,
  ProductSchema,
  Review,
  ReviewSchema,
  Role,
  RoleSchema,
  Session,
  SessionSchema,
  Setting,
  SettingSchema,
  SupportTicket,
  SupportTicketSchema,
  User,
  UserSchema,
  Vendor,
  VendorSchema,
  WalletTransaction,
  WalletTransactionSchema,
} from './schemas';

const MODELS = [
  { name: Announcement.name, schema: AnnouncementSchema },
  { name: AuditLog.name, schema: AuditLogSchema },
  { name: Banner.name, schema: BannerSchema },
  { name: Campus.name, schema: CampusSchema },
  { name: Cart.name, schema: CartSchema },
  { name: Category.name, schema: CategorySchema },
  { name: CmsPage.name, schema: CmsPageSchema },
  { name: Coupon.name, schema: CouponSchema },
  { name: CouponRedemption.name, schema: CouponRedemptionSchema },
  { name: DeliveryAssignment.name, schema: DeliveryAssignmentSchema },
  { name: DeliveryProfile.name, schema: DeliveryProfileSchema },
  { name: FeatureFlag.name, schema: FeatureFlagSchema },
  { name: Notification.name, schema: NotificationSchema },
  { name: NotificationToken.name, schema: NotificationTokenSchema },
  { name: Order.name, schema: OrderSchema },
  { name: Payment.name, schema: PaymentSchema },
  { name: Product.name, schema: ProductSchema },
  { name: Review.name, schema: ReviewSchema },
  { name: Role.name, schema: RoleSchema },
  { name: Session.name, schema: SessionSchema },
  { name: Setting.name, schema: SettingSchema },
  { name: SupportTicket.name, schema: SupportTicketSchema },
  { name: User.name, schema: UserSchema },
  { name: Vendor.name, schema: VendorSchema },
  { name: WalletTransaction.name, schema: WalletTransactionSchema },
];

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (config: AppConfig) => {
        /**
         * Operator injection is stopped at the HTTP edge by SanitizeMiddleware, which
         * strips `$`-prefixed and dotted keys from body, query and params before any
         * filter is built. Mongoose's `sanitizeFilter` is deliberately *not* enabled:
         * it rewrites every operator object into `$eq`, including the ones our own
         * repositories write (`$exists`, `$in`, `$gte`), which turns a legitimate query
         * into a cast error at runtime. Blocking untrusted operators at the boundary is
         * the check that can't be forgotten; `trusted()` sprinkled over 200 call sites
         * is the one that can.
         */
        mongoose.set('strictQuery', true);
        if (!config.isProduction) mongoose.set('debug', false);

        return {
          uri: config.mongo.uri,
          // Indexes are built explicitly by migrations in production, never implicitly.
          autoIndex: !config.isProduction,
          autoCreate: !config.isProduction,
          maxPoolSize: 20,
          minPoolSize: 2,
          serverSelectionTimeoutMS: 8_000,
          socketTimeoutMS: 45_000,
          retryWrites: true,
          // Reads and writes must survive a primary election without losing data.
          writeConcern: { w: 'majority', journal: true },
          readPreference: 'primaryPreferred',
        };
      },
    }),
    MongooseModule.forFeature(MODELS),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
