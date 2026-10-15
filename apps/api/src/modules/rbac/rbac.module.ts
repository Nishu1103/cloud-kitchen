import { Global, Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

/**
 * Global because the authentication guard depends on `AuthorizationService` on
 * every request, and guards are registered at the application root.
 */
@Global()
@Module({
  controllers: [RolesController],
  providers: [AuthorizationService, RolesService],
  exports: [AuthorizationService],
})
export class RbacModule {}
