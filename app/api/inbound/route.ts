import { NextResponse } from 'next/server';
import { enrollInboundLead, type InboundLead } from '../../../lib/inbound-leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PACKAGES = new Set([
  'Free Website Audit',
  'Turnkey Website - $2,500',
  'Website + Professional Media - $3,500',
  'Custom Project',
  'Not Sure Yet',
  'Schedule a 15-minute call',
]);
const requestLog = new Map<string, number[]>();

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === 'newbernwebsites.com' || host === 'www.newbernwebsites.com' || host === 'localhost';
  } catch {
    return false;
  }
}

function rateLimited(request: Request) {
  const key = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const cutoff = Date.now() - 10 * 60_000;
  const recent = (requestLog.get(key) || []).filter(value => value > cutoff);
  if (recent.length >= 5) return true;
  recent.push(Date.now());
  requestLog.set(key, recent);
  return false;
}

async function createFirestoreLead(lead: InboundLead) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!projectId || !apiKey) throw new Error('Firebase server configuration is incomplete.');

  const project = lead.campaign === 'captain97'
    ? `[Captain 97.1 campaign]\n${lead.project}`.trim()
    : lead.project;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/websiteLeads?documentId=${encodeURIComponent(lead.id)}&key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: {
      name: { stringValue: lead.name },
      business: { stringValue: lead.business },
      email: { stringValue: lead.email },
      phone: { stringValue: lead.phone },
      package: { stringValue: lead.package },
      project: { stringValue: project },
      source: { stringValue: 'newbernwebsites.com' },
      createdAt: { timestampValue: lead.createdAt },
    } }),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`Firestore rejected lead intake (${response.status}).`);
  }
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return NextResponse.json({ ok: false, error: 'Invalid origin.' }, { status: 403 });
  if (rateLimited(request)) return NextResponse.json({ ok: false, error: 'Please wait before submitting again.' }, { status: 429 });

  try {
    const body = await request.json() as Record<string, unknown>;
    if (text(body.websiteFax, 200)) return NextResponse.json({ ok: true });

    const submissionId = text(body.submissionId, 64).toLowerCase();
    const name = text(body.name, 100);
    const business = text(body.business, 150);
    const email = text(body.email, 254).toLowerCase();
    const phone = text(body.phone, 40);
    const selectedPackage = text(body.package, 100);
    const project = text(body.project, 2960);
    const campaign = body.campaign === 'captain97' ? 'captain97' : 'website';

    if (!/^[a-z0-9-]{20,64}$/.test(submissionId) || !name || !business || !validEmail(email) || !PACKAGES.has(selectedPackage)) {
      return NextResponse.json({ ok: false, error: 'Please complete the required fields.' }, { status: 400 });
    }

    const lead: InboundLead = {
      id: submissionId,
      name,
      business,
      email,
      phone,
      package: selectedPackage,
      project,
      campaign,
      createdAt: new Date().toISOString(),
    };
    await createFirestoreLead(lead);
    await enrollInboundLead(lead);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lead intake failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
