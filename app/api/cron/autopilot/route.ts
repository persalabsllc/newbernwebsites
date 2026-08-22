import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  hasAutomationMarker,
  markMessageSeen,
  readLatestUnseenFrom,
  sendAutomatedReply,
  sendOwnerAlert,
  sendQueuedProspectEmail,
} from '../../../../lib/mail-server';
import { OUTREACH_QUEUE } from '../../../../lib/outreach-queue';
import { classifyReply } from '../../../../lib/reply-automation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const received = Buffer.from(supplied);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function processReplies() {
  const activity: string[] = [];
  for (const lead of OUTREACH_QUEUE) {
    const inbound = await readLatestUnseenFrom(lead.email);
    if (!inbound) continue;

    if (inbound.contentType !== 'text/plain') {
      const marker = `escalate:${lead.key}:uid-${inbound.uid}`;
      if (!(await hasAutomationMarker(marker))) {
        await sendOwnerAlert({
          marker,
          subject: `Action needed: reply from ${lead.business}`,
          body: `${lead.business} replied in a format the automation will not interpret safely. Please review the unread message in kyle@newbernwebsites.com.`,
        });
      }
      await markMessageSeen(inbound.uid);
      activity.push(`escalated:${lead.key}`);
      continue;
    }

    const action = classifyReply({
      leadKey: lead.key,
      business: lead.business,
      subject: inbound.subject,
      messageId: inbound.messageId,
      rawBody: inbound.body,
    });

    if (action.kind === 'opt-out') {
      await markMessageSeen(inbound.uid);
      activity.push(`suppressed:${lead.key}`);
      continue;
    }

    if (!(await hasAutomationMarker(action.marker))) {
      if (action.kind === 'reply') {
        await sendAutomatedReply({
          to: lead.email,
          subject: action.subject,
          body: action.body,
          marker: action.marker,
          replyToMessageId: inbound.messageId,
        });
        if (action.alertOwner) {
          await sendOwnerAlert({
            marker: `owner:${action.marker}`,
            subject: `Warm lead: ${lead.business} requested a conversation`,
            body: action.alertOwner,
          });
        }
        activity.push(`replied:${lead.key}`);
      } else {
        await sendOwnerAlert({
          marker: action.marker,
          subject: `Action needed: reply from ${lead.business}`,
          body: `${action.reason}\r\n\r\nPlease review the unread reply from ${lead.email}.`,
        });
        activity.push(`escalated:${lead.key}`);
      }
    }
    await markMessageSeen(inbound.uid);
  }
  return activity;
}

async function sendNextFirstTouch() {
  for (const lead of OUTREACH_QUEUE) {
    const marker = `outreach:${lead.key}`;
    if (await hasAutomationMarker(marker)) continue;
    await sendQueuedProspectEmail({ ...lead, to: lead.email, marker });
    return lead.key;
  }
  return null;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Autopilot is safely paused until CRON_SECRET is configured.' }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const replyActivity = await processReplies();
    const firstTouch = await sendNextFirstTouch();
    return NextResponse.json({ ok: true, replyActivity, firstTouch });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Autopilot run failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
