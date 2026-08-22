import {
  markMessageSeen,
  readAutomationMessages,
  readInboundMessages,
  recordAutomationEvent,
  sendAutomatedReply,
  sendFollowUpEmail,
  sendOwnerAlert,
  sendQueuedProspectEmail,
} from './mail-server';
import { getAllProspects, type StoredOutreachLead } from './prospect-store';
import { classifyReply, type ReplyAction } from './reply-automation';

const FOLLOW_UP_LIMIT = 30;
const FIRST_TOUCH_BATCH_SIZE = 5;
const DAY_MS = 86_400_000;
const NEW_YORK_TIME_ZONE = 'America/New_York';

type AutomationMessage = Awaited<ReturnType<typeof readAutomationMessages>>[number];
type InboundMessage = Awaited<ReturnType<typeof readInboundMessages>>[number];

export type OutreachSnapshot = {
  prospects: StoredOutreachLead[];
  automationMessages: AutomationMessage[];
  inboundMessages: InboundMessage[];
  unreadMessages: InboundMessage[];
};

type EvaluatedMessage = {
  message: InboundMessage;
  action?: ReplyAction;
  issue?: 'unsafe-format' | 'uncorrelated';
};

type OutreachLockState = { running: boolean };
const lockKey = Symbol.for('newbernwebsites.outreach-lock');

function lockState() {
  const root = globalThis as typeof globalThis & { [lockKey]?: OutreachLockState };
  root[lockKey] ||= { running: false };
  return root[lockKey];
}

export async function withOutreachRunLock<T>(work: () => Promise<T>) {
  const state = lockState();
  if (state.running) return { acquired: false as const };
  state.running = true;
  try {
    return { acquired: true as const, result: await work() };
  } finally {
    state.running = false;
  }
}

export function currentFirstTouchLimit(now = Date.now()) {
  if (now < Date.parse('2026-08-25T00:00:00-04:00')) return 15;
  if (now < Date.parse('2026-08-26T00:00:00-04:00')) return 25;
  if (now < Date.parse('2026-08-27T00:00:00-04:00')) return 35;
  return 50;
}

function easternDayKey(value: string | number | Date) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NEW_YORK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function replyWindowOpen(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NEW_YORK_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const weekday = parts.find(part => part.type === 'weekday')?.value || '';
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday) && hour >= 8 && hour < 20;
}

export async function loadOutreachSnapshot(input: { includeAllInbound?: boolean } = {}): Promise<OutreachSnapshot> {
  const [prospects, automationMessages, unreadMessages, inboundMessages] = await Promise.all([
    getAllProspects(),
    readAutomationMessages('', 5000),
    readInboundMessages({ unseenOnly: true, limit: 500 }),
    input.includeAllInbound === false
      ? Promise.resolve([] as InboundMessage[])
      : readInboundMessages({ limit: 2000 }),
  ]);
  return { prospects, automationMessages, inboundMessages, unreadMessages };
}

function messageMap(messages: AutomationMessage[], prefix: string) {
  return new Map(
    messages.flatMap(message => message.marker?.startsWith(prefix) ? [[message.marker, message] as const] : []),
  );
}

function markerSet(messages: AutomationMessage[]) {
  return new Set(messages.flatMap(message => message.marker ? [message.marker] : []));
}

function latestInboundBySender(messages: InboundMessage[]) {
  const result = new Map<string, InboundMessage>();
  for (const message of messages) {
    if (!message.from) continue;
    const current = result.get(message.from);
    if (!current || message.uid > current.uid) result.set(message.from, message);
  }
  return result;
}

function ageInDays(date: string | undefined) {
  const timestamp = Date.parse(date || '');
  return Number.isFinite(timestamp) ? (Date.now() - timestamp) / DAY_MS : -1;
}

function replySubject(subject: string) {
  const clean = subject.replace(/[\r\n]+/g, ' ').trim();
  return /^re:/i.test(clean) ? clean : `Re: ${clean}`;
}

