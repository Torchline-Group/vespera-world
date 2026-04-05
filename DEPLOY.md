# Vespera CRM — Deployment Guide

## Step 1: Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Name it `vespera-crm` and set a strong database password
4. Wait for provisioning (~2 min)
5. Go to **Settings → API** and copy:
   - `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Step 2: Run the Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Paste the entire contents of `supabase-schema.sql` from this repo
4. Click **Run**
5. Verify tables were created under **Table Editor**

## Step 3: Create Your Admin User

1. In Supabase, go to **Authentication → Users**
2. Click **Add User → Create New User**
3. Enter your email and password
4. The `handle_new_user` trigger will auto-create a profile row
5. (Optional) In **Table Editor → profiles**, change your role to `admin`

## Step 4: Update Environment Variables

Edit `.env.local` in this project:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
INBOX_API_KEY=replace-with-long-random-secret
DEFAULT_AGENT_USER_ID=<profiles.id UUID>
CHATWOOT_WEBHOOK_TOKEN=replace-with-random-token
HELPWISE_WEBHOOK_TOKEN=replace-with-random-token

# Optional for AI + translation
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Shopify (Admin API — from Shopify Partners / store admin)
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...

# Polar (polar.sh — organization access token)
POLAR_ACCESS_TOKEN=
POLAR_ORGANIZATION_ID=

# Vendura (set per your provider docs)
VENDURA_API_KEY=
VENDURA_API_BASE_URL=

# Stripe (dashboard → API keys; use test keys in preview)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Step 5: Test Locally

```bash
npm run dev
```
Open http://localhost:3000 and log in with the credentials from Step 3.

**Guest “Skip” on login:** In Supabase go to **Authentication → Providers → Anonymous** and enable it so the login **Skip** button can create a session without email or password.

## Step 6: Deploy to Vercel

```bash
npx vercel
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? (your account)
- Link to existing project? **N** → create new
- Project name: `vespera-crm`
- Root directory: `.` (default)

Then add your env vars:
```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
npx vercel env add INBOX_API_KEY
npx vercel env add DEFAULT_AGENT_USER_ID
npx vercel env add CHATWOOT_WEBHOOK_TOKEN
npx vercel env add HELPWISE_WEBHOOK_TOKEN

# Optional
npx vercel env add OPENAI_API_KEY
npx vercel env add OPENAI_MODEL

# Commerce / billing (as needed)
npx vercel env add SHOPIFY_STORE_DOMAIN
npx vercel env add SHOPIFY_ADMIN_ACCESS_TOKEN
npx vercel env add POLAR_ACCESS_TOKEN
npx vercel env add POLAR_ORGANIZATION_ID
npx vercel env add VENDURA_API_KEY
npx vercel env add VENDURA_API_BASE_URL
npx vercel env add STRIPE_SECRET_KEY
npx vercel env add STRIPE_WEBHOOK_SECRET
npx vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

Deploy to production:
```bash
npx vercel --prod
```

## Step 7: Set Custom Domain (Private)

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard) → your project
2. Go to **Settings → Domains**
3. Add your domain, e.g.: `crm.vesperahq.com` or `crm.yourdomain.com`
4. Follow Vercel's DNS instructions (add CNAME record)
5. SSL is auto-provisioned

## Architecture

```
Browser → Vercel (Next.js SSR/Edge) → Supabase (PostgreSQL + Auth + Realtime)
```

- **Frontend:** Next.js 16 on Vercel (serverless)
- **Database:** Supabase PostgreSQL with Row Level Security
- **Auth:** Supabase Auth (email/password, extensible to OAuth)
- **Real-time chat:** Supabase Realtime (postgres_changes)
- **No connection to vesperahq.com** — fully isolated infrastructure
