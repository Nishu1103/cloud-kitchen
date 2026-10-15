import { Global, Module } from '@nestjs/common';
import { TenantResolverService } from './tenant-resolver.service';

/** Global because the tenant guard runs on every request. */
@Global()
@Module({
  providers: [TenantResolverService],
  exports: [TenantResolverService],
})
export class TenantModule {}
