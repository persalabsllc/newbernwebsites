import { createHash } from 'node:crypto';

export type AuditFinding = {
  title: string;
  detail: string;
};

export function cleanProspectKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

export function auditKey(input: { key: string; business: string }) {
  const business = cleanProspectKey(input.business) || 'business';
  const fingerprint = createHash('sha256').update(input.key).digest('hex').slice(0, 8);
  return `${business}-${fingerprint}`;
}

export function auditPath(input: { key: string; business: string }) {
  return `/audit/${auditKey(input)}`;
}

export function defaultAuditFindings(observation: string): AuditFinding[] {
  return [
    {
      title: 'The first impression can work harder',
      detail: observation,
    },
    {
      title: 'The mobile path should lead directly to a call or quote',
      detail: 'A focused mobile layout can reduce friction between a local search, the service they need, and the next action they should take.',
    },
    {
      title: 'Local search pages can capture more nearby demand',
      detail: 'Dedicated service and location content gives search engines—and prospective customers—a clearer picture of where the business works and what it does best.',
    },
  ];
}

export function siteHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}
