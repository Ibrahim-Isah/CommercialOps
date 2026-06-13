# Commercial Operations Dashboard — Claude Code Build Prompt

This file has two parts:

1. **Setup instructions** — what to do before and after running the prompt (API keys, install, run).
1. **The prompt** — copy everything inside the prompt block and paste it into Claude Code.

-----

## PART 1 — SETUP INSTRUCTIONS

### Step 1. Create the project folder and open Claude Code
Create a TrackOG project

Then paste the prompt from Part 2.

### Step 2. Get your free API keys (do this while Claude Code builds)

The app is built so it runs with mock data even if you have no keys. Add real keys to unlock live data.

**Brent oil prices — EIA (free, reliable, recommended)**

- Go to <https://www.eia.gov/opendata/register.php>
- Register, get your key instantly by email
- Env var: `EIA_API_KEY`

**Vessel tracking — AISStream.io (free real-time AIS)**

- Go to <https://aisstream.io>
- Sign up, create an API key in the dashboard
- Env var: `AISSTREAM_API_KEY`
- Note: this is a WebSocket stream, not a simple REST call. The app handles this server-side.

**Oil & gas news — NewsAPI (free dev tier, 100 requests/day)**

- Go to <https://newsapi.org/register>
- Env var: `NEWSAPI_KEY`
- Backup that needs no key: the app also pulls OilPrice.com and EIA RSS feeds.

### Step 3. After the build finishes

```bash
cp .env.example .env.local
# open .env.local and paste your keys
npm install
npm run dev
```

Open <http://localhost:3000>

### A note on the APIs (read this so you are not surprised)

- There is **no genuinely free, unlimited real-time vessel tracking API**. AISStream is the best free real-time option but its coverage depends on community receivers, so some vessels in open ocean may not appear. The app gracefully shows mock vessels when a search returns nothing.
- **Wood Mackenzie does not offer a free public API.** That kind of premium intelligence is paywalled. The app substitutes free, legitimate oil and gas news and data sources (EIA, OilPrice RSS, NewsAPI). The prompt makes this clear so the build does not chase a key that does not exist.
- The forecast section is a **simple statistical projection** (moving average plus linear trend), clearly labelled as an estimate, not a financial recommendation. It is for internal awareness, not trading decisions.

-----

## PART 2 — THE PROMPT FOR CLAUDE CODE

Copy everything between the lines below.

-----

Build a production-quality internal web application called **“Commercial Ops Dashboard”** for the commercial team of an oil and gas company (crude oil shipping, gas supply, and trading operations). I am a commercial team member who needs analytics, vessel tracking, regulatory compliance tracking, oil price monitoring, a simple price forecast, and an industry news feed in one place.

### Tech stack (use exactly this)

- **Next.js 14+** with the App Router and TypeScript
- **React** (Server and Client Components as appropriate)
- **Tailwind CSS** for styling
- **shadcn/ui** for all UI components (install via the shadcn CLI, use Card, Button, Dialog, Input, Table, Badge, Tabs, Select, Toast/Sonner, Calendar, Popover, Skeleton, Alert)
- **lucide-react** for icons
- **recharts** for all charts
- **date-fns** for date handling
- **zustand** for lightweight client state, or React Context if simpler
- **next-themes** for dark and light mode
- Data persistence for the certificates feature: use a local **SQLite database via better-sqlite3** with a small data-access layer, OR if that adds friction, use a JSON file store in the project. Pick the simpler reliable option and keep all DB logic in one module so it can be swapped for Postgres later.

### Overall layout and design

- A persistent left sidebar with navigation: Dashboard (overview), Vessel Tracking, Certificates & Clearances, Oil Prices, Forecast, Industry Updates.
- A top bar with the app title, a dark/light mode toggle, and the current date.
- Clean, professional, data-dense but not cluttered. Think Bloomberg-terminal-meets-modern-SaaS. Use a restrained palette: a deep navy or slate primary, with one accent colour (amber or teal). Good whitespace, clear typography, subtle borders and shadows.
- Fully responsive. Sidebar collapses to a sheet/drawer on mobile.
- Every data section must show proper loading skeletons and friendly empty/error states. Never show a raw error or a blank screen.
- All external API calls go through **Next.js API routes (route handlers) on the server**, never directly from the client, so keys stay secret. The client fetches from our own `/api/*` endpoints.

