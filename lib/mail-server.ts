import tls from 'node:tls';

type MailSettings = {
  username: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
};

function settings(): MailSettings {
  const username = process.env.MAIL_USERNAME?.trim();
  // Deployment dashboards and CLI input can preserve an accidental trailing
  // newline. It is never part of a Private Email app password and breaks both
  // SMTP AUTH and the raw IMAP LOGIN command.
  const password = process.env.MAIL_APP_PASSWORD?.trim();
  const smtpHost = process.env.MAIL_SMTP_HOST?.trim();
  const smtpPort = Number(process.env.MAIL_SMTP_PORT);
  const imapHost = process.env.MAIL_IMAP_HOST?.trim();
  const imapPort = Number(process.env.MAIL_IMAP_PORT);

  if (!username || !password || !smtpHost || !imapHost || !smtpPort || !imapPort) {
    throw new Error('Mail automation environment variables are incomplete.');
  }

  return { username, password, smtpHost, smtpPort, imapHost, imapPort };
}

function isTransientImapError(error: unknown) {
  const value = error as NodeJS.ErrnoException;
  return ['ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT'].includes(value?.code || '')
    || /connection timed out/i.test(value?.message || '');
}

async function withImapRetry<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientImapError(error)) throw error;
    await new Promise(resolve => setTimeout(resolve, 500));
    return operation();
  }
}

function smtpConversation(commands: Array<{ command: string; expect: number }>, host: string, port: number) {
  return new Promise<string[]>((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true });
    const responses: string[] = [];
    let buffer = '';
    let index = -1;
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.end();
      if (error) reject(error); else resolve(responses);
    };

    const timer = setTimeout(() => finish(new Error('SMTP connection timed out.')), 15_000);
    socket.on('error', error => { clearTimeout(timer); finish(error); });
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!/^\d{3}[ -]/.test(line)) continue;
        responses.push(line);
        if (line[3] === '-') continue;

        const code = Number(line.slice(0, 3));
        const expected = index < 0 ? 220 : commands[index].expect;
        if (code !== expected) {
          clearTimeout(timer);
          finish(new Error(`SMTP rejected a command (${code}).`));
          return;
        }

        index += 1;
        if (index >= commands.length) {
          clearTimeout(timer);
          finish();
          return;
        }
        socket.write(`${commands[index].command}\r\n`);
      }
    });
  });
}

function cleanHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function validMailbox(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function dotStuff(value: string) {
  return value.replace(/^\./gm, '..');
}

type SendPurpose = 'self-test' | 'outreach' | 'reply' | 'internal';

type SendOptions = {
  purpose: SendPurpose;
  marker?: string;
  storeInSent?: boolean;
  replyToMessageId?: string;
};

async function deliverRawMessage(config: MailSettings, recipients: string[], rawMessage: string) {
  await smtpConversation([
    { command: 'EHLO newbernwebsites.com', expect: 250 },
    { command: 'AUTH LOGIN', expect: 334 },
    { command: Buffer.from(config.username).toString('base64'), expect: 334 },
    { command: Buffer.from(config.password).toString('base64'), expect: 235 },
    { command: `MAIL FROM:<${config.username}>`, expect: 250 },
    ...recipients.map(recipient => ({ command: `RCPT TO:<${recipient}>`, expect: 250 })),
    { command: 'DATA', expect: 354 },
    { command: `${dotStuff(rawMessage)}\r\n.`, expect: 250 },
    { command: 'QUIT', expect: 221 },
  ], config.smtpHost, config.smtpPort);
}

async function sendPlainText(to: string, subject: string, body: string, options: SendOptions) {
  const config = settings();
  if (!validMailbox(to)) throw new Error('A valid recipient email is required.');
  if (!subject.trim() || subject.length > 120) throw new Error('Subject must be between 1 and 120 characters.');
  if (!body.trim() || body.length > 5000) throw new Error('Message must be between 1 and 5,000 characters.');

  const messageId = `<${options.purpose}-${Date.now()}-${Math.random().toString(36).slice(2)}@newbernwebsites.com>`;
  const headers = [
    `From: New Bern Websites <${cleanHeader(config.username)}>`,
    `Reply-To: ${cleanHeader(config.username)}`,
    `To: ${cleanHeader(to)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    `Subject: ${cleanHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ];

  if (options.purpose === 'outreach') {
    headers.push(`List-Unsubscribe: <mailto:${cleanHeader(config.username)}?subject=unsubscribe>`);
  }
  if (options.marker) headers.push(`X-NBW-Automation-Key: ${cleanHeader(options.marker)}`);
  if (options.replyToMessageId) {
    const messageId = cleanHeader(options.replyToMessageId);
    headers.push(`In-Reply-To: ${messageId}`, `References: ${messageId}`);
  }

  const rawMessage = [...headers, '', body].join('\r\n');
  // The external recipient is the only SMTP envelope recipient. A Sent-folder
  // copy is filed separately over IMAP so tracking never fills the Inbox.
  await deliverRawMessage(config, [to], rawMessage);
  if (options.storeInSent && to.toLowerCase() !== config.username.toLowerCase()) {
    try {
      await appendSentMessage(rawMessage);
    } catch (appendError) {
      // Delivery already succeeded. Preserve the exact Message-ID and marker in
      // a self-copy only when Sent filing fails so the next cron cannot resend.
      try {
        await deliverRawMessage(config, [config.username], rawMessage);
      } catch (copyError) {
        console.error(JSON.stringify({
          event: 'sent-copy-failed',
          marker: options.marker || '',
          appendError: appendError instanceof Error ? appendError.message : 'Sent append failed.',
          copyError: copyError instanceof Error ? copyError.message : 'Tracking copy failed.',
          messageId,
        }));
      }
    }
  }
}

export async function sendOneOffEmail(input: { to: string; subject: string; body: string }) {
  const marker = `oneoff:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await sendPlainText(input.to.trim().toLowerCase(), input.subject.trim(), input.body.trim(), {
    purpose: 'outreach',
    marker,
    storeInSent: true,
  });
  return marker;
}

export async function storeProspectRecord(marker: string, business: string, encodedRecord: string) {
  const config = settings();
  await sendPlainText(
    config.username,
    `[NBW Prospect] ${business}`,
    `NBW_PROSPECT_V1:${encodedRecord}`,
    { purpose: 'internal', marker },
  );
}

export async function recordAutomationEvent(input: { marker: string; subject: string; body: string }) {
  const config = settings();
  await sendPlainText(
    config.username,
    `[NBW Automation] ${input.subject}`,
    input.body,
    { purpose: 'internal', marker: input.marker },
  );
}

export async function verifySmtp() {
  const config = settings();
  await smtpConversation([
    { command: 'EHLO newbernwebsites.com', expect: 250 },
    { command: 'AUTH LOGIN', expect: 334 },
    { command: Buffer.from(config.username).toString('base64'), expect: 334 },
    { command: Buffer.from(config.password).toString('base64'), expect: 235 },
    { command: 'QUIT', expect: 221 },
  ], config.smtpHost, config.smtpPort);
}

export async function sendSelfTest() {
  const config = settings();
  const subject = 'New Bern Websites automation connection test';
  const body = [
    'The protected mail engine successfully authenticated and sent this message.',
    '',
    'No prospect email has been sent by this diagnostic.',
  ].join('\r\n');
  await sendPlainText(config.username, subject, body, { purpose: 'self-test' });
}

function outreachFooter() {
  return [
    '',
    '—',
    'Advertisement from New Bern Websites',
    '1423 South Glenburnie Road, Suite C, New Bern, NC 28562',
    'If you would rather not hear from us, reply “no thanks” and we will not contact you again.',
  ].join('\r\n');
}

function assertLinkFreeOutreach(body: string) {
  if (/https?:\/\//i.test(body) || /\/pay\//i.test(body)) {
    throw new Error('Cold outreach cannot contain links or payment requests.');
  }
}

export async function sendProspectEmail(input: { to: string; subject: string; body: string }) {
  assertLinkFreeOutreach(input.body);

  await sendPlainText(input.to.trim().toLowerCase(), input.subject.trim(), `${input.body.trim()}${outreachFooter()}`, { purpose: 'outreach', storeInSent: true });
}

export async function sendQueuedProspectEmail(input: { to: string; subject: string; body: string; marker: string }) {
  assertLinkFreeOutreach(input.body);

  await sendPlainText(
    input.to.trim().toLowerCase(),
    input.subject.trim(),
    `${input.body.trim()}${outreachFooter()}`,
    { purpose: 'outreach', marker: input.marker, storeInSent: true },
  );
}

export async function sendFollowUpEmail(input: {
  to: string;
  subject: string;
  body: string;
  marker: string;
  replyToMessageId?: string;
}) {
  assertLinkFreeOutreach(input.body);
  await sendPlainText(
    input.to.trim().toLowerCase(),
    input.subject.trim(),
    `${input.body.trim()}${outreachFooter()}`,
    {
      purpose: 'outreach',
      marker: input.marker,
      storeInSent: true,
      replyToMessageId: input.replyToMessageId,
    },
  );
}

export async function sendAutomatedReply(input: {
  to: string;
  subject: string;
  body: string;
  marker: string;
  replyToMessageId?: string;
}) {
  await sendPlainText(input.to.trim().toLowerCase(), input.subject.trim(), input.body.trim(), {
    purpose: 'reply',
    marker: input.marker,
    storeInSent: true,
    replyToMessageId: input.replyToMessageId,
  });
}

export async function sendOwnerAlert(input: { subject: string; body: string; marker: string }) {
  const config = settings();
  await sendPlainText(config.username, input.subject, input.body, {
    purpose: 'internal',
    marker: input.marker,
  });
}

async function readInboxStatusOnce() {
  const config = settings();
  return new Promise<{ messages: number; unseen: number }>((resolve, reject) => {
    const socket = tls.connect({ host: config.imapHost, port: config.imapPort, servername: config.imapHost, rejectUnauthorized: true });
    let buffer = '';
    let status = '';
    let settled = false;
    let stage: 'greeting' | 'login' | 'status' | 'logout' = 'greeting';

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.end();
      if (error) reject(error);
      else {
        const messages = Number(status.match(/MESSAGES\s+(\d+)/i)?.[1] || 0);
        const unseen = Number(status.match(/UNSEEN\s+(\d+)/i)?.[1] || 0);
        resolve({ messages, unseen });
      }
    };

    const timer = setTimeout(() => finish(new Error('IMAP connection timed out.')), 15_000);
    socket.on('error', error => { clearTimeout(timer); finish(error); });
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      if (stage === 'greeting' && buffer.includes('* OK')) {
        stage = 'login';
        socket.write(`A1 LOGIN "${config.username.replace(/(["\\])/g, '\\$1')}" "${config.password.replace(/(["\\])/g, '\\$1')}"\r\n`);
      }
      if (stage === 'login' && /A1 OK/i.test(buffer)) {
        stage = 'status';
        socket.write('A2 STATUS INBOX (MESSAGES UNSEEN)\r\n');
      }
      if (stage === 'status' && /A2 OK/i.test(buffer)) {
        status = buffer;
        stage = 'logout';
        socket.write('A3 LOGOUT\r\n');
      }
      if (stage === 'logout' && /A3 OK/i.test(buffer)) {
        clearTimeout(timer);
        finish();
      }
      if (/A[123] (NO|BAD)/i.test(buffer)) {
        clearTimeout(timer);
        finish(new Error('IMAP authentication or command failed.'));
      }
    });
  });
}

export function readInboxStatus() {
  return withImapRetry(readInboxStatusOnce);
}

function escapeImap(value: string) {
  return value.replace(/(["\\])/g, '\\$1');
}

async function appendSentMessageOnce(rawMessage: string) {
  const config = settings();
  return new Promise<void>((resolve, reject) => {
    const socket = tls.connect({ host: config.imapHost, port: config.imapPort, servername: config.imapHost, rejectUnauthorized: true });
    let buffer = '';
    let settled = false;
    let stage: 'greeting' | 'login' | 'append-ready' | 'append' | 'logout' = 'greeting';

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.end();
      if (error) reject(error); else resolve();
    };

    const timer = setTimeout(() => finish(new Error('IMAP Sent-folder append timed out.')), 20_000);
    socket.on('error', error => { clearTimeout(timer); finish(error); });
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      if (stage === 'greeting' && buffer.includes('* OK')) {
        stage = 'login';
        socket.write(`A1 LOGIN "${escapeImap(config.username)}" "${escapeImap(config.password)}"\r\n`);
      }
      if (stage === 'login' && /A1 OK/i.test(buffer)) {
        stage = 'append-ready';
        buffer = '';
        socket.write(`A2 APPEND "Sent" (\\Seen) {${Buffer.byteLength(rawMessage, 'utf8')}}\r\n`);
      }
      if (stage === 'append-ready' && /\+(?: |\r|\n)/.test(buffer)) {
        stage = 'append';
        buffer = '';
        socket.write(`${rawMessage}\r\n`);
      }
      if (stage === 'append' && /A2 OK/i.test(buffer)) {
        stage = 'logout';
        socket.write('A3 LOGOUT\r\n');
      }
      if (stage === 'logout' && /A3 OK/i.test(buffer)) {
        clearTimeout(timer);
        finish();
      }
      if (/A[1-3] (NO|BAD)/i.test(buffer)) {
        clearTimeout(timer);
        finish(new Error('IMAP rejected the Sent-folder append.'));
      }
    });
  });
}

function appendSentMessage(rawMessage: string) {
  return withImapRetry(() => appendSentMessageOnce(rawMessage));
}

async function moveInboxMessagesToSentOnce(search: string) {
  const config = settings();
  return new Promise<number>((resolve, reject) => {
    const socket = tls.connect({ host: config.imapHost, port: config.imapPort, servername: config.imapHost, rejectUnauthorized: true });
    let buffer = '';
    let settled = false;
    let ids: number[] = [];
    let stage: 'greeting' | 'login' | 'select' | 'search' | 'copy' | 'delete' | 'expunge' | 'logout' = 'greeting';

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.end();
      if (error) reject(error); else resolve(ids.length);
    };

    const timer = setTimeout(() => finish(new Error('IMAP outbound-copy cleanup timed out.')), 25_000);
    socket.on('error', error => { clearTimeout(timer); finish(error); });
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      if (stage === 'greeting' && buffer.includes('* OK')) {
        stage = 'login';
        socket.write(`A1 LOGIN "${escapeImap(config.username)}" "${escapeImap(config.password)}"\r\n`);
      }
      if (stage === 'login' && /A1 OK/i.test(buffer)) {
        stage = 'select';
        socket.write('A2 SELECT INBOX\r\n');
      }
      if (stage === 'select' && /A2 OK/i.test(buffer)) {
        stage = 'search';
        socket.write(`A3 UID SEARCH ${search}\r\n`);
      }
      if (stage === 'search' && /A3 OK/i.test(buffer)) {
        const searchLine = buffer.match(/\* SEARCH([^\r\n]*)/i)?.[1] || '';
        ids = searchLine.trim().split(/\s+/).filter(Boolean).map(Number).filter(Number.isFinite);
        if (!ids.length) {
          stage = 'logout';
          socket.write('A7 LOGOUT\r\n');
        } else {
          stage = 'copy';
          socket.write(`A4 UID COPY ${ids.join(',')} "Sent"\r\n`);
        }
      }
      if (stage === 'copy' && /A4 OK/i.test(buffer)) {
        stage = 'delete';
        socket.write(`A5 UID STORE ${ids.join(',')} +FLAGS.SILENT (\\Deleted)\r\n`);
      }
      if (stage === 'delete' && /A5 OK/i.test(buffer)) {
        stage = 'expunge';
        socket.write('A6 EXPUNGE\r\n');
      }
      if (stage === 'expunge' && /A6 OK/i.test(buffer)) {
        stage = 'logout';
        socket.write('A7 LOGOUT\r\n');
      }
      if (stage === 'logout' && /A7 OK/i.test(buffer)) {
        clearTimeout(timer);
        finish();
      }
      if (/A[1-7] (NO|BAD)/i.test(buffer)) {
        clearTimeout(timer);
        finish(new Error('IMAP rejected outbound-copy cleanup.'));
      }
    });
  });
}

export function organizeOutboundCopies() {
  const header = 'HEADER X-NBW-Automation-Key';
  const search = `OR OR OR OR ${header} "outreach:" ${header} "followup:" ${header} "reply:" ${header} "inbound-ack:" ${header} "oneoff:"`;
  return withImapRetry(() => moveInboxMessagesToSentOnce(search));
}

async function imapExchangeOnce(input: { search: string; fetchLatest?: boolean; mailbox?: string }) {
  const config = settings();
  return new Promise<{ ids: number[]; raw?: string }>((resolve, reject) => {
    const socket = tls.connect({ host: config.imapHost, port: config.imapPort, servername: config.imapHost, rejectUnauthorized: true });
    let buffer = '';
    let settled = false;
    let ids: number[] = [];
    let stage: 'greeting' | 'login' | 'select' | 'search' | 'fetch' | 'logout' = 'greeting';

    const finish = (error?: Error, raw?: string) => {
      if (settled) return;
      settled = true;
      socket.end();
      if (error) reject(error); else resolve({ ids, raw });
    };

    const timer = setTimeout(() => finish(new Error('IMAP connection timed out.')), 20_000);
    socket.on('error', error => { clearTimeout(timer); finish(error); });
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      if (stage === 'greeting' && buffer.includes('* OK')) {
        stage = 'login';
        socket.write(`A1 LOGIN "${escapeImap(config.username)}" "${escapeImap(config.password)}"\r\n`);
      }
      if (stage === 'login' && /A1 OK/i.test(buffer)) {
        stage = 'select';
        socket.write(`A2 SELECT "${escapeImap(input.mailbox || 'INBOX')}"\r\n`);
      }
      if (stage === 'select' && /A2 OK/i.test(buffer)) {
        stage = 'search';
        socket.write(`A3 UID SEARCH ${input.search}\r\n`);
      }
      if (stage === 'search' && /A3 OK/i.test(buffer)) {
        const searchLine = buffer.match(/\* SEARCH([^\r\n]*)/i)?.[1] || '';
        ids = searchLine.trim().split(/\s+/).filter(Boolean).map(Number).filter(Number.isFinite);
        if (input.fetchLatest && ids.length) {
          stage = 'fetch';
          buffer = '';
          socket.write(`A4 UID FETCH ${ids.at(-1)} BODY.PEEK[]\r\n`);
        } else {
          stage = 'logout';
          socket.write('A5 LOGOUT\r\n');
        }
      }
      if (stage === 'fetch' && /A4 OK/i.test(buffer)) {
        const literal = buffer.match(/\{(\d+)\}\r\n/);
        let raw: string | undefined;
        if (literal?.index !== undefined) {
          const start = literal.index + literal[0].length;
          raw = buffer.slice(start, start + Number(literal[1]));
        }
        stage = 'logout';
        socket.write('A5 LOGOUT\r\n');
        clearTimeout(timer);
        finish(undefined, raw);
      }
      if (stage === 'logout' && /A5 OK/i.test(buffer)) {
        clearTimeout(timer);
        finish();
      }
      if (/A[1-5] (NO|BAD)/i.test(buffer)) {
        clearTimeout(timer);
        finish(new Error('IMAP authentication or command failed.'));
      }
    });
  });
}

function imapExchange(input: { search: string; fetchLatest?: boolean; mailbox?: string }) {
  return withImapRetry(() => imapExchangeOnce(input));
}

async function imapFetchAllOnce(search: string, limit = 100, headersOnly = false, mailbox = 'INBOX') {
  const config = settings();
  return new Promise<Array<{ uid: number; raw: string }>>((resolve, reject) => {
    const socket = tls.connect({ host: config.imapHost, port: config.imapPort, servername: config.imapHost, rejectUnauthorized: true });
    let buffer = '';
    let settled = false;
    let ids: number[] = [];
    let stage: 'greeting' | 'login' | 'select' | 'search' | 'fetch' = 'greeting';

    const finish = (error?: Error, messages: Array<{ uid: number; raw: string }> = []) => {
      if (settled) return;
      settled = true;
      socket.end();
      if (error) reject(error); else resolve(messages);
    };

    const timer = setTimeout(() => finish(new Error('IMAP connection timed out.')), 25_000);
    socket.on('error', error => { clearTimeout(timer); finish(error); });
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      if (stage === 'greeting' && buffer.includes('* OK')) {
        stage = 'login';
        socket.write(`A1 LOGIN "${escapeImap(config.username)}" "${escapeImap(config.password)}"\r\n`);
      }
      if (stage === 'login' && /A1 OK/i.test(buffer)) {
        stage = 'select';
        socket.write(`A2 SELECT "${escapeImap(mailbox)}"\r\n`);
      }
      if (stage === 'select' && /A2 OK/i.test(buffer)) {
        stage = 'search';
        socket.write(`A3 UID SEARCH ${search}\r\n`);
      }
      if (stage === 'search' && /A3 OK/i.test(buffer)) {
        const searchLine = buffer.match(/\* SEARCH([^\r\n]*)/i)?.[1] || '';
        ids = searchLine.trim().split(/\s+/).filter(Boolean).map(Number).filter(Number.isFinite).slice(-limit);
        if (!ids.length) {
          clearTimeout(timer);
          finish();
          return;
        }
        stage = 'fetch';
        buffer = '';
        const section = headersOnly
          ? 'BODY.PEEK[HEADER.FIELDS (FROM SUBJECT MESSAGE-ID DATE CONTENT-TYPE X-NBW-AUTOMATION-KEY IN-REPLY-TO REFERENCES)]'
          : 'BODY.PEEK[]';
        socket.write(`A4 UID FETCH ${ids.join(',')} ${section}\r\n`);
      }
      if (stage === 'fetch' && /A4 OK/i.test(buffer)) {
        const messages: Array<{ uid: number; raw: string }> = [];
        let cursor = 0;
        while (cursor < buffer.length) {
          const literal = /\{(\d+)\}\r\n/g;
          literal.lastIndex = cursor;
          const match = literal.exec(buffer);
          if (!match?.index) break;
          const prefix = buffer.slice(cursor, match.index);
          const uid = Number(prefix.match(/UID\s+(\d+)/i)?.[1]);
          const start = match.index + match[0].length;
          const length = Number(match[1]);
          if (Number.isFinite(uid) && buffer.length >= start + length) {
            messages.push({ uid, raw: buffer.slice(start, start + length) });
          }
          cursor = start + length;
        }
        clearTimeout(timer);
        finish(undefined, messages);
      }
      if (/A[1-4] (NO|BAD)/i.test(buffer)) {
        clearTimeout(timer);
        finish(new Error('IMAP authentication or command failed.'));
      }
    });
  });
}

function imapFetchAll(search: string, limit = 100, headersOnly = false, mailbox = 'INBOX') {
  return withImapRetry(() => imapFetchAllOnce(search, limit, headersOnly, mailbox));
}

function parseMessage(raw: string) {
  const [rawHeaders = '', ...rawBodyParts] = raw.split(/\r?\n\r?\n/);
  const unfoldedHeaders = rawHeaders.replace(/\r?\n[ \t]+/g, ' ');
  const fromHeader = unfoldedHeaders.match(/^From:\s*(.+)$/im)?.[1]?.trim() || '';
  const bracketedFrom = fromHeader.match(/<([^<>]+)>/)?.[1]?.trim();
  const plainFrom = fromHeader.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  return {
    subject: unfoldedHeaders.match(/^Subject:\s*(.+)$/im)?.[1]?.trim() || '',
    messageId: unfoldedHeaders.match(/^Message-ID:\s*(.+)$/im)?.[1]?.trim(),
    inReplyTo: unfoldedHeaders.match(/^In-Reply-To:\s*(.+)$/im)?.[1]?.trim(),
    references: unfoldedHeaders.match(/^References:\s*(.+)$/im)?.[1]?.trim(),
    marker: unfoldedHeaders.match(/^X-NBW-Automation-Key:\s*(.+)$/im)?.[1]?.trim(),
    from: (bracketedFrom || plainFrom || '').toLowerCase(),
    contentType: unfoldedHeaders.match(/^Content-Type:\s*([^;\r\n]+)/im)?.[1]?.trim().toLowerCase() || 'text/plain',
    date: unfoldedHeaders.match(/^Date:\s*(.+)$/im)?.[1]?.trim(),
    body: rawBodyParts.join('\n\n'),
  };
}

export async function readStoredProspectRecords() {
  // Prospect records are append-only and can exceed the generic 100-message
  // safety default during an active outreach sprint.
  const messages = await imapFetchAll('SUBJECT "[NBW Prospect]"', 5000);
  return messages.map(message => ({ uid: message.uid, ...parseMessage(message.raw) }));
}

export async function readAutomationMessages(markerPrefix = '', limit = 5000, headersOnly = true) {
  const search = `HEADER X-NBW-Automation-Key "${escapeImap(markerPrefix)}"`;
  const [inboxMessages, sentMessages] = await Promise.all([
    imapFetchAll(search, limit, headersOnly, 'INBOX'),
    imapFetchAll(search, limit, headersOnly, 'Sent'),
  ]);
  // Prefer the filed Sent copy if a historical Inbox fallback shares a marker.
  const messages = [...inboxMessages, ...sentMessages];
  return messages.map(message => ({ uid: message.uid, ...parseMessage(message.raw) }));
}

export async function readInboxMessages(input: { unseenOnly?: boolean; limit?: number } = {}) {
  const messages = await imapFetchAll(input.unseenOnly ? 'UNSEEN' : 'ALL', input.limit || 500);
  return messages.map(message => ({ uid: message.uid, ...parseMessage(message.raw) }));
}

export async function readInboundMessages(input: { unseenOnly?: boolean; limit?: number } = {}) {
  const config = settings();
  const search = `${input.unseenOnly ? 'UNSEEN ' : ''}NOT FROM "${escapeImap(config.username)}"`;
  const messages = await imapFetchAll(search, input.limit || 1000);
  return messages.map(message => ({ uid: message.uid, ...parseMessage(message.raw) }));
}

export async function readAutomationMarker(marker: string) {
  const search = `HEADER X-NBW-Automation-Key "${escapeImap(marker)}"`;
  const [inbox, sent] = await Promise.all([
    imapExchange({ search, fetchLatest: true, mailbox: 'INBOX' }),
    imapExchange({ search, fetchLatest: true, mailbox: 'Sent' }),
  ]);
  const result = sent.raw ? sent : inbox;
  if (!result.raw) return null;
  return { uid: result.ids.at(-1) as number, ...parseMessage(result.raw) };
}

export async function hasAutomationMarker(marker: string) {
  const search = `HEADER X-NBW-Automation-Key "${escapeImap(marker)}"`;
  const [inbox, sent] = await Promise.all([
    imapExchange({ search, mailbox: 'INBOX' }),
    imapExchange({ search, mailbox: 'Sent' }),
  ]);
  return inbox.ids.length > 0 || sent.ids.length > 0;
}

async function readLatestFromSearch(email: string, unseenOnly: boolean) {
  if (!validMailbox(email)) throw new Error('A valid sender email is required.');
  const prefix = unseenOnly ? 'UNSEEN ' : '';
  const result = await imapExchange({ search: `${prefix}FROM "${escapeImap(email)}"`, fetchLatest: true });
  if (!result.raw) return null;

  const { subject, messageId, contentType, body, date } = parseMessage(result.raw);

  // Automated replies are only safe for plain-text messages. HTML or attachments
  // are escalated rather than interpreted loosely.
  return { uid: result.ids.at(-1) as number, subject, messageId, body, contentType, date };
}

export async function readLatestUnseenFrom(email: string) {
  return readLatestFromSearch(email, true);
}

export async function readLatestFrom(email: string) {
  return readLatestFromSearch(email, false);
}

export async function markMessageSeen(uid: number) {
  const config = settings();
  return new Promise<void>((resolve, reject) => {
    const socket = tls.connect({ host: config.imapHost, port: config.imapPort, servername: config.imapHost, rejectUnauthorized: true });
    let buffer = '';
    let settled = false;
    let stage: 'greeting' | 'login' | 'select' | 'store' | 'logout' = 'greeting';
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.end();
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => finish(new Error('IMAP connection timed out.')), 15_000);
    socket.on('error', error => { clearTimeout(timer); finish(error); });
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      if (stage === 'greeting' && buffer.includes('* OK')) {
        stage = 'login';
        socket.write(`A1 LOGIN "${escapeImap(config.username)}" "${escapeImap(config.password)}"\r\n`);
      }
      if (stage === 'login' && /A1 OK/i.test(buffer)) {
        stage = 'select';
        socket.write('A2 SELECT INBOX\r\n');
      }
      if (stage === 'select' && /A2 OK/i.test(buffer)) {
        stage = 'store';
        socket.write(`A3 UID STORE ${uid} +FLAGS (\\Seen)\r\n`);
      }
      if (stage === 'store' && /A3 OK/i.test(buffer)) {
        stage = 'logout';
        socket.write('A4 LOGOUT\r\n');
      }
      if (stage === 'logout' && /A4 OK/i.test(buffer)) {
        clearTimeout(timer);
        finish();
      }
      if (/A[1-4] (NO|BAD)/i.test(buffer)) {
        clearTimeout(timer);
        finish(new Error('IMAP command failed.'));
      }
    });
  });
}
