# Vespera Rough Draft CRM

Production-ready rough draft CRM for Vespera with:
- omnichannel inbox (internal chat, email, WhatsApp, Telegram, call logs)
- API adapters for Chatwoot and Helpwise webhooks
- auto-assignment and SLA tracking
- bilingual workflows (English/Spanish), translation endpoint, and AI helper
- Supabase backend (Postgres, Auth, Realtime, RLS) and Vercel deployment

## Live Environment

- App URL: `https://vespera-crm-cloud.vercel.app`
- Frontend/API host: Vercel
- Database/Auth/Realtime: Supabase project `jvmmphjbjcprifzbuify`

## Tech Stack

- Next.js 16 (App Router), TypeScript, React 19
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- CSS-based custom Vespera theme
- Optional LLM provider via OpenAI-compatible API

## Core Features Included

- **CRM Pipeline**: leads, scoring, statuses, activities, dashboard
- **Omnichannel Inbox**:
  - channel-aware rooms (`internal`, `email`, `whatsapp`, `telegram`, `call`)
  - communication event timeline
  - message direction metadata (`inbound`/`outbound`/`system`)
- **Integrations**:
  - `POST /api/webhooks/chatwoot`
  - `POST /api/webhooks/helpwise`
  - generic APIs:
    - `POST /api/inbox/messages`
    - `POST /api/inbox/events`
- **Automation**:
  - inbound message auto-assigns least-loaded sales/support/admin user
  - first-response SLA starts on inbound and resolves on first outbound response
- **Bilingual Ops**:
  - canned responses in EN/ES with channel targeting
  - translation endpoint: `POST /api/inbox/translate`
  - AI helper endpoint: `POST /api/ai/reply`

## Requirements (Business Partner Checklist)

### Accounts and Access

- Supabase owner/admin access
- Vercel project admin access
- Optional:
  - Chatwoot admin for webhook setup
  - Helpwise admin for webhook setup
  - OpenAI or compatible LLM provider account

### Runtime Requirements

- Node.js 20+ recommended
- npm 10+ recommended

### Required Environment Variables

These must be set in Vercel project settings (Production environment):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; required for webhook ingestion)
- `INBOX_API_KEY` (shared secret for API ingestion)
- `DEFAULT_AGENT_USER_ID` (a valid UUID from `public.profiles.id`)
- `CHATWOOT_WEBHOOK_TOKEN` (shared token for Chatwoot webhook)
- `HELPWISE_WEBHOOK_TOKEN` (shared token for Helpwise webhook)

Optional:
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4o-mini`)
- `OPENAI_BASE_URL` (default: `https://api.openai.com/v1`)

Commerce & payments (set when you wire those features; values come from each provider’s dashboard — the repo does not mint real secrets):

- **Shopify** (catalog sync): `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`
- **Polar** (billing): `POLAR_ACCESS_TOKEN`, optional `POLAR_ORGANIZATION_ID`
- **Vendura**: `VENDURA_API_KEY`, optional `VENDURA_API_BASE_URL`
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **Snipcart** (optional duplicate of Integrations UI): `NEXT_PUBLIC_SNIPCART_PUBLIC_API_KEY`

See `.env.example` for the full list. Use `node scripts/generate-secrets.mjs` to generate random strings for *your own* app secrets (e.g. `INBOX_API_KEY`), not for Shopify/Stripe/etc.

## Quick Start (Local)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill values.
3. Run dev server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`.

## Database Notes

Schema includes:
- `profiles`, `leads`, `activities`
- `chat_rooms`, `chat_participants`, `chat_messages`
- `channel_connections`, `communication_events`, `canned_responses`

RLS is enabled on operational tables. Authenticated users can access CRM data as defined by policies.

## Integration Setup

### Chatwoot

- Configure webhook URL:
  - `https://vespera-crm-cloud.vercel.app/api/webhooks/chatwoot`
- Add header token:
  - `x-chatwoot-token: <CHATWOOT_WEBHOOK_TOKEN>`

### Helpwise

- Configure webhook URL:
  - `https://vespera-crm-cloud.vercel.app/api/webhooks/helpwise`
- Add header token:
  - `x-helpwise-token: <HELPWISE_WEBHOOK_TOKEN>`

## Security Notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` client-side.
- Do not commit real secrets to git.
- Rotate webhook/API tokens if shared outside trusted ops channels.

## Deployment

- Vercel production deploy command:
  ```bash
  npx vercel --prod
  ```
- Detailed deployment walkthrough: see `DEPLOY.md`.

## Roadmap Suggestions (Next)

- Per-channel SLA rules (e.g., WhatsApp 5m, Email 60m)
- Language-based routing/assignment
- AI suggested replies from conversation intent
- Outbound channel sending adapters (beyond ingestion)
