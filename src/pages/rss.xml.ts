import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const articles = await getCollection('news');
  const sorted = articles.sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  );

  return rss({
    title: 'pulse360 — The Global Pulse',
    description:
      'AI-synthesized global news from 195+ sources, refreshed every 4 hours. No ads, no noise.',
    site: context.site!,
    customData: [
      '<language>en</language>',
      '<copyright>pulse360 https://pulse360.news</copyright>',
      '<managingEditor>pulse360 (pulse360)</managingEditor>',
      '<webMaster>pulse360 (pulse360)</webMaster>',
      '<ttl>240</ttl>',
      '<image><url>https://pulse360.news/logo.png</url><title>pulse360</title><link>https://pulse360.news</link></image>',
      '<atom:link href="https://pulse360.news/rss.xml" rel="self" type="application/rss+xml" />',
    ].join('\n'),
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
      media: 'http://search.yahoo.com/mrss/',
    },
    items: sorted.slice(0, 100).map((article) => ({
      title: article.data.title,
      pubDate: article.data.pubDate,
      description: article.data.description,
      link: `/news/${article.id}`,
      categories: [article.data.category, ...(article.data.tags ?? [])],
      customData: [
        article.data.source ? `<author>${article.data.source}</author>` : '',
        article.data.heroImage ? `<media:content url="${article.data.heroImage}" medium="image" />` : '',
        `<source url="${article.data.sourceUrl}">${article.data.source || 'Source'}</source>`,
      ].filter(Boolean).join('\n'),
    })),
  });
}
