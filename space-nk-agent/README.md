# Space NK Monthly Review Agent

Helps Immy complete her 10 monthly reviews on Space NK to earn vouchers.

## What it does

1. Checks which products have already been reviewed (never repeats)
2. Browses Space NK and picks 10 fresh products
3. Reads existing customer reviews to identify common themes
4. Generates a ~100-word authentic-sounding, average-to-positive review per product using Claude
5. Shows all 10 reviews in a browser UI so you can read/edit them
6. Logs into Space NK and submits all reviews in one click

## Setup

```bash
cd space-nk-agent

# Install Python dependencies
pip install -r requirements.txt

# Install Playwright browsers (one-time)
playwright install chromium

# Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...

# Run the agent
python app.py
```

Then open **http://localhost:5000** in your browser.

## Monthly workflow

1. Open http://localhost:5000
2. Enter your Space NK email and password
3. Click **Find & Generate This Month's Reviews**
4. Wait ~2 minutes while it scrapes products and generates reviews
5. Read through the 10 reviews — click any text to edit it
6. Click **Submit All Reviews to Space NK**
7. Done ✓ — the agent logs what was submitted so it won't repeat those products

## Files

| File | Purpose |
|------|---------|
| `app.py` | Flask web server + browser UI |
| `scraper.py` | Playwright-based Space NK scraper + review submitter |
| `generator.py` | Claude API review generation |
| `history.py` | Tracks all-time reviewed products |
| `review_history.json` | Created automatically — don't delete this |

## Notes

- Reviews are saved to `review_history.json` after successful submission
- The same product will never be reviewed twice (tracked forever, not just per month)
- The agent adds small random delays between actions to behave like a human
