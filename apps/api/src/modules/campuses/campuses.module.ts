import { Module } from '@nestjs/common';
import { AdminCampusesController, CampusesController } from './campuses.controller';
import { CampusesService } from './campuses.service';

@Module({
  controllers: [CampusesController, AdminCampusesController],
  providers: [CampusesService],
  exports: [CampusesService],
})
export class CampusesModule {}
