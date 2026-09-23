import crypto from 'node:crypto';

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.trim());
    // Strip tracking and session query parameters
    const paramsToStrip = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',
      'source',
      'fbclid',
      'gclid',
      'gh_src',
      'lever-source',
    ];
    paramsToStrip.forEach((p) => u.searchParams.delete(p));

    // Remove hash
    u.hash = '';

    // Remove trailing slash in pathname
    let path = u.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    u.pathname = path;

    return u.toString();
  } catch {
    return rawUrl.trim();
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateDeduplicationKey(
  company: string,
  title: string,
  url: string,
  nativeId?: string | number,
  source?: string
): string {
  const compSlug = slugify(company);
  if (nativeId && source) {
    return `${slugify(source)}:${compSlug}:${String(nativeId).trim()}`;
  }

  const cleanUrl = canonicalizeUrl(url);
  const cleanTitle = slugify(title);
  const hash = crypto
    .createHash('sha256')
    .update(`${compSlug}|${cleanTitle}|${cleanUrl}`)
    .digest('hex')
    .slice(0, 16);

  return `${compSlug}:${cleanTitle.slice(0, 24)}:${hash}`;
}
