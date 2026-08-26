import { NextResponse } from 'next/server';
import { cronAuthorized } from '../../../../lib/cron-auth';
import { firstTouchQueueStatus } from '../../../../lib/outreach-autopilot';
import { executeResearchRun } from '../../../../lib/research-runs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const RESEARCH_QUEUE_FLOOR = 60;

function easternResearchWindowOpen(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now));
  return hour >= 7 && hour <= 18;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Research is paused until CRON_SECRET is configured.' }, { status: 503 });
  }
  if (!cronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  // Vercel cron schedules are UTC. This guard keeps refill checks inside the
  // weekday business day across daylight-saving changes.
  if (!easternResearchWindowOpen()) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Outside the Eastern research window.' });
  }
  try {
    const queue = await firstTouchQueueStatus();
    if (queue.pending >= RESEARCH_QUEUE_FLOOR) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'Prospect queue is already stocked.',
        queue,
        queueFloor: RESEARCH_QUEUE_FLOOR,
      });
    }
    const run = await executeResearchRun('cron', { limit: 12, maxChecked: 60 });
    if (run.state === 'failed') return NextResponse.json({ ok: false, run, error: run.error }, { status: 500 });
    if (run.state === 'warning') return NextResponse.json({ ok: false, run, error: 'Research completed but added zero prospects.' }, { status: 424 });
    return NextResponse.json({ ok: true, run, queueBefore: queue, queueFloor: RESEARCH_QUEUE_FLOOR });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prospect research failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
