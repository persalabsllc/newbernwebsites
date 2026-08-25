import { createHash } from 'node:crypto';
import { getAllProspects, saveManualProspect, type StoredOutreachLead } from './prospect-store';
import { cleanProspectKey, type AuditFinding } from './prospect-utils';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NEW_BERN = { latitude: 35.1085, longitude: -77.0441 };
const RADIUS_METERS = 120_700;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 750_000;

type OverpassElement = {
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
};

export type ProspectResearchOptions = {
  limit?: number;
  maxChecked?: number;
  startOffset?: number;
};

export type ProspectResearchResult = {
  radiusMiles: number;
  discovered: number;
  eligible: number;
  checked: number;
  saved: number;
  skipped: number;
  rejectionCounts: Record<string, number>;
  startOffset: number;
  nextOffset: number;
  totalProspects: number;
  prospects: Array<{ key: string; business: string; location?: string; category?: string }>;
};

type CandidateResult =
  | { lead: StoredOutreachLead; reason?: never }
  | { lead: null; reason: string };

const excludedMailboxPrefixes = new Set(['example', 'noreply', 'no-reply', 'donotreply', 'webmaster']);
const nationalChains = /\b(walmart|walgreens|cvs|mcdonald|starbucks|subway|domino|lowe'?s|home depot|dollar general|food lion|autozone|o'?reilly|enterprise rent-a-car)\b/i;

function normalizeWebsite(value: string | undefined) {
  if (!value) return '';
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || unsafeHostname(url.hostname)) return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function unsafeHostname(hostname: string) {
  const host = hostname.toLowerCase();
  return host === 'localhost'
    || host.endsWith('.local')
    || host === '0.0.0.0'
    || host === '127.0.0.1'
    || host === '::1'
    || /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    || /^169\.254\./.test(host);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase().replace(/^mailto:/, '').split(/[?;,\s]/)[0];
}

function validPublicEmail(value: string) {
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value) || value.length > 254) return false;
  const prefix = value.split('@')[0];
  return !excludedMailboxPrefixes.has(prefix) && !/\.(png|jpg|jpeg|gif|webp)$/i.test(value);
}

