import {
  hasAutomationMarker,
  readAutomationMessages,
  readInboundMessages,
  recordAutomationEvent,
  sendAutomatedReply,
} from './mail-server';

const HOUR_MS = 3_600_000;

export type InboundLead = {
  id: string;
  name: string;
  business: string;
  email: string;
  phone: string;
  package: string;
  project: string;
  campaign: 'website' | 'captain97';
  createdAt: string;
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'there';
}

function encodeRecord(lead: InboundLead) {
  return Buffer.from(JSON.stringify(lead), 'utf8').toString('base64url');
}

function decodeRecord(body: string) {
  const encoded = body.match(/NBW_INBOUND_V1:([A-Za-z0-9_-]+)/)?.[1];
  if (!encoded) return null;
  try {
    const lead = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as InboundLead;
    return lead.id && lead.email ? lead : null;
  } catch {
    return null;
  }
}

function acknowledgementCopy(lead: InboundLead) {
  if (lead.package === 'Schedule a 15-minute call') return [
    `Hi ${firstName(lead.name)},`,
    '',
    'I received your request for a 15-minute website conversation. I’ll review the preferred time and details you sent, then confirm directly from this email address.',
    '',
    'If you have a current website, you can reply with its address so I can review it before we speak.',
    '',
    'Kyle',
    'New Bern Websites',
    '252-515-4389',
  ].join('\r\n');
  const intro = lead.package === 'Free Website Audit'
    ? 'I received your request for a free website audit.'
    : `I received your inquiry about our ${lead.package}.`;
  const next = lead.package.includes('$3,500')
    ? 'That package includes the full website build plus professional on-location photo and video production. It is $1,750 to begin and $1,750 after approval, before launch.'
    : lead.package.includes('$2,500')
      ? 'The turnkey package is $1,250 to begin and $1,250 after approval, before launch.'
      : 'I’ll review what you sent and recommend the clearest next step.';

  return [
    `Hi ${firstName(lead.name)},`,
    '',
    `${intro} ${next}`,
    '',
    'If you already have a website, reply with its address. I’ll review it before I follow up so the conversation is useful from the start.',
    '',
    'If you prefer, request a 15-minute time here: https://www.newbernwebsites.com/schedule?source=inbound-confirmation',
    '',
    'Kyle',
    'New Bern Websites',
    '252-515-4389',
    'NewBernWebsites.com',
  ].join('\r\n');
}

function followUpCopy(lead: InboundLead, step: 1 | 2 | 3) {
  if (step === 1) return [
    `Hi ${firstName(lead.name)},`,
    '',
    'I wanted to make sure my note reached you. If you send your current website address—or tell me you do not have one yet—I can give you a specific recommendation instead of a generic sales pitch.',
    '',
    'Kyle',
    'New Bern Websites',
    '252-515-4389',
  ].join('\r\n');

  if (step === 2) return [
    `Hi ${firstName(lead.name)},`,
    '',
    'A quick planning detail: our complete website is $2,500, or $3,500 with professional on-location photography and video. Both are split 50% to begin and 50% after you approve the finished site, before launch. Every project also includes one month of Captain 97.1 underwriting acknowledgments.',
    '',
    'Would you like me to outline what I would change first for your business?',
    '',
    'Kyle',
    'New Bern Websites',
    '252-515-4389',
  ].join('\r\n');

  return [
    `Hi ${firstName(lead.name)},`,
    '',
    'I’ll close the loop after this so I do not crowd your inbox. If the website project is still on your list, reply with “audit” and I’ll send the short review.',
    '',
    'Kyle',
    'New Bern Websites',
    '252-515-4389',
  ].join('\r\n');
}

export async function enrollInboundLead(lead: InboundLead) {
  const recordMarker = `inbound-record:${lead.id}`;
  const ackMarker = `inbound-ack:${lead.id}`;

  if (!await hasAutomationMarker(recordMarker)) {
    await recordAutomationEvent({
      marker: recordMarker,
      subject: `New website lead: ${lead.business}`,
      body: [
        `New inbound lead from ${lead.campaign === 'captain97' ? 'Captain 97.1' : 'NewBernWebsites.com'}`,
        '',
        `Name: ${lead.name}`,
        `Business: ${lead.business}`,
        `Email: ${lead.email}`,
        `Phone: ${lead.phone || 'Not provided'}`,
        `Interest: ${lead.package}`,
        `Project: ${lead.project || 'Not provided'}`,
        '',
        `NBW_INBOUND_V1:${encodeRecord(lead)}`,
      ].join('\r\n'),
    });
  }

  if (!await hasAutomationMarker(ackMarker)) {
    await sendAutomatedReply({
      to: lead.email,
      subject: `We received your ${lead.business} website request`,
      body: acknowledgementCopy(lead),
      marker: ackMarker,
    });
  }
}

function markerMap(messages: Awaited<ReturnType<typeof readAutomationMessages>>) {
  return new Map(messages.flatMap(message => message.marker ? [[message.marker, message] as const] : []));
}

function messageTime(date: string | undefined) {
  const value = Date.parse(date || '');
  return Number.isFinite(value) ? value : 0;
}

export async function processInboundLeadFollowUps() {
  const [automation, inbound] = await Promise.all([
    readAutomationMessages('inbound', 5000, false),
    readInboundMessages({ limit: 2000 }),
  ]);
  const markers = markerMap(automation);
  const records = automation
    .filter(message => message.marker?.startsWith('inbound-record:'))
    .map(message => decodeRecord(message.body))
    .filter((lead): lead is InboundLead => Boolean(lead));
  const activity: string[] = [];

  for (const lead of records) {
    if (lead.package === 'Schedule a 15-minute call') continue;
    const createdAt = Date.parse(lead.createdAt);
    if (!Number.isFinite(createdAt)) continue;
    const replied = inbound.some(message => message.from === lead.email && messageTime(message.date) >= createdAt);
    if (replied) continue;

    const ack = markers.get(`inbound-ack:${lead.id}`);
    const first = markers.get(`inbound-followup:1:${lead.id}`);
    const second = markers.get(`inbound-followup:2:${lead.id}`);
    const third = markers.get(`inbound-followup:3:${lead.id}`);
    const now = Date.now();
    let step: 1 | 2 | 3 | undefined;
    let replyToMessageId = ack?.messageId;

    if (!first && now - createdAt >= 4 * HOUR_MS) step = 1;
    else if (first && !second && now - messageTime(first.date) >= 20 * HOUR_MS) {
      step = 2;
      replyToMessageId = first.messageId || replyToMessageId;
    } else if (second && !third && now - messageTime(second.date) >= 48 * HOUR_MS) {
      step = 3;
      replyToMessageId = second.messageId || replyToMessageId;
    }
    if (!step) continue;

    const marker = `inbound-followup:${step}:${lead.id}`;
    await sendAutomatedReply({
      to: lead.email,
      subject: `Re: We received your ${lead.business} website request`,
      body: followUpCopy(lead, step),
      marker,
      replyToMessageId,
    });
    markers.set(marker, { ...ack, marker, date: new Date().toUTCString() } as NonNullable<typeof ack>);
    activity.push(`${step}:${lead.id}`);
  }

  return { checked: records.length, sent: activity.length, activity };
}
