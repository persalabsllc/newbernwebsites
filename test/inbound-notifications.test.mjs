import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { registerHooks } from 'node:module';
import tls from 'node:tls';
import test from 'node:test';

// Match Next.js's extensionless TypeScript import when running with Node.
const inboundUrl = new URL('../lib/inbound-leads.ts', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(context.parentURL === inboundUrl && specifier === './mail-server' ? './mail-server.ts' : specifier, context);
  },
});
const { enrollInboundLead } = await import('../lib/inbound-leads.ts');
const { sendOwnerAlert } = await import('../lib/mail-server.ts');

const lead = {
  id: 'notification-test-1234567890',
  name: 'Test Customer', business: 'Test Business', email: 'customer@example.test',
  phone: '252-555-0100', package: 'Free Website Audit', project: 'Please review our website.',
  campaign: 'website', createdAt: '2026-10-13T14:00:00.000Z',
};

function mailFixture(existing = []) {
  const markers = new Set(existing);
  const calls = [];
  const record = type => async input => { calls.push({ type, ...input }); markers.add(input.marker); };
  return {
    calls,
    mail: {
      hasAutomationMarker: async marker => markers.has(marker),
      recordAutomationEvent: record('record'), sendAutomatedReply: record('customer'), sendOwnerAlert: record('owner'),
    },
  };
}

test('contact and appointment requests notify the owner with details and customer Reply-To', async () => {
  for (const request of [lead, { ...lead, package: 'Schedule a 15-minute call', project: 'Preferred conversation: Wednesday at 10:30 AM Eastern. Notes: Discuss a new website.' }]) {
    const { mail, calls } = mailFixture();
    await enrollInboundLead(request, mail);
    const owner = calls.find(call => call.type === 'owner');
    assert.equal(owner.replyTo, request.email);
    assert.match(owner.body, /Test Customer/);
    assert.match(owner.body, /252-555-0100/);
    assert.ok(owner.body.includes(request.project));
    assert.match(owner.body, /https:\/\/www\.newbernwebsites\.com\/admin/);
    assert.match(owner.subject, request.package.startsWith('Schedule') ? /New appointment request/ : /New website inquiry/);
    assert.equal(calls.find(call => call.type === 'customer').to, request.email);
    await enrollInboundLead(request, mail);
    assert.equal(calls.length, 3, 'retrying an accepted submission does not resend either email');
  }
});

test('an existing customer confirmation never suppresses the separate owner alert', async () => {
  const { mail, calls } = mailFixture([`inbound-record:${lead.id}`, `inbound-ack:${lead.id}`]);
  await enrollInboundLead(lead, mail);
  assert.deepEqual(calls.map(call => call.type), ['owner']);
});

test('failed owner delivery rejects intake and can be retried without duplicate records', async () => {
  const { mail, calls } = mailFixture();
  const sendOwner = mail.sendOwnerAlert;
  mail.sendOwnerAlert = async () => { throw new Error('SMTP unavailable'); };
  await assert.rejects(enrollInboundLead(lead, mail), /SMTP unavailable/);
  assert.deepEqual(calls.map(call => call.type), ['record']);
  mail.sendOwnerAlert = sendOwner;
  await enrollInboundLead(lead, mail);
  assert.deepEqual(calls.map(call => call.type), ['record', 'owner', 'customer']);
});

function fakeMailEnvironment(t) {
  const values = {
    MAIL_USERNAME: 'owner@example.test', MAIL_APP_PASSWORD: 'test-only',
    MAIL_SMTP_HOST: 'smtp.example.test', MAIL_SMTP_PORT: '465',
    MAIL_IMAP_HOST: 'imap.example.test', MAIL_IMAP_PORT: '993',
  };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
}

test('owner alerts use SMTP delivery, preserve customer Reply-To, and file a tracking copy', async t => {
  fakeMailEnvironment(t);
  const connections = [];
  t.mock.method(tls, 'connect', options => {
    const socket = new EventEmitter();
    const commands = [];
    connections.push({ host: options.host, commands });
    socket.end = () => {};
    let smtpStep = 0;
    socket.write = command => {
      commands.push(command);
      let response;
      if (options.host.startsWith('smtp.')) {
        response = `${[250, 334, 334, 235, 250, 250, 354, 250, 221][smtpStep++]} OK\r\n`;
      } else if (command.startsWith('A1 LOGIN')) response = 'A1 OK\r\n';
      else if (command.startsWith('A2 APPEND')) response = '+ Ready\r\n';
      else if (command.startsWith('From:')) response = 'A2 OK\r\n';
      else response = 'A3 OK\r\n';
      queueMicrotask(() => socket.emit('data', Buffer.from(response)));
    };
    queueMicrotask(() => socket.emit('data', Buffer.from(options.host.startsWith('smtp.') ? '220 Ready\r\n' : '* OK Ready\r\n')));
    return socket;
  });
  await sendOwnerAlert({ subject: 'New website inquiry', body: 'New request details.', marker: 'inbound-owner:test', replyTo: lead.email });
  const smtp = connections.find(connection => connection.host.startsWith('smtp.'));
  assert.ok(smtp, 'owner alert must not take the internal Sent-only shortcut');
  assert.deepEqual(smtp.commands.filter(command => command.startsWith('RCPT TO')), ['RCPT TO:<owner@example.test>\r\n']);
  const message = smtp.commands.find(command => command.startsWith('From:'));
  assert.match(message, /Reply-To: customer@example\.test\r\n/);
  assert.match(message, /X-NBW-Automation-Key: inbound-owner:test\r\n/);
  assert.ok(connections.some(connection => connection.commands.some(command => command.startsWith('A2 APPEND "Sent"'))));
});

test('a customer address cannot inject email headers', async t => {
  fakeMailEnvironment(t);
  const connect = t.mock.method(tls, 'connect', () => { throw new Error('Must not connect'); });
  await assert.rejects(sendOwnerAlert({ subject: 'Test', body: 'Test', marker: 'test', replyTo: 'customer@example.test\r\nBcc: other@example.test' }), /valid reply-to email/);
  assert.equal(connect.mock.callCount(), 0);
});
