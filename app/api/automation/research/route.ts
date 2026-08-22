import { NextResponse } from 'next/server';
import { requireFirebaseUser } from '../../../../lib/firebase-server-auth';
import { researchProspects } from '../../../../lib/prospect-research';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    await requireFirebaseUser(request);
    const result = await researchProspects(60);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prospect research failed.';
    return NextResponse.json({ ok: false, error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