function greeting(lead: StoredOutreachLead) {
  if (lead.contactPerson) return `Hi ${lead.contactPerson.split(/\s+/)[0]},`;
  return `Hi ${lead.business} team,`;
}

function followUpCopy(lead: StoredOutreachLead, step: 1 | 2 | 3) {
  if (step === 1) {
    return [
      greeting(lead),
      '',
      'Just following up on the website note I sent. The main opportunity I noticed was:',
      '',
      lead.observation,
      '',
      "If you want, I can send the three changes I'd prioritize. No meeting is needed.",
      '',
      'Kyle',
      'New Bern Websites',
    ].join('\r\n');
  }

  if (step === 2) {
    return [
      greeting(lead),
      '',
      'One practical detail in case budget or scope was the question: our complete Turnkey Website is $2,500 and the version with local photo/video production is $3,500. Both use a 50% kickoff deposit and a final 50% payment only when the site is approved and ready to launch.',
      '',
      'Both packages also include 30 days of Captain 97.1 local business underwriting acknowledgments.',
      '',
      'Would a free 15-minute website review be useful?',
      '',
      'Kyle',
      'New Bern Websites',
    ].join('\r\n');
  }

  return [
    greeting(lead),
    '',
    "I'll close the loop after this so I do not crowd your inbox. If improving the website becomes a priority, reply here and I will send the short review I offered.",
    '',
    'Kyle',
    'New Bern Websites',
  ].join('\r\n');
}

function extractMessageIds(value: string | undefined) {
  return (value?.match(/<[^<>]+>/g) || []).map(item => item.toLowerCase());
}

function outboundThreadIds(lead: StoredOutreachLead, messages: AutomationMessage[]) {
  const ids = new Set<string>();
  for (const message of messages) {
    const marker = message.marker || '';
    const belongsToLead = marker === `outreach:${lead.key}`
      || (marker.endsWith(`:${lead.key}`) && marker.startsWith('followup:'))
      || marker.startsWith(`reply:${lead.key}:`);
    if (!belongsToLead) continue;
    for (const id of extractMessageIds(message.messageId)) ids.add(id);
  }
  return ids;
}

function threadCorrelated(message: InboundMessage, outboundIds: Set<string>) {
  if (!outboundIds.size) return false;
  const replyIds = [...extractMessageIds(message.inReplyTo), ...extractMessageIds(message.references)];
  return replyIds.some(id => outboundIds.has(id));
}

async function sendAlertOnce(
  markers: Set<string>,
  input: { marker: string; subject: string; body: string },
) {
  if (markers.has(input.marker)) return false;
  await sendOwnerAlert(input);
  markers.add(input.marker);
  return true;
}

async function recordSuppression(lead: StoredOutreachLead, uid: number, markers: Set<string>) {
  const marker = `suppressed:${lead.key}`;
  if (markers.has(marker)) return;
  await recordAutomationEvent({
    marker,
    subject: `Opt-out recorded for ${lead.business}`,
    body: `${lead.business} (${lead.email}) opted out. No further automated outreach will be sent. Source message UID: ${uid}.`,
  });
  markers.add(marker);
}

function evaluateMessages(lead: StoredOutreachLead, messages: InboundMessage[], snapshot: OutreachSnapshot) {
  const outboundIds = outboundThreadIds(lead, snapshot.automationMessages);
  return messages.map<EvaluatedMessage>(message => {
    if (message.contentType !== 'text/plain') return { message, issue: 'unsafe-format' };
    const action = classifyReply({
      leadKey: lead.key,
      business: lead.business,
      subject: message.subject,
      messageId: message.messageId,
      rawBody: message.body,
    });
    if (action.kind === 'opt-out') return { message, action };
    if (!threadCorrelated(message, outboundIds)) return { message, action, issue: 'uncorrelated' };
    return { message, action };
  });
}

