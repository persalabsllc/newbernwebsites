import { randomUUID } from 'node:crypto';
import { readAutomationMessages, recordAutomationEvent } from './mail-server';
import { researchProspects, type ProspectResearchOptions, type ProspectResearchResult } from './prospect-research';

export type ResearchRunSource = 'cron' | 'manual';
export type ResearchRunState = 'running' | 'completed' | 'warning' | 'failed';

export type ResearchRun = {
  id: string;
  source: ResearchRunSource;
  state: ResearchRunState;
  startedAt: string;
  finishedAt?: string;
  startOffset: number;
  result?: ProspectResearchResult;
  error?: string;
};

const BODY_PREFIX = 'NBW_RESEARCH_RUN_V1:';
const MARKER_PREFIX = 'research-run:';

function encode(run: ResearchRun) {
  return `${BODY_PREFIX}${Buffer.from(JSON.stringify(run), 'utf8').toString('base64url')}`;
}

function decode(body: string) {
  const match = body.match(/NBW_RESEARCH_RUN_V1:([A-Za-z0-9_-]+)/);
  if (!match) return null;
  try {
    const run = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')) as ResearchRun;
    return run.id && run.startedAt ? run : null;
  } catch {
    return null;
  }
}

async function saveResearchRun(run: ResearchRun) {
  // The durable status record only needs counts and diagnostics. Omitting the
  // prospect-name list keeps internal status messages comfortably below mail
  // provider size limits while the actual prospect records remain separate.
  const durableRun = run.result
    ? {
      ...run,
      result: {
        ...run.result,
        prospects: [],
        discoveryAttemptCount: run.result.discoveryAttempts.length,
        discoveryAttempts: run.result.discoveryAttempts.slice(-3).map(attempt => ({
          ...attempt,
          error: attempt.error?.slice(0, 80),
        })),
      },
    }
    : run;
  await recordAutomationEvent({
    marker: `${MARKER_PREFIX}${run.id}:${run.state}`,
    subject: `Prospect research ${run.state}`,
    body: encode(durableRun),
  });
}

export async function readResearchRuns(limit = 50) {
  const messages = await readAutomationMessages(MARKER_PREFIX, limit, false);
  return messages
    .flatMap(message => {
      const run = decode(message.body);
      return run ? [{ ...run, recordUid: message.uid }] : [];
    })
    .toSorted((a, b) => b.recordUid - a.recordUid);
}

export async function latestResearchRun() {
  return (await readResearchRuns(50))[0] || null;
}

export async function researchRunById(id: string) {
  return (await readResearchRuns(50)).find(run => run.id === id) || null;
}

async function latestCursor() {
  const completed = (await readResearchRuns(50)).find(run => run.result);
  return completed?.result?.nextOffset || 0;
}

export async function createResearchRun(source: ResearchRunSource) {
  const run: ResearchRun = {
    id: `${source}-${Date.now()}-${randomUUID().slice(0, 8)}`,
    source,
    state: 'running',
    startedAt: new Date().toISOString(),
    startOffset: await latestCursor(),
  };
  await saveResearchRun(run);
  return run;
}

export async function finishResearchRun(run: ResearchRun, options: ProspectResearchOptions) {
  try {
    const result = await researchProspects({ ...options, startOffset: run.startOffset });
    const finished: ResearchRun = {
      ...run,
      state: result.saved > 0 ? 'completed' : 'warning',
      finishedAt: new Date().toISOString(),
      result,
    };
    await saveResearchRun(finished);
    console.info(JSON.stringify({ event: 'prospect-research', ...finished }));
    return finished;
  } catch (error) {
    const failed: ResearchRun = {
      ...run,
      state: 'failed',
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Prospect research failed.',
    };
    try { await saveResearchRun(failed); } catch { /* Preserve the original research error. */ }
    console.error(JSON.stringify({ event: 'prospect-research', ...failed }));
    return failed;
  }
}

export async function executeResearchRun(source: ResearchRunSource, options: ProspectResearchOptions) {
  const run = await createResearchRun(source);
  return finishResearchRun(run, options);
}
