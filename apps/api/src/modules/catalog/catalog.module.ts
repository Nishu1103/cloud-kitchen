import { Module } from '@nestjs/common';
import {
  AdminCategoriesController,
  CatalogController,
  VendorMenuController,
} from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController, VendorMenuController, AdminCategoriesController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
