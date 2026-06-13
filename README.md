# Commercial Ops Dashboard

An internal web app for the commercial team of an oil & gas company (crude oil shipping, gas supply and trading). It brings analytics, vessel tracking, regulatory compliance tracking, oil price monitoring, a simple price forecast and an industry news feed into one place.

The app is built to run end to end **with no API keys at all** using realistic mock data, so it is always demonstrable. Add free API keys to unlock live data, and the "Demo data" badges disappear automatically.

## What it does

- **Dashboard** — a summary landing page: current Brent price with daily change, tracked vessel count, active certificate count, and a count of certificates expiring within 30 days, plus a 30-day Brent chart, an "expiring soon" widget and the latest 4 headlines. Every widget links to its full section.
- **Vessel Tracking** — search a vessel by name, IMO or MMSI; see results in a table; add vessels to a persistent watchlist shown on an interactive map (OpenStreetMap via Leaflet) and a tracked-vessels list with remove actions.
- **Certificates & Clearances** — full create / read / update / delete for regulatory and operational documents (NUPRC clearance, NESS inspection, Customs, vessel certificates, insurance, environmental permits, etc.). Status is computed (Active / Expiring Soon / Expired) and colour-coded. An expiry notifier raises a toast on load and a bell badge in the top bar counts items expiring within 30 days.
- **Oil Prices** — Brent crude spot price from the EIA, with current price and daily change, a chart over 30 / 90 / 365 days, and a stats panel (high, low, average, volatility).
- **Forecast** — a transparent statistical projection of Brent (linear trend + moving-average anchor + confidence band), projected 7 / 14 / 30 days. Clearly labelled as an internal estimate, not trading advice.
- **Industry Updates** — an oil & gas news feed aggregated from NewsAPI and free RSS feeds (OilPrice.com, EIA Today in Energy), with a category filter, manual refresh and last-updated time.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **React** server and client components
- **Tailwind CSS** + **shadcn/ui** components
- **lucide-react** icons, **recharts** charts, **react-leaflet** + OpenStreetMap map
- **date-fns** for dates, **zustand** for client state, **next-themes** for dark/light mode
- **rss-parser** for news feeds
- A simple **JSON file store** (`data/store.json`) for the certificates and vessel watchlist

### Why a JSON file store instead of SQLite?

The prompt allowed either a local SQLite database (`better-sqlite3`) or a JSON file store, whichever is simpler and reliable. We chose a JSON file because `better-sqlite3` needs native compilation, which is a common source of install friction (especially on Windows). All persistence logic is isolated in `lib/store.ts`, so it can be swapped for SQLite or Postgres later without touching the API routes.

## Getting the free API keys

You do **not** need any keys to run the app. To unlock live data, add the keys you want:

### Brent oil prices — EIA (recommended, free, instant)

1. Go to <https://www.eia.gov/opendata/register.php>
2. Register; the key is emailed to you instantly.
3. Put it in `.env.local` as `EIA_API_KEY`.
   Used by `/api/prices` (series `RBRTE`, Europe Brent spot, FOB).

### Vessel tracking — AISStream.io (free real-time AIS)

1. Go to <https://aisstream.io>
2. Sign up and create an API key in the dashboard.
3. Put it in `.env.local` as `AISSTREAM_API_KEY`.
   This is a **WebSocket stream**, not a REST call. The server connects, listens for a few seconds, and returns matching vessels (see `lib/vessels.ts`).

### Oil & gas news — NewsAPI (free dev tier, 100 requests/day)

1. Go to <https://newsapi.org/register>
2. Put the key in `.env.local` as `NEWSAPI_KEY`.
   The news feed also pulls OilPrice.com and EIA RSS feeds, which need **no key**, so live headlines work even with this blank.

## How the mock fallbacks work

Each data source degrades gracefully:

- **Prices** — no `EIA_API_KEY` or a failed request → a deterministic mock Brent series around ~$80/bbl, badged "Demo data".
- **Vessels** — no `AISSTREAM_API_KEY`, or a live search returns nothing (common, see below) → a realistic mock fleet of 8 tankers/carriers around West Africa and the Atlantic, badged "Demo data".
- **News** — `NEWSAPI_KEY` blank → RSS feeds only (still real). If every source fails → a small set of mock headlines badged "Demo data".
- **Forecast** — inherits the price series; if prices are mock, the forecast is badged "Demo data".

## Honest limitations

- **Vessel tracking coverage is partial.** There is no genuinely free, unlimited real-time vessel API. AISStream is the best free real-time option, but it relies on community-run receivers, so many vessels (especially in open ocean) never appear. When a live search returns nothing, the app shows the mock fleet so the feature stays demonstrable.
- **There is no free Wood Mackenzie API.** That kind of premium intelligence is paywalled, so it is intentionally **not** integrated. The news feed substitutes free, legitimate sources (EIA, OilPrice.com RSS, NewsAPI).
- **The forecast is a simple statistical estimate.** It is a moving-average-anchored linear trend with a volatility-based band, for internal awareness only — not investment or trading advice.
- **The news feed never reproduces full articles.** It shows only the title and a short snippet and links out to the original source.

## Running it

```bash
cp .env.example .env.local   # then paste any keys you have (all optional)
npm install
npm run dev
```

Open <http://localhost:3000>.

To build for production:

```bash
npm run build
npm run start
```

The app builds and runs with every environment variable blank.

## Project structure

```
app/
  layout.tsx              Root layout, theme + providers + app shell
  page.tsx                Dashboard (overview)
  vessels/page.tsx        Vessel tracking
  certificates/page.tsx   Certificates CRUD
  prices/page.tsx         Oil prices
  forecast/page.tsx       Forecast
  news/page.tsx           Industry updates
  api/
    prices/route.ts       EIA Brent (cached 1h) + mock fallback
    forecast/route.ts     Statistical projection
    news/route.ts         NewsAPI + RSS (cached ~30m) + mock fallback
    vessels/route.ts      AISStream WebSocket lookup + mock fallback
    certificates/route.ts        list / create
    certificates/[id]/route.ts   update / delete
    watchlist/route.ts    persisted vessel watchlist
components/
  ui/                     shadcn/ui primitives
  charts/                 recharts price & forecast charts
  certificates/           add/edit dialog, status badge
  vessels/                Leaflet map
  app-shell.tsx, sidebar.tsx, providers.tsx, theme-toggle.tsx, expiry-bell.tsx, common.tsx
lib/
  store.ts                JSON file store (certificates + watchlist)
  stores.ts               zustand client stores
  prices.ts, forecast.ts, news.ts, vessels.ts   data layers / API clients
  mock-data.ts, cache.ts, certificates.ts, validation.ts, nav.ts, utils.ts
types/
  index.ts                Vessel, Certificate, PricePoint, NewsItem, ForecastPoint, …
data/
  store.json              created at runtime (git-ignored)
```

All external API calls run **server-side only** (in `app/api/*` route handlers), so API keys are never exposed to the client. The browser only ever calls our own `/api/*` endpoints.

## Next steps for production

- **Swap the JSON store for Postgres.** Replace the implementation in `lib/store.ts` with a real database; the API routes need no changes.
- **Add authentication** (e.g. Supabase Auth, Auth.js) and per-user or per-team data scoping.
- **Upgrade to paid AIS** (e.g. MarineTraffic, Spire) for full global vessel coverage.
- **Move caching to Redis** so it works across multiple server instances.
- **Add tests** around the forecast math, status logic and API routes.
