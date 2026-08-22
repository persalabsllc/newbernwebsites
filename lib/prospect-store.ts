import { randomUUID } from 'node:crypto';
import { OUTREACH_QUEUE, type OutreachLead } from './outreach-queue';
import { readStoredProspectRecords, storeProspectRecord } from './mail-server';

export type ManualProspectInput = {
  business: string;
  website: string;
  phone: string;
  contactPerson: string;
  email: string;
};

export type StoredOutreachLead = OutreachLead & {
  phone?: string;
  contactPerson?: string;
  addedManually?: boolean;
  addedAt?: string;
};

function clean(value: string, max: number) {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function validWebsite(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function buildManualProspect(input: ManualProspectInput): StoredOutreachLead {
  const business = clean(input.business, 120);
  const website = clean(input.website, 300);
  const phone = clean(input.phone, 40);
  const contactPerson = clean(input.contactPerson, 100);
  const email = clean(input.email, 254).toLowerCase();
  if (!business || !validWebsite(website) || !validEmail(email)) {
    throw new Error('Business name, a valid website, and a valid email are required.');
  }

  const greeting = contactPerson ? `Hi ${contactPerson.split(/\s+/)[0]},` : `Hi ${business} team,`;
  const lead: StoredOutreachLead = {
    key: `manual-${randomUUID()}`,
    business,
    email,
    phone,
    contactPerson,
    sourceUrl: website,
    observation: `Manually added from ${new URL(website).hostname.replace(/^www\./, '')}.`,
    recommendedPackage: 'Turnkey Website',
    subject: `A quick website idea for ${business}`.slice(0, 120),
    body: [
      greeting,
      '',
      `I took a look at ${business}'s website and wanted to introduce myself. I run New Bern Websites, where we build clear, modern sites for local businesses and handle the design, mobile experience, launch, and ongoing care.`,
      '',
      "If improving the site's customer path is already on your list, I can send a short, no-pressure outline of what I would prioritize.",
      '',
      'Kyle',
      'New Bern Websites',
    ].join('\r\n'),
    addedManually: true,
    addedAt: new Date().toISOString(),
  };
  return lead;
}

export async function saveManualProspect(lead: StoredOutreachLead) {
  const encoded = Buffer.from(JSON.stringify(lead), 'utf8').toString('base64url');
  await storeProspectRecord(`prospect-record:${lead.key}`, lead.business, encoded);
}

export async function getManualProspects(): Promise<StoredOutreachLead[]> {
  const records = await readStoredProspectRecords();
  const leads: StoredOutreachLead[] = [];
  for (const record of records) {
    const match = record.body.match(/NBW_PROSPECT_V1:([A-Za-z0-9_-]+)/);
    if (!match) continue;
    try {
      const parsed = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')) as StoredOutreachLead;
      if (parsed.key && parsed.business && validEmail(parsed.email) && validWebsite(parsed.sourceUrl)) leads.push(parsed);
    } catch {
      // Ignore malformed internal records instead of blocking the whole queue.
    }
  }
  return leads.sort((a, b) => String(a.addedAt).localeCompare(String(b.addedAt)));
}

export async function getAllProspects(): Promise<StoredOutreachLead[]> {
  const manual = await getManualProspects();
  const seen = new Set<string>();
  // Owner-entered prospects receive queue priority, followed by the researched list.
  return [...manual, ...OUTREACH_QUEUE].filter(lead => {
    const email = lead.email.toLowerCase();
    if (seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}
