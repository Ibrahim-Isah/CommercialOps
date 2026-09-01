/**
 * Industry news data layer — Nigeria-first.
 *
 * Sources (all free / legitimate):
 *  - NewsAPI developer tier (NEWSAPI_KEY) — one global oil/gas query plus a
 *    dedicated Nigeria oil & gas query.
 *  - BusinessDay Nigeria and The Guardian Nigeria energy RSS feeds (no key) —
 *    dedicated Nigerian coverage.
 *  - Africa Oil+Gas Report RSS feed (no key) — Lagos-based, Africa-wide
 *    upstream/midstream coverage with strong Nigerian focus.
 *  - OilPrice.com RSS feed (no key).
 *  - EIA "Today in Energy" RSS feed (no key).
 *
 * Anything mentioning the Nigerian sector (or coming from a Nigerian feed) is
 * tagged "Nigeria" and sorted to the top of the feed — the audience is
 * Nigerian procurement staff, so local sector news outranks global wires.
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

const RSS_FEEDS: Array<{ url: string; source: string; nigeriaFocus?: boolean }> = [
  // Nigerian outlets first — their items are always tagged "Nigeria".
  {
    url: "https://businessday.ng/category/energy/feed/",
    source: "BusinessDay Nigeria",
    nigeriaFocus: true,
  },
  {
    url: "https://guardian.ng/category/energy/feed/",
    source: "The Guardian Nigeria",
    nigeriaFocus: true,
  },
  {
    url: "https://africaoilgasreport.com/feed/",
    source: "Africa Oil+Gas Report",
  },
  { url: "https://oilprice.com/rss/main", source: "OilPrice.com" },
  {
    url: "https://www.eia.gov/rss/todayinenergy.xml",
    source: "EIA Today in Energy",
  },
];

/** Nigerian oil & gas sector markers: places, regulators, operators, grades. */
const NIGERIA_RE =
  /(nigeria|nigerian|nnpc|nuprc|ncdmb|nmdpra|nimasa|\bnlng\b|dangote|bonny light|qua iboe|forcados|escravos|brass river|niger delta|port harcourt refin|warri refin|kaduna refin|seplat|oando|heirs energies|renaissance energy|first e&p|aiteo|petroleum industry act|\bpia\b.*gas|nogicd)/i;

/** Derive filter categories from the headline + description text. */
export function categorise(
  text: string,
  options?: { nigeriaFocus?: boolean }
): NewsCategory[] {
  const t = text.toLowerCase();
  const cats: NewsCategory[] = [];
  // Nigeria first so the badge leads the card.
  if (options?.nigeriaFocus || NIGERIA_RE.test(t)) cats.push("Nigeria");
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

async function fetchNewsApi(apiKey: string, query: string): Promise<NewsItem[]> {
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", query);
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
  const parser = new Parser({
    timeout: 10_000,
    // Some outlets (Africa Oil+Gas Report, some Nigerian papers) reject
    // non-browser user agents with a 403, so present a full browser UA.
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    },
  });
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async ({ url, source, nigeriaFocus }) => {
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
          categories: categorise(`${item.title ?? ""} ${desc ?? ""}`, {
            nigeriaFocus,
          }),
        } satisfies NewsItem;
      });
    })
  );
  
  return results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => (r as PromiseFulfilledResult<NewsItem[]>).value);
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

  // Gather from every available source; tolerate partial failure. The
  // dedicated Nigeria query runs alongside the global one so local sector
  // stories are never crowded out by the world wires.
  const tasks: Array<Promise<NewsItem[]>> = [fetchRss()];
  if (apiKey) {
    tasks.push(
      fetchNewsApi(
        apiKey,
        'Nigeria AND (oil OR gas OR NNPC OR NUPRC OR crude OR LNG OR petrol OR "Dangote refinery")'
      ),
      fetchNewsApi(apiKey, "oil OR gas OR OPEC OR LNG OR crude")
    );
  }

  const settled = await Promise.allSettled(tasks);
  for (const s of settled) {
    if (s.status === "fulfilled") collected.push(...s.value);
  }

  // Nigeria-first: local sector news outranks global headlines, newest first
  // within each group.
  const nigeria = (i: NewsItem) => (i.categories.includes("Nigeria") ? 1 : 0);
  let items = dedupe(collected).sort(
    (a, b) =>
      nigeria(b) - nigeria(a) ||
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
