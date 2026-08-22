import { NextResponse } from 'next/server';
import { requireFirebaseUser } from '../../../../lib/firebase-server-auth';
import { hasAutomationMarker, readLatestFrom } from '../../../../lib/mail-server';
import { OUTREACH_QUEUE } from '../../../../lib/outreach-queue';
import { classifyReply } from '../../../../lib/reply-automation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type PipelineStatus = 'Pending email' | 'Contacted' | 'Replied automatically' | 'Needs Kyle' | 'Meeting requested' | 'Deposit link sent' | 'Opted out';

async function prospectState(lead: (typeof OUTREACH_QUEUE)[number], index: number) {
  const marker = `outreach:${lead.key}`;
  const [sent, inbound] = await Promise.all([
    hasAutomationMarker(marker),
    readLatestFrom(lead.email),
  ]);

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
    subject: lead.subject,
    queuePosition: index + 1,
    scheduledBatch: Math.floor(index / 3) + 1,
    sent,
    status,
    replyStage,
    paymentStage,
    needsKyle,
  };
}

export async function GET(request: Request) {
  try {
    await requireFirebaseUser(request);
    const prospects = [];

    // Keep IMAP load bounded while still returning the pipeline quickly.
    for (let index = 0; index < OUTREACH_QUEUE.length; index += 3) {
      const batch = OUTREACH_QUEUE.slice(index, index + 3);
      const states = await Promise.all(batch.map((lead, offset) => prospectState(lead, index + offset)));
      prospects.push(...states);
    }

    return NextResponse.json({
      ok: true,
      dailyLimit: 3,
      weekdayOnly: true,
      prospects,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load the prospect pipeline.';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
