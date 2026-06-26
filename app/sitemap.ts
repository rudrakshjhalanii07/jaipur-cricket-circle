import { supabase } from '@/lib/supabase';
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL
    : process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://jaipur-cricket-circle.vercel.app';

  // 1. Fetch dynamic blog posts from Supabase
  let dbArticles: any[] = [];
  try {
    const { data, error } = await supabase
      .from('chewvana_articles')
      .select('slug, published_at, updated_at, created_at')
      .eq('status', 'published');

    if (!error && data) {
      dbArticles = data;
    }
  } catch (err) {
    console.error('Sitemap: Failed to fetch articles from Supabase:', err);
  }

  // 2. Aggregate posts by slug (DB only)
  const articleEntries = new Map<string, Date>();

  dbArticles.forEach((art) => {
    const lastMod = art.updated_at || art.published_at || art.created_at;
    articleEntries.set(art.slug, lastMod ? new Date(lastMod) : new Date());
  });

  // 3. Define main static pages
  const staticPages = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/rivalry`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/members`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/chewvana-times`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
  ];

  // 4. Map dynamic pages
  const dynamicBlogPages = Array.from(articleEntries.entries()).map(([slug, lastMod]) => ({
    url: `${baseUrl}/chewvana-times/${slug}`,
    lastModified: lastMod,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...dynamicBlogPages];
}
