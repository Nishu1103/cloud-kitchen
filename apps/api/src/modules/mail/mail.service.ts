import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { CONFIG, type AppConfig } from '@/config';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Escapes interpolated values so a display name can never inject markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    this.transporter = createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      ...(config.mail.user
        ? { auth: { user: config.mail.user, pass: config.mail.password } }
        : {}),
      pool: true,
      maxConnections: 5,
      // Never fall back to plaintext against a real provider.
      requireTLS: config.isProduction,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.mail.from,
      to: message.to,
      subject: message.subject,
      html: this.layout(message.subject, message.html),
      text: message.text ?? this.toPlainText(message.html),
    });
    this.logger.log(`Sent "${message.subject}" to ${this.maskEmail(message.to)}`);
  }

  private layout(title: string, content: string): string {
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
    <tr><td style="padding:24px 28px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff">
      <div style="font-size:18px;font-weight:700;letter-spacing:-.01em">Campus Kitchen</div>
    </td></tr>
    <tr><td style="padding:28px">${content}</td></tr>
    <tr><td style="padding:18px 28px;background:#fafafa;color:#71717a;font-size:12px;line-height:1.5">
      You are receiving this because you have a Campus Kitchen account.
      If this was not you, please contact campus support.
    </td></tr>
  </table>
</body></html>`;
  }

  private toPlainText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Log hygiene: addresses are PII, so they are never written in full. */
  private maskEmail(email: string): string {
    const [local = '', domain = ''] = email.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }
}