### Section 1 — Dashboard (overview / home)

A summary landing page that pulls together the key signals:

- A stat card row: current Brent price (with the day’s change and an up/down arrow), number of tracked vessels, number of active certificates, and number of certificates expiring within 30 days (highlighted in amber/red if any).
- A small Brent price line chart (last 30 days).
- A “Certificates expiring soon” widget listing the next 5 expiring items with days remaining.
- A “Latest industry updates” widget with the 4 most recent news headlines.
- Each widget links to its full section.

### Section 2 — Vessel Tracking

Purpose: search for a vessel and track selected vessels on a map and in a watchlist. This reflects real crude oil shipping operations where the team monitors vessel ETAs, laycan windows, and demurrage risk.

- A search bar to look up a vessel by **name or IMO number or MMSI**.
- Use **AISStream.io** (`AISSTREAM_API_KEY`) for live AIS data. Because AISStream is a WebSocket stream, implement a server-side route that connects, collects matching vessel position reports for a short window, and returns them. Document this clearly in code comments.
- If no key is set or no live match is found, fall back to a **realistic mock dataset** of 6 to 8 vessels (tankers with names, IMO, MMSI, lat/long, speed, heading, status, destination, ETA) so the feature is always demonstrable. Clearly badge mock data as “Demo data”.
- Show vessel details: name, IMO, MMSI, type, flag, current position, speed, heading, navigational status, destination, and ETA.
- A **map** showing vessel positions. Use **react-leaflet with OpenStreetMap tiles** (free, no key). Markers for each vessel, with a popup showing key details. Pan/zoom enabled.
- A **watchlist**: let me add a searched vessel to a tracked list shown on my dashboard map and in a table. Persist the watchlist locally (same store as certificates). Let me remove vessels from the watchlist.
- A table of tracked vessels below the map with sortable columns and a “remove” action.

### Section 3 — Certificates & Clearances

Purpose: track regulatory certificates and operational clearances (for example NUPRC clearance, NESS inspection certificate, Customs clearance, vessel certificates, insurance, environmental permits). This must support full CRUD with expiry notifications.

- A table listing all certificates with columns: Name, Issuing Body, Category, Registration/Issue Date, Expiration Date, Status (computed: Active / Expiring Soon / Expired), and actions (edit, delete).
- Status logic: **Expired** if expiration is past; **Expiring Soon** if within the next 30 days; otherwise **Active**. Colour-code with badges (green / amber / red).
- An **“Add Certificate” button that opens a shadcn Dialog (modal)** with a form: name, issuing body (free text with suggestions like NUPRC, NMDPRA, NESS, Nigerian Customs, NIMASA, insurer), category (select: Regulatory, Operational, Insurance, Vessel, Environmental, Other), registration date (date picker), expiration date (date picker), optional notes. Validate that expiration is after registration.
- Edit and delete actions (delete behind a confirmation dialog).
- **Expiry notifier**: on app load and on this page, compute everything expiring within 30 days and show a toast / alert banner. A bell badge in the top bar shows the count of expiring items. List them with exact days remaining.
- Persist all certificates in the local database/store so they survive restarts.
- Provide a small set of seeded example certificates on first run so the table is not empty.

### Section 4 — Oil Prices (Brent)

- Fetch **Brent crude spot price** from the **EIA API** (`EIA_API_KEY`). Use the EIA petroleum pricing series for Europe Brent spot (RBRTE). If no key, fall back to a generated realistic mock price series and badge it “Demo data”.
- Show the current price prominently with daily change (absolute and percent) and a colour-coded arrow.
- A line chart with selectable ranges: 30 days, 90 days, 1 year.
- A small stats panel: period high, period low, period average, volatility (standard deviation).
- Cache API responses server-side for a sensible interval (for example 1 hour) to respect rate limits.

