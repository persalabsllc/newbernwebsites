import { NextResponse } from 'next/server';
import { cronAuthorized } from '../../../../lib/cron-auth';
import { researchProspects } from '../../../../lib/prospect-research';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Research is paused until CRON_SECRET is configured.' }, { status: 503 });
  }
  if (!cronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, result: await researchProspects(60) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prospect research failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
