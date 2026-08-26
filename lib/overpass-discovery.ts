const NEW_BERN = { latitude: 35.1085, longitude: -77.0441 };
const RADIUS_METERS = 120_700;
const DEFAULT_DISCOVERY_BUDGET_MS = 120_000;
const PROVIDER_TIMEOUT_MS = 18_000;
const FALLBACK_RESERVE_MS = 1_000;
const QUERY_TIMEOUT_SECONDS = 16;
const QUERY_MAX_BYTES = 64 * 1024 * 1024;
const RESULTS_PER_SHARD = 600;

export type OverpassElement = {
  type?: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
};

export type DiscoveryEndpoint = {
  name: string;
  url: string;
};

export type DiscoveryShard = {
  name: string;
  selectors: string[];
};

export type DiscoveryAttempt = {
  shard: string;
  provider: string;
  elapsedMs: number;
  status?: number;
  outcome: 'success' | 'http-error' | 'timeout' | 'network-error' | 'invalid-response';
  error?: string;
};

export type OverpassDiscoveryResult = {
  elements: OverpassElement[];
  attempts: DiscoveryAttempt[];
  failedShards: string[];
};

export const OVERPASS_ENDPOINTS: readonly DiscoveryEndpoint[] = [
  {
    name: 'VK Maps',
    url: 'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  },
  {
    name: 'FOSSGIS',
    url: 'https://overpass-api.de/api/interpreter',
  },
  {
    name: 'Private.coffee',
    url: 'https://overpass.private.coffee/api/interpreter',
  },
];

export const DISCOVERY_SHARDS: readonly DiscoveryShard[] = [
  {
    name: 'hospitality-and-local-services',
    selectors: [
      '["amenity"~"restaurant|cafe|bar|dentist|doctors|clinic|veterinary|car_repair|events_venue"]',
    ],
  },
  {
    name: 'shops-offices-and-trades',
    selectors: ['["craft"]', '["office"]', '["shop"]'],
  },
  {
    name: 'tourism-and-recreation',
    selectors: [
      '["tourism"~"hotel|motel|guest_house|attraction"]',
      '["leisure"~"marina|fitness_centre|sports_centre"]',
    ],
  },
];

// The broad contact:website form roughly doubles provider work for the same
// category scan. Keep scheduled discovery on the consistently indexed website
// tag; candidate parsing still accepts contact:website when both tags exist.
const WEBSITE_KEYS = ['website'] as const;

export function buildOverpassQuery(shard: DiscoveryShard) {
  const around = `(around:${RADIUS_METERS},${NEW_BERN.latitude},${NEW_BERN.longitude})`;
  const statements = shard.selectors.flatMap(selector =>
    WEBSITE_KEYS.map(key => `nwr${around}["name"]["${key}"]${selector};`),
  );
  return `[out:json][timeout:${QUERY_TIMEOUT_SECONDS}][maxsize:${QUERY_MAX_BYTES}];(${statements.join('')});out tags qt ${RESULTS_PER_SHARD};`;
}

function compactError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').trim().slice(0, 240);
}

function timeoutError(error: unknown) {
  return error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name);
}

