import { after, NextResponse } from 'next/server';
import { requireFirebaseUser } from '../../../../lib/firebase-server-auth';
import { createResearchRun, finishResearchRun, latestResearchRun, researchRunById } from '../../../../lib/research-runs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    await requireFirebaseUser(request);
    const runId = new URL(request.url).searchParams.get('runId')?.trim();
    return NextResponse.json({ ok: true, run: runId ? await researchRunById(runId) : await latestResearchRun() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read research status.';
    return NextResponse.json({ ok: false, error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireFirebaseUser(request);
    const current = await latestResearchRun();
    if (current?.state === 'running' && Date.now() - Date.parse(current.startedAt) < 10 * 60_000) {
      return NextResponse.json({ ok: true, accepted: false, run: current }, { status: 202 });
    }
    const run = await createResearchRun('manual');
    after(async () => { await finishResearchRun(run, { limit: 8, maxChecked: 36 }); });
    return NextResponse.json({ ok: true, accepted: true, run }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prospect research failed.';
    return NextResponse.json({ ok: false, error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
