import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getArticleIndex } from '../utils/articles';

export async function GET(context: APIContext) {
  const { all: sorted } = await getArticleIndex();

  return rss({
    title: 'pulse360 — The Global Pulse',
    description:
      'AI-synthesized global news from 195+ sources, refreshed every 4 hours.',
    site: context.site!,
    items: sorted.slice(0, 50).map((article) => ({
      title: article.data.title,
      pubDate: article.data.pubDate,
      description: article.data.description,
      link: `/news/${article.id}`,
      categories: [article.data.category],
    })),
  });
}
