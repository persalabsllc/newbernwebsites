import { createHash } from 'node:crypto';

export type ReplyAction =
  | { kind: 'opt-out' }
  | { kind: 'reply'; subject: string; body: string; marker: string; alertOwner?: string }
  | { kind: 'escalate'; marker: string; reason: string };

function decodeBody(raw: string) {
  const withoutQuoted = raw
    .split(/\r?\n(?:On .+wrote:|From:\s)/i)[0]
    .split(/\r?\n--\s*\r?\n/)[0]
    .split(/\r?\n/)
    .filter(line => !line.trimStart().startsWith('>'))
    .join('\n')
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
  return withoutQuoted.slice(0, 4000);
}

function replySubject(subject: string) {
  const clean = subject.replace(/[\r\n]+/g, ' ').trim() || 'Website inquiry';
  return /^re:/i.test(clean) ? clean : `Re: ${clean}`;
}

function responseMarker(leadKey: string, messageId: string | undefined, text: string) {
  const source = messageId || text;
  return `reply:${leadKey}:${createHash('sha256').update(source).digest('hex').slice(0, 20)}`;
}

const signature = ['','Kyle','New Bern Websites'].join('\r\n');

export function classifyReply(input: {
  leadKey: string;
  business: string;
  subject: string;
  messageId?: string;
  rawBody: string;
}): ReplyAction {
  const text = decodeBody(input.rawBody);
  const marker = responseMarker(input.leadKey, input.messageId, text);
  const subject = replySubject(input.subject);

  if (/\b(unsubscribe|remove me|no thanks|stop emailing|do not contact|take me off)\b/i.test(text)) {
    return { kind: 'opt-out' };
  }

  if (/\b(discount|cheaper|negotiate|guarantee|refund|contract|legal|lawsuit|complaint|dispute)\b/i.test(text)) {
    return { kind: 'escalate', marker, reason: 'The reply asks for non-standard terms or contains a sensitive issue.' };
  }

  if (/\b(call|phone|meeting|meet|schedule|appointment|come by|visit)\b/i.test(text)) {
    return {
      kind: 'reply',
      subject,
      marker,
      body: [
        `Thanks for getting back to me. I’d be glad to coordinate a quick conversation. What is the best phone number to use, and what two time windows work well for you?`,
        signature,
      ].join('\r\n'),
      alertOwner: `${input.business} asked for a call or meeting. The automation requested their best number and two available time windows.`,
    };
  }

  const wantsPayment = /\b(send (?:me )?(?:the )?(?:payment|deposit) link|ready to (?:move forward|start|pay)|how do (?:i|we) pay|where do (?:i|we) pay)\b/i.test(text);
  if (wantsPayment) {
    const packageName = /\bmedia\b/i.test(text) ? 'Media Website' : /\bturnkey\b/i.test(text) ? 'Turnkey Website' : null;
    if (!packageName) {
      return {
        kind: 'reply',
        subject,
        marker,
        body: [`Absolutely. Which package would you like to start with—the $2,500 Turnkey Website or the $3,500 Media Website? Once you confirm, I’ll send the correct 50% kickoff link.`, signature].join('\r\n'),
      };
    }
    const link = packageName === 'Media Website'
      ? 'https://www.newbernwebsites.com/pay/media-deposit'
      : 'https://www.newbernwebsites.com/pay/turnkey-deposit';
    return {
      kind: 'reply',
      subject,
      marker,
      body: [
        `Great—here is the secure 50% kickoff link for the ${packageName}:`,
        link,
        '',
        'After the deposit is complete, I’ll send the intake steps so we can begin.',
        signature,
      ].join('\r\n'),
    };
  }

  if (/\b(interested|tell me more|more information|outline|price|pricing|cost|how much|what do you include|details|yes|sure)\b/i.test(text)) {
    return {
      kind: 'reply',
      subject,
      marker,
      body: [
        'Thanks for the reply. We offer two fixed-scope options:',
        '',
        '• Turnkey Website — $2,500 total ($1,250 to begin, $1,250 at completion). Up to five pages, lead form, local SEO setup, domain/hosting, and two revision rounds.',
        '• Media Website — $3,500 total ($1,750 to begin, $1,750 at completion). Everything above, plus a 90-minute local shoot, 25 edited photos, a silent hero video, and three vertical clips.',
        '',
        'Once we have the complete intake, the staging target is within 21 days. Which option sounds closer to what you need?',
        signature,
      ].join('\r\n'),
    };
  }

  return { kind: 'escalate', marker, reason: 'The reply does not match a safe, routine response path.' };
}
