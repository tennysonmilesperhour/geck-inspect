# The market habit: what shipped and what is left (30 Sep 2026)

## The question

How do we make the market analytics useful and interesting enough that members come back at least a couple of times a week, and some of them every day?

## The idea

People come back to a market when something changed that matters to them. A chart of median prices is the same chart tomorrow, so it gets one visit. What brings people back is news about their own animals ("your Lilly Whites are worth more this week"), their own wishes ("an Axanthic female under $600 was just listed") and their own listings ("two breeders listed a similar Harlequin for less since yesterday"), plus a small reason to come back on days with no news (a daily game).

Everything shows asking prices on listings and says so. None of it claims sale prices.

## What shipped

**1. A daily snapshot of the market and of each member's collection.**
`geck_data.market_daily` keeps one row per day, market (US, Korea, Japan, Europe) and morph: how many were for sale, the middle asking price, new listings, price cuts and how many came down. It knows which days were full checks, so a partial scrape or the catch-up after an outage never reads as a flood of new listings. `public.market_value_daily` keeps each member's crested gecko collection value per day (a low, middle and high estimate from similar listings at each gecko's quality grade), computed by the `market-value-snapshot` edge function.

**2. Market lines where members already look.**
The Today card on the dashboard shows the collection value and its change, new watchlist matches, and news in the morphs the member keeps. The Sunday digest email adds the value and the week's watchlist matches.

**3. Watchlists.**
On /Market, Watchlist: pick morphs, a price range, sex, and whether to hear only about price cuts. After each market check the database matches new listings and cuts against every watch and sends one "Watchlist match" notification per member (bell, and email and push per the member's Settings).

**4. The morning brief and the live feed.**
Today tab: the latest MorphMarket check (new listings, cuts, came down, and whether it was a busy or slow day), the member's morphs, new listings in them, rare sightings (a morph under 2% of the market, or a Luwak), one fact worth knowing, the other markets, and the collection value. "Send me this each morning" is off by default; when on, the brief arrives only on mornings with news for that member.
Live tab: new listings and price cuts from the US, Korea, Japan and Europe, newest first, with what arrived since the last visit marked New. It checks for more every two minutes while open.

**5. Guess the Price.**
Five real listings a day, the same five for everyone, with a score, a streak and share text. After each guess the member sees the real asking price and where it sits among similar geckos. A bonus "will it sell within 14 days?" call resolves itself from the listing later. The day turns over at midnight US Eastern.

**6. Your listings (Breeder plan).**
A breeder links their MorphMarket store and sees each listing against similar geckos, how long it has been up, and cheaper similar listings from other breeders since yesterday.

**7. Fresher data.**
The geck-data scraper has a newest mode that reads the first pages of MorphMarket's newest-first list about every 30 minutes, so new listings reach the Live tab and watchlists within the hour instead of the next day. After any scrape that wrote rows, the scraper asks the database to refresh (within 5 minutes); a newest-only refresh takes about 2 seconds instead of about 55.

**8. Measuring it.**
Admin, Product Analytics, "Market habit": per week, the signed-in members who were active, how many opened something market-related, and how many did so on two or more days. The Geck Data site's visit log had been empty since 3 Sep (signed-out visits were refused after the schema move); it records again.

## What only Tennyson can do

1. **Turn the US MorphMarket feed back on.** It has been off since early September because MorphMarket blocks GitHub. Either rerun `scripts/local/setup_mac.sh` in the geck-data repo on the Mac (free; it now also installs the 30-minute newest check), or add the `MORPHMARKET_PROXY_URL` secret in GitHub (a residential proxy, roughly $5 to $15 a month). See geck-data `docs/SCRAPER_SETUP.md`. Until then the US numbers come from the last full check, the Live tab shows Korea, Japan and Europe only, watchlists only match when a check runs, and the morning brief does not send (it waits for a fresh US check).
2. **Decision D20** (scraped listing photos on public pages). Until it is decided, /Market stays member-only.
3. **Try it on a phone:** open /Market, save a watch, play a round of Guess the Price, and switch on the morning brief.

## Baseline for the habit number

Weeks of 7 to 28 September: 2 to 7 signed-in members active per week, at most 1 of them opened anything market-related, and none on two or more days. A reasonable first target once the feed is back: a third of weekly active members on two or more days, within eight weeks. That target is a suggestion, not a decision.

## Known limits

- "Came down" is only counted on full catalog checks, and it means a listing disappeared: most sold, some were removed.
- Prices outside the US are converted at stored exchange rates; shipping and import costs are not included.
- Scheduled GitHub runs can start late or be skipped when GitHub is busy.
- The first check after a long outage is treated as a catch-up: it sends no new-listing alerts and no brief that day.

## Where things live

| Piece | Where |
|---|---|
| Daily market rows | `geck_data.market_daily`, `geck_data.snapshot_market_day(date)` |
| After a scrape | `geck_data.request_after_scrape(source)`, `geck_data.run_requested_after_scrape()` (cron every 5 minutes), `geck_data.after_scrape(trigger)` (also hourly at :20) |
| Quick refresh | `geck_data.refresh_listing_matviews()` for requests from the newest check |
| Collection value | `public.market_value_daily`, edge function `market-value-snapshot`, cron `market-value-daily` (12:40 UTC) |
| Watchlist | `geck_data.alerts`, `geck_data.alert_matches`, `geck_data.match_alerts()`, `public.market_watch_*` functions |
| Morning brief | `public.market_brief()`, `public.enqueue_market_briefs()` (cron `market-brief-morning`, hourly 13:35 to 20:35 UTC) |
| Live feed | `public.market_tape(before, limit, scope, before_id)` |
| Guess the Price | `public.price_game_rounds`, `public.price_game_guesses`, `public.price_game_today()`, `price_game_guess()`, `price_game_predict()` |
| Your listings | `public.seller_market_view(slug)`, `public.seller_market_find(query)` |
| Today card | `public.my_market_today()`, `src/components/dashboard/MarketTodayStrip.jsx` |
| The page | `src/pages/Market.jsx`, `src/components/market/`, `src/lib/marketHabit.js` |
| Habit number | `public.market_habit_weekly(weeks)`, `src/components/admin/MarketHabitCard.jsx` |
| Newest check | geck-data `scripts/scrape_listings_api.py --mode=newest`, `.github/workflows/scrape-listings-newest.yml`, `scripts/local/setup_mac.sh` |
