import { NextResponse } from 'next/server';
import { requireFirebaseUser } from '../../../../lib/firebase-server-auth';
import { readInboxStatus, sendSelfTest, verifySmtp } from '../../../../lib/mail-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = await request.json() as { action?: string };

    if (body.action === 'verify') {
      const [inbox] = await Promise.all([readInboxStatus(), verifySmtp()]);
      return NextResponse.json({ ok: true, email: user.email, inbox, outreachEnabled: false });
    }

    if (body.action === 'send-self-test') {
      await sendSelfTest();
      return NextResponse.json({ ok: true, recipient: process.env.MAIL_USERNAME, outreachEnabled: false });
    }

    return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mail diagnostic failed.';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

