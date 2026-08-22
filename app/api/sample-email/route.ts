import { NextResponse } from 'next/server';
import { readAutomationMessages, sendQueuedProspectEmail } from '../../../lib/mail-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SAMPLE_TOKEN = '967dcbe1498f4ac6865c951aa7b37847';
const SAMPLE_MARKER = 'sample:2026-08-22:kyle-deacon-jones';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  if (token !== SAMPLE_TOKEN) return NextResponse.json({ ok: false }, { status: 404 });

  const existing = await readAutomationMessages(SAMPLE_MARKER, 10);
  if (existing.some(message => message.marker === SAMPLE_MARKER)) {
    return NextResponse.json({ ok: true, alreadySent: true });
  }

  await sendQueuedProspectEmail({
    to: 'kyle.kratoville@deaconjonesautogroup.com',
    subject: 'Quick website idea for Deacon Jones Auto Group',
    marker: SAMPLE_MARKER,
    body: [
      'Hi Kyle,',
      '',
      'I came across Deacon Jones Auto Group while looking at businesses in Eastern North Carolina. I had one specific website idea that may help turn more mobile visitors into calls and inquiries.',
      '',
      'We build turnkey local-business websites and handle the design, copy, domain, hosting, and launch. Would it be useful if I sent over the idea?',
      '',
      'Kyle',
      'New Bern Websites',
    ].join('\r\n'),
  });

  return NextResponse.json({ ok: true, sent: true });
}
