import { Global, Module } from '@nestjs/common';
import { AdminAnnouncementsController, VendorAnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

/**
 * Global so any feature module can emit a notification without importing a chain
 * of dependencies. The gateway is exported too, since order and delivery flows push
 * live board updates that are not notifications.
 */
@Global()
@Module({
  controllers: [
    NotificationsController,
    AdminAnnouncementsController,
    VendorAnnouncementsController,
  ],
  providers: [
    NotificationsService,
    NotificationsGateway,
    PushService,
    AnnouncementsService,
  ],
  exports: [NotificationsService, NotificationsGateway, PushService],
})
export class NotificationsModule {}
