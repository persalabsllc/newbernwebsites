import { NextResponse } from 'next/server';
import { requireFirebaseUser } from '../../../../lib/firebase-server-auth';
import { readAutomationMarker, readLatestFrom } from '../../../../lib/mail-server';
import { buildManualProspect, getAllProspects, saveManualProspect, type StoredOutreachLead } from '../../../../lib/prospect-store';
import { classifyReply } from '../../../../lib/reply-automation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type PipelineStatus = 'Pending email' | 'Contacted' | 'Replied automatically' | 'Needs Kyle' | 'Meeting requested' | 'Deposit link sent' | 'Opted out';

async function prospectState(lead: StoredOutreachLead, index: number) {
  const marker = `outreach:${lead.key}`;
  const [sentMessage, inbound] = await Promise.all([
    readAutomationMarker(marker),
    readLatestFrom(lead.email),
  ]);
  const sent = Boolean(sentMessage);

  let status: PipelineStatus = sent ? 'Contacted' : 'Pending email';
  let replyStage = sent ? 'Waiting for reply' : 'Not contacted';
  let paymentStage = 'Not offered';
  let needsKyle = false;

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
      });

      if (action.kind === 'opt-out') {
        status = 'Opted out';
        replyStage = 'Suppressed';
      } else if (action.kind === 'escalate') {
        status = 'Needs Kyle';
        replyStage = action.reason;
        needsKyle = true;
      } else if (action.alertOwner) {
        status = 'Meeting requested';
        replyStage = 'Automation requested their phone number and two time windows';
        needsKyle = true;
      } else if (/\/pay\//i.test(action.body)) {
        status = 'Deposit link sent';
        replyStage = 'Replied automatically';
        paymentStage = '50% kickoff link sent';
      } else {
        status = 'Replied automatically';
        replyStage = 'Routine reply handled';
        if (/fixed-scope options/i.test(action.body)) paymentStage = 'Pricing sent';
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
    queuePosition: index + 1,
    scheduledBatch: Math.floor(index / 3) + 1,
    sent,
    status,
    replyStage,
    paymentStage,
    needsKyle,
    sentAt: sentMessage?.date || '',
    repliedAt: inbound?.date || '',
  };
}

export async function GET(request: Request) {
  try {
    await requireFirebaseUser(request);
    const queue = await getAllProspects();
    const prospects = [];

    // Keep IMAP load bounded while still returning the pipeline quickly.
    for (let index = 0; index < queue.length; index += 3) {
      const batch = queue.slice(index, index + 3);
      const states = await Promise.all(batch.map((lead, offset) => prospectState(lead, index + offset)));
      prospects.push(...states);
    }

    return NextResponse.json({
      ok: true,
      dailyLimit: 3,
      weekdayOnly: true,
      prospects,
      background: {
        schedule: 'Weekdays at 10:17 AM Eastern',
        firstTouchLimit: 3,
        replyChecks: 'Replies are processed during the weekday scheduled run, not continuously.',
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
