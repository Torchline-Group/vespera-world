## Vespera World - Account Handoff

Project path: `C:\Users\user\Vespera World`

### Product scope
Luxury glassmorphic CRM + commerce + client workspace MVP (Next.js + Supabase), focused on Shopify + DS'ers workflows and a one-page client portal.

### Included features
- CRM core: leads/prospects pipeline, status tracking, activity logging
- DS'ers workspace: quick assignment and follow-up actions
- Omnichannel inbox foundations: internal chat, channel/event structures, webhook adapters, ingestion API routes
- Commerce layer: product/catalog model in Supabase, Shopify sync route (credential path + mock fallback), Shopify CSV import/export, Liquid vs Headless storefront mode switch
- Marketplace UI: listing + product detail routes with black/silver/white + rose-gold glass styling
- Client Workspace (one-page portal):
  - Account snapshot
  - Requests/tasks status
  - Forms list + create
  - Signed docs timeline
  - Comms summary
  - Internal acknowledgment signing flow (timestamp/IP/UA capture via API)
- Theme/UX: global design tokens, glass surfaces, expanded sidebar/nav for Commerce/DS'ers/Portal, hierarchy consistency pass

### Stack
- Frontend: Next.js App Router, TypeScript, React
- Backend: Next.js route handlers
- Data/Auth: Supabase (Postgres + Auth)
- Deployment target: Vercel

### Last known status
- Lint passing
- Build passing (with Supabase environment variables present in shell)
- Plan todos completed

### Account migration checklist (Cursor)
1. Commit and push latest code to remote.
2. Zip backup this folder before switching accounts.
3. Sign out of current Cursor account.
4. Sign in with active subscription account (`marcus@torchline.io`).
5. Open this same local folder (or clone from remote).
6. Reconnect account-scoped integrations and auth (MCP/API sessions).
7. Reapply Cursor account-level settings/preferences if needed.

### Notes
- Code and files are local/Git-managed and are not tied to Cursor login.
- Chat history and account-level integration sessions are account-scoped and may not transfer automatically.
