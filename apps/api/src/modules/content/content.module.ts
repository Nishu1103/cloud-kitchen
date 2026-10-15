import { Module } from '@nestjs/common';
import {
  AdminContentController,
  ContentController,
  SupportController,
} from './content.controller';
import { ContentService } from './content.service';

@Module({
  controllers: [ContentController, SupportController, AdminContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
