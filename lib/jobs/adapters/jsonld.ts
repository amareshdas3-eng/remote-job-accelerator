import type { NormalizedJob } from '../types.ts';
import { normalizeJobRecord, stripHtml } from '../normalizer.ts';

export function extractJsonLdJob(html: string, pageUrl: string): NormalizedJob | null {
  try {
    // Look for application/ld+json script tags
    const matches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

    for (const m of matches) {
      try {
        const json = JSON.parse(m[1].trim());
        const candidate = Array.isArray(json) ? json.find((x) => x['@type'] === 'JobPosting') : (json['@type'] === 'JobPosting' ? json : null);

        if (candidate) {
          const title = candidate.title || '';
          const company =
            typeof candidate.hiringOrganization === 'object'
              ? candidate.hiringOrganization.name
              : candidate.hiringOrganization || new URL(pageUrl).hostname;
          const description = candidate.description || '';
          const datePosted = candidate.datePosted || new Date().toISOString();

          let salary: string | undefined;
          if (candidate.baseSalary) {
            const val = candidate.baseSalary.value;
            if (typeof val === 'object' && val.minValue && val.maxValue) {
              salary = `$${val.minValue} – $${val.maxValue} ${val.unitText || ''}`.trim();
            } else if (typeof val === 'number' || typeof val === 'string') {
              salary = String(val);
            }
          }

          let location = '100% Remote';
          if (candidate.jobLocationType === 'TELECOMMUTE' || candidate.applicantLocationRequirements) {
            location = '100% Remote';
          } else if (candidate.jobLocation?.address?.addressLocality) {
            location = candidate.jobLocation.address.addressLocality;
          }

          if (title && company) {
            return normalizeJobRecord({
              title,
              company,
              url: pageUrl,
              description,
              salary,
              location,
              source: `Web (${new URL(pageUrl).hostname})`,
              published_at: datePosted,
            });
          }
        }
      } catch {
        // Continue to next script tag
      }
    }
  } catch {
    // Ignore JSON-LD parse errors
  }

  // Fallback: OpenGraph tags & Title extraction
  try {
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*name=["']title["'][^>]*content=["']([^"']*)["']/i);
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    const ogSiteMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*)["']/i);
    const titleTagMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);

    const fullTitle = ogTitleMatch?.[1] || titleTagMatch?.[1] || '';
    const desc = ogDescMatch?.[1] || stripHtml(html).slice(0, 15000);

    if (!fullTitle) return null;

    // Separate "Title at Company" or "Title - Company"
    let title = fullTitle;
    let company = ogSiteMatch?.[1] || new URL(pageUrl).hostname;

    if (fullTitle.includes(' at ')) {
      const parts = fullTitle.split(' at ');
      title = parts[0];
      company = parts.slice(1).join(' at ');
    } else if (fullTitle.includes(' - ')) {
      const parts = fullTitle.split(' - ');
      title = parts[0];
      company = parts.slice(1).join(' - ');
    } else if (fullTitle.includes(' | ')) {
      const parts = fullTitle.split(' | ');
      title = parts[0];
      company = parts.slice(1).join(' | ');
    }

    return normalizeJobRecord({
      title: title.trim(),
      company: company.trim(),
      url: pageUrl,
      description: desc,
      source: `Web (${new URL(pageUrl).hostname})`,
    });
  } catch {
    return null;
  }
}
