import { NextResponse } from 'next/server';
import { requireFirebaseUser } from '../../../../lib/firebase-server-auth';
import { readAutomationMessages, readInboundMessages } from '../../../../lib/mail-server';
import { currentFirstTouchLimit } from '../../../../lib/outreach-autopilot';
import { buildManualProspect, getAllProspects, saveManualProspect, type StoredOutreachLead } from '../../../../lib/prospect-store';
import { classifyReply } from '../../../../lib/reply-automation';
import { auditPath } from '../../../../lib/prospect-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type PipelineStatus = 'Pending email' | 'Contacted' | 'Replied automatically' | 'Needs Kyle' | 'Meeting requested' | 'Deposit link sent' | 'Opted out';

type AutomationMessage = Awaited<ReturnType<typeof readAutomationMessages>>[number];

function dueDate(date: string | undefined, days: number) {
  const timestamp = Date.parse(date || '');
  return Number.isFinite(timestamp) ? new Date(timestamp + days * 86_400_000).toISOString() : '';
}

function prospectState(
  lead: StoredOutreachLead,
  index: number,
  firstTouchLimit: number,
  markers: Map<string, AutomationMessage>,
  inboundBySender: Map<string, Awaited<ReturnType<typeof readInboundMessages>>[number]>,
) {
  const sentMessage = markers.get(`outreach:${lead.key}`);
  const firstFollowUp = markers.get(`followup:1:${lead.key}`);
  const secondFollowUp = markers.get(`followup:2:${lead.key}`);
  const finalFollowUp = markers.get(`followup:3:${lead.key}`);
  const inbound = inboundBySender.get(lead.email.toLowerCase());
  const sent = Boolean(sentMessage);

  let status: PipelineStatus = sent ? 'Contacted' : 'Pending email';
  let replyStage = sent ? 'Waiting for reply' : 'Not contacted';
  let paymentStage = 'Not offered';
  let needsKyle = false;
  let outreachStage = sent ? 'First touch sent' : 'Queued for first touch';
  let lastOutreachAt = sentMessage?.date || '';
  let nextAction = sent ? `First follow-up due ${dueDate(sentMessage?.date, 4)}` : 'Waiting for a weekday first-touch slot';

  if (firstFollowUp) {
    outreachStage = 'Follow-up 1 sent';
    lastOutreachAt = firstFollowUp.date || lastOutreachAt;
    nextAction = `Pricing follow-up due ${dueDate(firstFollowUp.date, 5)}`;
  }
  if (secondFollowUp) {
    outreachStage = 'Pricing follow-up sent';
    lastOutreachAt = secondFollowUp.date || lastOutreachAt;
    nextAction = `Final follow-up due ${dueDate(secondFollowUp.date, 5)}`;
  }
  if (finalFollowUp) {
    outreachStage = 'Four-touch sequence complete';
    lastOutreachAt = finalFollowUp.date || lastOutreachAt;
    nextAction = 'No more automated outreach';
  }

  if (inbound) {
    if (inbound.contentType !== 'text/plain') {
      status = 'Needs Kyle';
      replyStage = 'Non-standard reply received';
      needsKyle = true;
    } else {
      const action = classifyReply({
        leadKey: lead.key,
        business: lead.business,
        subject: inbound.subject,
        messageId: inbound.messageId,
        rawBody: inbound.body,
        auditUrl: `https://www.newbernwebsites.com${auditPath(lead)}`,
      });

      if (action.kind === 'opt-out') {
        status = 'Opted out';
        replyStage = 'Suppressed';
        nextAction = 'Permanently suppressed';
      } else if (action.kind === 'escalate') {
        status = 'Needs Kyle';
        replyStage = action.reason;
        needsKyle = true;
        nextAction = 'Kyle must review the reply';
      } else if (action.alertOwner) {
        status = 'Meeting requested';
        replyStage = 'Automation requested their phone number and two time windows';
        needsKyle = true;
        nextAction = 'Kyle must schedule the conversation';
      } else if (/\/pay\//i.test(action.body)) {
        status = 'Deposit link sent';
        replyStage = 'Replied automatically';
        paymentStage = '50% kickoff link sent';
        nextAction = 'Watch Stripe for the kickoff payment';
      } else {
        status = 'Replied automatically';
        replyStage = 'Routine reply handled';
        if (/fixed-scope options/i.test(action.body)) paymentStage = 'Pricing sent';
        nextAction = 'Watch for the prospect’s next reply';
      }
    }
  }

  return {
    key: lead.key,
    business: lead.business,
    email: lead.email,
    sourceUrl: lead.sourceUrl,
    observation: lead.observation,
    recommendedPackage: lead.recommendedPackage,
    phone: lead.phone || '',
    contactPerson: lead.contactPerson || '',
    addedManually: Boolean(lead.addedManually),
    addedAt: lead.addedAt || '',
    subject: lead.subject,
    auditUrl: auditPath(lead),
    queuePosition: index + 1,
    scheduledBatch: Math.floor(index / firstTouchLimit) + 1,
    sent,
    status,
    replyStage,
    paymentStage,
    needsKyle,
    sentAt: sentMessage?.date || '',
    followUp1At: firstFollowUp?.date || '',
    followUp2At: secondFollowUp?.date || '',
    followUp3At: finalFollowUp?.date || '',
    outreachStage,
    lastOutreachAt,
    nextAction,
    repliedAt: inbound?.date || '',
  };
}

export async function GET(request: Request) {
  try {
    await requireFirebaseUser(request);
    const [queue, automationMessages, inboxMessages] = await Promise.all([
      getAllProspects(),
      readAutomationMessages('', 5000),
      readInboundMessages({ limit: 2000 }),
    ]);
    const markers = new Map(
      automationMessages.flatMap(message => message.marker ? [[message.marker, message] as const] : []),
    );
    const inboundBySender = new Map<string, (typeof inboxMessages)[number]>();
    for (const message of inboxMessages) {
      if (!message.from) continue;
      const current = inboundBySender.get(message.from);
      if (!current || message.uid > current.uid) inboundBySender.set(message.from, message);
    }
    const firstTouchLimit = currentFirstTouchLimit();
    const prospects = queue.map((lead, index) => prospectState(lead, index, firstTouchLimit, markers, inboundBySender));

    return NextResponse.json({
      ok: true,
      dailyLimit: firstTouchLimit,
      weekdayOnly: true,
      prospects,
      background: {
        schedule: 'Five first touches per hourly run on weekdays until the daily limit is reached',
        firstTouchLimit,
        replyChecks: 'Replies are checked hourly on weekdays. Follow-ups run on days 4, 9, and 14.',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load the prospect pipeline.';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}


export async function POST(request: Request) {
  try {
    await requireFirebaseUser(request);
    const input = await request.json() as {
      business?: string;
      website?: string;
      phone?: string;
      contactPerson?: string;
      email?: string;
    };
    const existing = await getAllProspects();
    const email = String(input.email || '').trim().toLowerCase();
    if (existing.some(lead => lead.email.toLowerCase() === email)) {
      return NextResponse.json({ ok: false, error: 'That email is already in the prospect pipeline.' }, { status: 409 });
    }
    const lead = buildManualProspect({
      business: String(input.business || ''),
      website: String(input.website || ''),
      phone: String(input.phone || ''),
      contactPerson: String(input.contactPerson || ''),
      email,
    });
    await saveManualProspect(lead);
    return NextResponse.json({ ok: true, prospect: lead });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not add the prospect.';
    const status = message === 'Unauthorized' ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
