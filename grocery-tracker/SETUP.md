# Setup Guide

Get the Grocery Tracker running locally and deployed in about 20 minutes.

---

## 1. Get an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / log in
3. Go to **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`)

---

## 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in with GitHub
2. Click **New Project** — name it `grocery-tracker`
3. Choose a region close to you (e.g. London)
4. Wait ~2 minutes for it to spin up
5. Go to **Settings → API** and copy:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public** key
   - **service_role** key (click to reveal)

---

## 3. Set Up the Database

1. In Supabase, go to **SQL Editor**
2. Click **New Query**
3. Open the file `supabase/schema.sql` from this repo
4. Paste the entire contents into the SQL editor
5. Click **Run**

You should see no errors. Your tables are now created.

---

## 4. Create Your Household

After running the schema, run this in the SQL editor too (just once):

```sql
-- Create a household for your home
insert into households (name) values ('Home') returning id;
```

Copy the `id` it returns — you'll need it in step 6.

---

## 5. Set Up Environment Variables

In the `grocery-tracker` folder:

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in the values from steps 1–2.

---

## 6. Run Locally

```bash
cd grocery-tracker
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Sign up with your email. Then in Supabase SQL editor, link your new user to the household:

```sql
-- Replace the email and household ID with your values
update profiles
set household_id = 'paste-household-id-here'
where email = 'your@email.com';
```

Repeat for Immy's email once she signs up.

---

## 7. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**
3. Import your `SmartThingsPublic` repo
4. Set **Root Directory** to `grocery-tracker`
5. Add your environment variables (same as `.env.local`)
6. Click **Deploy**

Your app will be live at `your-project.vercel.app` — works on any phone.

---

## Done!

Both you and Immy can now:
- Open the URL on any phone
- Sign up with your emails
- Start adding receipts
