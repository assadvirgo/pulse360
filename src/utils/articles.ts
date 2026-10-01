import { getCollection, type CollectionEntry } from 'astro:content';
import { getReadingTime } from './readingTime';

/**
 * Build-time article index.
 *
 * Every page used to call getCollection('news') and then filter/sort the full
 * collection itself. With 20k+ articles that is O(n) work per page and O(n²)
 * across the build (article pages also scanned everything for related stories),
 * which made builds take hours and eventually run out of memory.
 *
 * This module loads the collection once per build and precomputes everything
 * the pages need, so each page does near-constant work.
 */

export type Article = CollectionEntry<'news'>;

export const PAGE_SIZE = 50;
export const CATEGORIES = ['politics', 'economy', 'sports', 'showbiz', 'tech'] as const;

interface ArticleIndex {
  /** All articles, newest first. */
  all: Article[];
  /** Lowercase category → articles, newest first. */
  byCategory: Map<string, Article[]>;
  /** Tag → articles, newest first. */
  byTag: Map<string, Article[]>;
  /** Country code → articles, newest first. */
  byCountry: Map<string, Article[]>;
  /** Category (as written in frontmatter) → article count. */
  categoryCounts: Record<string, number>;
  /** Country code → display name + count, most articles first. */
  countries: [string, { name: string; count: number }][];
  /** Tag → count, most articles first. */
  tags: [string, number][];
  readingTimes: Map<string, number>;
  /** Lowercase category → groups of articles sharing an identical tag set. */
  tagGroups: Map<string, TagGroup[]>;
}

interface TagGroup {
  tags: string[];
  /** Newest first. */
  articles: Article[];
}

let indexPromise: Promise<ArticleIndex> | undefined;

export function getArticleIndex(): Promise<ArticleIndex> {
  indexPromise ??= buildIndex();
  return indexPromise;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

async function buildIndex(): Promise<ArticleIndex> {
  const all = (await getCollection('news')).sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  );

  const byCategory = new Map<string, Article[]>();
  const byTag = new Map<string, Article[]>();
  const byCountry = new Map<string, Article[]>();
  const categoryCounts: Record<string, number> = {};
  const countryInfo = new Map<string, { name: string; count: number }>();
  const readingTimes = new Map<string, number>();
  const groupsByKey = new Map<string, Map<string, TagGroup>>();

  for (const a of all) {
    const cat = a.data.category;
    const catKey = cat.toLowerCase();
    const tags = a.data.tags ?? [];

    push(byCategory, catKey, a);
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    readingTimes.set(a.id, getReadingTime(a.body ?? ''));

    for (const tag of new Set(tags)) push(byTag, tag, a);

    const code = a.data.countryCode;
    if (code) {
      push(byCountry, code, a);
      const info = countryInfo.get(code);
      if (info) info.count++;
      else countryInfo.set(code, { name: a.data.country || code, count: 1 });
    }

    let catGroups = groupsByKey.get(catKey);
    if (!catGroups) groupsByKey.set(catKey, (catGroups = new Map()));
    const sig = [...tags].sort().join('\u0000');
    const group = catGroups.get(sig);
    if (group) group.articles.push(a);
    else catGroups.set(sig, { tags, articles: [a] });
  }

  const tagGroups = new Map<string, TagGroup[]>();
  for (const [catKey, groups] of groupsByKey) tagGroups.set(catKey, [...groups.values()]);

  return {
    all,
    byCategory,
    byTag,
    byCountry,
    categoryCounts,
    countries: [...countryInfo.entries()].sort((a, b) => b[1].count - a[1].count),
    tags: [...byTag.entries()].map(([t, list]): [string, number] => [t, list.length]).sort((a, b) => b[1] - a[1]),
    readingTimes,
    tagGroups,
  };
}

export function readingTimeOf(index: ArticleIndex, article: Article): number {
  return index.readingTimes.get(article.id) ?? getReadingTime(article.body ?? '');
}

/**
 * Related articles: same category, excluding the article itself, ranked by
 * number of shared tags, then newest first.
 *
 * Articles with an identical tag set always have the same overlap score, so we
 * only score each distinct tag set once and take the newest few from each
 * group instead of scoring the whole category.
 */
export function getRelated(index: ArticleIndex, article: Article, limit = 3): Article[] {
  const groups = index.tagGroups.get(article.data.category.toLowerCase()) ?? [];
  const currentTags = new Set(article.data.tags ?? []);

  const candidates: { article: Article; overlap: number }[] = [];
  for (const group of groups) {
    const overlap = group.tags.filter((t) => currentTags.has(t)).length;
    let taken = 0;
    for (const a of group.articles) {
      if (a.id === article.id) continue;
      candidates.push({ article: a, overlap });
      if (++taken >= limit) break;
    }
  }

  return candidates
    .sort((a, b) => b.overlap - a.overlap || b.article.data.pubDate.getTime() - a.article.data.pubDate.getTime())
    .slice(0, limit)
    .map((c) => c.article);
}

/** Static paths for a list split into pages, where page 1 has no page segment. */
export function pageParams(total: number): (string | undefined)[] {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return Array.from({ length: totalPages }, (_, i) => (i === 0 ? undefined : String(i + 1)));
}

export function paginate<T>(items: T[], page: string | number | undefined) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.max(1, Math.min(Number(page ?? 1) || 1, totalPages));
  const start = (currentPage - 1) * PAGE_SIZE;
  return { currentPage, totalPages, items: items.slice(start, start + PAGE_SIZE) };
}
