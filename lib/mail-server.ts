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
  const password = process.env.MAIL_APP_PASSWORD;
  const smtpHost = process.env.MAIL_SMTP_HOST?.trim();
  const smtpPort = Number(process.env.MAIL_SMTP_PORT);
  const imapHost = process.env.MAIL_IMAP_HOST?.trim();
  const imapPort = Number(process.env.MAIL_IMAP_PORT);

  if (!username || !password || !smtpHost || !imapHost || !smtpPort || !imapPort) {
    throw new Error('Mail automation environment variables are incomplete.');
  }

  return { username, password, smtpHost, smtpPort, imapHost, imapPort };
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

async function sendPlainText(to: string, subject: string, body: string, purpose: 'self-test' | 'outreach') {
  const config = settings();
  if (!validMailbox(to)) throw new Error('A valid recipient email is required.');
  if (!subject.trim() || subject.length > 120) throw new Error('Subject must be between 1 and 120 characters.');
  if (!body.trim() || body.length > 5000) throw new Error('Message must be between 1 and 5,000 characters.');

  const headers = [
    `From: New Bern Websites <${cleanHeader(config.username)}>`,
    `Reply-To: ${cleanHeader(config.username)}`,
    `To: ${cleanHeader(to)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${purpose}-${Date.now()}-${Math.random().toString(36).slice(2)}@newbernwebsites.com>`,
    `Subject: ${cleanHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ];

  if (purpose === 'outreach') {
    headers.push(`List-Unsubscribe: <mailto:${cleanHeader(config.username)}?subject=unsubscribe>`);
  }

  const message = dotStuff([...headers, '', body].join('\r\n'));
  await smtpConversation([
    { command: 'EHLO newbernwebsites.com', expect: 250 },
    { command: 'AUTH LOGIN', expect: 334 },
    { command: Buffer.from(config.username).toString('base64'), expect: 334 },
    { command: Buffer.from(config.password).toString('base64'), expect: 235 },
    { command: `MAIL FROM:<${config.username}>`, expect: 250 },
    { command: `RCPT TO:<${to}>`, expect: 250 },
    { command: 'DATA', expect: 354 },
    { command: `${message}\r\n.`, expect: 250 },
    { command: 'QUIT', expect: 221 },
  ], config.smtpHost, config.smtpPort);
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
    'No prospect email has been sent. Outreach is available only in supervised, individually approved mode.',
  ].join('\r\n');
  await sendPlainText(config.username, subject, body, 'self-test');
}

export async function sendProspectEmail(input: { to: string; subject: string; body: string }) {
  if (/https?:\/\//i.test(input.body) || /\/pay\//i.test(input.body)) {
    throw new Error('First-touch outreach cannot contain links or payment requests.');
  }

  const complianceFooter = [
    '',
    '—',
    'Advertisement from New Bern Websites',
    '1423 South Glenburnie Road, Suite C, New Bern, NC 28562',
    'If you would rather not hear from us, reply “no thanks” and we will not contact you again.',
  ].join('\r\n');

  await sendPlainText(input.to.trim().toLowerCase(), input.subject.trim(), `${input.body.trim()}${complianceFooter}`, 'outreach');
}

export async function readInboxStatus() {
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