export async function processReplies(snapshot?: OutreachSnapshot) {
  const data = snapshot || await loadOutreachSnapshot({ includeAllInbound: false });
  const activity: string[] = [];
  const suppressedLeadKeys = new Set<string>();
  const markers = markerSet(data.automationMessages);
  const leadsByEmail = new Map(data.prospects.map(lead => [lead.email.toLowerCase(), lead]));
  const messagesByLead = new Map<string, { lead: StoredOutreachLead; messages: InboundMessage[] }>();

  for (const message of [...data.unreadMessages].sort((a, b) => a.uid - b.uid)) {
    const lead = leadsByEmail.get(message.from);
    if (!lead) continue;
    const group = messagesByLead.get(lead.key) || { lead, messages: [] };
    group.messages.push(message);
    messagesByLead.set(lead.key, group);
  }

  for (const { lead, messages } of messagesByLead.values()) {
    const evaluated = evaluateMessages(lead, messages, data);
    const optOut = evaluated.find(item => item.action?.kind === 'opt-out');
    if (optOut) {
      await recordSuppression(lead, optOut.message.uid, markers);
      suppressedLeadKeys.add(lead.key);
    }

    for (const item of evaluated) {
      const { message, action, issue } = item;
      if (issue === 'unsafe-format') {
        const marker = `escalate:${lead.key}:uid-${message.uid}`;
        await sendAlertOnce(markers, {
          marker,
          subject: `Action needed: reply from ${lead.business}`,
          body: `${lead.business} replied in a format the automation will not interpret safely. Please review the message in kyle@newbernwebsites.com.`,
        });
        activity.push(`escalated-format:${lead.key}:uid-${message.uid}`);
      } else if (issue === 'uncorrelated') {
        const marker = `uncorrelated:${lead.key}:uid-${message.uid}`;
        await sendAlertOnce(markers, {
          marker,
          subject: `Manual review: message from ${lead.business}`,
          body: `A message from ${lead.email} did not carry a verified New Bern Websites thread reference, so no automated response was sent. Please review it manually.`,
        });
        activity.push(`escalated-thread:${lead.key}:uid-${message.uid}`);
      } else if (optOut && action?.kind !== 'opt-out') {
        const marker = `suppressed-review:${lead.key}:uid-${message.uid}`;
        await sendAlertOnce(markers, {
          marker,
          subject: `Review messages from opted-out prospect: ${lead.business}`,
          body: `${lead.business} sent another message in a group that includes an opt-out. Outreach was suppressed and no automated response was sent. Please review the message manually.`,
        });
        activity.push(`suppressed-review:${lead.key}:uid-${message.uid}`);
      } else if (action?.kind === 'opt-out') {
        activity.push(`suppressed:${lead.key}:uid-${message.uid}`);
      } else if (action?.kind === 'reply') {
        if (!markers.has(action.marker)) {
          await sendAutomatedReply({
            to: lead.email,
            subject: action.subject,
            body: action.body,
            marker: action.marker,
            replyToMessageId: message.messageId,
          });
          markers.add(action.marker);
          activity.push(`replied:${lead.key}:uid-${message.uid}`);
        }
        if (action.alertOwner) {
          await sendAlertOnce(markers, {
            marker: `owner:${action.marker}`,
            subject: `Warm lead: ${lead.business} requested a conversation`,
            body: action.alertOwner,
          });
        }
      } else if (action?.kind === 'escalate') {
        await sendAlertOnce(markers, {
          marker: action.marker,
          subject: `Action needed: reply from ${lead.business}`,
          body: `${action.reason}\r\n\r\nPlease review the reply from ${lead.email}.`,
        });
        activity.push(`escalated:${lead.key}:uid-${message.uid}`);
      }
      await markMessageSeen(message.uid);
    }
  }
  return { activity, suppressedLeadKeys };
}

