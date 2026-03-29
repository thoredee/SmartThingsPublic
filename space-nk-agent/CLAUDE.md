# Space NK Review Agent — Claude Context

## What this project is

Immy (Thore's partner) participates in Space NK's official review incentive programme — he earns vouchers by submitting 10 product reviews per month. This agent automates the workflow: finding unreviewed products, generating ~100-word authentic-sounding reviews based on existing customer reviews, and submitting them to his Space NK account.

## Account details

- **Email:** immydonner@gmail.com
- **Password:** Kelmarsh11
- **Account holder:** Immy (Thore's partner)

## API

- **Uses:** Google Gemini API (free tier) — **not** Anthropic/Claude API
- **Key env var:** `GEMINI_API_KEY`
- **Model:** `gemini-1.5-flash`
- Key must be set before running (see START REVIEWS.bat for the easy way)

## How to run

```
cd C:\Users\thore\smartthingspublic\space-nk-agent
set GEMINI_API_KEY=AIza...
python app.py
```

Then open http://localhost:5000. Or just double-click `START REVIEWS.bat` (edit the key in that file first).

## File map

| File | Purpose |
|------|---------|
| `app.py` | Flask web server + full browser UI (inline HTML) |
| `scraper.py` | Finds products via sitemap/search/Playwright; submits reviews |
| `generator.py` | Calls Gemini to generate reviews from existing review themes |
| `history.py` | Tracks all-time reviewed products in `review_history.json` |
| `review_history.json` | Auto-created; **never delete** — prevents repeat reviews |
| `START REVIEWS.bat` | Double-click launcher for Windows |

## Review rules (important — don't change these)

- ~100 words per review (90–115)
- Average to positive tone — never negative, never gushing
- Based on themes extracted from existing Space NK customer reviews
- Sounds like a real British person writing naturally
- Never starts with "I"
- Written in first person
- Never mentions incentives or that he hasn't used the product

## Known issues / things to watch

- **Scraper fragility:** Space NK's site structure changes occasionally. If product fetching fails, check `scraper.py` — the URL patterns, CSS selectors for the review form, and category URLs are the most likely culprits.
- **Review submission selectors:** `submit_review()` in `scraper.py` uses multiple fallback selectors for the star rating, title field, body field, and submit button. If submission fails silently, Space NK may have updated their review widget (likely Bazaarvoice).
- **History file:** `review_history.json` must be preserved across sessions — it's what prevents repeat reviews. It's local to the project folder.
- **No database** — all state is in `review_history.json`. If moving to another machine, copy this file.
- **Browser timing:** `START REVIEWS.bat` uses `timeout /t 4` to wait 4 seconds before opening the browser, giving Flask time to start. If the red error banner appears on load, Flask didn't start in time — close and re-run the bat.
- **GEMINI_API_KEY in bat file:** The key is hardcoded in `START REVIEWS.bat` as `set GEMINI_API_KEY=AIza...`. The `set` syntax **must** include the variable name and `=` sign — a bare `set VALUE` silently does nothing on Windows.
- **Exposed API key:** The Gemini API key was accidentally shared in chat during setup. If reviews start failing with auth errors, regenerate the key at aistudio.google.com and update `START REVIEWS.bat`.

## Monthly workflow (what Immy/Thore does)

1. Double-click `START REVIEWS.bat` (or run `python app.py` manually)
2. Open http://localhost:5000
3. Click **Find & Generate This Month's Reviews** — wait ~2 mins
4. Read through the 10 reviews, edit any if needed
5. Click **Submit All Reviews to Space NK**
6. Done — close browser, Ctrl+C in terminal

## PR / branch

Active branch: `claude/space-nk-review-agent-4Xjyn`
Repo: `thoredee/smartthingspublic`
