import type { MetadataRoute } from 'next';
import { marketPages } from '../lib/market-pages';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.newbernwebsites.com';
  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/work/captain-97`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/work/calico-creek-homes`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/work/soundline-marine`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/work/juniper-tide-pools`, changeFrequency: 'monthly', priority: 0.6 },
    ...marketPages.map(page => ({ url: `${base}/web-design/${page.slug}`, changeFrequency: 'monthly' as const, priority: 0.75 })),
  ];
}