function decodeEntities(value: string) {
  return value
    .replace(/&#64;|&#x40;|\[at\]/gi, '@')
    .replace(/&#46;|&#x2e;|\[dot\]/gi, '.')
    .replace(/&amp;/gi, '&');
}

function extractEmails(html: string) {
  const decoded = decodeEntities(html);
  const matches = decoded.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const mailtos = Array.from(decoded.matchAll(/mailto:([^"'\s>]+)/gi), match => match[1]);
  return [...new Set([...mailtos, ...matches].map(normalizeEmail).filter(validPublicEmail))];
}

function preferredEmail(emails: string[], website: string) {
  const host = new URL(website).hostname.replace(/^www\./, '');
  return emails.toSorted((a, b) => {
    const score = (value: string) => {
      const domain = value.split('@')[1];
      const prefix = value.split('@')[0];
      return (domain === host || host.endsWith(`.${domain}`) ? 10 : 0)
        + (/^(info|hello|contact|office|sales|admin|service)$/.test(prefix) ? 4 : 0);
    };
    return score(b) - score(a);
  })[0] || '';
}

function textOnly(html: string) {
  return decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

async function safeHtml(url: string) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'NewBernWebsitesBot/1.0 (+https://www.newbernwebsites.com/)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) return null;
  if (unsafeHostname(new URL(response.url).hostname)) return null;
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_HTML_BYTES) return null;
  const html = (await response.text()).slice(0, MAX_HTML_BYTES);
  return { html, finalUrl: response.url };
}

function contactUrl(html: string, website: string) {
  const hrefs = Array.from(html.matchAll(/href=["']([^"']+)["']/gi), match => match[1]);
  const candidate = hrefs.find(href => /contact|about|team|get-in-touch/i.test(href));
  if (!candidate) return '';
  try {
    const url = new URL(candidate, website);
    const home = new URL(website);
    return url.hostname === home.hostname && !unsafeHostname(url.hostname) ? url.toString() : '';
  } catch {
    return '';
  }
}

function businessCategory(tags: Record<string, string>) {
  return tags.craft || tags.office || tags.shop || tags.amenity || tags.tourism || tags.leisure || 'local business';
}

function readableCategory(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function locationLabel(tags: Record<string, string>) {
  return tags['addr:city'] || tags['contact:city'] || tags['addr:county'] || 'Eastern North Carolina';
}

function auditSite(input: { html: string; finalUrl: string; business: string; category: string }) {
  const { html, finalUrl, business, category } = input;
  const pageText = textOnly(html);
  const findings: AuditFinding[] = [];
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
    findings.push({ title: 'The mobile foundation needs attention', detail: 'The homepage does not expose a standard mobile viewport signal, which can make the experience harder to use on the phones where many local customers begin.' });
  }
  if (!/<meta[^>]+name=["']description["'][^>]+content=["'][^"']{40,}/i.test(html) && !/<meta[^>]+content=["'][^"']{40,}["'][^>]+name=["']description["']/i.test(html)) {
    findings.push({ title: 'The search result can make a stronger first impression', detail: 'The homepage does not appear to provide a useful search description explaining the business, service area, and reason to click.' });
  }
  if (!/<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(html)) {
    findings.push({ title: 'The primary message is not clearly structured', detail: `A focused main heading can tell visitors—and search engines—what ${business} does and where it works without making them interpret the page.` });
  }
  if (!/<form\b/i.test(html) && !/mailto:|tel:/i.test(html)) {
    findings.push({ title: 'The next step can be easier to find', detail: 'The homepage does not expose a direct form, email, or telephone action in its page markup, adding friction for ready prospects.' });
  }
  const years = Array.from(pageText.matchAll(/(?:©|copyright)?\s*(20\d{2})/gi), match => Number(match[1])).filter(year => year >= 2000 && year <= new Date().getFullYear());
  const latestYear = years.length ? Math.max(...years) : 0;
  if (latestYear && latestYear < new Date().getFullYear() - 1) {
    findings.push({ title: 'Freshness and trust signals can be updated', detail: `The visible copyright language appears to stop at ${latestYear}. Small maintenance signals can influence trust when a customer is comparing local providers.` });
  }
  if (!finalUrl.startsWith('https://')) {
    findings.push({ title: 'The secure experience should be consistent', detail: 'The page resolved without HTTPS, which can create browser warnings and weaken confidence before a customer contacts the business.' });
  }
  if (findings.length < 3) {
    findings.push(
      { title: 'The service path can be more specific', detail: `Dedicated ${readableCategory(category).toLowerCase()} service pages can answer buyer questions and create stronger local-search entry points.` },
      { title: 'The strongest proof can move closer to the decision', detail: 'Recent work, testimonials, credentials, and service-area details are most useful when they appear beside the next action instead of living in separate corners of the site.' },
      { title: 'The mobile call-to-action can stay within reach', detail: 'A persistent, uncluttered call or quote action can help high-intent visitors respond without searching through the navigation.' },
    );
  }
  return findings.slice(0, 3);
}

function firstTouchBody(input: { business: string; observation: string; category: string }) {
  return [
    `Hi ${input.business} team,`,
    '',
    `I was reviewing your website and noticed one specific opportunity: ${input.observation}`,
    '',
    `I run New Bern Websites locally. We build complete, mobile-first websites for Eastern North Carolina businesses and handle the design, copy, launch, hosting, and local-search foundation.`,
    '',
    `I also put together a short private audit for ${input.business}. If you would like the link, reply “send it” and I’ll send it over—no meeting required.`,
    '',
    'Kyle',
    'New Bern Websites',
  ].join('\r\n');
}

function observationFrom(findings: AuditFinding[]) {
  return findings[0].detail.replace(/\s+/g, ' ').trim().slice(0, 420);
}

async function candidateToLead(element: OverpassElement): Promise<CandidateResult> {
  const tags = element.tags || {};
  const business = String(tags.name || '').trim().slice(0, 120);
  const website = normalizeWebsite(tags.website || tags['contact:website']);
  if (!business || !website) return { lead: null, reason: 'missing-business-or-website' };
  if (nationalChains.test(business)) return { lead: null, reason: 'national-chain' };

  const homepage = await safeHtml(website);
  if (!homepage) return { lead: null, reason: 'website-unavailable' };
  let emails = [tags.email, tags['contact:email']].filter(Boolean).flatMap(value => String(value).split(/[;,]/)).map(normalizeEmail).filter(validPublicEmail);
  emails.push(...extractEmails(homepage.html));
  const contact = contactUrl(homepage.html, homepage.finalUrl);
  if (contact) {
    try {
      const contactPage = await safeHtml(contact);
      if (contactPage) emails.push(...extractEmails(contactPage.html));
    } catch {
      // A homepage-verified candidate remains usable when its contact page fails.
    }
  }
  emails = [...new Set(emails)];
  const email = preferredEmail(emails, homepage.finalUrl);
  if (!email) return { lead: null, reason: 'no-public-email' };

  const category = businessCategory(tags);
  const findings = auditSite({ html: homepage.html, finalUrl: homepage.finalUrl, business, category });
  const observation = observationFrom(findings);
  const keySeed = `${business}|${email}|${homepage.finalUrl}`;
  const key = `research-${cleanProspectKey(business)}-${createHash('sha256').update(keySeed).digest('hex').slice(0, 10)}`;
  const mediaCategory = /restaurant|cafe|bar|hotel|marina|boat|construction|builder|landscap|pool|photograph|salon|spa/i.test(`${category} ${business}`);
  return { lead: {
    key,
    business,
    email,
    phone: tags.phone || tags['contact:phone'] || '',
    sourceUrl: homepage.finalUrl,
    observation,
    recommendedPackage: mediaCategory ? 'Media Website' : 'Turnkey Website',
    subject: `A quick website observation for ${business}`.slice(0, 120),
    body: firstTouchBody({ business, observation, category }),
    researchedAutomatically: true,
    addedAt: new Date().toISOString(),
    location: locationLabel(tags),
    category: readableCategory(category),
    auditFindings: findings,
  } };
}

async function overpassCandidates() {
  const around = `(around:${RADIUS_METERS},${NEW_BERN.latitude},${NEW_BERN.longitude})`;
  const query = `[out:json][timeout:45];(
    nwr${around}["name"]["website"]["craft"];
    nwr${around}["name"]["website"]["office"];
    nwr${around}["name"]["website"]["shop"];
    nwr${around}["name"]["website"]["amenity"~"restaurant|cafe|bar|dentist|doctors|clinic|veterinary|car_repair|events_venue"];
    nwr${around}["name"]["website"]["tourism"~"hotel|motel|guest_house|attraction"];
    nwr${around}["name"]["website"]["leisure"~"marina|fitness_centre|sports_centre"];
  );out tags center 900;`;
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'NewBernWebsitesBot/1.0 (+https://www.newbernwebsites.com/)' },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!response.ok) throw new Error(`Business discovery provider returned ${response.status}.`);
  const data = await response.json() as { elements?: OverpassElement[] };
  return data.elements || [];
}

export async function researchProspects(options: number | ProspectResearchOptions = {}): Promise<ProspectResearchResult> {
  const normalized = typeof options === 'number' ? { limit: options } : options;
  const limit = Math.max(1, Math.min(60, normalized.limit || 12));
  const maxChecked = Math.max(limit, Math.min(180, normalized.maxChecked || 60));
  const requestedOffset = Math.max(0, Math.floor(normalized.startOffset || 0));
  const existing = await getAllProspects();
  const existingEmails = new Set(existing.map(lead => lead.email.toLowerCase()));
  const existingHosts = new Set(existing.map(lead => {
    try { return new URL(lead.sourceUrl).hostname.replace(/^www\./, ''); } catch { return ''; }
  }));
  const elements = await overpassCandidates();
  const orderedCandidates = elements
    .filter(element => {
      const website = normalizeWebsite(element.tags?.website || element.tags?.['contact:website']);
      if (!website) return false;
      return !existingHosts.has(new URL(website).hostname.replace(/^www\./, ''));
    })
    .toSorted((a, b) => String(a.tags?.name || '').localeCompare(String(b.tags?.name || '')));

  const startOffset = orderedCandidates.length ? requestedOffset % orderedCandidates.length : 0;
  const candidates = orderedCandidates.length
    ? [...orderedCandidates.slice(startOffset), ...orderedCandidates.slice(0, startOffset)]
    : [];

  const saved: StoredOutreachLead[] = [];
  let checked = 0;
  const rejectionCounts: Record<string, number> = {};
  const reject = (reason: string) => { rejectionCounts[reason] = (rejectionCounts[reason] || 0) + 1; };
  for (let index = 0; index < candidates.length && saved.length < limit && checked < maxChecked; index += 6) {
    const batch = candidates.slice(index, Math.min(index + 6, index + (maxChecked - checked)));
    const results = await Promise.all(batch.map(async candidate => {
      try { return await candidateToLead(candidate); } catch { return { lead: null, reason: 'fetch-error' } as CandidateResult; }
    }));
    checked += batch.length;
    for (const result of results) if (!result.lead) reject(result.reason);
    const unique = results.flatMap(result => result.lead ? [result.lead] : []).filter(lead => {
      const email = lead.email.toLowerCase();
      if (existingEmails.has(email)) {
        reject('duplicate-email');
        return false;
      }
      existingEmails.add(email);
      return true;
    });
    // Private Email is reliable with bounded sequential SMTP writes; opening a
    // dozen simultaneous authenticated connections can trigger provider limits.
    for (const lead of unique) await saveManualProspect(lead);
    saved.push(...unique);
  }
  return {
    radiusMiles: 75,
    discovered: elements.length,
    eligible: orderedCandidates.length,
    checked,
    saved: saved.length,
    skipped: checked - saved.length,
    rejectionCounts,
    startOffset,
    nextOffset: orderedCandidates.length ? (startOffset + checked) % orderedCandidates.length : 0,
    totalProspects: existing.length + saved.length,
    prospects: saved.map(lead => ({ key: lead.key, business: lead.business, location: lead.location, category: lead.category })),
  };
}
