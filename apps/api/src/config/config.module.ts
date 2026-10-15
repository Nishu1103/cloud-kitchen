import { Global, Module } from '@nestjs/common';
import { CONFIG } from './configuration';
import { loadAppConfig } from './load';

@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: loadAppConfig }],
  exports: [CONFIG],
})
export class AppConfigModule {}
