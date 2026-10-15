import { Global, Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { AdminPlatformController, PlatformController } from './platform.controller';
import { SettingsService } from './settings.service';

/** Global: pricing, ordering and the feature-flag guard all read configuration. */
@Global()
@Module({
  controllers: [PlatformController, AdminPlatformController],
  providers: [SettingsService, FeatureFlagsService],
  exports: [SettingsService, FeatureFlagsService],
})
export class PlatformModule {}
