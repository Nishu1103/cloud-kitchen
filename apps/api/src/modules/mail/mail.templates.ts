import { escapeHtml } from './mail.service';

const button = (href: string, label: string) => `
  <a href="${href}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#ea580c;color:#fff;text-decoration:none;font-weight:600;font-size:14px">${escapeHtml(label)}</a>`;

const paragraph = (text: string) =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3f3f46">${text}</p>`;

export const mailTemplates = {
  verifyEmail: (name: string, link: string) => ({
    subject: 'Confirm your Campus Kitchen email',
    html: `
      ${paragraph(`Hi ${escapeHtml(name)},`)}
      ${paragraph('Confirm your email address to start ordering from your campus kitchens.')}
      <div style="margin:22px 0">${button(link, 'Verify email')}</div>
      ${paragraph('This link expires in 24 hours and can be used once.')}`,
  }),

  passwordReset: (name: string, link: string) => ({
    subject: 'Reset your Campus Kitchen password',
    html: `
      ${paragraph(`Hi ${escapeHtml(name)},`)}
      ${paragraph('Use the button below to choose a new password.')}
      <div style="margin:22px 0">${button(link, 'Reset password')}</div>
      ${paragraph('This link expires in 30 minutes. If you did not request it, you can ignore this email - your password stays unchanged.')}`,
  }),

  passwordChanged: (name: string) => ({
    subject: 'Your Campus Kitchen password was changed',
    html: `
      ${paragraph(`Hi ${escapeHtml(name)},`)}
      ${paragraph('Your password was just changed and every other signed-in device was signed out.')}
      ${paragraph('If this was not you, contact campus support immediately.')}`,
  }),

  newLogin: (name: string, details: { ip?: string; device?: string; at: string }) => ({
    subject: 'New sign-in to your Campus Kitchen account',
    html: `
      ${paragraph(`Hi ${escapeHtml(name)},`)}
      ${paragraph('We noticed a new sign-in:')}
      <ul style="margin:0 0 14px;padding-left:18px;color:#3f3f46;font-size:14px;line-height:1.7">
        <li>When: ${escapeHtml(details.at)}</li>
        <li>Device: ${escapeHtml(details.device ?? 'Unknown')}</li>
        <li>IP: ${escapeHtml(details.ip ?? 'Unknown')}</li>
      </ul>
      ${paragraph('If this was not you, reset your password right away.')}`,
  }),

  orderReceipt: (params: {
    name: string;
    orderCode: string;
    vendorName: string;
    total: string;
    lines: Array<{ name: string; quantity: number; amount: string }>;
  }) => ({
    subject: `Order ${params.orderCode} confirmed`,
    html: `
      ${paragraph(`Hi ${escapeHtml(params.name)}, your order from ${escapeHtml(params.vendorName)} is confirmed.`)}
      <table role="presentation" width="100%" style="border-collapse:collapse;margin:16px 0;font-size:14px">
        ${params.lines
          .map(
            (line) => `<tr>
              <td style="padding:8px 0;border-bottom:1px solid #f1f1f4;color:#3f3f46">${escapeHtml(line.name)} x ${line.quantity}</td>
              <td style="padding:8px 0;border-bottom:1px solid #f1f1f4;text-align:right;color:#18181b">${escapeHtml(line.amount)}</td>
            </tr>`,
          )
          .join('')}
        <tr>
          <td style="padding:12px 0;font-weight:700">Total</td>
          <td style="padding:12px 0;text-align:right;font-weight:700">${escapeHtml(params.total)}</td>
        </tr>
      </table>
      ${paragraph(`Order reference: <strong>${escapeHtml(params.orderCode)}</strong>`)}`,
  }),

  vendorDecision: (
    name: string,
    outcome: 'approved' | 'rejected' | 'suspended',
    reason?: string,
  ) => {
    if (outcome === 'approved') {
      return {
        subject: 'Your kitchen is approved',
        html: `${paragraph(`Hi ${escapeHtml(name)},`)}${paragraph('Your kitchen has been approved. You can sign in to the vendor portal and publish your menu.')}`,
      };
    }
    if (outcome === 'suspended') {
      return {
        subject: 'Your kitchen has been suspended',
        html: `${paragraph(`Hi ${escapeHtml(name)},`)}${paragraph('Campus operations has suspended your kitchen. Students cannot order until it is reinstated.')}${reason ? paragraph(`Reason: ${escapeHtml(reason)}`) : ''}`,
      };
    }
    return {
      subject: 'Update on your kitchen application',
      html: `${paragraph(`Hi ${escapeHtml(name)},`)}${paragraph('We could not approve your kitchen application at this time.')}${reason ? paragraph(`Reason: ${escapeHtml(reason)}`) : ''}`,
    };
  },
};
