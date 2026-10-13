import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { AUTOMATIC_OUTREACH_ENABLED } from '../lib/automation-policy.ts';
import { websitePaymentStatus } from '../lib/payment-status.ts';

const session = (status, payment_status, source = 'newbernwebsites.com') => ({
  status, payment_status, metadata: { source },
});

test('unfinished and expired checkouts are never reported as submitted', () => {
  assert.equal(websitePaymentStatus(session('open', 'unpaid')), 'not-submitted');
  assert.equal(websitePaymentStatus(session('expired', 'unpaid')), 'not-submitted');
});

test('distinguishes completed payments from asynchronous processing', () => {
  assert.equal(websitePaymentStatus(session('complete', 'paid')), 'paid');
  assert.equal(websitePaymentStatus(session('complete', 'unpaid')), 'processing');
});

test('missing and unrelated checkout sessions cannot confirm a website payment', () => {
  assert.equal(websitePaymentStatus(null), 'unknown');
  assert.equal(websitePaymentStatus(session('complete', 'paid', 'other-business')), 'unknown');
});

test('automatic deployments and research are enabled without scheduling email jobs', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.git.deploymentEnabled, true);
  assert.equal(AUTOMATIC_OUTREACH_ENABLED, false);
  assert.deepEqual(config.crons.map(job => job.path), ['/api/cron/research']);
});
