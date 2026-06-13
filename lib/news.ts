/**
 * Industry news data layer.
 *
 * Sources (all free / legitimate):
 *  - NewsAPI developer tier (NEWSAPI_KEY) — oil/gas/OPEC/LNG/crude headlines.
 *  - OilPrice.com RSS feed (no key).
 *  - EIA "Today in Energy" RSS feed (no key).
 *
 * NOTE: Wood Mackenzie has NO free public API, so it is intentionally not
 * integrated. We aggregate the free sources above instead.
 *
 * We only ever store and show the title + a short snippet + a link out to the
 * original article. We never reproduce full article text.
 */
import Parser from "rss-parser";
import { randomUUID } from "node:crypto";
import type { NewsCategory, NewsItem, NewsResponse } from "@/types";
import { getCached, setCached } from "@/lib/cache";
import { mockNews } from "@/lib/mock-data";

const CACHE_TTL_MS = 30 * 60 * 1000; // ~30 minutes.
const CACHE_KEY = "news-feed";

const RSS_FEEDS: Array<{ url: string; source: string }> = [
  { url: "https://oilprice.com/rss/main", source: "OilPrice.com" },
  {
    url: "https://www.eia.gov/rss/todayinenergy.xml",
    source: "EIA Today in Energy",
  },
];

/** Derive filter categories from the headline + description text. */
export function categorise(text: string): NewsCategory[] {
  const t = text.toLowerCase();
  const cats: NewsCategory[] = [];
  if (/(opec|opec\+)/.test(t)) cats.push("OPEC");
  if (/(crude|brent|wti|barrel|tanker|refin)/.test(t)) cats.push("Crude");
  if (/(\blng\b|natural gas|\bgas\b|pipeline)/.test(t)) cats.push("Gas/LNG");
  if (/(regulat|sanction|policy|compliance|permit|tariff|emission)/.test(t))
    cats.push("Regulatory");
  if (cats.length === 0) cats.push("General");
  return Array.from(new Set(cats));
}

function snippet(text?: string, max = 220): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  return clean.length > max ? clean.slice(0, max).trimEnd() + "…" : clean;
}

async function fetchNewsApi(apiKey: string): Promise<NewsItem[]> {
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", "oil OR gas OR OPEC OR LNG OR crude");
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "30");
  url.searchParams.set("apiKey", apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`NewsAPI responded ${res.status}`);
    const json = (await res.json()) as {
      articles?: Array<{
        title?: string;
        description?: string;
        url?: string;
        publishedAt?: string;
        source?: { name?: string };
      }>;
    };
    return (json.articles ?? [])
      .filter((a) => a.title && a.url)
      .map((a) => {
        const desc = snippet(a.description);
        return {
          id: randomUUID(),
          title: a.title as string,
          source: a.source?.name ?? "NewsAPI",
          url: a.url as string,
          publishedAt: a.publishedAt ?? new Date().toISOString(),
          description: desc,
          categories: categorise(`${a.title} ${a.description ?? ""}`),
        } satisfies NewsItem;
      });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRss(): Promise<NewsItem[]> {
  const parser = new Parser({ timeout: 10_000 });
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async ({ url, source }) => {
      const feed = await parser.parseURL(url);
      return (feed.items ?? []).slice(0, 20).map((item) => {
        const desc = snippet(item.contentSnippet ?? item.content);
        return {
          id: randomUUID(),
          title: item.title ?? "Untitled",
          source,
          url: item.link ?? "#",
          publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
          description: desc,
          categories: categorise(`${item.title ?? ""} ${desc ?? ""}`),
        } satisfies NewsItem;
      });
    })
  );
  return results
    .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    const key = it.title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export async function getNews(force = false): Promise<NewsResponse> {
  if (!force) {
    const cached = getCached<NewsResponse>(CACHE_KEY);
    if (cached) return cached;
  }

  const apiKey = process.env.NEWSAPI_KEY?.trim();
  const collected: NewsItem[] = [];

  // Gather from every available source; tolerate partial failure.
  const tasks: Array<Promise<NewsItem[]>> = [fetchRss()];
  if (apiKey) tasks.push(fetchNewsApi(apiKey));

  const settled = await Promise.allSettled(tasks);
  for (const s of settled) {
    if (s.status === "fulfilled") collected.push(...s.value);
  }

  let items = dedupe(collected).sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  let isMock = false;
  if (items.length === 0) {
    // Everything failed — show clearly badged demo headlines.
    items = mockNews();
    isMock = true;
  }

  const response: NewsResponse = {
    items: items.slice(0, 40),
    isMock,
    fetchedAt: new Date().toISOString(),
  };
  setCached(CACHE_KEY, response, CACHE_TTL_MS);
  return response;
}
