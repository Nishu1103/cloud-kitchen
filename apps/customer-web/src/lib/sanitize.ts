import DOMPurify from 'isomorphic-dompurify';

/**
 * Second sanitisation pass for admin-authored CMS HTML.
 *
 * The API already sanitises on write; this runs again on render because content that
 * predates that rule, or arrives from a compromised admin session, would otherwise be
 * injected straight into the page. Sanitising in both places costs nothing and means no
 * single mistake is enough to produce stored XSS.
 */
const ALLOWED_TAGS = [
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
];

export function sanitizeCmsHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan'],
    ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel):/i,
    ADD_ATTR: ['target', 'rel'],
  });
}
