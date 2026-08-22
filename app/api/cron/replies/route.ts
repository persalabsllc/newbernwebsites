import { NextResponse } from 'next/server';
import { cronAuthorized } from '../../../../lib/cron-auth';
import {
  loadOutreachSnapshot,
  processReplies,
  replyWindowOpen,
  withOutreachRunLock,
} from '../../../../lib/outreach-autopilot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Reply checks are paused until CRON_SECRET is configured.' }, { status: 503 });
  }
  if (!cronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!replyWindowOpen()) {
    return NextResponse.json({ ok: true, skipped: 'Outside weekday 8 AM–8 PM Eastern reply window.' });
  }

  try {
    const run = await withOutreachRunLock(async () => {
      const snapshot = await loadOutreachSnapshot({ includeAllInbound: false });
      return processReplies(snapshot);
    });
    if (!run.acquired) return NextResponse.json({ ok: true, skipped: 'Outreach run already in progress.' });
    return NextResponse.json({ ok: true, replyActivity: run.result.activity });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reply check failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
