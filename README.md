# Mayaar Smart Estate

**AI-powered home matching for Islamabad. Describe what you want, get back a reasoned shortlist instead of another list to scroll through.**

Built for **Horizon 2026**, 48-Hour AI Build Challenge
**Category:** Smart Real Estate

**Live demo:** [mayaar-smart-estate.vercel.app](https://mayaar-smart-estate.vercel.app/)

---

## The problem

My family spent about two months house-hunting. Scrolling listings on social media and property sites, comparing, visiting, comparing again. By the end we were tired enough to almost settle for a house we didn't really love, just to be done with it. One more push turned up the house we actually loved most.

That near-miss is basically the whole reason this project exists. A generic filter form doesn't fix exhaustion, it just gives you more to scroll through. What actually helps is something that understands what you need, gives you a short shortlist with honest reasoning, and lets you refine it by talking instead of starting over with new filters.

There's also a bigger fragmentation problem underneath this. Real house-hunting today means checking property portals, scrolling Instagram and Facebook listings, calling agents, and cross-referencing addresses across tools that don't talk to each other. With more time, Mayaar's architecture is meant to grow into exactly that: pulling listings from social platforms, verified address data, and multiple property sources, so one search actually replaces the research instead of just organizing a slice of it. What we built in 48 hours is the reasoning engine that makes that possible. The matching, ranking, and explanation layer is already fully separate from where the listings come from, so this is a foundation for an all-in-one tool, not a single-source demo.

## What Mayaar does

You describe your ideal home in plain language. No dropdowns, no price sliders, no bedroom-count checkboxes. Mayaar:

1. **Understands** what you actually meant, including things you only implied
2. **Narrows** all 146 real Islamabad listings down to genuine candidates against your hard requirements
3. **Ranks** the top 5 with a match percentage, and for each one: what fits, what doesn't, and what the data couldn't confirm
4. **Explains its single best pick** with an honest recommendation card, including what you'd be accepting by choosing it
5. **Lets you refine by chatting.** Say what's off in a sentence and the shortlist re-ranks in front of you with a plain acknowledgment of what changed

It's built to be argued with, not just trusted. Every score is checkable against the listing's own data, and every gap in the data is disclosed instead of papered over.

## Why the AI reasoning is trustworthy, not just plausible-sounding

This is the part I'm most proud of, and it came out of a real failure we hit during testing.

**Handing everything to the model doesn't work.** Early versions gave Gemini all 146 listings and asked it to filter and rank them directly. It ignored hard constraints outright. A user with a 3.5 crore budget ceiling in F-11 got results at 9.3 to 40 crore ranked #1 to #4 at 78 to 95% match. A small, fast model can't reliably filter 146 records by hand while also reasoning about tone and priorities at the same time.

**So we split filtering from writing.** Hard, checkable constraints (budget, bedrooms, sector, distance) are filtered and scored in deterministic code (`src/lib/candidates.ts`), using a relaxation ladder that narrows the full dataset down to a pre-checked candidate pool. Each candidate already carries authoritative `checks_out`, `falls_short`, and `cannot_confirm` facts computed against the real data. Gemini only judges and writes from that pre-verified pool. It never invents whether a home fits your budget, it only explains why it does or doesn't, using facts already computed for it.

The same principle applies to landmark search. When someone says "near Faisal Mosque" or "close to my office at the Stock Exchange," Gemini identifies the landmark's real-world coordinates from its own general knowledge, but the actual proximity (distance in km and an estimated drive time) is calculated with the haversine formula in code, not guessed by the model. This is what fixed a real bug we found: before the fix, "an office near Faisal Mosque" was returning results roughly 50 minutes away in Bahria Enclave. After moving the distance math into code, the same query correctly returns F-7 listings 1.8 to 2.2 km away.

This same pattern, verify in code and explain with the model, also caught two real data bugs during testing. A listing was reporting "double storey" as satisfying a "single storey" priority, which would've been a real problem for a mobility-constrained buyer. And free-text family size was being silently copied into a minimum-bedroom count, which excluded genuinely good matches. Both are fixed now.

## Core features

- **Natural language search.** Describe your needs once, in your own words
- **AI understanding confirmation.** See exactly what was extracted (budget, sectors, bedrooms, priorities) before matching runs, with soft inferences called out separately, like noticing you mentioned hosting guests often and prioritizing larger living spaces because of it
- **Ranked matches with honest reasoning.** Match percentage, what fits, what doesn't, computed against real listing data
- **Match breakdown.** Per-criterion score bars for any listing, benchmarked against your other matches
- **Compare.** 2 to 3 shortlisted homes side by side, scored criterion by criterion
- **Saved listings.** Build a shortlist across a session
- **Conversational refinement.** Adjust preferences by chatting. The shortlist re-ranks live with a plain-language acknowledgment of what changed
- **Landmark-aware proximity search.** Mention an office, mosque, or landmark by name and get a real distance and estimated drive time, computed in code (see technical note above)
- **Interactive map.** Ranked matches plotted on a real map, plus a radius search mode where you drop a point, drag a radius, and see exactly which listings fall inside it
- **Over-budget transparency.** If a genuinely great match happens to exceed your stated budget, it's shown with a clear badge and an honest tradeoff explanation, never hidden or silently excluded

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling / UI | Tailwind CSS + shadcn/ui, Fraunces (serif) + Geist (sans) via `next/font` |
| AI / reasoning | Google Gemini API (`gemini-3.5-flash-lite`) |
| Maps | Mapbox GL JS (map rendering and tiles only, no metered geocoding or directions calls at runtime) |
| Data | Curated local JSON dataset, 146 real Islamabad listings |
| Deployment | Vercel |
| Version control | GitHub, public repo with full commit history |

## A note on the data

The 146 listings are real, pulled from live Zameen.com pages across Islamabad (DHA, F-7, F-11, G-13, Bahria Town/Enclave, and more), not synthetic placeholders. Price, size, sector, and source link are scraped directly. Latitude and longitude were independently verified and corrected using Google Places data for each sector, since the source listings only specify sector or society names, not exact street addresses. So pins mark the general area, not a precise building, and every listing states this honestly through a `geocode_confidence` field.

We're upfront about this rather than hiding it: it's a curated prototype dataset with an architecture that already supports swapping in live data later. The matching, ranking, and reasoning pipeline is fully decoupled from where the listings come from.

## Known limitations, stated honestly

- **Response time.** Matching typically takes 10 to 30 seconds depending on Gemini's live response time, since it's doing genuine reasoning over multiple candidates rather than an instant filter. That's a real tradeoff of quality over speed, not a bug.
- **Landmark recognition** works reliably for major, well-documented public places like mosques, malls, government buildings, and well-known institutions. It may be less accurate for small or private businesses, since it draws on the model's general knowledge rather than a verified location database.
- **Drive time estimates** are calculated from straight-line distance at an assumed average city driving speed. This is clearly labeled in the UI as an approximation that doesn't account for real traffic or road routing, not a live navigation API (deliberately avoided to stay within free-tier usage).
- **Dataset is a snapshot**, not a live feed, as noted above.

## Getting started locally

```bash
npm install
```

Create `.env.local` in the project root:

```
GEMINI_API_KEY=your_gemini_key
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Listings are loaded from `src/data/listings.json`.

## Team

Built by Abdulbasit Sohail, Mustafa Asim.
Content by Fatima Shakil.

---

*Mayaar Smart Estate, Horizon 2026*
