#!/usr/bin/env node
/**
 * Generate random hex strings for app-owned secrets (e.g. INBOX_API_KEY).
 * Third-party keys (Shopify, Stripe, Polar, etc.) must be created in each provider's dashboard.
 */
import crypto from 'node:crypto'

function hex(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex')
}

console.log('Paste these into `.env.local` / Vercel (rotate periodically):\n')
console.log(`INBOX_API_KEY=${hex(24)}`)
console.log(`CHATWOOT_WEBHOOK_TOKEN=${hex(16)}`)
console.log(`HELPWISE_WEBHOOK_TOKEN=${hex(16)}`)
console.log('')
