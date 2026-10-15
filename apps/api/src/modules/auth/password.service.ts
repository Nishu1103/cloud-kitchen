import { Inject, Injectable } from '@nestjs/common';
import { CONFIG, type AppConfig } from '@/config';
import { hashPassword, verifyPassword } from './password.util';

/** Thin injectable wrapper so the pepper comes from validated config, not a global. */
@Injectable()
export class PasswordService {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  hash(plain: string): Promise<string> {
    return hashPassword(plain, this.config.auth.passwordPepper);
  }

  verify(digest: string, plain: string): Promise<boolean> {
    return verifyPassword(digest, plain, this.config.auth.passwordPepper);
  }
}