function uniqueElements(elements: OverpassElement[]) {
  const seen = new Set<string>();
  return elements.filter(element => {
    const key = `${element.type || 'element'}:${element.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchShard(input: {
  shard: DiscoveryShard;
  endpoints: readonly DiscoveryEndpoint[];
  fetchImpl: typeof fetch;
  deadline: number;
  attempts: DiscoveryAttempt[];
  providerTimeoutMs: number;
}) {
  const query = buildOverpassQuery(input.shard);
  for (let endpointIndex = 0; endpointIndex < input.endpoints.length; endpointIndex += 1) {
    const endpoint = input.endpoints[endpointIndex];
    const remaining = input.deadline - Date.now();
    if (remaining < 1_000) break;
    // The first provider may be slow rather than fail fast. Reserve a complete
    // independent fallback attempt instead of letting the primary consume the
    // whole shard allocation.
    const available = endpointIndex === 0 && input.endpoints.length > 1
      ? Math.floor((remaining - FALLBACK_RESERVE_MS) / 2)
      : remaining;
    if (available < 25) continue;
    const startedAt = Date.now();
    try {
      const response = await input.fetchImpl(endpoint.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'NewBernWebsitesBot/1.0 (+https://www.newbernwebsites.com/)',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(Math.min(input.providerTimeoutMs, available)),
      });
      const elapsedMs = Date.now() - startedAt;
      if (!response.ok) {
        const attempt: DiscoveryAttempt = {
          shard: input.shard.name,
          provider: endpoint.name,
          elapsedMs,
          status: response.status,
          outcome: 'http-error',
          error: `HTTP ${response.status}`,
        };
        input.attempts.push(attempt);
        console.warn(JSON.stringify({ event: 'prospect-discovery-attempt', ...attempt }));
        // A malformed query will be rejected everywhere; other response codes
        // can be provider-specific capacity, policy, or gateway failures.
        if ([400, 422].includes(response.status)) break;
        continue;
      }

      let data: { elements?: OverpassElement[] };
      try {
        data = await response.json() as { elements?: OverpassElement[] };
      } catch (error) {
        const attempt: DiscoveryAttempt = {
          shard: input.shard.name,
          provider: endpoint.name,
          elapsedMs: Date.now() - startedAt,
          status: response.status,
          outcome: 'invalid-response',
          error: compactError(error),
        };
        input.attempts.push(attempt);
        console.warn(JSON.stringify({ event: 'prospect-discovery-attempt', ...attempt }));
        continue;
      }
      if (!Array.isArray(data.elements) || data.elements.length === 0) {
        const attempt: DiscoveryAttempt = {
          shard: input.shard.name,
          provider: endpoint.name,
          elapsedMs: Date.now() - startedAt,
          status: response.status,
          outcome: 'invalid-response',
          error: !Array.isArray(data.elements)
            ? 'Response did not include an elements array.'
            : 'Provider returned an anomalous empty result for a broad local-business query.',
        };
        input.attempts.push(attempt);
        console.warn(JSON.stringify({ event: 'prospect-discovery-attempt', ...attempt }));
        continue;
      }

      const attempt: DiscoveryAttempt = {
        shard: input.shard.name,
        provider: endpoint.name,
        elapsedMs: Date.now() - startedAt,
        status: response.status,
        outcome: 'success',
      };
      input.attempts.push(attempt);
      console.info(JSON.stringify({
        event: 'prospect-discovery-attempt',
        ...attempt,
        discovered: data.elements.length,
      }));
      return data.elements;
    } catch (error) {
      const attempt: DiscoveryAttempt = {
        shard: input.shard.name,
        provider: endpoint.name,
        elapsedMs: Date.now() - startedAt,
        outcome: timeoutError(error) ? 'timeout' : 'network-error',
        error: compactError(error),
      };
      input.attempts.push(attempt);
      console.warn(JSON.stringify({ event: 'prospect-discovery-attempt', ...attempt }));
    }
  }
  return null;
}

export async function discoverOverpassCandidates(options: {
  budgetMs?: number;
  endpoints?: readonly DiscoveryEndpoint[];
  shards?: readonly DiscoveryShard[];
  fetchImpl?: typeof fetch;
  providerTimeoutMs?: number;
} = {}): Promise<OverpassDiscoveryResult> {
  const endpoints = options.endpoints || OVERPASS_ENDPOINTS;
  const shards = options.shards || DISCOVERY_SHARDS;
  const fetchImpl = options.fetchImpl || fetch;
  const providerTimeoutMs = Math.max(25, options.providerTimeoutMs || PROVIDER_TIMEOUT_MS);
  const deadline = Date.now() + Math.max(3_000, options.budgetMs || DEFAULT_DISCOVERY_BUDGET_MS);
  const attempts: DiscoveryAttempt[] = [];
  const failedShards: string[] = [];
  const elements: OverpassElement[] = [];

  for (let index = 0; index < shards.length; index += 1) {
    const shard = shards[index];
    const remainingShards = shards.length - index;
    const remaining = deadline - Date.now();
    if (remaining < 1_000) {
      failedShards.push(...shards.slice(index).map(item => item.name));
      break;
    }
    // Give every category a fair chance instead of allowing one overloaded
    // provider request to consume the entire discovery budget.
    const shardDeadline = Date.now() + Math.max(1_000, Math.floor(remaining / remainingShards));
    const result = await fetchShard({
      shard,
      endpoints,
      fetchImpl,
      deadline: shardDeadline,
      attempts,
      providerTimeoutMs,
    });
    if (result) elements.push(...result);
    else failedShards.push(shard.name);
  }

  if (!elements.length) {
    const summary = attempts.slice(-3).map(attempt =>
      `${attempt.provider}/${attempt.shard}: ${attempt.status || attempt.outcome}`,
    ).join('; ');
    throw new Error(`Business discovery providers were unavailable${summary ? ` (${summary})` : ''}.`);
  }

  return { elements: uniqueElements(elements), attempts, failedShards };
}
