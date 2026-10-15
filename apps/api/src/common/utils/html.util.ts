import sanitizeHtml from 'sanitize-html';

/**
 * Sanitises admin-authored rich text before it is stored.
 *
 * CMS pages are the one place where a privileged user's input is later rendered as HTML
 * in every student's browser. Sanitising on write means a compromised or careless admin
 * account cannot plant a script that runs on the platform's own origin, and the stored
 * document stays safe no matter which client renders it later.
 *
 * The allowlist is deliberately small: policy pages need headings, lists, links and
 * emphasis, not embeds, forms or inline styles.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'hr',
    'h2',
    'h3',
    'h4',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'blockquote',
    'ul',
    'ol',
    'li',
    'a',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'img',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'width', 'height'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  // No `javascript:` or `data:` URLs, which are the usual way an anchor becomes a script.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  transformTags: {
    // An external link opened in a new tab must not be able to reach back into ours.
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }),
  },
  disallowedTagsMode: 'discard',
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/** Strips every tag, for fields that must be plain text (titles, meta descriptions). */
export function stripTags(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}
