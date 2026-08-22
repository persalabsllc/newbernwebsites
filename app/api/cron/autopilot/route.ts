import { NextResponse } from 'next/server';
import { cronAuthorized } from '../../../../lib/cron-auth';
import {
  getOutreachLimits,
  loadOutreachSnapshot,
  processReplies,
  replyWindowOpen,
  sendDueFollowUps,
  sendNextFirstTouches,
  withOutreachRunLock,
} from '../../../../lib/outreach-autopilot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Autopilot is safely paused until CRON_SECRET is configured.' }, { status: 503 });
  }
  if (!cronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!replyWindowOpen()) {
    return NextResponse.json({ ok: true, skipped: 'Outside weekday 8 AM–8 PM Eastern outreach window.' });
  }

  try {
    const run = await withOutreachRunLock(async () => {
      const snapshot = await loadOutreachSnapshot();
      const replies = await processReplies(snapshot);
      const followUps = await sendDueFollowUps(snapshot, replies.suppressedLeadKeys);
      const firstTouches = await sendNextFirstTouches(snapshot, replies.suppressedLeadKeys);
      return { replyActivity: replies.activity, followUps, firstTouches };
    });
    if (!run.acquired) return NextResponse.json({ ok: true, skipped: 'Outreach run already in progress.' });
    return NextResponse.json({ ok: true, ...run.result, limits: getOutreachLimits() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Autopilot run failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
