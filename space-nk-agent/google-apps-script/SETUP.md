# Space NK Review Agent — Google Sheets Setup

## One-time setup (takes about 5 minutes)

### Step 1 — Create a Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and tap **+** to create a blank sheet
2. Name it **Space NK Reviews** (top left)

### Step 2 — Open the Script Editor

1. Tap the menu: **Extensions → Apps Script**
2. A new tab opens showing a code editor
3. Delete everything in the editor (select all, delete)
4. Open the file `Code.gs` from this folder and **copy the entire contents**
5. Paste it into the Apps Script editor
6. Tap the 💾 **Save** button (or Ctrl/Cmd + S)
7. Name the project **Space NK Reviews** when prompted

### Step 3 — Add your Anthropic API key

1. Go back to your Google Sheet tab
2. **Refresh the page** — you should now see a new menu: **🛍️ Space NK Reviews**
3. Tap **🛍️ Space NK Reviews → Settings (API Key)**
4. The sheet will switch to the Settings tab — tap cell **B2** and paste your API key (starts with `sk-ant-...`)
5. Press Enter

> **Where to get an API key:** Go to [console.anthropic.com](https://console.anthropic.com), sign in, and create a key. The review agent costs roughly £0.01–0.02 per month to run.

### Step 4 — Share the sheet with Immy

1. Tap the **Share** button (top right of the sheet)
2. Enter Immy's email address
3. Set permission to **Editor**
4. Tap Send

Immy can now open the sheet on his phone and use it each month.

---

## Monthly workflow (takes about 3 minutes)

1. Open the **Space NK Reviews** Google Sheet
2. Tap **🛍️ Space NK Reviews → Generate This Month's Reviews**
3. Tap **Yes** to confirm — the agent searches Space NK and writes 10 reviews
4. Read through each review in the **Reviews** tab (you can edit any cell if you want to tweak the wording)
5. For each row, tap **Open Product Page**, go to the product on Space NK, scroll to *Write a Review*, and copy/paste the title and review text, choose 4 or 5 stars, and submit
6. Once all submitted, **select all 10 rows** in the Reviews sheet, then tap **🛍️ Space NK Reviews → Mark Selected Rows as Submitted**
7. Done ✅ — those products are recorded and will never be picked again

---

## Tabs explained

| Tab | What it's for |
|-----|--------------|
| **Reviews** | The 10 reviews generated this month |
| **History** | Permanent log of every product ever reviewed |
| **Settings** | Your API key (only needs setting once) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Menu doesn't appear | Refresh the page |
| "No API key found" error | Tap Settings and paste your key into cell B2 |
| "Could not find products" | Space NK may be slow — wait a minute and try again |
| Reviews are too short/long | You can edit any review text directly in the cell before submitting |