### Section 5 — Forecast

- A **simple price forecast** section for Brent (and optionally a generic natural gas series if data is available, otherwise Brent only).
- Implement a transparent, lightweight method client-side or in an API route: a moving-average baseline plus a linear-regression trend line, projected forward 7, 14, or 30 days (selectable). Optionally show a simple confidence band based on recent volatility.
- Chart the historical actuals and the projected forecast as a dashed continuation.
- **Prominently label this as a simple statistical estimate for internal awareness only, not investment or trading advice.** Add a short plain-language explanation of the method so users understand its limits.

### Section 6 — Industry Updates

Purpose: a curated oil and gas news and intelligence feed. Note: **Wood Mackenzie has no free public API**, so do not attempt to integrate it. Instead aggregate free, legitimate sources.

- Pull headlines from: **NewsAPI** (`NEWSAPI_KEY`, query oil/gas/OPEC/LNG/crude) and free RSS feeds such as **OilPrice.com RSS** and **EIA “Today in Energy” RSS**. Implement RSS parsing server-side (use a parser like rss-parser).
- If no NewsAPI key, rely on the RSS feeds alone (they need no key). If everything fails, show a small set of mock headlines badged “Demo data”.
- Display as cards: headline, source, published date, short description, and a link to the original article (open in new tab). Never reproduce full article text — show only the title and a short snippet, and link out.
- Add a category filter (All, Crude, Gas/LNG, OPEC, Regulatory) implemented as keyword filtering over the fetched items.
- Add a manual refresh button and show last-updated time. Cache server-side for ~30 minutes.

### Cross-cutting requirements

- Create a `.env.example` listing every env var with comments: `EIA_API_KEY`, `AISSTREAM_API_KEY`, `NEWSAPI_KEY`. Make the app run end-to-end with all of them blank using mock fallbacks.
- All API routes must handle failures gracefully (try/catch, timeouts, typed responses) and never leak keys to the client.
- Strong TypeScript types for all data models (Vessel, Certificate, PricePoint, NewsItem, ForecastPoint). Keep models in a `types/` directory.
- Organise code cleanly: `app/` routes, `app/api/` route handlers, `components/` (with a `components/ui/` for shadcn), `lib/` for the data layer, API clients, and the forecast/utility logic, `types/` for types.
- Add a thorough `README.md` covering: what the app does, the tech stack, exactly how to get each free API key with links, how the mock fallbacks work, the honest limitations of each data source (especially vessel tracking coverage and the absence of a free Wood Mackenzie API), how to run it, and clear next steps for going to production (swap SQLite for Postgres, add auth, upgrade to paid AIS for full coverage).
- Use good accessibility practices: labelled inputs, keyboard-navigable modals, sufficient contrast in both themes.
- Add a couple of basic guards so the app does not crash on empty data anywhere.

### Build order

Scaffold the Next.js + Tailwind + shadcn project and the layout/sidebar/theme first. Then build sections in this order: Certificates (with the local store, since other features reuse it), Oil Prices, Dashboard overview, Vessel Tracking, Forecast, Industry Updates. Get each section working with mock fallbacks before wiring the real APIs. Verify the app builds and runs with empty env vars before finishing.

When done, give me a short summary of what was built, the file structure, and the exact commands to run it.

-----

## PART 3 — TIPS FOR RUNNING THIS WITH CLAUDE CODE

- Let it build section by section. If it stops, just say “continue” or “next section”.
- If a package install fails, tell it the exact error and it will fix it.
- After the first run, ask it to “verify npm run build passes and fix any type errors”.
- If you later get the real API keys, paste them into `.env.local`, restart `npm run dev`, and the mock badges disappear automatically.
- To go further later, ask Claude Code to “add Supabase auth and move the certificate store from SQLite to Postgres”.