export async function sendNextFirstTouches(snapshot: OutreachSnapshot, runSuppressions: Set<string> = new Set()) {
  const sentMarkers = messageMap(snapshot.automationMessages, 'outreach:');
  const suppressedMarkers = messageMap(snapshot.automationMessages, 'suppressed:');
  const sent: string[] = [];
  const firstTouchLimit = currentFirstTouchLimit();
  const today = easternDayKey(new Date());
  const sentToday = snapshot.automationMessages.filter(message =>
    message.marker?.startsWith('outreach:') && easternDayKey(message.date || '') === today
  ).length;
  const runLimit = Math.min(FIRST_TOUCH_BATCH_SIZE, Math.max(0, firstTouchLimit - sentToday));
  if (runLimit === 0) return sent;

  for (const lead of snapshot.prospects) {
    const marker = `outreach:${lead.key}`;
    if (sentMarkers.has(marker) || suppressedMarkers.has(`suppressed:${lead.key}`) || runSuppressions.has(lead.key)) continue;
    await sendQueuedProspectEmail({ ...lead, to: lead.email, marker });
    sentMarkers.set(marker, { marker } as AutomationMessage);
    sent.push(lead.key);
    if (sent.length >= runLimit) break;
  }
  return sent;
}

export async function sendDueFollowUps(snapshot: OutreachSnapshot, runSuppressions: Set<string> = new Set()) {
  const firstTouchMarkers = messageMap(snapshot.automationMessages, 'outreach:');
  const followUpMarkers = messageMap(snapshot.automationMessages, 'followup:');
  const suppressedMarkers = messageMap(snapshot.automationMessages, 'suppressed:');
  const inboundBySender = latestInboundBySender(snapshot.inboundMessages);
  const candidates: Array<{
    lead: StoredOutreachLead;
    step: 1 | 2 | 3;
    marker: string;
    replyToMessageId?: string;
  }> = [];

  for (const lead of snapshot.prospects) {
    if (candidates.length >= FOLLOW_UP_LIMIT) break;
    if (suppressedMarkers.has(`suppressed:${lead.key}`) || runSuppressions.has(lead.key)) continue;

    const firstTouch = firstTouchMarkers.get(`outreach:${lead.key}`);
    if (!firstTouch || ageInDays(firstTouch.date) < 4) continue;

    const first = followUpMarkers.get(`followup:1:${lead.key}`);
    const second = followUpMarkers.get(`followup:2:${lead.key}`);
    const third = followUpMarkers.get(`followup:3:${lead.key}`);
    let step: 1 | 2 | 3 | null = null;
    let replyToMessageId = firstTouch.messageId;

    if (!first) {
      step = 1;
    } else if (!second && ageInDays(first.date) >= 5) {
      step = 2;
      replyToMessageId = first.messageId || replyToMessageId;
    } else if (!third && second && ageInDays(second.date) >= 5) {
      step = 3;
      replyToMessageId = second.messageId || replyToMessageId;
    }
    if (!step) continue;

    const inbound = inboundBySender.get(lead.email.toLowerCase());
    const firstTouchTime = Date.parse(firstTouch.date || '');
    const inboundTime = Date.parse(inbound?.date || '');
    if (inbound && (!Number.isFinite(firstTouchTime) || !Number.isFinite(inboundTime) || inboundTime >= firstTouchTime)) continue;

    candidates.push({
      lead,
      step,
      marker: `followup:${step}:${lead.key}`,
      replyToMessageId,
    });
  }

  const sent: string[] = [];
  for (let index = 0; index < candidates.length; index += 3) {
    const batch = candidates.slice(index, index + 3);
    await Promise.all(batch.map(async candidate => {
      await sendFollowUpEmail({
        to: candidate.lead.email,
        subject: replySubject(candidate.lead.subject),
        body: followUpCopy(candidate.lead, candidate.step),
        marker: candidate.marker,
        replyToMessageId: candidate.replyToMessageId,
      });
      sent.push(candidate.marker);
    }));
  }
  return sent;
}

export function getOutreachLimits() {
  return {
    firstTouches: currentFirstTouchLimit(),
    firstTouchesPerRun: FIRST_TOUCH_BATCH_SIZE,
    followUps: FOLLOW_UP_LIMIT,
  };
}
