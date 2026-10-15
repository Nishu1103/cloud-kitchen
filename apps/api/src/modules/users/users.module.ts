import { Module } from '@nestjs/common';
import { AdminUsersController, MeController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [MeController, AdminUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
