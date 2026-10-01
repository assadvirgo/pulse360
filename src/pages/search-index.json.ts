import type { APIContext } from 'astro';
import { getArticleIndex } from '../utils/articles';

export async function GET(_context: APIContext) {
  const { all } = await getArticleIndex();
  const index = all.map((a) => ({
    slug: a.id,
    title: a.data.title,
    description: a.data.description,
    category: a.data.category,
    pubDate: a.data.pubDate.toISOString(),
    tags: a.data.tags ?? [],
    heroImage: a.data.heroImage ?? '',
  }));

  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
}
