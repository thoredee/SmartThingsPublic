# Project Context for Claude

This repo contains two things:
1. Legacy SmartThings device handlers (ignore these — they are not being developed)
2. **Grocery Receipt Tracker** — the active project, located in `/grocery-tracker/`

---

## Grocery Receipt Tracker

### What it is
A shared household grocery intelligence web app for two users: **the owner** and **Immy**.

They shop primarily at **Tesco**. They take a photo of their receipt on their phone, the app reads it using Claude's vision API, and stores all the item data. Over time it builds up a picture of what they buy, when they buy it, how much they spend, and what's likely in the cupboard.

### Users
- Two people sharing a household
- Both need to be able to add receipts from their phones
- Both see the same shared data (one household account)
- Auth via Supabase (email/password or magic link)

### Core Features (in priority order)
1. **Receipt capture** — take photo on phone, Claude extracts items/prices/date/store
2. **Spend tracking** — total spend, by category, over time (week/month/year)
3. **Pantry estimates** — track what's likely in the cupboard based on purchase history and estimated consumption rates
4. **Shopping list** — auto-suggest items running low, allow manual additions
5. **Health insights** — categorise items (fresh, processed, etc.), show nutritional balance trends
6. **Recipe helper** — "can I make X?" based on estimated pantry contents

### Tech Stack
| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) | PWA so works on mobile without app store |
| Styling | Tailwind CSS | |
| Database | Supabase (PostgreSQL) | Free tier, SQL for easy analytics |
| Auth | Supabase Auth | Email/password, shared household login |
| Receipt AI | Anthropic Claude API (claude-claude-sonnet-4-6) | Vision model reads receipt photos |
| Hosting | Vercel | Deploy from GitHub, free tier |

### Environment Variables Needed
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

### Database Schema (Supabase)

**households** — one per family unit
- id, name, created_at

**profiles** — one per user, linked to household
- id (= auth.users.id), household_id, name, email

**receipts** — one per shopping trip
- id, household_id, uploaded_by, store, purchase_date, total_amount, image_url, created_at

**receipt_items** — one row per line item on a receipt
- id, receipt_id, name, quantity, unit, unit_price, total_price, category, created_at

**pantry_items** — estimated current stock
- id, household_id, name, category, estimated_quantity, unit, last_purchased_at, avg_days_between_purchase, updated_at

**shopping_list** — current shopping list
- id, household_id, name, category, quantity, unit, added_by, is_checked, created_at

### Item Categories
- fresh-produce, dairy, meat-fish, bakery, frozen, drinks, snacks, cleaning, personal-care, baby, other

### Project File Structure
```
/grocery-tracker/
  package.json
  next.config.js
  tailwind.config.js
  .env.local.example
  /supabase/
    schema.sql          ← run this in Supabase SQL editor to set up tables
  /src/
    /app/
      layout.tsx        ← root layout, nav
      page.tsx          ← dashboard (spending overview)
      /receipts/
        page.tsx        ← upload a receipt
      /pantry/
        page.tsx        ← what's in the cupboard
      /shopping-list/
        page.tsx        ← current shopping list
      /api/
        /parse-receipt/
          route.ts      ← POST: takes image, calls Claude, returns structured items
    /components/
      Navigation.tsx
      ReceiptUpload.tsx
      SpendChart.tsx
      PantryCard.tsx
    /lib/
      supabase.ts       ← Supabase client (browser + server)
      claude.ts         ← Claude API receipt parsing
    /types/
      index.ts          ← shared TypeScript types
```

### Key Decisions & Reasoning
- **Supabase over Firebase**: SQL makes spending analytics and trend queries much simpler
- **Claude vision for OCR**: More accurate than generic OCR for structured receipt data; can infer categories too
- **PWA not native app**: No app store friction, works on any phone, camera access works via browser
- **Shared household model**: One household_id links both users' data together; no complex permissions needed
- **Pantry as estimates not inventory**: We don't scan barcodes or track usage manually — the app estimates based on purchase frequency and typical consumption patterns

### Setup Instructions (for laptop / first run)
See `/grocery-tracker/SETUP.md` for step-by-step instructions to get running locally and deploy to Vercel.

### Current Status
- [ ] Project scaffolded
- [ ] Receipt upload + Claude parsing working
- [ ] Supabase schema deployed
- [ ] Dashboard built
- [ ] Auth working
- [ ] Deployed to Vercel
- [ ] Pantry estimates
- [ ] Shopping list
- [ ] Health insights
- [ ] Recipe helper
