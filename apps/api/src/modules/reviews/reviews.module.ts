import { Module } from '@nestjs/common';
import { VendorsModule } from '@/modules/vendors/vendors.module';
import {
  AdminReviewsController,
  ReviewsController,
  VendorReviewsController,
} from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [VendorsModule],
  controllers: [ReviewsController, VendorReviewsController, AdminReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
