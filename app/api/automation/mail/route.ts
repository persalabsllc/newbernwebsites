import { NextResponse } from 'next/server';
import { requireFirebaseUser } from '../../../../lib/firebase-server-auth';
import { readInboxStatus, sendOneOffEmail, sendProspectEmail, sendSelfTest, verifySmtp } from '../../../../lib/mail-server';
import { getAllProspects } from '../../../../lib/prospect-store';
import { currentFirstTouchLimit } from '../../../../lib/outreach-autopilot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const body = await request.json() as {
      action?: string;
      to?: string;
      subject?: string;
      message?: string;
    };

    if (body.action === 'verify') {
      const [inbox, prospects] = await Promise.all([readInboxStatus(), getAllProspects(), verifySmtp()]);
      return NextResponse.json({
        ok: true,
        email: user.email,
        inbox,
        outreachEnabled: true,
        mode: process.env.CRON_SECRET ? 'guarded-autopilot' : 'paused',
        autopilotReady: Boolean(process.env.CRON_SECRET),
        queued: prospects.length,
        dailyLimit: currentFirstTouchLimit(),
      });
    }

    if (body.action === 'send-self-test') {
      await sendSelfTest();
      return NextResponse.json({ ok: true, recipient: process.env.MAIL_USERNAME, outreachEnabled: true, mode: 'supervised' });
    }

    if (body.action === 'send-prospect') {
      await sendProspectEmail({
        to: String(body.to || ''),
        subject: String(body.subject || ''),
        body: String(body.message || ''),
      });
      return NextResponse.json({ ok: true, recipient: body.to, mode: 'manual-fallback' });
    }

    if (body.action === 'send-one-off') {
      const marker = await sendOneOffEmail({
        to: String(body.to || ''),
        subject: String(body.subject || ''),
        body: String(body.message || ''),
      });
      return NextResponse.json({ ok: true, recipient: body.to, marker, mode: 'one-off' });
    }

    return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mail request failed.';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
