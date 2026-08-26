import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOverpassQuery,
  discoverOverpassCandidates,
} from '../lib/overpass-discovery.ts';

const shard = { name: 'test-shard', selectors: ['["shop"]'] };

test('builds a bounded, efficient query', () => {
  const query = buildOverpassQuery(shard);
  assert.match(query, /\[maxsize:67108864\]/);
  assert.match(query, /\["website"\]/);
  assert.match(query, /out tags qt 600/);
  assert.doesNotMatch(query, /center/);
});

test('fails over after a transient provider error', async () => {
  const calls = [];
  const result = await discoverOverpassCandidates({
    budgetMs: 3_000,
    shards: [shard],
    endpoints: [
      { name: 'primary', url: 'https://primary.test/interpreter' },
      { name: 'secondary', url: 'https://secondary.test/interpreter' },
    ],
    fetchImpl: async url => {
      calls.push(String(url));
      if (String(url).includes('primary')) return new Response('', { status: 504 });
      return Response.json({ elements: [{ type: 'node', id: 1, tags: { name: 'Local Shop', website: 'https://example.test' } }] });
    },
  });

  assert.deepEqual(calls, [
    'https://primary.test/interpreter',
    'https://secondary.test/interpreter',
  ]);
  assert.equal(result.elements.length, 1);
  assert.deepEqual(result.attempts.map(attempt => attempt.outcome), ['http-error', 'success']);
});

test('reserves enough time for fallback after a slow primary timeout', async () => {
  const calls = [];
  const result = await discoverOverpassCandidates({
    budgetMs: 3_000,
    providerTimeoutMs: 40,
    shards: [shard],
    endpoints: [
      { name: 'slow-primary', url: 'https://slow.test/interpreter' },
      { name: 'healthy-fallback', url: 'https://healthy.test/interpreter' },
    ],
    fetchImpl: async (url, init) => {
      calls.push(String(url));
      if (String(url).includes('slow')) {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
        });
      }
      return Response.json({ elements: [{ type: 'node', id: 2, tags: { name: 'Fallback Shop', website: 'https://fallback.test' } }] });
    },
  });

  assert.deepEqual(calls, [
    'https://slow.test/interpreter',
    'https://healthy.test/interpreter',
  ]);
  assert.equal(result.elements.length, 1);
  assert.deepEqual(result.attempts.map(attempt => attempt.outcome), ['timeout', 'success']);
});

test('fails over when a broad query returns an anomalous empty result', async () => {
  const result = await discoverOverpassCandidates({
    budgetMs: 3_000,
    shards: [shard],
    endpoints: [
      { name: 'empty-primary', url: 'https://empty.test/interpreter' },
      { name: 'healthy-fallback', url: 'https://healthy.test/interpreter' },
    ],
    fetchImpl: async url => String(url).includes('empty')
      ? Response.json({ elements: [] })
      : Response.json({ elements: [{ type: 'node', id: 3, tags: { name: 'Healthy Shop', website: 'https://healthy.test' } }] }),
  });

  assert.equal(result.elements.length, 1);
  assert.deepEqual(result.attempts.map(attempt => attempt.outcome), ['invalid-response', 'success']);
});

test('keeps successful shards when another shard fails', async () => {
  const result = await discoverOverpassCandidates({
    budgetMs: 3_000,
    shards: [
      { name: 'broken', selectors: ['["shop"]'] },
      { name: 'working', selectors: ['["tourism"]'] },
    ],
    endpoints: [{ name: 'provider', url: 'https://provider.test/interpreter' }],
    fetchImpl: async (_url, init) => {
      const query = init.body.get('data');
      if (query.includes('["shop"]')) return new Response('', { status: 503 });
      return Response.json({ elements: [{ type: 'way', id: 9, tags: { name: 'Local Inn', website: 'https://inn.test' } }] });
    },
  });

  assert.equal(result.elements.length, 1);
  assert.deepEqual(result.failedShards, ['broken']);
});

test('deduplicates the same OpenStreetMap element across shards', async () => {
  const result = await discoverOverpassCandidates({
    budgetMs: 3_000,
    shards: [shard, { ...shard, name: 'second-shard' }],
    endpoints: [{ name: 'provider', url: 'https://provider.test/interpreter' }],
    fetchImpl: async () => Response.json({
      elements: [{ type: 'relation', id: 12, tags: { name: 'Marina', website: 'https://marina.test' } }],
    }),
  });

  assert.equal(result.elements.length, 1);
});

test('reports a terminal error only when every shard fails', async () => {
  await assert.rejects(
    discoverOverpassCandidates({
      budgetMs: 3_000,
      shards: [shard],
      endpoints: [{ name: 'provider', url: 'https://provider.test/interpreter' }],
      fetchImpl: async () => new Response('', { status: 504 }),
    }),
    /Business discovery providers were unavailable/,
  );
});
